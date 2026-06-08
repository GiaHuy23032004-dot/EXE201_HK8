import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROADMAP_CREDIT_COST = 3;
const VALID_CATEGORIES = [
  "mind-sports",
  "career-english",
  "modern-sports",
  "barista-beverage",
  "content-speaking",
  "ai-productivity",
] as const;

type CourseCategory = (typeof VALID_CATEGORIES)[number];
type Level = "beginner" | "intermediate" | "advanced" | "unknown";
type PreferredFormat = "online" | "offline" | "any";

type ReserveResult = {
  ok?: boolean;
  success?: boolean;
  usage_log_id?: string | null;
  usageLogId?: string | null;
  id?: string | null;
  reason?: string | null;
  error?: string | null;
  credits_remaining?: number | null;
  creditsRemaining?: number | null;
  ai_credits_remaining?: number | null;
};

type RoadmapCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  rating: number | null;
  review_count: number | null;
  mentor?: { name?: string | null } | null;
};

type LearningProfile = {
  primary_goal?: string | null;
  current_level?: string | null;
  preferred_categories?: string[] | null;
  preferred_format?: PreferredFormat | null;
  budget_min?: number | null;
  budget_max?: number | null;
  location_preference?: string | null;
  schedule_preference?: string | null;
  learning_style?: string | null;
  notes?: string | null;
};

type RoadmapResult = {
  roadmap_title: string;
  goal_summary: string;
  estimated_duration_weeks: number;
  weekly_plan: Array<{
    week: number;
    focus: string;
    tasks: string[];
    suggested_course_ids: string[];
  }>;
  recommended_courses: Array<{
    course_id: string;
    reason: string;
  }>;
  study_tips: string[];
  next_step: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReserveResult(value: unknown) {
  const row = firstRow(value as ReserveResult | ReserveResult[]) ?? {};
  const creditsRemaining = Number(row.credits_remaining ?? row.creditsRemaining ?? row.ai_credits_remaining ?? 0);
  return {
    ok: row.ok === true || row.success === true,
    usageLogId: row.usage_log_id ?? row.usageLogId ?? row.id ?? null,
    reason: row.reason ?? row.error ?? "insufficient_credits",
    creditsRemaining: Number.isFinite(creditsRemaining) ? creditsRemaining : 0,
  };
}

function getServiceSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getAuthedSupabase(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để tạo lộ trình AI." }, 401),
      supabase: null,
      userId: null,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonResponse({ error: true, message: "Supabase environment is not configured." }, 500), supabase: null, userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Phiên đăng nhập không hợp lệ." }, 401),
      supabase: null,
      userId: null,
    };
  }
  return { error: null, supabase, userId: data.user.id };
}

function learningProfileContext(profile: LearningProfile | null) {
  if (!profile) return null;
  return {
    goal: profile.primary_goal?.slice(0, 220) ?? null,
    level: profile.current_level?.slice(0, 80) ?? null,
    preferred_categories: profile.preferred_categories?.slice(0, 3) ?? [],
    preferred_format: profile.preferred_format ?? "any",
    budget_min: profile.budget_min ?? null,
    budget_max: profile.budget_max ?? null,
    location_preference: profile.location_preference?.slice(0, 120) ?? null,
    schedule_preference: profile.schedule_preference?.slice(0, 120) ?? null,
    learning_style: profile.learning_style?.slice(0, 120) ?? null,
    notes: profile.notes?.slice(0, 160) ?? null,
  };
}

async function fetchLearningProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("learner_learning_profiles")
    .select("primary_goal, current_level, preferred_categories, preferred_format, budget_min, budget_max, location_preference, schedule_preference, learning_style, notes")
    .eq("learner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("learner_learning_profiles fetch error:", { message: error.message, code: error.code });
    return null;
  }

  return (data ?? null) as LearningProfile | null;
}

async function isLearnerUser(userId: string) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");
  const { data, error } = await serviceClient.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.role !== "mentor";
}

async function reserveAiUsage(
  supabase: ReturnType<typeof createClient>,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    _feature: "roadmap",
    _credits: ROADMAP_CREDIT_COST,
    _prompt_preview: promptPreview.slice(0, 500),
    _metadata: metadata,
  });
  if (error) throw error;

  const result = normalizeReserveResult(data);
  if (!result.ok) {
    return {
      ok: false,
      usageLogId: null,
      response: jsonResponse(
        {
          error: true,
          code: "AI_CREDIT_REQUIRED",
          reason: result.reason,
          creditsRemaining: result.creditsRemaining,
          upgradeUrl: "/pricing",
        },
        402,
      ),
    };
  }
  return { ok: true, usageLogId: result.usageLogId, response: null };
}

