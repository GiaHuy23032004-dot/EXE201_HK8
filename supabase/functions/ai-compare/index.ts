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
  mentor_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  skill_tags?: string[] | null;
  learning_outcomes?: string[] | null;
  prerequisites?: string[] | null;
  skill_topic?: string | null;
  skill_domain?: SkillDomain;
  skill_kind?: string | null;
  format: "online" | "offline";
  price: number | null;
  location: string | null;
  image_url?: string | null;
  rating: number | null;
  review_count: number | null;
  students_count?: number | null;
  status: string | null;
  is_hidden?: boolean | null;
  mentor?: {
    name?: string | null;
    bio?: string | null;
    role?: string | null;
    avatar_url?: string | null;
    trust_badges?: string[];
    verification_status?: string | null;
  } | null;
  course_schedules?: Array<{ day_of_week?: string | null; start_time?: string | null; end_time?: string | null }> | null;
  review_summary?: {
    distribution: Record<string, number>;
    latest_comments: string[];
  };
};

type SkillDomain =
  | "programming"
  | "sports"
  | "language"
  | "public_speaking"
  | "creative"
  | "food_beverage"
  | "music"
  | "wellness"
  | "other";

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
  recommendedCourseId: string | null;
  confidence: "low" | "medium" | "high";
  factualComparison: Array<{
    criterion: string;
    courseA: string;
    courseB: string;
  }>;
  goalBasedAnalysis: Array<{
    goal: string;
    betterChoice: "courseA" | "courseB" | "tie";
    reason: string;
  }>;
  skillInsights: string[];
  courseAPros: string[];
  courseACons: string[];
  courseBPros: string[];
  courseBCons: string[];
  questionsToAskMentor: string[];
  missingInformation: string[];
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

const GOAL_LABELS: Record<string, string> = {
  career: "Học để đi làm",
  beginner_zero: "Học từ số 0",
  communication_confidence: "Học để giao tiếp/tự tin hơn",
  hobby_health: "Học để giải trí/sức khỏe",
  lower_cost: "Giá rẻ hơn",
  trusted_mentor: "Mentor uy tín hơn",
  unsure: "Tôi chưa biết, hãy tư vấn giúp tôi",
};

const DOMAIN_RUBRICS: Record<SkillDomain, string[]> = {
  programming: ["beginner friendliness", "prerequisites", "career path", "project applicability", "difficulty", "tools/technologies"],
  sports: ["beginner friendliness", "intensity", "safety", "equipment/location", "practice frequency", "cost to continue"],
  language: ["speaking/listening/reading/writing focus", "real-life usage", "exam/work/study relevance", "feedback quality"],
  public_speaking: ["confidence building", "speaking practice", "performance", "feedback", "practical output"],
  creative: ["creative output", "practice format", "portfolio usefulness", "tooling/materials", "feedback quality"],
  food_beverage: ["hands-on practice", "tools/ingredients", "job relevance", "beginner friendliness"],
  music: ["practice frequency", "technique foundation", "performance confidence", "equipment", "mentor feedback"],
  wellness: ["safety", "beginner friendliness", "intensity", "consistency", "health/wellness fit"],
  other: ["learner goal fit", "short-term benefit", "long-term benefit", "difficulty to start", "time commitment", "cost/value", "risk/uncertainty"],
};

const CROSS_CATEGORY_RUBRIC = [
  "Độ phù hợp với mục tiêu học",
  "Lợi ích ngắn hạn",
  "Lợi ích dài hạn",
  "Độ khó để bắt đầu",
  "Thời gian cần đầu tư",
  "Chi phí/giá trị",
  "Rủi ro hoặc thông tin còn thiếu",
];

function getRubric(courses: CompareCourse[]) {
  const domains = [...new Set(courses.map((course) => course.skill_domain ?? "other"))];
  if (domains.length === 1) return DOMAIN_RUBRICS[domains[0]] ?? DOMAIN_RUBRICS.other;
  return CROSS_CATEGORY_RUBRIC;
}

function isCrossCategory(courses: CompareCourse[]) {
  const domains = [...new Set(courses.map((course) => course.skill_domain ?? "other"))];
  return domains.length > 1;
}

function goalLabel(goal: string | null | undefined) {
  return GOAL_LABELS[goal || ""] ?? goal ?? GOAL_LABELS.unsure;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 12);
    return items.length ? items : null;
  }
  if (typeof value === "string" && value.trim()) {
    const items = value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
    return items.length ? items : [value.trim()];
  }
  return null;
}

