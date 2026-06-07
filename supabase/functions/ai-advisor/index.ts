import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADVISOR_CREDIT_COST = 1;

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

type LearnerContext = {
  goal?: string;
  level?: string;
  budget?: number;
  preferred_format?: "online" | "offline" | "any";
  schedule_preference?: string;
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

type CourseRow = {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  meeting_link?: string | null;
  rating: number | null;
  review_count: number | null;
  students_count: number | null;
  start_date?: string | null;
  status: string | null;
  is_hidden?: boolean | null;
};

type MentorProfile = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  mentor_headline?: string | null;
  teaching_fields?: string[] | null;
  experience_years?: number | null;
  city?: string | null;
};

type CourseSchedule = {
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
};

type AdvisorResult = {
  summary: string;
  fit_level: "high" | "medium" | "low";
  fit_score: number;
  why_fit: string[];
  concerns: string[];
  recommended_next_step: string;
  questions_to_ask_mentor: string[];
  booking_advice: string;
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
  const creditsRemaining = Number(
    row.credits_remaining ?? row.creditsRemaining ?? row.ai_credits_remaining ?? 0,
  );

  return {
    ok: row.ok === true || row.success === true,
    usageLogId: row.usage_log_id ?? row.usageLogId ?? row.id ?? null,
    reason: row.reason ?? row.error ?? "insufficient_credits",
    creditsRemaining: Number.isFinite(creditsRemaining) ? creditsRemaining : 0,
  };
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeFitLevel(value: unknown, score: number): AdvisorResult["fit_level"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function sanitizeString(value: unknown, fallback: string, maxLength = 500) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function sanitizeStringArray(value: unknown, fallback: string[], limit = 4) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 220))
    .slice(0, limit);
  return items.length ? items : fallback;
}

function stripJsonFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAiJson(text: string) {
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI output is not valid JSON.");
  }
}

function validateAdvisorResult(raw: unknown, fallbackText: string): AdvisorResult {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const fitScore = clampScore(payload.fit_score);

  return {
    summary: sanitizeString(payload.summary, fallbackText, 600),
    fit_level: normalizeFitLevel(payload.fit_level, fitScore),
    fit_score: fitScore,
    why_fit: sanitizeStringArray(payload.why_fit, ["Khóa học có thông tin phù hợp để bạn cân nhắc trước khi đặt lịch."]),
    concerns: sanitizeStringArray(payload.concerns, ["Bạn nên hỏi mentor thêm về lịch học, mục tiêu và kỳ vọng trước khi đặt lịch."]),
    recommended_next_step: sanitizeString(
      payload.recommended_next_step,
      "Trao đổi thêm với mentor hoặc đặt lịch nếu thông tin hiện tại phù hợp với nhu cầu của bạn.",
      300,
    ),
    questions_to_ask_mentor: sanitizeStringArray(payload.questions_to_ask_mentor, [
      "Khóa học này phù hợp với trình độ hiện tại của tôi không?",
      "Tôi cần chuẩn bị gì trước buổi học đầu tiên?",
    ]),
    booking_advice: sanitizeString(
      payload.booking_advice,
      "Bạn có thể đặt lịch nếu mục tiêu, ngân sách và lịch học đều phù hợp. AI chỉ hỗ trợ tham khảo, quyết định cuối cùng vẫn nên dựa trên trao đổi với mentor.",
      400,
    ),
  };
}

function buildFallbackAdvisor(course: CourseRow, rawText?: string): AdvisorResult {
  const score = Number(course.rating ?? 0) >= 4 ? 70 : 60;
  return {
    summary:
      rawText?.slice(0, 600) ||
      `AI chưa trả về JSON hợp lệ, nhưng khóa "${course.title}" có thể được cân nhắc dựa trên mô tả, hình thức học, giá và đánh giá đang có.`,
    fit_level: normalizeFitLevel(null, score),
    fit_score: score,
    why_fit: [
      course.format === "online" ? "Khóa học hỗ trợ học online." : "Khóa học có hình thức học trực tiếp.",
      `Học phí hiện hiển thị là ${Number(course.price ?? 0).toLocaleString("vi-VN")}đ/buổi.`,
    ],
    concerns: [
      "AI không thấy toàn bộ kỳ vọng cá nhân của bạn, nên hãy hỏi mentor thêm trước khi đặt lịch.",
      "Không nên xem đây là cam kết kết quả học tập.",
    ],
    recommended_next_step: "Hỏi mentor thêm 1-2 câu về trình độ đầu vào và lịch học trước khi đặt lịch.",
    questions_to_ask_mentor: [
      "Khóa này phù hợp với người mới hay cần nền tảng trước?",
      "Tôi nên chuẩn bị gì trước buổi đầu?",
      "Lịch học có linh hoạt nếu tôi bận không?",
    ],
    booking_advice: "Nếu lịch, giá và mục tiêu học phù hợp, bạn có thể tiếp tục đặt lịch. Nếu còn phân vân, hãy nhắn mentor trước.",
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
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để dùng AI Advisor." }, 401),
      supabase: null,
      userId: null,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: jsonResponse({ error: true, message: "Supabase environment is not configured." }, 500),
      supabase: null,
      userId: null,
    };
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

async function reserveAiUsage(
  supabase: ReturnType<typeof createClient>,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    feature: "advisor",
    credits: ADVISOR_CREDIT_COST,
    prompt_preview: promptPreview.slice(0, 500),
    metadata,
  });

  if (error) throw error;

  const result = normalizeReserveResult(data);
  if (!result.ok) {
    return {
      ok: false,
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
      usageLogId: null,
    };
  }

  return { ok: true, response: null, usageLogId: result.usageLogId };
}

