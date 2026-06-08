import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COMPARE_CREDIT_COST = 2;

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

type CompareCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  rating: number | null;
  review_count: number | null;
  status: string | null;
  is_hidden?: boolean | null;
  mentor?: { name?: string | null } | null;
  course_schedules?: Array<{ day_of_week?: string | null; start_time?: string | null; end_time?: string | null }> | null;
};

type LearningProfile = {
  primary_goal?: string | null;
  current_level?: string | null;
  preferred_categories?: string[] | null;
  preferred_format?: "online" | "offline" | "any" | null;
  budget_min?: number | null;
  budget_max?: number | null;
  location_preference?: string | null;
  schedule_preference?: string | null;
  learning_style?: string | null;
  notes?: string | null;
};

type CompareResult = {
  summary: string;
  best_choice_course_id: string | null;
  comparison_table: Array<{
    criterion: string;
    course_values: Array<{ course_id: string; value: string }>;
  }>;
  course_analysis: Array<{
    course_id: string;
    strengths: string[];
    weaknesses: string[];
    best_for: string;
  }>;
  recommendation: string;
  questions_to_ask_mentor: string[];
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
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để dùng AI Compare." }, 401),
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
    _feature: "compare",
    _credits: COMPARE_CREDIT_COST,
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

function summarizeSchedule(course: CompareCourse) {
  const schedules = course.course_schedules ?? [];
  if (!schedules.length) return null;
  return schedules
    .slice(0, 3)
    .map((schedule) => `${schedule.day_of_week ?? ""} ${schedule.start_time ?? ""}-${schedule.end_time ?? ""}`.trim())
    .filter(Boolean)
    .join(", ");
}

function publicCourse(course: CompareCourse) {
  return {
    id: course.id,
    title: course.title,
    description: String(course.description ?? "").slice(0, 260),
    category: course.category,
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    mentor_name: course.mentor?.name ?? "Mentor",
    schedule_summary: summarizeSchedule(course),
  };
}

async function fetchCourses(courseIds: string[]) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");

  const { data, error } = await serviceClient
    .from("courses")
    .select(`
      id, title, description, category, format, price, location, rating, review_count, status, is_hidden,
      mentor:profiles!courses_mentor_id_fkey(name),
      course_schedules(day_of_week, start_time, end_time)
    `)
    .in("id", courseIds)
    .eq("status", "approved")
    .eq("is_hidden", false);

  if (error) throw error;
  const courses = (data ?? []) as CompareCourse[];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return courseIds.map((id) => courseById.get(id)).filter(Boolean) as CompareCourse[];
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

function list(value: unknown, limit = 4) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, limit);
}

