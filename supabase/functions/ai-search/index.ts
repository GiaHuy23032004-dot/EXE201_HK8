import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type CallAIResult } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const aiCreditCosts = {
  course_match: 1,
  advisor: 1,
  search: 1,
  chat: 1,
  compare: 2,
  roadmap: 3,
} as const;

const validCategories = [
  "mind-sports",
  "career-english",
  "modern-sports",
  "barista-beverage",
  "content-speaking",
  "ai-productivity",
] as const;

type CourseCategory = (typeof validCategories)[number];
type AiFeature = keyof typeof aiCreditCosts;
type DetectedFormat = "online" | "offline" | "any";

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

type CourseRow = {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  students_count: number | null;
  is_promoted?: boolean | null;
  mentor?: { name?: string | null; avatar_url?: string | null; user_id?: string | null } | null;
  course_schedules?: Array<{ day_of_week?: string | null; start_time?: string | null; end_time?: string | null }> | null;
};

type CourseCandidate = {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  format: "online" | "offline";
  price: number;
  location: string | null;
  image_url: string | null;
  rating: number;
  review_count: number;
  students_count: number;
  is_promoted: boolean;
  mentor_name: string;
  mentor_avatar: string | null;
  schedule_summary: string | null;
  score: number;
};

type ParsedNeed = {
  category: CourseCategory | null;
  format: DetectedFormat;
  budget: number | null;
  location: string | null;
  schedulePreference: string | null;
  keywords: string[];
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

type AiRecommendation = {
  course_id: string;
  match_score: number;
  reason: string;
  pros: string[];
  considerations: string[];
  course: {
    id: string;
    title: string;
    mentorName: string;
    mentorAvatar: string;
    price: number;
    rating: number;
    reviewCount: number;
    image: string;
    category: CourseCategory;
    format: "online" | "offline";
    location?: string;
    studentsCount: number;
    promoted: boolean;
  };
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

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeCategory(value: unknown): CourseCategory {
  const normalized = normalizeText(value).replace(/[_\s]+/g, "-");
  if ((validCategories as readonly string[]).includes(normalized)) return normalized as CourseCategory;

  if (["chess", "board-game", "co", "cờ"].includes(normalized)) return "mind-sports";
  if (["english", "language", "ngoai-ngu", "tieng-anh"].includes(normalized)) return "career-english";
  if (["sport", "sports", "fitness", "yoga", "pickleball", "tennis"].includes(normalized)) return "modern-sports";
  if (["barista", "beverage", "coffee", "cooking", "food"].includes(normalized)) return "barista-beverage";
  if (["content", "speaking", "presentation", "mc", "thuyet-trinh"].includes(normalized)) return "content-speaking";
  return "ai-productivity";
}

function resolveFeature(type: unknown): AiFeature {
  const value = String(type ?? "course_match");
  if (value === "search") return "search";
  if (value === "course_match" || value === "recommend") return "course_match";
  return "course_match";
}

function parseBudget(text: string) {
  const normalized = normalizeText(text).replace(/,/g, ".");
  const millionMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(trieu|million|m)\b/);
  if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);

  const thousandMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(k|nghin|ngan)\b/);
  if (thousandMatch) return Math.round(Number(thousandMatch[1]) * 1_000);

  const moneyMatches = normalized.match(/\d[\d.\s]{4,}/g) ?? [];
  for (const match of moneyMatches) {
    const amount = Number(match.replace(/[.\s]/g, ""));
    if (Number.isFinite(amount) && amount >= 50_000) return amount;
  }

  return null;
}

function detectCategory(text: string): CourseCategory | null {
  const normalized = normalizeText(text);
  const rules: Array<[CourseCategory, string[]]> = [
    ["mind-sports", ["co vua", "co tuong", "chess", "tu duy chien thuat", "chien thuat"]],
    ["career-english", ["tieng anh", "ielts", "toeic", "giao tiep", "english", "cong viec"]],
    ["modern-sports", ["the thao", "yoga", "pickleball", "tennis", "boi", "gym", "fitness"]],
    ["barista-beverage", ["barista", "ca phe", "coffee", "do uong", "pha che", "bartender"]],
    ["content-speaking", ["mc", "thuyet trinh", "noi dung", "content", "presentation", "noi truoc dam dong"]],
    ["ai-productivity", ["ai", "automation", "tu dong hoa", "cong cu", "nang suat", "lap trinh", "coding"]],
  ];

  return rules.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? null;
}