async function finalizeAiUsage(
  supabase: ReturnType<typeof createClient>,
  usageLogId: string | null,
  status: "success" | "failed",
  errorMessage: string | null,
) {
  if (!usageLogId) return;
  const { error } = await supabase.rpc("finalize_ai_usage", {
    _usage_log_id: usageLogId,
    _status: status,
    _error_message: errorMessage,
  });
  if (error) console.error("finalize_ai_usage error:", { message: error.message, code: error.code });
}

async function updateAiUsageMetadata(usageLogId: string | null, metadata: Record<string, unknown>) {
  if (!usageLogId) return;
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;

  const { data: existingLog } = await serviceClient.from("ai_usage_logs").select("metadata").eq("id", usageLogId).maybeSingle();
  const existingMetadata =
    existingLog?.metadata && typeof existingLog.metadata === "object" && !Array.isArray(existingLog.metadata)
      ? existingLog.metadata as Record<string, unknown>
      : {};

  const { error } = await serviceClient
    .from("ai_usage_logs")
    .update({ metadata: { ...existingMetadata, ...metadata } })
    .eq("id", usageLogId);
  if (error) console.error("ai_usage_logs metadata update error:", { message: error.message, code: error.code });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function detectCategory(goal: string): CourseCategory | null {
  const text = normalizeText(goal);
  const rules: Array<[CourseCategory, string[]]> = [
    ["mind-sports", ["co vua", "co tuong", "chess", "chien thuat", "tu duy"]],
    ["career-english", ["tieng anh", "english", "ielts", "toeic", "giao tiep"]],
    ["modern-sports", ["the thao", "yoga", "pickleball", "tennis", "gym", "boi"]],
    ["barista-beverage", ["barista", "ca phe", "coffee", "pha che", "do uong"]],
    ["content-speaking", ["mc", "thuyet trinh", "noi dung", "content", "presentation"]],
    ["ai-productivity", ["ai", "cong cu", "nang suat", "automation", "lap trinh", "coding"]],
  ];
  return rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? null;
}

function firstValidProfileCategory(profile: LearningProfile | null) {
  const preferred = profile?.preferred_categories?.find((value) =>
    VALID_CATEGORIES.includes(value as CourseCategory),
  );
  return preferred ? preferred as CourseCategory : null;
}

function extractKeywords(goal: string) {
  const stopWords = new Set(["toi", "muon", "hoc", "trong", "tuan", "de", "cho", "can", "va", "voi", "mot"]);
  return normalizeText(goal)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 12);
}

function scoreCourse(course: RoadmapCourse, keywords: string[]) {
  const text = normalizeText(`${course.title} ${course.description ?? ""} ${course.category ?? ""}`);
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  return hits * 10 + Number(course.rating ?? 0) * 2 + Math.min(Number(course.review_count ?? 0), 50) / 5;
}

async function fetchCandidateCourses(params: {
  goal: string;
  category: CourseCategory | null;
  preferredFormat: PreferredFormat;
  budget: number | null;
}) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");

  let query = serviceClient
    .from("courses")
    .select("id, title, description, category, format, price, location, rating, review_count, mentor:profiles!courses_mentor_id_fkey(name)")
    .eq("status", "approved")
    .eq("is_hidden", false)
    .order("rating", { ascending: false })
    .limit(40);

  if (params.category) query = query.eq("category", params.category);
  if (params.preferredFormat !== "any") query = query.eq("format", params.preferredFormat);
  if (params.budget && params.budget > 0) query = query.lte("price", params.budget);

  const { data, error } = await query;
  if (error) throw error;

  const keywords = extractKeywords(params.goal);
  return ((data ?? []) as RoadmapCourse[])
    .sort((a, b) => scoreCourse(b, keywords) - scoreCourse(a, keywords))
    .slice(0, 8);
}

function publicCourse(course: RoadmapCourse) {
  return {
    id: course.id,
    title: course.title,
    description: String(course.description ?? "").slice(0, 220),
    category: course.category,
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    mentor_name: course.mentor?.name ?? "Mentor",
  };
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI output is not valid JSON.");
  }
}

function list(value: unknown, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, limit);
}

function clampWeeks(value: unknown, fallback = 8) {
  const weeks = Number(value);
  if (!Number.isFinite(weeks)) return fallback;
  return Math.max(2, Math.min(24, Math.round(weeks)));
}