async function finalizeAiUsage(
  supabase: ReturnType<typeof createClient>,
  usageLogId: string | null,
  status: "success" | "failed",
  errorMessage: string | null,
) {
  if (!usageLogId) return;
  const { error } = await supabase.rpc("finalize_ai_usage", {
    usage_log_id: usageLogId,
    status,
    error_message: errorMessage,
  });
  if (error) {
    console.error("finalize_ai_usage error:", {
      message: error.message,
      code: error.code,
    });
  }
}

async function updateAiUsageMetadata(usageLogId: string | null, metadata: Record<string, unknown>) {
  if (!usageLogId) return;
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;

  const { data: existingLog } = await serviceClient
    .from("ai_usage_logs")
    .select("metadata")
    .eq("id", usageLogId)
    .maybeSingle();
  const existingMetadata =
    existingLog?.metadata && typeof existingLog.metadata === "object" && !Array.isArray(existingLog.metadata)
      ? existingLog.metadata as Record<string, unknown>
      : {};

  const { error } = await serviceClient
    .from("ai_usage_logs")
    .update({ metadata: { ...existingMetadata, ...metadata } })
    .eq("id", usageLogId);

  if (error) {
    console.error("ai_usage_logs metadata update error:", {
      message: error.message,
      code: error.code,
    });
  }
}

async function fetchAdvisorCourse(courseId: string) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data: course, error: courseError } = await serviceClient
    .from("courses")
    .select(`
      id, mentor_id, title, description, category, format, price, location,
      meeting_link, rating, review_count, students_count, start_date, status, is_hidden
    `)
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return null;

  const courseRow = course as CourseRow;
  if (courseRow.status !== "approved" || courseRow.is_hidden === true) return null;

  const [{ data: mentor }, { data: schedules }] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("user_id, name, avatar_url, mentor_headline, teaching_fields, experience_years, city")
      .eq("user_id", courseRow.mentor_id)
      .maybeSingle(),
    serviceClient
      .from("course_schedules")
      .select("day_of_week, start_time, end_time")
      .eq("course_id", courseRow.id)
      .order("day_of_week", { ascending: true }),
  ]);

  return {
    course: courseRow,
    mentor: (mentor ?? null) as MentorProfile | null,
    schedules: (schedules ?? []) as CourseSchedule[],
  };
}

async function isLearnerUser(userId: string) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");

  const { data, error } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role !== "mentor";
}

function sanitizeLearnerContext(value: unknown): LearnerContext | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const budget = Number(record.budget);
  const preferredFormat = record.preferred_format;

  return {
    goal: record.goal ? String(record.goal).trim().slice(0, 200) : undefined,
    level: record.level ? String(record.level).trim().slice(0, 80) : undefined,
    budget: Number.isFinite(budget) && budget >= 0 ? budget : undefined,
    preferred_format:
      preferredFormat === "online" || preferredFormat === "offline" || preferredFormat === "any"
        ? preferredFormat
        : undefined,
    schedule_preference: record.schedule_preference
      ? String(record.schedule_preference).trim().slice(0, 160)
      : undefined,
  };
}

function buildCoursePayload(course: CourseRow, mentor: MentorProfile | null, schedules: CourseSchedule[]) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    online_has_meeting_link: course.format === "online" ? Boolean(course.meeting_link) : undefined,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    students_count: Number(course.students_count ?? 0),
    start_date: course.start_date ?? null,
    mentor: {
      name: mentor?.name ?? "Mentor",
      mentor_headline: mentor?.mentor_headline ?? null,
      teaching_fields: mentor?.teaching_fields ?? [],
      experience_years: mentor?.experience_years ?? null,
      city: mentor?.city ?? null,
    },
    schedules: schedules.map((schedule) => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    })),
  };
}