function fallbackCompare(courses: CompareCourse[], reason?: string): CompareResult {
  const sorted = [...courses].sort((a, b) => {
    const ratingDiff = Number(b.rating ?? 0) - Number(a.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(a.price ?? 0) - Number(b.price ?? 0);
  });
  const best = sorted[0] ?? null;

  return {
    summary: reason
      ? "AI chưa trả về kết quả hợp lệ nên VET dùng bảng so sánh dự phòng dựa trên dữ liệu khóa học."
      : "So sánh dựa trên giá, hình thức học, đánh giá, số review và lịch học hiện có.",
    best_choice_course_id: best?.id ?? null,
    comparison_table: [
      {
        criterion: "Học phí",
        course_values: courses.map((course) => ({ course_id: course.id, value: `${Number(course.price ?? 0).toLocaleString("vi-VN")}đ/buổi` })),
      },
      {
        criterion: "Hình thức",
        course_values: courses.map((course) => ({ course_id: course.id, value: course.format === "online" ? "Online" : "Offline" })),
      },
      {
        criterion: "Đánh giá",
        course_values: courses.map((course) => ({ course_id: course.id, value: `${Number(course.rating ?? 0)}/5 (${Number(course.review_count ?? 0)} review)` })),
      },
      {
        criterion: "Lịch học",
        course_values: courses.map((course) => ({ course_id: course.id, value: summarizeSchedule(course) || "Chưa có lịch cố định" })),
      },
    ],
    course_analysis: courses.map((course) => ({
      course_id: course.id,
      strengths: [
        course.format === "online" ? "Linh hoạt học online." : "Có trải nghiệm học trực tiếp.",
        Number(course.rating ?? 0) > 0 ? `Có điểm đánh giá ${Number(course.rating ?? 0)}/5.` : "Có thể trao đổi thêm với mentor trước khi đặt.",
      ],
      weaknesses: [
        summarizeSchedule(course) ? "Cần kiểm tra lịch có khớp thời gian cá nhân không." : "Chưa có nhiều thông tin lịch học.",
      ],
      best_for: "Learner muốn cân nhắc dựa trên dữ liệu hiện có trước khi đặt lịch.",
    })),
    recommendation: best
      ? `Nếu phải chọn một khóa dựa trên dữ liệu hiện tại, hãy ưu tiên "${best.title}", nhưng nên hỏi mentor thêm trước khi quyết định.`
      : "Hãy xem lại thông tin từng khóa và hỏi mentor thêm trước khi đặt lịch.",
    questions_to_ask_mentor: [
      "Khóa này phù hợp với trình độ hiện tại của tôi không?",
      "Lịch học có thể linh hoạt nếu tôi bận không?",
      "Tôi nên chuẩn bị gì trước buổi đầu?",
    ],
  };
}

function validateCompare(raw: unknown, courses: CompareCourse[]): CompareResult {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const validIds = new Set(courses.map((course) => course.id));
  const best = String(payload.best_choice_course_id ?? "");
  const comparisonRows = Array.isArray(payload.comparison_table) ? payload.comparison_table : [];
  const analysisRows = Array.isArray(payload.course_analysis) ? payload.course_analysis : [];

  const comparison_table = comparisonRows.slice(0, 8).map((row) => {
    const record = row as Record<string, unknown>;
    const values = Array.isArray(record.course_values) ? record.course_values : [];
    return {
      criterion: String(record.criterion ?? "Tiêu chí").slice(0, 120),
      course_values: values.flatMap((item) => {
        const valueRecord = item as Record<string, unknown>;
        const id = String(valueRecord.course_id ?? "");
        if (!validIds.has(id)) return [];
        return [{ course_id: id, value: String(valueRecord.value ?? "").slice(0, 240) }];
      }),
    };
  }).filter((row) => row.course_values.length);

  const course_analysis = analysisRows.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const id = String(record.course_id ?? "");
    if (!validIds.has(id)) return [];
    return [{
      course_id: id,
      strengths: list(record.strengths),
      weaknesses: list(record.weaknesses),
      best_for: String(record.best_for ?? "").slice(0, 240),
    }];
  });

  if (!comparison_table.length || !course_analysis.length) throw new Error("AI comparison is incomplete.");

  return {
    summary: String(payload.summary ?? "AI đã so sánh các khóa học bạn chọn.").slice(0, 600),
    best_choice_course_id: validIds.has(best) ? best : null,
    comparison_table,
    course_analysis,
    recommendation: String(payload.recommendation ?? "Hãy chọn khóa phù hợp nhất với mục tiêu, lịch học và ngân sách của bạn.").slice(0, 600),
    questions_to_ask_mentor: list(payload.questions_to_ask_mentor),
  };
}