function titleCaseTopic(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upperPreserve = ["AI", "IELTS", "TOEIC", "MC", "UI", "UX", "SQL", "C++", "C#", "HTML", "CSS", "JS"];
  const normalized = upperPreserve.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (normalized) return normalized;
  return trimmed
    .split(/\s+/)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractSkillTopic(course: Pick<CompareCourse, "title" | "description" | "category" | "skill_tags">) {
  const firstTag = course.skill_tags?.find(Boolean);
  if (firstTag) return titleCaseTopic(firstTag);

  const text = normalizeText(`${course.title} ${course.description ?? ""} ${course.category ?? ""}`);
  const exactPatterns: Array<[RegExp, string]> = [
    [/\bielts\s+speaking\b/, "IELTS Speaking"],
    [/\bielts\b/, "IELTS"],
    [/\btoeic\b/, "TOEIC"],
    [/\benglish communication\b|\btieng anh giao tiep\b/, "English Communication"],
    [/\bjava backend\b/, "Java Backend"],
    [/\bjava\b/, "Java"],
    [/\bpython\b/, "Python"],
    [/\breact\b/, "React"],
    [/\bphotoshop\b/, "Photoshop"],
    [/\bfigma\b/, "Figma"],
    [/\bcanva\b/, "Canva"],
    [/\bcau long\b|\bbadminton\b/, "Cầu lông"],
    [/\btennis\b/, "Tennis"],
    [/\bpickleball\b/, "Pickleball"],
    [/\byoga\b/, "Yoga"],
    [/\bbarista\b|\bpha che\b/, "Barista"],
    [/\bmc\b|\bdan chuong trinh\b/, "MC / Public Speaking"],
    [/\bpublic speaking\b|\bthuyet trinh\b/, "Public Speaking"],
    [/\bguitar\b/, "Guitar"],
    [/\bpiano\b/, "Piano"],
    [/\bchess\b|\bco vua\b/, "Cờ vua"],
  ];
  for (const [pattern, topic] of exactPatterns) {
    if (pattern.test(text)) return topic;
  }

  const stripped = course.title
    .replace(/\b(cơ bản|nâng cao|cho người mới|chuyên nghiệp|từ số 0|for everybody|online|offline)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCaseTopic(stripped) ?? titleCaseTopic(course.category ?? "Kỹ năng");
}

function classifySkillDomain(course: Pick<CompareCourse, "title" | "description" | "category" | "skill_tags">): SkillDomain {
  const text = normalizeText(`${course.title} ${course.description ?? ""} ${course.category ?? ""} ${(course.skill_tags ?? []).join(" ")}`);
  const category = normalizeText(course.category);
  if (/(python|java|javascript|typescript|react|node|backend|frontend|fullstack|html|css|sql|code|coding|programming|lap trinh|ai|automation|technology|cong nghe)/.test(text)
    || ["ai-productivity", "coding", "programming", "technology"].includes(category)) return "programming";
  if (/(tennis|pickleball|badminton|cau long|boi|swimming|football|gym|fitness|the thao|sport)/.test(text)
    || ["modern-sports", "sports", "sport", "fitness"].includes(category)) return "sports";
  if (/(ielts|toeic|english|tieng anh|language|ngoai ngu|speaking|listening|reading|writing)/.test(text)
    || ["career-english", "language", "english", "foreign-language"].includes(category)) return "language";
  if (/(mc|public speaking|thuyet trinh|dan chuong trinh|noi truoc dam dong|presentation|content speaking)/.test(text)
    || ["content-speaking", "content_creation"].includes(category)) return "public_speaking";
  if (/(photoshop|figma|illustrator|design|art|ve|drawing|creative|content|video|editor|canva)/.test(text)
    || ["creative", "design", "art"].includes(category)) return "creative";
  if (/(barista|pha che|bartender|coffee|cafe|cocktail|beverage|food|cooking|nau an)/.test(text)
    || ["barista-beverage", "barista", "bartender", "cooking", "food"].includes(category)) return "food_beverage";
  if (/(guitar|piano|music|am nhac|vocal|singing|ukulele|drum)/.test(text) || category === "music") return "music";
  if (/(yoga|meditation|wellness|suc khoe|thiền|thien)/.test(text)) return "wellness";
  return "other";
}

function classifySkillKind(topic: string | null, domain: SkillDomain) {
  const text = normalizeText(topic);
  if (domain === "programming") {
    if (/\b(react|vue|angular|node|express|spring|django|laravel)\b/.test(text)) return "framework_or_tool";
    if (/\b(python|java|javascript|typescript|c\+\+|c#|sql|go|ruby|php)\b/.test(text)) return "programming_language";
    return "technical_skill";
  }
  if (domain === "sports") return "physical_activity";
  if (domain === "language") return "language_skill";
  if (domain === "public_speaking") return "communication_skill";
  if (domain === "food_beverage") return "hands_on_skill";
  if (domain === "creative") return "creative_tool_or_skill";
  return "skill_topic";
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
    skill_topic: course.skill_topic,
    skill_domain: course.skill_domain,
    skill_kind: course.skill_kind,
    skill_tags: course.skill_tags ?? [],
    learning_outcomes: course.learning_outcomes ?? [],
    prerequisites: course.prerequisites ?? [],
    format: course.format,
    price: Number(course.price ?? 0),
    location: course.format === "offline" ? course.location : null,
    rating: Number(course.rating ?? 0),
    review_count: Number(course.review_count ?? 0),
    students_count: Number(course.students_count ?? 0),
    image_url: course.image_url ?? null,
    mentor_name: course.mentor?.name ?? "Mentor",
    mentor_bio: course.mentor?.bio ? course.mentor.bio.slice(0, 220) : null,
    mentor_role: course.mentor?.role ?? null,
    mentor_avatar_url: course.mentor?.avatar_url ?? null,
    mentor_verification_status: course.mentor?.verification_status ?? null,
    mentor_trust_badges: course.mentor?.trust_badges ?? [],
    schedule_summary: summarizeSchedule(course),
    review_summary: course.review_summary ?? null,
  };
}

async function fetchCourses(courseIds: string[]) {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) throw new Error("Supabase service role is not configured.");

  const runCourseQuery = (includeHiddenColumn: boolean, includeSkillColumns: boolean) => {
    const baseColumns = "id,mentor_id,title,description,category,format,price,location,image_url,rating,review_count,students_count,status";
    const skillColumns = includeSkillColumns ? ",skill_tags,learning_outcomes,prerequisites" : "";
    const hiddenColumn = includeHiddenColumn ? ",is_hidden" : "";
    let query = serviceClient
      .from("courses")
      .select(`${baseColumns}${hiddenColumn}${skillColumns}`)
      .in("id", courseIds)
      .eq("status", "approved");

    if (includeHiddenColumn) query = query.eq("is_hidden", false);
    return query;
  };

  let includeHiddenColumn = true;
  let includeSkillColumns = true;
  let data: unknown[] | null = null;
  let error: { code?: string; message?: string; details?: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await runCourseQuery(includeHiddenColumn, includeSkillColumns);
    data = result.data as unknown[] | null;
    error = result.error as typeof error;
    if (!error) break;

    const errorText = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    const missingColumn = error.code === "PGRST204" || error.code === "42703";
    const missingSkillColumn = missingColumn && /(skill_tags|learning_outcomes|prerequisites)/.test(errorText);
    const missingHiddenColumn = missingColumn && errorText.includes("is_hidden");

    if (missingSkillColumn && includeSkillColumns) {
      includeSkillColumns = false;
      continue;
    }
    if (missingHiddenColumn && includeHiddenColumn) {
      includeHiddenColumn = false;
      continue;
    }
    break;
  }

  if (error) throw error;

  const rawCourses = (data ?? []) as Array<Record<string, unknown>>;
  const mentorIds = [...new Set(rawCourses.map((course) => String(course.mentor_id ?? "")).filter(Boolean))];

  const [schedulesResult, mentorsResult, reviewsResult, verificationsResult, badgesResult] = await Promise.all([
    serviceClient
      .from("course_schedules")
      .select("course_id,day_of_week,start_time,end_time")
      .in("course_id", courseIds),
    mentorIds.length
      ? serviceClient
          .from("profiles")
          .select("user_id,name,bio,role,avatar_url")
          .in("user_id", mentorIds)
      : Promise.resolve({ data: [], error: null }),
    serviceClient
      .from("reviews")
      .select("course_id,rating,comment,created_at")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false }),
    mentorIds.length
      ? serviceClient
          .from("mentor_verifications")
          .select("mentor_id,status")
          .in("mentor_id", mentorIds)
      : Promise.resolve({ data: [], error: null }),
    mentorIds.length
      ? serviceClient
          .from("mentor_trust_badges")
          .select("mentor_id,badge_type,status,public_visible")
          .in("mentor_id", mentorIds)
          .eq("status", "active")
          .eq("public_visible", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [schedulesResult, mentorsResult, reviewsResult, verificationsResult, badgesResult]) {
    if (result.error) {
      console.error("ai-compare context fetch warning:", {
        message: result.error.message,
        code: result.error.code,
      });
    }
  }

  const schedulesByCourse = new Map<string, CompareCourse["course_schedules"]>();
  for (const schedule of schedulesResult.data ?? []) {
    const row = schedule as Record<string, unknown>;
    const courseId = String(row.course_id ?? "");
    if (!courseId) continue;
    const current = schedulesByCourse.get(courseId) ?? [];
    current.push({
      day_of_week: typeof row.day_of_week === "string" ? row.day_of_week : null,
      start_time: typeof row.start_time === "string" ? row.start_time : null,
      end_time: typeof row.end_time === "string" ? row.end_time : null,
    });
    schedulesByCourse.set(courseId, current);
  }

  const mentorsById = new Map<string, CompareCourse["mentor"]>();
  for (const mentor of mentorsResult.data ?? []) {
    const row = mentor as Record<string, unknown>;
    const userId = String(row.user_id ?? "");
    if (!userId) continue;
    mentorsById.set(userId, {
      name: typeof row.name === "string" ? row.name : null,
      bio: typeof row.bio === "string" ? row.bio : null,
      role: typeof row.role === "string" ? row.role : null,
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
      trust_badges: [],
      verification_status: null,
    });
  }

  for (const verification of verificationsResult.data ?? []) {
    const row = verification as Record<string, unknown>;
    const mentorId = String(row.mentor_id ?? "");
    const mentor = mentorsById.get(mentorId);
    if (mentor) mentor.verification_status = typeof row.status === "string" ? row.status : null;
  }

  for (const badge of badgesResult.data ?? []) {
    const row = badge as Record<string, unknown>;
    const mentorId = String(row.mentor_id ?? "");
    const mentor = mentorsById.get(mentorId);
    if (mentor && typeof row.badge_type === "string") {
      mentor.trust_badges = [...(mentor.trust_badges ?? []), row.badge_type];
    }
  }

  const reviewsByCourse = new Map<string, CompareCourse["review_summary"]>();
  for (const review of reviewsResult.data ?? []) {
    const row = review as Record<string, unknown>;
    const courseId = String(row.course_id ?? "");
    if (!courseId) continue;
    const rating = Number(row.rating);
    const summary = reviewsByCourse.get(courseId) ?? {
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      latest_comments: [],
    };
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      summary.distribution[String(rating)] = (summary.distribution[String(rating)] ?? 0) + 1;
    }
    if (typeof row.comment === "string" && row.comment.trim() && summary.latest_comments.length < 3) {
      summary.latest_comments.push(row.comment.trim().slice(0, 240));
    }
    reviewsByCourse.set(courseId, summary);
  }

  const courses = rawCourses.map((row) => {
    const mentorId = typeof row.mentor_id === "string" ? row.mentor_id : null;
    const baseCourse = {
      id: String(row.id),
      mentor_id: mentorId,
      title: String(row.title ?? ""),
      description: typeof row.description === "string" ? row.description : null,
      category: typeof row.category === "string" ? row.category : null,
      skill_tags: normalizeArray(row.skill_tags),
      learning_outcomes: normalizeArray(row.learning_outcomes),
      prerequisites: normalizeArray(row.prerequisites),
      format: row.format === "online" ? "online" : "offline",
      price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
      location: typeof row.location === "string" ? row.location : null,
      image_url: typeof row.image_url === "string" ? row.image_url : null,
      rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
      review_count: Number.isFinite(Number(row.review_count)) ? Number(row.review_count) : null,
      students_count: Number.isFinite(Number(row.students_count)) ? Number(row.students_count) : null,
      status: typeof row.status === "string" ? row.status : null,
      is_hidden: typeof row.is_hidden === "boolean" ? row.is_hidden : null,
      mentor: mentorId ? mentorsById.get(mentorId) ?? null : null,
      course_schedules: schedulesByCourse.get(String(row.id)) ?? [],
      review_summary: reviewsByCourse.get(String(row.id)) ?? {
        distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
        latest_comments: [],
      },
    } satisfies CompareCourse;
    const skillTopic = extractSkillTopic(baseCourse);
    const skillDomain = classifySkillDomain(baseCourse);
    return {
      ...baseCourse,
      skill_topic: skillTopic,
      skill_domain: skillDomain,
      skill_kind: classifySkillKind(skillTopic, skillDomain),
    } satisfies CompareCourse;
  });

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

function formatPrice(value: number | null) {
  return Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("vi-VN")}đ/buổi` : "Chưa có học phí";
}

function courseTrustScore(course: CompareCourse) {
  return (course.mentor?.verification_status === "approved" ? 2 : 0) + (course.mentor?.trust_badges?.length ?? 0);
}

function scoreForGoal(course: CompareCourse, goal: string) {
  let score = Number(course.rating ?? 0) * 8 + Math.min(Number(course.review_count ?? 0), 30) + courseTrustScore(course) * 8;
  if (summarizeSchedule(course)) score += 8;
  if (goal === "lower_cost") score -= Number(course.price ?? 0) / 50000;
  if (goal === "beginner_zero") score += /cơ bản|beginner|người mới|từ số 0/i.test(`${course.title} ${course.description ?? ""}`) ? 18 : 0;
  if (goal === "trusted_mentor") score += courseTrustScore(course) * 12;
  if (goal === "career" && ["programming", "language", "food_beverage", "creative"].includes(course.skill_domain ?? "other")) score += 18;
  if (goal === "communication_confidence" && ["public_speaking", "language"].includes(course.skill_domain ?? "other")) score += 18;
  if (goal === "hobby_health" && ["sports", "wellness", "music", "food_beverage"].includes(course.skill_domain ?? "other")) score += 12;
  return score;
}

function missingInfoForCourse(course: CompareCourse) {
  const missing: string[] = [];
  if (!course.description || course.description.length < 80) missing.push(`${course.title}: mô tả/đầu ra khóa học còn ít`);
  if (!summarizeSchedule(course)) missing.push(`${course.title}: lịch học cố định`);
  if (!course.review_count) missing.push(`${course.title}: review từ học viên`);
  if (!course.students_count) missing.push(`${course.title}: số học viên đã học`);
  if (!course.mentor?.bio) missing.push(`${course.title}: bio/kinh nghiệm mentor`);
  return missing;
}

function buildFactualRows(courses: CompareCourse[]) {
  return [
    {
      criterion: "Học phí",
      course_values: courses.map((course) => ({ course_id: course.id, value: formatPrice(course.price) })),
    },
    {
      criterion: "Hình thức",
      course_values: courses.map((course) => ({ course_id: course.id, value: course.format === "online" ? "Online" : `Offline${course.location ? ` · ${course.location}` : ""}` })),
    },
    {
      criterion: "Lịch học",
      course_values: courses.map((course) => ({ course_id: course.id, value: summarizeSchedule(course) || "Chưa có lịch cố định" })),
    },
    {
      criterion: "Đánh giá",
      course_values: courses.map((course) => ({ course_id: course.id, value: Number(course.rating ?? 0) > 0 ? `${Number(course.rating ?? 0)}/5 (${Number(course.review_count ?? 0)} review)` : "Chưa có đánh giá" })),
    },
    {
      criterion: "Mentor",
      course_values: courses.map((course) => ({ course_id: course.id, value: `${course.mentor?.name ?? "Mentor"}${course.mentor?.verification_status === "approved" ? " · Đã xác minh" : ""}` })),
    },
    {
      criterion: "Số học viên",
      course_values: courses.map((course) => ({ course_id: course.id, value: Number(course.students_count ?? 0) > 0 ? `${course.students_count} học viên` : "Chưa có dữ liệu" })),
    },
    {
      criterion: "Badge uy tín",
      course_values: courses.map((course) => ({ course_id: course.id, value: course.mentor?.trust_badges?.length ? course.mentor.trust_badges.join(", ") : "Chưa có badge công khai" })),
    },
  ];
}

function fallbackCompare(courses: CompareCourse[], context: Record<string, unknown>, reason?: string): CompareResult {
  const goal = String(context.comparison_goal ?? "unsure");
  const sorted = [...courses].sort((a, b) => scoreForGoal(b, goal) - scoreForGoal(a, goal));
  const crossCategory = isCrossCategory(courses);
  const best = crossCategory && goal === "unsure" ? null : sorted[0] ?? null;
  const factualRows = buildFactualRows(courses);
  const missingInformation = [...new Set(courses.flatMap(missingInfoForCourse))].slice(0, 8);
  const courseA = courses[0];
  const courseB = courses[1];
  const questionList = [
    "Khóa này phù hợp với trình độ hiện tại của tôi không?",
    "Sau khóa học tôi sẽ làm được sản phẩm/kỹ năng cụ thể nào?",
    "Tỷ lệ thực hành và phản hồi cá nhân trong buổi học là bao nhiêu?",
    "Lịch học có thể linh hoạt nếu tôi bận không?",
  ];

  const course_analysis = courses.map((course) => ({
    course_id: course.id,
    strengths: [
      course.format === "online" ? "Linh hoạt học online." : `Có học trực tiếp${course.location ? ` tại ${course.location}` : ""}.`,
      courseTrustScore(course) > 0 ? "Mentor có tín hiệu uy tín/xác minh công khai." : "Có thể hỏi thêm mentor để xác nhận kinh nghiệm và cách dạy.",
      Number(course.rating ?? 0) > 0 ? `Có điểm đánh giá ${course.rating}/5 từ dữ liệu hiện có.` : "Dữ liệu đánh giá còn ít, nên hỏi mentor thêm.",
    ],
    weaknesses: missingInfoForCourse(course).map((item) => item.replace(`${course.title}: `, "")).slice(0, 3),
    best_for: goal === "lower_cost"
      ? "Learner ưu tiên tối ưu chi phí."
      : goal === "beginner_zero"
        ? "Learner muốn bắt đầu từ nền tảng cơ bản."
        : goal === "trusted_mentor"
          ? "Learner ưu tiên tín hiệu uy tín của mentor."
          : goal === "career"
            ? "Learner học để áp dụng cho công việc hoặc định hướng nghề nghiệp."
            : goal === "communication_confidence"
              ? "Learner muốn tăng giao tiếp, tự tin hoặc khả năng trình bày."
              : goal === "hobby_health"
                ? "Learner học để giải trí, sức khỏe hoặc duy trì thói quen."
                : "Learner muốn cân bằng mục tiêu, chi phí và độ chắc chắn của dữ liệu.",
  }));

  const recommendation = best
    ? `Dựa trên dữ liệu hiện có và mục tiêu "${goalLabel(goal)}", "${best.title}" có vẻ phù hợp hơn để cân nhắc trước. Bạn vẫn nên hỏi mentor về đầu ra, trình độ yêu cầu và lịch học trước khi đặt.`
    : "Dữ liệu hiện có chưa đủ để chọn một khóa nổi bật. Nên hỏi mentor thêm trước khi quyết định.";

  return {
    summary: crossCategory
      ? `Đây là các khóa phục vụ mục tiêu khác nhau. VET so sánh theo mục tiêu "${goalLabel(goal)}", chi phí, lịch học, mentor và mức độ chắc chắn của dữ liệu.`
      : `VET so sánh theo rubric của lĩnh vực kỹ năng, mục tiêu "${goalLabel(goal)}", học phí, lịch học, đánh giá và mentor.${reason ? " AI không trả JSON hợp lệ nên đây là bảng so sánh dự phòng dựa trên dữ liệu thật." : ""}`,
    recommendedCourseId: best?.id ?? null,
    confidence: missingInformation.length >= 5 ? "low" : "medium",
    factualComparison: factualRows.map((row) => ({
      criterion: row.criterion,
      courseA: row.course_values.find((item) => item.course_id === courseA?.id)?.value ?? "-",
      courseB: row.course_values.find((item) => item.course_id === courseB?.id)?.value ?? "-",
    })),
    goalBasedAnalysis: [
      {
        goal: goalLabel(goal),
        betterChoice: best && courseA && best.id === courseA.id ? "courseA" : best && courseB && best.id === courseB.id ? "courseB" : "tie",
        reason: recommendation,
      },
      ...(crossCategory ? [{
        goal: "Khác mục tiêu",
        betterChoice: "tie" as const,
        reason: "Hai khóa thuộc nhóm kỹ năng khác nhau, nên chọn theo mục tiêu chính thay vì ép một khóa thắng tuyệt đối.",
      }] : []),
    ],
    skillInsights: [
      ...courses.slice(0, 2).map((course) => `${course.title}: chủ đề chính là ${course.skill_topic ?? "kỹ năng chưa rõ"}, thuộc nhóm ${course.skill_domain ?? "other"}.`),
      ...(crossCategory ? ["Hai khóa phục vụ nhóm mục tiêu khác nhau, vì vậy khuyến nghị nên bám theo mục tiêu learner đã chọn."] : []),
    ],
    courseAPros: course_analysis[0]?.strengths ?? [],
    courseACons: course_analysis[0]?.weaknesses ?? [],
    courseBPros: course_analysis[1]?.strengths ?? [],
    courseBCons: course_analysis[1]?.weaknesses ?? [],
    questionsToAskMentor: questionList,
    missingInformation,
    best_choice_course_id: best?.id ?? null,
    comparison_table: factualRows,
    course_analysis,
    recommendation,
    questions_to_ask_mentor: questionList,
  };
}

function validateCompare(raw: unknown, courses: CompareCourse[], context: Record<string, unknown>): CompareResult {
  if (!raw || typeof raw !== "object") throw new Error("AI output is not an object.");
  const payload = raw as Record<string, unknown>;
  const validIds = new Set(courses.map((course) => course.id));
  const courseA = courses[0];
  const courseB = courses[1];
  const recommended = String(payload.recommendedCourseId ?? payload.best_choice_course_id ?? "");
  const factualRows = Array.isArray(payload.factualComparison) ? payload.factualComparison : [];
  const goalRows = Array.isArray(payload.goalBasedAnalysis) ? payload.goalBasedAnalysis : [];
  const legacyRows = Array.isArray(payload.comparison_table) ? payload.comparison_table : [];
  const fallback = fallbackCompare(courses, context, "ai_output_shape_fallback");

  const factualComparison = factualRows.slice(0, 10).flatMap((row) => {
    const record = row as Record<string, unknown>;
    const criterion = String(record.criterion ?? "").trim().slice(0, 120);
    if (!criterion) return [];
    return [{
      criterion,
      courseA: String(record.courseA ?? "").slice(0, 260) || "Chưa có dữ liệu",
      courseB: String(record.courseB ?? "").slice(0, 260) || "Chưa có dữ liệu",
    }];
  });

  const comparison_table = factualComparison.length
    ? factualComparison.map((row) => ({
        criterion: row.criterion,
        course_values: [
          { course_id: courseA?.id ?? "", value: row.courseA },
          { course_id: courseB?.id ?? "", value: row.courseB },
        ].filter((item) => validIds.has(item.course_id)),
      }))
    : legacyRows.slice(0, 8).map((row) => {
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

  const normalizedFactual = factualComparison.length ? factualComparison : fallback.factualComparison;
  const goalBasedAnalysis = goalRows.slice(0, 5).flatMap((row) => {
    const record = row as Record<string, unknown>;
    const betterChoice = ["courseA", "courseB", "tie"].includes(String(record.betterChoice))
      ? String(record.betterChoice) as "courseA" | "courseB" | "tie"
      : "tie";
    const reason = String(record.reason ?? "").trim().slice(0, 420);
    if (!reason) return [];
    return [{
      goal: String(record.goal ?? goalLabel(String(context.comparison_goal ?? "unsure"))).slice(0, 120),
      betterChoice,
      reason,
    }];
  });

  const courseAPros = list(payload.courseAPros, 5);
  const courseACons = list(payload.courseACons, 5);
  const courseBPros = list(payload.courseBPros, 5);
  const courseBCons = list(payload.courseBCons, 5);
  const skillInsights = list(payload.skillInsights, 6);
  const questionsToAskMentor = list(payload.questionsToAskMentor ?? payload.questions_to_ask_mentor, 6);
  const missingInformation = list(payload.missingInformation, 8);
  const confidence = ["low", "medium", "high"].includes(String(payload.confidence))
    ? String(payload.confidence) as CompareResult["confidence"]
    : fallback.confidence;

  if (!normalizedFactual.length || !goalBasedAnalysis.length) throw new Error("AI comparison is incomplete.");

  const course_analysis = courses.map((course, index) => ({
    course_id: course.id,
    strengths: index === 0 ? (courseAPros.length ? courseAPros : fallback.courseAPros) : (courseBPros.length ? courseBPros : fallback.courseBPros),
    weaknesses: index === 0 ? (courseACons.length ? courseACons : fallback.courseACons) : (courseBCons.length ? courseBCons : fallback.courseBCons),
    best_for: goalBasedAnalysis.find((row) => row.betterChoice === (index === 0 ? "courseA" : "courseB"))?.reason.slice(0, 240)
      ?? fallback.course_analysis[index]?.best_for
      ?? "Phù hợp tùy mục tiêu học cụ thể.",
  }));

  return {
    summary: String(payload.summary ?? "AI đã so sánh các khóa học bạn chọn.").slice(0, 600),
    recommendedCourseId: validIds.has(recommended) ? recommended : null,
    confidence,
    factualComparison: normalizedFactual,
    goalBasedAnalysis: goalBasedAnalysis.length ? goalBasedAnalysis : fallback.goalBasedAnalysis,
    skillInsights: skillInsights.length ? skillInsights : fallback.skillInsights,
    courseAPros: courseAPros.length ? courseAPros : fallback.courseAPros,
    courseACons: courseACons.length ? courseACons : fallback.courseACons,
    courseBPros: courseBPros.length ? courseBPros : fallback.courseBPros,
    courseBCons: courseBCons.length ? courseBCons : fallback.courseBCons,
    questionsToAskMentor: questionsToAskMentor.length ? questionsToAskMentor : fallback.questionsToAskMentor,
    missingInformation: missingInformation.length ? missingInformation : fallback.missingInformation,
    best_choice_course_id: validIds.has(recommended) ? recommended : null,
    comparison_table: comparison_table.length ? comparison_table : fallback.comparison_table,
    course_analysis,
    recommendation: String(payload.recommendation ?? "Hãy chọn khóa phù hợp nhất với mục tiêu, lịch học và ngân sách của bạn.").slice(0, 600),
    questions_to_ask_mentor: questionsToAskMentor.length ? questionsToAskMentor : fallback.questions_to_ask_mentor,
  };
}

function buildPrompt(courses: CompareCourse[], context: Record<string, unknown>, learningProfile: LearningProfile | null) {
  const rubric = getRubric(courses);
  const crossCategory = isCrossCategory(courses);
  return `Learner comparison context:
${JSON.stringify(context)}

Saved learner learning profile, use only as secondary context and never override explicit comparison context:
${JSON.stringify(learningProfileContext(learningProfile))}

Domain and skill-aware comparison rubric:
${JSON.stringify({
  cross_domain: crossCategory,
  criteria: rubric,
  course_topics: courses.map((course) => ({ id: course.id, topic: course.skill_topic, domain: course.skill_domain, kind: course.skill_kind })),
})}

Courses from VET database:
${JSON.stringify(courses.map(publicCourse))}

Rules:
- Only compare course IDs listed above.
- Separate factual comparison from AI interpretation.
- Only use provided course data. Do not invent price, schedule, mentor, reviews, slots, outcomes, refunds, certificates, or payment policies.
- You may explain general differences between skill topics/domains, but course-specific facts must only come from the VET database payload.
- When comparing tools/languages, classify accurately. Example: Java/Python are programming languages; React is a frontend library/tool, not a programming language.
- If a field is missing, say it is not available.
- If domains/topics are unrelated, say they serve different learning goals and compare by the user's goal instead of forcing a universal winner.
- If domains/topics are unrelated and the learner goal is unsure, set recommendedCourseId to null and explain how to choose by goal.
- Avoid overclaiming. Use "dựa trên dữ liệu hiện có", "có vẻ phù hợp hơn nếu...", and "nên hỏi mentor thêm".
- If no course is clearly best, recommendedCourseId may be null.
- Respond in Vietnamese.
- Respond only as valid JSON:
{
  "summary": string,
  "recommendedCourseId": string | null,
  "confidence": "low" | "medium" | "high",
  "factualComparison": [
    { "criterion": string, "courseA": string, "courseB": string }
  ],
  "goalBasedAnalysis": [
    { "goal": string, "betterChoice": "courseA" | "courseB" | "tie", "reason": string }
  ],
  "skillInsights": string[],
  "courseAPros": string[],
  "courseACons": string[],
  "courseBPros": string[],
  "courseBCons": string[],
  "questionsToAskMentor": string[],
  "missingInformation": string[],
  "recommendation": string,
  "best_choice_course_id": string | null,
  "comparison_table": [
    { "criterion": string, "course_values": [{ "course_id": string, "value": string }] }
  ],
  "course_analysis": [
    { "course_id": string, "strengths": string[], "weaknesses": string[], "best_for": string }
  ],
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
      comparison_goal: String(body.comparison_goal ?? body.learner_goal ?? "unsure").trim().slice(0, 120) || "unsure",
      comparison_goal_label: goalLabel(String(body.comparison_goal ?? body.learner_goal ?? "unsure").trim() || "unsure"),
      learner_goal: String(body.learner_goal ?? "").trim().slice(0, 240) || null,
      learner_level: String(body.learner_level ?? "").trim().slice(0, 80) || null,
      preferred_format: ["online", "offline", "any"].includes(String(body.preferred_format)) ? body.preferred_format : "any",
      budget: Number.isFinite(Number(body.budget)) ? Number(body.budget) : null,
      cross_category: isCrossCategory(courses),
      rubric: getRubric(courses),
      skill_topics: courses.map((course) => course.skill_topic ?? null),
      skill_domains: courses.map((course) => course.skill_domain ?? "other"),
      skill_kinds: courses.map((course) => course.skill_kind ?? "skill_topic"),
    };

    const reservation = await reserveAiUsage(supabase, courses.map((course) => course.title).join(" vs "), {
      function: "ai-compare",
      feature: "compare",
      course_ids: courseIds,
      provider: "gemini",
      comparison_goal: context.comparison_goal,
      cross_category: context.cross_category,
      skill_topics: context.skill_topics,
      skill_domains: context.skill_domains,
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
        const comparison = validateCompare(parseJson(aiResult.text), courses, context);
        await updateAiUsageMetadata(usageLogId, {
          provider: aiResult.provider,
          model: aiResult.model,
          task: "compare",
          input_tokens: aiResult.usage?.inputTokens ?? null,
          output_tokens: aiResult.usage?.outputTokens ?? null,
          total_tokens: aiResult.usage?.totalTokens ?? null,
          fallback: false,
          course_ids: courseIds,
          comparison_goal: context.comparison_goal,
          cross_category: context.cross_category,
          result_summary: comparison.summary,
        });
        return jsonResponse({ comparison, courses: courses.map(publicCourse), provider: aiResult.provider, model: aiResult.model, credit_cost: COMPARE_CREDIT_COST });
      } catch (parseError) {
        const comparison = fallbackCompare(courses, context, parseError instanceof Error ? parseError.message : "invalid_ai_output");
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
          comparison_goal: context.comparison_goal,
          cross_category: context.cross_category,
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