function detectFormat(text: string): DetectedFormat {
  const normalized = normalizeText(text);
  if (/\b(online|zoom|remote|truc tuyen)\b/.test(normalized)) return "online";
  if (/\b(offline|truc tiep|tai lop|gan toi|gan nha)\b/.test(normalized)) return "offline";
  return "any";
}

function extractKeywords(text: string) {
  const stopWords = new Set([
    "toi",
    "muon",
    "hoc",
    "can",
    "tim",
    "khoa",
    "lop",
    "duoi",
    "tren",
    "vao",
    "buoi",
    "va",
    "voi",
    "cho",
    "mot",
    "cac",
  ]);

  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 12);
}

function parseNeed(query: string, filters: Record<string, unknown>): ParsedNeed {
  const filterCategory = filters.category ? normalizeCategory(filters.category) : null;
  const filterFormat = filters.format === "online" || filters.format === "offline" ? filters.format : null;
  const budgetFromFilter = Number(filters.budget ?? filters.maxPrice);
  const budget = Number.isFinite(budgetFromFilter) && budgetFromFilter > 0 ? budgetFromFilter : parseBudget(query);

  return {
    category: filterCategory ?? detectCategory(query),
    format: filterFormat ?? detectFormat(query),
    budget,
    location: String(filters.location ?? "").trim() || null,
    schedulePreference: String(filters.schedulePreference ?? "").trim() || null,
    keywords: extractKeywords(query),
  };
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

function applyLearningProfileToNeed(need: ParsedNeed, profile: LearningProfile | null): ParsedNeed {
  if (!profile) return need;
  const preferredCategory = profile.preferred_categories?.find(Boolean);
  return {
    ...need,
    category: need.category ?? (preferredCategory ? normalizeCategory(preferredCategory) : null),
    format: need.format !== "any"
      ? need.format
      : profile.preferred_format === "online" || profile.preferred_format === "offline"
        ? profile.preferred_format
        : need.format,
    budget: need.budget ?? profile.budget_max ?? null,
    location: need.location ?? profile.location_preference ?? null,
    schedulePreference: need.schedulePreference ?? profile.schedule_preference ?? null,
  };
}

function summarizeSchedules(course: CourseRow) {
  const schedules = course.course_schedules ?? [];
  if (!schedules.length) return null;
  return schedules
    .slice(0, 3)
    .map((schedule) => `${schedule.day_of_week ?? ""} ${schedule.start_time ?? ""}-${schedule.end_time ?? ""}`.trim())
    .filter(Boolean)
    .join(", ");
}

function keywordScore(candidate: CourseCandidate, keywords: string[]) {
  if (!keywords.length) return 0;
  const text = normalizeText(`${candidate.title} ${candidate.description} ${candidate.location ?? ""}`);
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  return Math.min(20, hits * 6);
}

function scoreCandidate(candidate: CourseCandidate, need: ParsedNeed) {
  let score = 20;
  if (need.category && candidate.category === need.category) score += 30;
  if (need.format !== "any" && candidate.format === need.format) score += 20;
  if (need.budget && candidate.price <= need.budget) score += 20;
  if (need.location && normalizeText(candidate.location).includes(normalizeText(need.location))) score += 10;
  score += Math.min(10, Math.round((candidate.rating || 0) * 1.5 + Math.min(candidate.review_count, 50) / 10));
  score += keywordScore(candidate, need.keywords);
  if (candidate.is_promoted) score += 3;
  return Math.max(0, Math.min(100, score));
}

function toCandidate(course: CourseRow, need: ParsedNeed): CourseCandidate {
  const candidate: CourseCandidate = {
    id: course.id,
    title: course.title,
    description: String(course.description ?? "").slice(0, 240),
    category: normalizeCategory(course.category),
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.location,
    image_url: course.image_url,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    students_count: Number(course.students_count ?? 0),
    is_promoted: Boolean(course.is_promoted),
    mentor_name: course.mentor?.name || "Mentor",
    mentor_avatar: course.mentor?.avatar_url ?? null,
    schedule_summary: summarizeSchedules(course),
    score: 0,
  };
  candidate.score = scoreCandidate(candidate, need);
  return candidate;
}

function toPublicCourse(candidate: CourseCandidate) {
  return {
    id: candidate.id,
    title: candidate.title,
    mentorName: candidate.mentor_name,
    mentorAvatar: candidate.mentor_avatar || "",
    price: candidate.price,
    rating: candidate.rating,
    reviewCount: candidate.review_count,
    image: candidate.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: candidate.category,
    format: candidate.format,
    location: candidate.location || undefined,
    studentsCount: candidate.students_count,
    promoted: candidate.is_promoted,
  };
}

function buildFallbackResult(
  query: string,
  need: ParsedNeed,
  candidates: CourseCandidate[],
  fallbackReason: string,
) {
  const recommendations: AiRecommendation[] = candidates.slice(0, 5).map((candidate) => ({
    course_id: candidate.id,
    match_score: clampScore(candidate.score),
    reason: need.category === candidate.category
      ? "Khóa học này khớp với nhóm nhu cầu bạn mô tả và có thông tin phù hợp trong hệ thống."
      : "Khóa học này là lựa chọn gần nhất dựa trên từ khóa, giá, hình thức học và đánh giá hiện có.",
    pros: [
      candidate.format === "online" ? "Có thể học online linh hoạt." : "Có địa điểm học trực tiếp.",
      candidate.price > 0 ? `Học phí khoảng ${candidate.price.toLocaleString("vi-VN")}đ.` : "Có thể trao đổi thêm về học phí.",
      candidate.rating > 0 ? `Đánh giá trung bình ${candidate.rating}/5.` : "Phù hợp để tìm hiểu thêm.",
    ],
    considerations: [
      candidate.schedule_summary ? `Lịch cố định: ${candidate.schedule_summary}.` : "Nên kiểm tra lịch học trước khi đặt.",
    ],
    course: toPublicCourse(candidate),
  }));

  return {
    intent_summary: query
      ? `Bạn đang tìm khóa học phù hợp với nhu cầu: "${query}".`
      : "Bạn đang tìm khóa học phù hợp trong VET.",
    detected_category: need.category,
    detected_format: need.format,
    detected_budget: need.budget,
    recommendations,
    follow_up_question: recommendations.length
      ? null
      : "Bạn có thể chia sẻ thêm ngân sách, hình thức học online/offline hoặc thời gian học mong muốn không?",
    fallback: true,
    fallback_reason: fallbackReason,
    suggestions: recommendations.map((item) => item.course.title),
  };
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

function validateAiResult(raw: unknown, need: ParsedNeed, candidates: CourseCandidate[], query: string) {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const rawRecommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];

  const recommendations: AiRecommendation[] = rawRecommendations.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const courseId = String(record.course_id ?? "");
    const candidate = candidateMap.get(courseId);
    if (!candidate) return [];

    return [{
      course_id: candidate.id,
      match_score: clampScore(record.match_score),
      reason: String(record.reason ?? "Khóa học này phù hợp với nhu cầu bạn mô tả.").slice(0, 320),
      pros: Array.isArray(record.pros)
        ? record.pros.map((value) => String(value)).filter(Boolean).slice(0, 3)
        : [],
      considerations: Array.isArray(record.considerations)
        ? record.considerations.map((value) => String(value)).filter(Boolean).slice(0, 3)
        : [],
      course: toPublicCourse(candidate),
    }];
  }).slice(0, 5);

  if (!recommendations.length) {
    throw new Error("AI did not recommend any valid candidate course.");
  }

  const detectedCategory = String(payload.detected_category ?? "");
  const detectedFormat = String(payload.detected_format ?? need.format);
  const detectedBudget = Number(payload.detected_budget ?? need.budget);

  return {
    intent_summary: String(payload.intent_summary ?? `Bạn đang tìm khóa học phù hợp với: "${query}".`).slice(0, 500),
    detected_category: (validCategories as readonly string[]).includes(detectedCategory)
      ? detectedCategory
      : need.category,
    detected_format: detectedFormat === "online" || detectedFormat === "offline" || detectedFormat === "any"
      ? detectedFormat
      : need.format,
    detected_budget: Number.isFinite(detectedBudget) && detectedBudget > 0 ? detectedBudget : need.budget,
    recommendations,
    follow_up_question: payload.follow_up_question ? String(payload.follow_up_question).slice(0, 240) : null,
    fallback: false,
    suggestions: recommendations.map((item) => item.course.title),
  };
}