function buildPrompt(courses: CompareCourse[], context: Record<string, unknown>, learningProfile: LearningProfile | null) {
  return `Learner comparison context:
${JSON.stringify(context)}

Saved learner learning profile, use only as secondary context and never override explicit comparison context:
${JSON.stringify(learningProfileContext(learningProfile))}

Courses from VET database:
${JSON.stringify(courses.map(publicCourse))}

Rules:
- Only compare course IDs listed above.
- Do not invent price, schedule, mentor, reviews, slots, outcomes, refunds, or payment policies.
- If no course is clearly best, best_choice_course_id may be null.
- Respond in Vietnamese.
- Respond only as valid JSON:
{
  "summary": string,
  "best_choice_course_id": string | null,
  "comparison_table": [
    { "criterion": string, "course_values": [{ "course_id": string, "value": string }] }
  ],
  "course_analysis": [
    { "course_id": string, "strengths": string[], "weaknesses": string[], "best_for": string }
  ],
  "recommendation": string,
  "questions_to_ask_mentor": string[]
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const courseIds = Array.from(new Set((Array.isArray(body.course_ids) ? body.course_ids : []).map((id) => String(id).trim()).filter(Boolean)));
    if (courseIds.length < 2 || courseIds.length > 3) {
      return jsonResponse({ error: true, message: "Vui lòng chọn từ 2 đến 3 khóa học để so sánh." }, 400);
    }

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    supabaseForFinalize = supabase;

    if (!(await isLearnerUser(userId))) {
      return jsonResponse({ error: true, code: "LEARNER_REQUIRED", message: "Chỉ learner mới có thể dùng AI Compare." }, 403);
    }

    const learningProfile = await fetchLearningProfile(supabase, userId);
    const courses = await fetchCourses(courseIds);
    if (courses.length !== courseIds.length) {
      return jsonResponse({ error: true, code: "COURSE_NOT_AVAILABLE", message: "Một hoặc nhiều khóa học chưa sẵn sàng để so sánh." }, 404);
    }

    const context = {
      learner_goal: String(body.learner_goal ?? "").trim().slice(0, 240) || null,
      learner_level: String(body.learner_level ?? "").trim().slice(0, 80) || null,
      preferred_format: ["online", "offline", "any"].includes(String(body.preferred_format)) ? body.preferred_format : "any",
      budget: Number.isFinite(Number(body.budget)) ? Number(body.budget) : null,
    };

    const reservation = await reserveAiUsage(supabase, courses.map((course) => course.title).join(" vs "), {
      function: "ai-compare",
      feature: "compare",
      course_ids: courseIds,
      provider: "gemini",
      learning_profile_used: Boolean(learningProfile),
      profile_preferred_categories: learningProfile?.preferred_categories?.slice(0, 3) ?? [],
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    try {
      const aiResult = await callAI({
        task: "compare",
        modelTier: "main",
        systemPrompt: "Bạn là AI Compare của VET. Chỉ so sánh các khóa học thật được backend cung cấp, không bịa dữ liệu và không cam kết kết quả học tập.",
        prompt: buildPrompt(courses, context, learningProfile),
        responseMimeType: "application/json",
        maxOutputTokens: 1400,
        temperature: 0.3,
      });

      await finalizeAiUsage(supabase, usageLogId, "success", null);

      try {
        const comparison = validateCompare(parseJson(aiResult.text), courses);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "compare",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: false,
          course_ids: courseIds,
          result_summary: comparison.summary,
        });
        return jsonResponse({ comparison, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: COMPARE_CREDIT_COST });
      } catch (parseError) {
        const comparison = fallbackCompare(courses, parseError instanceof Error ? parseError.message : "invalid_ai_output");
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "compare",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: true,
          fallback_reason: parseError instanceof Error ? parseError.message : "invalid_ai_output",
          course_ids: courseIds,
          result_summary: comparison.summary,
        });
        return jsonResponse({ comparison, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: COMPARE_CREDIT_COST, fallback: true });
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI provider error";
      console.error("ai-compare provider error:", message);
      await finalizeAiUsage(supabase, usageLogId, "failed", message);
      await updateAiUsageMetadata(usageLogId, {
        task: "compare",
        fallback: true,
        fallback_reason: "ai_error",
        course_ids: courseIds,
        result_summary: "AI Compare gặp lỗi, credit sẽ được hoàn qua hệ thống.",
      });
      return jsonResponse({ error: true, message: "Không thể dùng AI Compare lúc này. Credit sẽ được hoàn nếu AI gặp lỗi.", credit_refunded: true }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI Compare error";
    console.error("ai-compare error:", message);
    if (supabaseForFinalize && usageLogId) await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    return jsonResponse({ error: true, message: "Không thể dùng AI Compare lúc này. Vui lòng thử lại sau." }, 500);
  }
});