function fallbackRoadmap(goal: string, durationWeeks: number, courses: RoadmapCourse[], reason?: string): RoadmapResult {
  const planLength = Math.min(durationWeeks, 8);
  const recommendedCourses = courses.slice(0, 3);
  return {
    roadmap_title: "Lộ trình học cá nhân hóa",
    goal_summary: reason
      ? `VET tạo lộ trình dự phòng cho mục tiêu: ${goal}`
      : `Lộ trình giúp bạn tiến gần hơn đến mục tiêu: ${goal}`,
    estimated_duration_weeks: durationWeeks,
    weekly_plan: Array.from({ length: planLength }).map((_, index) => ({
      week: index + 1,
      focus: index === 0 ? "Xác định nền tảng và mục tiêu cụ thể" : `Thực hành và củng cố giai đoạn ${index + 1}`,
      tasks: [
        "Dành 2-3 buổi học ngắn trong tuần.",
        "Ghi lại điểm chưa hiểu để hỏi mentor.",
        "Tự đánh giá tiến độ cuối tuần.",
      ],
      suggested_course_ids: recommendedCourses[index % Math.max(1, recommendedCourses.length)]?.id
        ? [recommendedCourses[index % Math.max(1, recommendedCourses.length)].id]
        : [],
    })),
    recommended_courses: recommendedCourses.map((course) => ({
      course_id: course.id,
      reason: "Khóa học này gần với mục tiêu và bộ lọc bạn nhập.",
    })),
    study_tips: [
      "Giữ lịch học cố định hằng tuần.",
      "Hỏi mentor trước khi đặt lịch nếu bạn chưa chắc trình độ phù hợp.",
      "Đặt mục tiêu nhỏ theo từng tuần thay vì kỳ vọng kết quả ngay.",
    ],
    next_step: recommendedCourses.length
      ? "Chọn một khóa phù hợp nhất và trao đổi với mentor trước khi đặt lịch."
      : "Hãy thử mở rộng danh mục, ngân sách hoặc hình thức học để tìm khóa phù hợp hơn.",
  };
}

function validateRoadmap(raw: unknown, candidates: RoadmapCourse[], fallback: RoadmapResult): RoadmapResult {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const validIds = new Set(candidates.map((course) => course.id));
  const weeks = clampWeeks(payload.estimated_duration_weeks, fallback.estimated_duration_weeks);
  const weeklyRaw = Array.isArray(payload.weekly_plan) ? payload.weekly_plan : [];
  const recommendedRaw = Array.isArray(payload.recommended_courses) ? payload.recommended_courses : [];

  const weekly_plan = weeklyRaw.slice(0, Math.min(weeks, 12)).map((row, index) => {
    const record = row as Record<string, unknown>;
    return {
      week: Number.isFinite(Number(record.week)) ? Number(record.week) : index + 1,
      focus: String(record.focus ?? `Tuần ${index + 1}`).slice(0, 180),
      tasks: list(record.tasks, 5),
      suggested_course_ids: list(record.suggested_course_ids, 4).filter((id) => validIds.has(id)),
    };
  }).filter((row) => row.focus && row.tasks.length);

  const recommended_courses = recommendedRaw.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const id = String(record.course_id ?? "");
    if (!validIds.has(id)) return [];
    return [{ course_id: id, reason: String(record.reason ?? "").slice(0, 240) }];
  }).slice(0, 5);

  if (!weekly_plan.length) throw new Error("AI roadmap is missing weekly plan.");

  return {
    roadmap_title: String(payload.roadmap_title ?? fallback.roadmap_title).slice(0, 160),
    goal_summary: String(payload.goal_summary ?? fallback.goal_summary).slice(0, 600),
    estimated_duration_weeks: weeks,
    weekly_plan,
    recommended_courses,
    study_tips: list(payload.study_tips, 6),
    next_step: String(payload.next_step ?? fallback.next_step).slice(0, 500),
  };
}