function buildAiPrompt(query: string, need: ParsedNeed, candidates: CourseCandidate[], profile: LearningProfile | null) {
  const compactCandidates = candidates.map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    category: candidate.category,
    format: candidate.format,
    price: candidate.price,
    location: candidate.location,
    rating: candidate.rating,
    review_count: candidate.review_count,
    mentor_name: candidate.mentor_name,
    schedule_summary: candidate.schedule_summary,
  }));

  return `Learner need:
${query}

Learner learning profile context, use only as secondary context and never override explicit learner query:
${JSON.stringify(learningProfileContext(profile))}

Detected by backend:
${JSON.stringify({
    category: need.category,
    format: need.format,
    budget: need.budget,
    location: need.location,
    schedulePreference: need.schedulePreference,
  })}

Candidate courses from database:
${JSON.stringify(compactCandidates)}

Rules:
- Only recommend course_id values present in candidate courses.
- Do not invent courses, mentors, categories, prices, locations, or schedules.
- detected_category must be one of: mind-sports, career-english, modern-sports, barista-beverage, content-speaking, ai-productivity, or null.
- detected_format must be online, offline, or any.
- If no candidate is a strong fit, still return the closest options and a follow_up_question.
- Respond only as valid JSON object in this exact shape:
{
  "intent_summary": string,
  "detected_category": "mind-sports" | "career-english" | "modern-sports" | "barista-beverage" | "content-speaking" | "ai-productivity" | null,
  "detected_format": "online" | "offline" | "any",
  "detected_budget": number | null,
  "recommendations": [
    {
      "course_id": string,
      "match_score": number,
      "reason": string,
      "pros": string[],
      "considerations": string[]
    }
  ],
  "follow_up_question": string | null
}`;
}