function buildAdvisorPrompt({
  question,
  learnerContext,
  learningProfile,
  coursePayload,
}: {
  question: string;
  learnerContext: LearnerContext | null;
  learningProfile: LearningProfile | null;
  coursePayload: Record<string, unknown>;
}) {
  return `Learner question:
${question || "Learner wants to know whether this course is suitable before booking."}

Learner context:
${JSON.stringify(learnerContext ?? {})}

Saved learner learning profile, use only as secondary context and never override the direct question:
${JSON.stringify(learningProfileContext(learningProfile))}

Course data from VET database:
${JSON.stringify(coursePayload)}

Rules:
- Advise only from the course data above. Do not invent price, schedules, slots, mentor details, reviews, or outcomes.
- Do not expose private online meeting links. You may say the course is online if format is online.
- Do not promise learning results, refunds, payment outcomes, or booking confirmation.
- Do not give medical, legal, or financial advice outside learning/booking decision support.
- If the course may not fit, say so clearly and suggest what to ask the mentor.
- Respond in Vietnamese.
- Respond only as a valid JSON object in this exact shape:
{
  "summary": string,
  "fit_level": "high" | "medium" | "low",
  "fit_score": number,
  "why_fit": string[],
  "concerns": string[],
  "recommended_next_step": string,
  "questions_to_ask_mentor": string[],
  "booking_advice": string
}`;
}

function publicCourseResponse(course: CourseRow, mentor: MentorProfile | null, schedules: CourseSchedule[]) {
  return {
    id: course.id,
    title: course.title,
    category: course.category,
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    mentor_name: mentor?.name ?? "Mentor",
    schedule_count: schedules.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const courseId = String(body.course_id ?? "").trim();
    const question = String(body.question ?? "").trim().slice(0, 800);
    const learnerContext = sanitizeLearnerContext(body.learner_context);

    if (!courseId) {
      return jsonResponse({ error: true, message: "Thiếu course_id." }, 400);
    }

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) {
      return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    }
    supabaseForFinalize = supabase;

    if (!(await isLearnerUser(userId))) {
      return jsonResponse(
        { error: true, code: "LEARNER_REQUIRED", message: "Chỉ learner mới có thể dùng AI Advisor trước booking." },
        403,
      );
    }

    const learningProfile = await fetchLearningProfile(supabase, userId);
    const advisorCourse = await fetchAdvisorCourse(courseId);
    if (!advisorCourse) {
      return jsonResponse(
        { error: true, code: "COURSE_NOT_AVAILABLE", message: "Khóa học này chưa sẵn sàng để AI tư vấn." },
        404,
      );
    }

    const { course, mentor, schedules } = advisorCourse;
    const promptPreview = question || course.title;

    const reservation = await reserveAiUsage(supabase, promptPreview, {
      function: "ai-advisor",
      feature: "advisor",
      course_id: course.id,
      provider: "gemini",
      learning_profile_used: Boolean(learningProfile),
      profile_preferred_categories: learningProfile?.preferred_categories?.slice(0, 3) ?? [],
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const coursePayload = buildCoursePayload(course, mentor, schedules);

    try {
      const aiResult = await callAI({
        task: "advisor",
        modelTier: "fast",
        systemPrompt:
          "Bạn là AI Advisor của VET, hỗ trợ learner quyết định có nên đặt lịch một khóa học cụ thể hay không. Luôn trung thực, thận trọng, không bịa dữ liệu và chỉ dùng dữ liệu khóa học do backend cung cấp.",
        prompt: buildAdvisorPrompt({ question, learnerContext, learningProfile, coursePayload }),
        responseMimeType: "application/json",
        maxOutputTokens: 900,
        temperature: 0.35,
      });

      await finalizeAiUsage(supabase, usageLogId, "success", null);

      try {
        const parsed = parseAiJson(aiResult.text);
        const advisor = validateAdvisorResult(parsed, buildFallbackAdvisor(course).summary);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          task: "advisor",
          course_id: course.id,
          fallback: false,
          result_summary: advisor.summary,
        });

        return jsonResponse({
          advisor,
          course: publicCourseResponse(course, mentor, schedules),
          provider: aiResult.provider,
          model: aiResult.model,
          credit_cost: ADVISOR_CREDIT_COST,
        });
      } catch (parseError) {
        const advisor = buildFallbackAdvisor(course, aiResult.text);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          task: "advisor",
          course_id: course.id,
          fallback: true,
          fallback_reason: parseError instanceof Error ? parseError.message : "invalid_ai_output",
          result_summary: advisor.summary,
        });

        return jsonResponse({
          advisor,
          course: publicCourseResponse(course, mentor, schedules),
          provider: aiResult.provider,
          model: aiResult.model,
          credit_cost: ADVISOR_CREDIT_COST,
          fallback: true,
        });
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI provider error";
      console.error("ai-advisor provider error:", message);
      await finalizeAiUsage(supabase, usageLogId, "failed", message);
      await updateAiUsageMetadata(usageLogId, {
        task: "advisor",
        course_id: course.id,
        fallback: true,
        fallback_reason: "ai_error",
        result_summary: "AI Advisor gặp lỗi, credit sẽ được hoàn qua hệ thống.",
      });
      return jsonResponse(
        {
          error: true,
          message: "Không thể dùng AI Advisor lúc này. Credit sẽ được hoàn nếu AI gặp lỗi.",
          credit_refunded: true,
        },
        500,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI Advisor error";
    console.error("ai-advisor error:", message);
    if (supabaseForFinalize && usageLogId) {
      await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    }
    return jsonResponse(
      {
        error: true,
        message: "Không thể dùng AI Advisor lúc này. Vui lòng thử lại sau.",
      },
      500,
    );
  }
});