function buildPrompt(params: {
  goal: string;
  category: CourseCategory | null;
  level: Level;
  durationWeeks: number;
  preferredFormat: PreferredFormat;
  budget: number | null;
  learningProfile: LearningProfile | null;
  courses: RoadmapCourse[];
}) {
  return `Learner roadmap request:
${JSON.stringify({
    goal: params.goal,
    category: params.category,
    level: params.level,
    duration_weeks: params.durationWeeks,
    preferred_format: params.preferredFormat,
    budget: params.budget,
  })}

Saved learner learning profile, use only as secondary context and never override explicit roadmap request:
${JSON.stringify(learningProfileContext(params.learningProfile))}

Candidate courses from VET database:
${JSON.stringify(params.courses.map(publicCourse))}

Rules:
- Build a learning roadmap only from the learner goal and candidate courses above.
- Do not invent courses. Course IDs in suggested_course_ids and recommended_courses must come from candidates.
- Do not promise guaranteed outcomes, refunds, payment results, medical/legal/financial advice, or unavailable schedules.
- It is okay to include general self-study tasks.
- Respond in Vietnamese.
- Respond only as valid JSON:
{
  "roadmap_title": string,
  "goal_summary": string,
  "estimated_duration_weeks": number,
  "weekly_plan": [
    { "week": number, "focus": string, "tasks": string[], "suggested_course_ids": string[] }
  ],
  "recommended_courses": [
    { "course_id": string, "reason": string }
  ],
  "study_tips": string[],
  "next_step": string
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const goal = String(body.goal ?? "").trim().slice(0, 500);
    if (!goal) return jsonResponse({ error: true, message: "Vui lòng nhập mục tiêu học tập." }, 400);

    const categoryInput = body.category ? String(body.category).trim() : "";
    if (categoryInput && !VALID_CATEGORIES.includes(categoryInput as CourseCategory)) {
      return jsonResponse({ error: true, message: "Danh mục không hợp lệ." }, 400);
    }

    let category = (categoryInput as CourseCategory) || detectCategory(goal);
    const level: Level = ["beginner", "intermediate", "advanced", "unknown"].includes(String(body.level))
      ? body.level
      : "unknown";
    let preferredFormat: PreferredFormat = ["online", "offline", "any"].includes(String(body.preferred_format))
      ? body.preferred_format
      : "any";
    const durationWeeks = clampWeeks(body.duration_weeks, 8);
    let budget = Number.isFinite(Number(body.budget)) && Number(body.budget) > 0 ? Number(body.budget) : null;

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    supabaseForFinalize = supabase;

    if (!(await isLearnerUser(userId))) {
      return jsonResponse({ error: true, code: "LEARNER_REQUIRED", message: "Chỉ learner mới có thể tạo lộ trình AI." }, 403);
    }

    const learningProfile = await fetchLearningProfile(supabase, userId);
    category = category ?? firstValidProfileCategory(learningProfile);
    preferredFormat = preferredFormat !== "any"
      ? preferredFormat
      : learningProfile?.preferred_format === "online" || learningProfile?.preferred_format === "offline"
        ? learningProfile.preferred_format
        : preferredFormat;
    budget = budget ?? learningProfile?.budget_max ?? null;

    const courses = await fetchCandidateCourses({ goal, category, preferredFormat, budget });

    const reservation = await reserveAiUsage(supabase, goal, {
      function: "ai-roadmap",
      feature: "roadmap",
      category,
      provider: "gemini",
      candidate_count: courses.length,
      learning_profile_used: Boolean(learningProfile),
      profile_preferred_categories: learningProfile?.preferred_categories?.slice(0, 3) ?? [],
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const fallback = fallbackRoadmap(goal, durationWeeks, courses);

    try {
      const aiResult = await callAI({
        task: "roadmap",
        modelTier: "main",
        systemPrompt: "Bạn là AI Roadmap của VET. Hãy tạo lộ trình học thực tế, an toàn, không bịa khóa học và không cam kết kết quả.",
        prompt: buildPrompt({ goal, category, level, durationWeeks, preferredFormat, budget, learningProfile, courses }),
        responseMimeType: "application/json",
        maxOutputTokens: 1700,
        temperature: 0.35,
      });

      await finalizeAiUsage(supabase, usageLogId, "success", null);

      try {
        const roadmap = validateRoadmap(parseJson(aiResult.text), courses, fallback);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "roadmap",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: false,
          category,
          candidate_count: courses.length,
          result_summary: roadmap.goal_summary,
        });
        return jsonResponse({ roadmap, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: ROADMAP_CREDIT_COST });
      } catch (parseError) {
        const roadmap = fallbackRoadmap(goal, durationWeeks, courses, parseError instanceof Error ? parseError.message : "invalid_ai_output");
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "roadmap",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: true,
          fallback_reason: parseError instanceof Error ? parseError.message : "invalid_ai_output",
          category,
          candidate_count: courses.length,
          result_summary: roadmap.goal_summary,
        });
        return jsonResponse({ roadmap, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: ROADMAP_CREDIT_COST, fallback: true });
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI provider error";
      console.error("ai-roadmap provider error:", message);
      await finalizeAiUsage(supabase, usageLogId, "failed", message);
      await updateAiUsageMetadata(usageLogId, {
        task: "roadmap",
        fallback: true,
        fallback_reason: "ai_error",
        category,
        candidate_count: courses.length,
        result_summary: "AI Roadmap gặp lỗi, credit sẽ được hoàn qua hệ thống.",
      });
      return jsonResponse({ error: true, message: "Không thể tạo lộ trình AI lúc này. Credit sẽ được hoàn nếu AI gặp lỗi.", credit_refunded: true }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI Roadmap error";
    console.error("ai-roadmap error:", message);
    if (supabaseForFinalize && usageLogId) await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    return jsonResponse({ error: true, message: "Không thể tạo lộ trình AI lúc này. Vui lòng thử lại sau." }, 500);
  }
});