async function getAuthedSupabase(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để dùng AI." }, 401),
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

async function reserveAiUsage(
  supabase: ReturnType<typeof createClient>,
  feature: AiFeature,
  credits: number,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    _feature: feature,
    _credits: credits,
    _prompt_preview: promptPreview.slice(0, 500),
    _metadata: metadata,
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
    _usage_log_id: usageLogId,
    _status: status,
    _error_message: errorMessage,
  });
  if (error) {
    console.error("finalize_ai_usage error:", {
      message: error.message,
      code: error.code,
    });
  }
}

function getServiceSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function updateAiUsageMetadata(
  usageLogId: string | null,
  metadata: Record<string, unknown>,
) {
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

async function fetchCourseCandidates(
  supabase: ReturnType<typeof createClient>,
  need: ParsedNeed,
) {
  let query = supabase
    .from("courses")
    .select(`
      id, mentor_id, title, description, category, format, price, location, image_url,
      rating, review_count, students_count, is_promoted,
      mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id),
      course_schedules(day_of_week, start_time, end_time)
    `)
    .eq("status", "approved")
    .eq("is_hidden", false)
    .order("is_promoted", { ascending: false })
    .order("rating", { ascending: false })
    .limit(50);

  if (need.category) query = query.eq("category", need.category);
  if (need.format !== "any") query = query.eq("format", need.format);
  if (need.budget) query = query.lte("price", need.budget);
  if (need.location) query = query.ilike("location", `%${need.location}%`);

  const { data, error } = await query;
  if (error) throw error;

  let candidates = ((data ?? []) as CourseRow[]).map((course) => toCandidate(course, need));

  if (!candidates.length && (need.category || need.budget || need.location)) {
    const { data: broaderData, error: broaderError } = await supabase
      .from("courses")
      .select(`
        id, mentor_id, title, description, category, format, price, location, image_url,
        rating, review_count, students_count, is_promoted,
        mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id),
        course_schedules(day_of_week, start_time, end_time)
      `)
      .eq("status", "approved")
      .eq("is_hidden", false)
      .order("is_promoted", { ascending: false })
      .order("rating", { ascending: false })
      .limit(50);
    if (broaderError) throw broaderError;
    candidates = ((broaderData ?? []) as CourseRow[]).map((course) => toCandidate(course, need));
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.rating - a.rating || b.review_count - a.review_count)
    .slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const prompt = String(body.query ?? "").trim();
    const type = body.type ?? "course_match";
    const feature = resolveFeature(type);
    const credits = aiCreditCosts[feature];
    const filters = (body.filters && typeof body.filters === "object" ? body.filters : {}) as Record<string, unknown>;
    let need = parseNeed(prompt, filters);

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) {
      return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    }
    supabaseForFinalize = supabase;

    const learningProfile = await fetchLearningProfile(supabase, userId);
    need = applyLearningProfileToNeed(need, learningProfile);

    const reservation = await reserveAiUsage(supabase, feature, credits, prompt, {
      function: "ai-search",
      type,
      feature,
      provider: "gemini",
      parsed_category: need.category,
      parsed_format: need.format,
      parsed_budget: need.budget,
      learning_profile_used: Boolean(learningProfile),
      profile_preferred_categories: learningProfile?.preferred_categories?.slice(0, 3) ?? [],
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const candidates = await fetchCourseCandidates(supabase, need);

    if (!candidates.length) {
      await finalizeAiUsage(supabase, usageLogId, "success", null);
      await updateAiUsageMetadata(usageLogId, {
        task: feature,
        fallback: true,
        fallback_reason: "no_candidates",
        candidate_count: 0,
        result_summary: "Không tìm thấy khóa học phù hợp trong bộ lọc hiện tại.",
      });
      return jsonResponse(buildFallbackResult(prompt, need, [], "no_candidates"));
    }

    try {
      const aiResult = await callAI({
        task: "course_match",
        modelTier: "fast",
        systemPrompt: `Bạn là AI Course Match của VET. Nhiệm vụ là phân tích nhu cầu learner và chọn khóa học phù hợp từ danh sách candidates đã được backend lọc sẵn. Không được tạo khóa học mới. Không được recommend course_id ngoài danh sách candidates.`,
        prompt: buildAiPrompt(prompt, need, candidates, learningProfile),
        responseMimeType: "application/json",
        temperature: 0.35,
      });

      await finalizeAiUsage(supabase, usageLogId, "success", null);

      try {
        const parsedAi = parseAiJson(aiResult.text);
        const validated = validateAiResult(parsedAi, need, candidates, prompt);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          task: "course_match",
          candidate_count: candidates.length,
          fallback: false,
          result_summary: validated.intent_summary,
        });
        return jsonResponse({
          ...validated,
          provider: aiResult.provider,
          model: aiResult.model,
        });
      } catch (parseError) {
        const fallback = buildFallbackResult(prompt, need, candidates, "invalid_ai_output");
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          task: "course_match",
          candidate_count: candidates.length,
          fallback: true,
          fallback_reason: parseError instanceof Error ? parseError.message : "invalid_ai_output",
          result_summary: fallback.intent_summary,
        });
        return jsonResponse(fallback);
      }
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI provider error";
      console.error("ai-search provider error:", message);
      await finalizeAiUsage(supabase, usageLogId, "failed", message);
      await updateAiUsageMetadata(usageLogId, {
        task: "course_match",
        candidate_count: candidates.length,
        fallback: true,
        fallback_reason: "ai_error",
        result_summary: "AI Search gặp lỗi, kết quả dự phòng đã được trả về.",
      });
      return jsonResponse({
        ...buildFallbackResult(prompt, need, candidates, "ai_error_credit_refunded"),
        credit_refunded: true,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown AI error";
    console.error("ai-search error:", message);
    if (supabaseForFinalize && usageLogId) {
      await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    }
    return jsonResponse({
      error: "Không thể dùng AI Search lúc này. Nếu AI đã lỗi, credit sẽ được hoàn qua hệ thống.",
      details: message,
    }, 500);
  }
});
