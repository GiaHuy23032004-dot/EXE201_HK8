import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type CallAIResult } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHAT_CREDIT_COST = 1;

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

type ChatMessage = {
  role?: string;
  content?: string;
};

type ChatRole = "user" | "assistant" | "system";

type ChatHistoryMetadata = {
  conversation_id?: string | null;
  message_id?: string | null;
  recommendations?: PublicCourseRecommendation[];
};

type CourseFormat = "online" | "offline";
type CourseCategorySlug =
  | "mind-sports"
  | "career-english"
  | "modern-sports"
  | "barista-beverage"
  | "content-speaking"
  | "ai-productivity";

type DetectedCourseIntent = {
  shouldRetrieve: boolean;
  originalRequest: string;
  keyword: string | null;
  category: CourseCategorySlug | null;
  format: CourseFormat | "any";
  location: string | null;
  needsLocation: boolean;
};

type CourseRecommendation = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: CourseFormat | string | null;
  price: number | null;
  location: string | null;
  rating: number | null;
  review_count: number | null;
  mentor_id: string | null;
  image_url: string | null;
  mentor_name: string | null;
  mentor_avatar_url: string | null;
  score: number;
};

type PublicCourseRecommendation = {
  id: string;
  title: string;
  mentorName?: string | null;
  category?: string | null;
  format: CourseFormat | string | null;
  price: number | null;
  location?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  detailUrl: string;
  matchType: "exact" | "similar";
};

type CourseRecommendationContext = {
  intent: DetectedCourseIntent;
  exactCourses: CourseRecommendation[];
  similarCourses: CourseRecommendation[];
  systemContext: string;
};

type CourseDetailSchedule = {
  day_of_week: string | number | null;
  start_time: string | null;
  end_time: string | null;
};

type CourseDetailContext = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  format: CourseFormat | string | null;
  price: number | null;
  location: string | null;
  rating: number | null;
  review_count: number | null;
  students_count: number | null;
  mentor_id: string | null;
  mentor_name: string | null;
  mentor_headline: string | null;
  mentor_bio: string | null;
  schedules: CourseDetailSchedule[];
  systemContext: string;
};

const COURSE_DETAIL_ROUTE_PREFIX = "/course";
const CATEGORY_LABELS: Record<CourseCategorySlug, string> = {
  "mind-sports": "Cờ & Tư duy chiến thuật",
  "career-english": "Tiếng Anh công việc & học tập",
  "modern-sports": "Thể thao hiện đại",
  "barista-beverage": "Barista & Đồ uống",
  "content-speaking": "Nội dung, MC & Thuyết trình",
  "ai-productivity": "AI & Công cụ làm việc",
};

const CATEGORY_ALIASES: Record<CourseCategorySlug, string[]> = {
  "mind-sports": ["mind-sports", "chess", "board-game"],
  "career-english": ["career-english", "language", "english", "foreign-language"],
  "modern-sports": ["modern-sports", "fitness", "sport", "sports", "yoga", "swimming", "tennis", "pickleball"],
  "barista-beverage": ["barista-beverage", "cooking", "barista", "bartender", "beverage", "food"],
  "content-speaking": ["content-speaking", "content_creation", "music", "art", "design", "creative"],
  "ai-productivity": ["ai-productivity", "coding", "programming", "business", "ai", "automation", "technology"],
};

const CATEGORY_TERMS: Array<{ category: CourseCategorySlug; terms: string[] }> = [
  {
    category: "content-speaking",
    terms: [
      "mc",
      "thuyet trinh",
      "noi truoc dam dong",
      "public speaking",
      "tao noi dung",
      "content",
      "dan chuong trinh",
      "giao tiep truoc dam dong",
    ],
  },
  {
    category: "career-english",
    terms: ["tieng anh", "english", "ielts", "toeic", "giao tiep tieng anh", "anh van"],
  },
  {
    category: "modern-sports",
    terms: ["pickleball", "tennis", "boi", "swimming", "yoga", "the thao", "gym", "fitness"],
  },
  {
    category: "barista-beverage",
    terms: ["pha che", "barista", "bartender", "cafe", "ca phe", "do uong", "cocktail"],
  },
  {
    category: "mind-sports",
    terms: ["co vua", "co tuong", "chess", "board game", "tu duy chien thuat"],
  },
  {
    category: "ai-productivity",
    terms: [
      "ai",
      "tri tue nhan tao",
      "automation",
      "tu dong hoa",
      "cong cu lam viec",
      "nang suat",
      "python",
      "lap trinh",
      "hoc code",
      "coding",
      "programming",
      "technology",
      "cong nghe",
    ],
  },
];

const COURSE_RECOMMENDATION_TRIGGERS = [
  "toi muon hoc",
  "muon hoc",
  "goi y khoa hoc",
  "goi y lop",
  "khoa hoc cho toi",
  "co lop",
  "tim khoa hoc",
  "tim mentor",
  "hoc gi",
  "lop nao",
  "khoa nao",
  "mentor nao",
];

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
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(normalizedText: string, terms: string[]) {
  return terms.some((term) => normalizedText.includes(term));
}

function detectCourseIntent(message: string): DetectedCourseIntent {
  const originalRequest = message.trim();
  const normalized = normalizeText(originalRequest);
  const detectedCategory = CATEGORY_TERMS.find((entry) => containsAny(normalized, entry.terms))?.category ?? null;
  const mentionsOnline = containsAny(normalized, ["online", "truc tuyen", "hoc tu xa"]);
  const mentionsOffline = containsAny(normalized, [
    "offline",
    "truc tiep",
    "gan toi",
    "gan day",
    "quanh toi",
    "o tp hcm",
    "tai tp hcm",
    "tphcm",
    "ho chi minh",
    "sai gon",
    "quan ",
  ]);
  const location = extractLocationLabel(normalized);
  const needsLocation = containsAny(normalized, ["gan toi", "quanh toi", "gan day", "gan minh"]) && !location;
  const shouldRetrieve =
    Boolean(detectedCategory) ||
    containsAny(normalized, COURSE_RECOMMENDATION_TRIGGERS) ||
    (normalized.includes("hoc") && containsAny(normalized, ["lop", "mentor", "khoa", "online", "offline"]));

  return {
    shouldRetrieve,
    originalRequest,
    keyword: extractKeyword(originalRequest, detectedCategory),
    category: detectedCategory,
    format: mentionsOnline ? "online" : mentionsOffline ? "offline" : "any",
    location,
    needsLocation,
  };
}

function extractLocationLabel(normalizedText: string) {
  const districtMatch = normalizedText.match(/\bquan\s*(\d{1,2}|binh thanh|tan binh|phu nhuan|go vap|thu duc|binh tan|tan phu)\b/);
  const hasHcm = containsAny(normalizedText, ["tp hcm", "tphcm", "ho chi minh", "sai gon"]);
  if (districtMatch?.[0] && hasHcm) return `${districtMatch[0].replace(/\bquan\b/, "Quận")} TP.HCM`;
  if (districtMatch?.[0]) return districtMatch[0].replace(/\bquan\b/, "Quận");
  if (hasHcm) return "TP.HCM";
  return null;
}

function extractKeyword(originalRequest: string, category: CourseCategorySlug | null) {
  const compact = originalRequest
    .replace(/\?/g, "")
    .replace(/\b(tôi|toi|muốn|muon|học|hoc|khóa học|khoa hoc|lớp|lop|gợi ý|goi y|cho tôi|cho toi)\b/gi, " ")
    .replace(/\b(online|offline|trực tuyến|truc tuyen|trực tiếp|truc tiep|ở|o|tại|tai|gần tôi|gan toi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (compact.length >= 3) return compact.slice(0, 120);
  if (category) return CATEGORY_LABELS[category];
  return null;
}

function formatPrice(value: number | null) {
  if (!Number.isFinite(Number(value))) return "Chưa cập nhật";
  return `${Number(value).toLocaleString("vi-VN")}đ/buổi`;
}

function courseLink(courseId: string) {
  return `${COURSE_DETAIL_ROUTE_PREFIX}/${courseId}`;
}

function getCategoryAliases(category: CourseCategorySlug | null | undefined) {
  return category ? CATEGORY_ALIASES[category] ?? [category] : [];
}

function courseMatchesCategory(courseCategory: string | null, intentCategory: CourseCategorySlug | null) {
  if (!courseCategory || !intentCategory) return false;
  return getCategoryAliases(intentCategory).includes(courseCategory);
}

function toPublicCourseRecommendation(
  course: CourseRecommendation,
  matchType: PublicCourseRecommendation["matchType"],
): PublicCourseRecommendation {
  return {
    id: course.id,
    title: course.title,
    mentorName: course.mentor_name,
    category: course.category,
    format: course.format,
    price: course.price,
    location: course.location,
    imageUrl: course.image_url,
    rating: course.rating,
    reviewCount: course.review_count,
    detailUrl: courseLink(course.id),
    matchType,
  };
}

function buildPublicCourseRecommendations(context: CourseRecommendationContext | null) {
  if (!context) return [];
  if (context.exactCourses.length) {
    return context.exactCourses.map((course) => toPublicCourseRecommendation(course, "exact"));
  }
  return context.similarCourses.map((course) => toPublicCourseRecommendation(course, "similar"));
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
  if (error || !data.user?.id) {
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
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    _feature: "chat",
    _credits: CHAT_CREDIT_COST,
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

async function fetchApprovedCourses(
  serviceClient: ReturnType<typeof createClient> | null,
  filters: { category?: CourseCategorySlug | null; format?: CourseFormat | "any" | null },
) {
  if (!serviceClient) return [];

  const runCourseQuery = (includeHiddenColumn: boolean) => {
    let query = serviceClient
      .from("courses")
      .select(
        includeHiddenColumn
          ? "id,title,description,category,format,price,location,rating,review_count,mentor_id,image_url,status,is_hidden"
          : "id,title,description,category,format,price,location,rating,review_count,mentor_id,image_url,status",
      )
      .eq("status", "approved")
      .limit(80);

    if (includeHiddenColumn) query = query.eq("is_hidden", false);
    if (filters.category) query = query.in("category", getCategoryAliases(filters.category));
    if (filters.format && filters.format !== "any") query = query.eq("format", filters.format);

    return query;
  };

  let { data, error } = await runCourseQuery(true);
  const hiddenColumnErrorText = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const hiddenColumnUnavailable =
    error &&
    (error.code === "PGRST204" || error.code === "42703" || hiddenColumnErrorText.includes("is_hidden"));

  if (hiddenColumnUnavailable) {
    const fallback = await runCourseQuery(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("ai-chat course retrieval error:", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return [];
  }

  const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const mentorIds = [...new Set(rows.map((row) => String(row.mentor_id ?? "")).filter(Boolean))];
  const mentorMap = new Map<string, { name: string | null; avatar_url: string | null }>();

  if (mentorIds.length) {
    const { data: mentors, error: mentorError } = await serviceClient
      .from("profiles")
      .select("user_id,name,avatar_url")
      .in("user_id", mentorIds);

    if (mentorError) {
      console.error("ai-chat mentor profile retrieval error:", {
        message: mentorError.message,
        code: mentorError.code,
      });
    } else {
      for (const mentor of mentors ?? []) {
        const row = mentor as Record<string, unknown>;
        mentorMap.set(String(row.user_id), {
          name: typeof row.name === "string" ? row.name : null,
          avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
        });
      }
    }
  }

  return rows.map((row) => {
    const mentorId = typeof row.mentor_id === "string" ? row.mentor_id : null;
    const mentor = mentorId ? mentorMap.get(mentorId) : null;
    return {
      id: String(row.id),
      title: String(row.title ?? ""),
      description: typeof row.description === "string" ? row.description : null,
      category: typeof row.category === "string" ? row.category : null,
      format: typeof row.format === "string" ? row.format : null,
      price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
      location: typeof row.location === "string" ? row.location : null,
      rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
      review_count: Number.isFinite(Number(row.review_count)) ? Number(row.review_count) : null,
      mentor_id: mentorId,
      image_url: typeof row.image_url === "string" ? row.image_url : null,
      mentor_name: mentor?.name ?? "Mentor VET",
      mentor_avatar_url: mentor?.avatar_url ?? null,
      score: 0,
    } satisfies CourseRecommendation;
  });
}

function isCourseDetailQuestion(message: string) {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const asksForOtherCourses = containsAny(normalized, [
    "tim khoa khac",
    "goi y khoa khac",
    "khoa nao khac",
    "lop nao khac",
    "mentor khac",
    "tim mentor",
    "tim lop",
    "tim khoa",
    "so sanh",
  ]);
  if (asksForOtherCourses) return false;

  return containsAny(normalized, [
    "khoa nay",
    "lop nay",
    "course nay",
    "khoa hoc nay",
    "co gi",
    "hoc gi",
    "hoc duoc gi",
    "se hoc duoc gi",
    "toi se hoc duoc gi",
    "noi dung khoa hoc",
    "noi dung",
    "gom nhung gi",
    "phu hop voi ai",
    "danh cho ai",
    "dau ra",
    "ket qua",
    "mo ta",
    "chi tiet",
    "can chuan bi gi",
  ]);
}

function normalizeCourseId(value: unknown) {
  const courseId = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)
    ? courseId
    : null;
}

function formatCourseFormat(format: CourseDetailContext["format"]) {
  if (format === "online") return "Online";
  if (format === "offline") return "Offline";
  return "Chưa cập nhật";
}

function formatScheduleLabel(schedule: CourseDetailSchedule) {
  const day = schedule.day_of_week ?? "Chưa rõ ngày";
  const time =
    schedule.start_time && schedule.end_time
      ? `${schedule.start_time} - ${schedule.end_time}`
      : "Chưa rõ giờ";
  return `${day}: ${time}`;
}

function serializeCourseDetailForPrompt(course: Omit<CourseDetailContext, "systemContext">) {
  const schedules = course.schedules.length
    ? course.schedules.map((schedule) => `- ${formatScheduleLabel(schedule)}`).join("\n")
    : "- Chưa có lịch học cố định trong dữ liệu.";

  return `COURSE_DETAIL_CONTEXT
Người dùng đang ở trang chi tiết khóa học hiện tại trên VET.

Dữ liệu khóa học hiện tại từ Supabase:
- id: ${course.id}
- title: ${course.title}
- description: ${course.description ?? "Chưa có mô tả"}
- category: ${course.category ?? "Chưa cập nhật"}
- format: ${formatCourseFormat(course.format)}
- price: ${formatPrice(course.price)}
- location: ${course.location ?? "Không áp dụng hoặc chưa cập nhật"}
- rating: ${course.rating ?? "Chưa có"} (${course.review_count ?? 0} đánh giá)
- students_count: ${course.students_count ?? 0}
- mentor_id: ${course.mentor_id ?? "Không rõ"}
- mentor_name: ${course.mentor_name ?? "Mentor VET"}
- mentor_headline: ${course.mentor_headline ?? "Chưa cập nhật"}
- mentor_bio: ${course.mentor_bio ?? "Chưa cập nhật"}
- detail_link: ${courseLink(course.id)}

Lịch học cố định:
${schedules}

Quy tắc bắt buộc:
- Trả lời câu hỏi của người dùng dựa trên COURSE_DETAIL_CONTEXT.
- Không bịa syllabus, đầu ra, chứng chỉ, cam kết việc làm, lịch học, giá, mentor hoặc thông tin không có trong dữ liệu.
- Nếu learning outcomes/syllabus không có field riêng, hãy diễn giải từ description và ghi "Theo mô tả hiện có".
- Nếu thông tin còn thiếu, nói rõ thông tin đó chưa được mentor cập nhật.
- Chỉ gợi ý tìm khóa khác nếu người dùng thật sự hỏi tìm khóa khác.`;
}

async function fetchCourseDetailContext(
  serviceClient: ReturnType<typeof createClient> | null,
  courseId: string | null,
) {
  if (!serviceClient || !courseId) return null;

  const runCourseQuery = (includeHiddenColumn: boolean) => {
    let query = serviceClient
      .from("courses")
      .select(
        includeHiddenColumn
          ? "id,title,description,category,format,price,location,rating,review_count,students_count,mentor_id,status,is_hidden"
          : "id,title,description,category,format,price,location,rating,review_count,students_count,mentor_id,status",
      )
      .eq("id", courseId)
      .eq("status", "approved");

    if (includeHiddenColumn) query = query.eq("is_hidden", false);
    return query.limit(1).maybeSingle();
  };

  let { data, error } = await runCourseQuery(true);
  const hiddenColumnErrorText = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const hiddenColumnUnavailable =
    error &&
    (error.code === "PGRST204" || error.code === "42703" || hiddenColumnErrorText.includes("is_hidden"));

  if (hiddenColumnUnavailable) {
    const fallback = await runCourseQuery(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("ai-chat course detail retrieval error:", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return null;
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  const mentorId = typeof row.mentor_id === "string" ? row.mentor_id : null;
  let mentor: { name: string | null; mentor_headline: string | null; bio: string | null } | null = null;

  if (mentorId) {
    const { data: mentorData, error: mentorError } = await serviceClient
      .from("profiles")
      .select("user_id,name,mentor_headline,bio")
      .eq("user_id", mentorId)
      .maybeSingle();

    if (mentorError) {
      console.error("ai-chat course detail mentor retrieval error:", {
        message: mentorError.message,
        code: mentorError.code,
      });
    } else if (mentorData) {
      const mentorRow = mentorData as Record<string, unknown>;
      mentor = {
        name: typeof mentorRow.name === "string" ? mentorRow.name : null,
        mentor_headline: typeof mentorRow.mentor_headline === "string" ? mentorRow.mentor_headline : null,
        bio: typeof mentorRow.bio === "string" ? mentorRow.bio : null,
      };
    }
  }

  const { data: scheduleData, error: scheduleError } = await serviceClient
    .from("course_schedules")
    .select("day_of_week,start_time,end_time")
    .eq("course_id", courseId)
    .order("day_of_week", { ascending: true });

  if (scheduleError) {
    console.error("ai-chat course detail schedule retrieval error:", {
      message: scheduleError.message,
      code: scheduleError.code,
    });
  }

  const schedules = Array.isArray(scheduleData)
    ? scheduleData.map((schedule) => {
        const scheduleRow = schedule as Record<string, unknown>;
        return {
          day_of_week:
            typeof scheduleRow.day_of_week === "string" || typeof scheduleRow.day_of_week === "number"
              ? scheduleRow.day_of_week
              : null,
          start_time: typeof scheduleRow.start_time === "string" ? scheduleRow.start_time : null,
          end_time: typeof scheduleRow.end_time === "string" ? scheduleRow.end_time : null,
        } satisfies CourseDetailSchedule;
      })
    : [];

  const course = {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    category: typeof row.category === "string" ? row.category : null,
    format: typeof row.format === "string" ? row.format : null,
    price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
    location: typeof row.location === "string" ? row.location : null,
    rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
    review_count: Number.isFinite(Number(row.review_count)) ? Number(row.review_count) : null,
    students_count: Number.isFinite(Number(row.students_count)) ? Number(row.students_count) : null,
    mentor_id: mentorId,
    mentor_name: mentor?.name ?? "Mentor VET",
    mentor_headline: mentor?.mentor_headline ?? null,
    mentor_bio: mentor?.bio ?? null,
    schedules,
  };

  return {
    ...course,
    systemContext: serializeCourseDetailForPrompt(course),
  } satisfies CourseDetailContext;
}

function scoreCourse(course: CourseRecommendation, intent: DetectedCourseIntent, mode: "exact" | "similar") {
  const haystack = normalizeText([
    course.title,
    course.description,
    course.category,
    course.location,
    course.mentor_name,
    course.category && CATEGORY_LABELS[course.category as CourseCategorySlug],
  ].filter(Boolean).join(" "));
  const keywordTerms = normalizeText(intent.keyword ?? "")
    .split(" ")
    .filter((term) => term.length >= 3);
  let score = 0;

  if (courseMatchesCategory(course.category, intent.category)) score += mode === "exact" ? 45 : 35;
  if (intent.format !== "any" && course.format === intent.format) score += 18;
  if (intent.location && course.location && normalizeText(course.location).includes(normalizeText(intent.location))) score += 12;
  if (keywordTerms.length && keywordTerms.some((term) => haystack.includes(term))) score += 20;
  if (!keywordTerms.length && !intent.category) score += 10;
  score += Math.min(Number(course.rating ?? 0), 5);
  score += Math.min(Number(course.review_count ?? 0), 20) / 10;

  return score;
}

function rankCourses(courses: CourseRecommendation[], intent: DetectedCourseIntent, mode: "exact" | "similar") {
  return courses
    .map((course) => ({ ...course, score: scoreCourse(course, intent, mode) }))
    .filter((course) => course.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function serializeCoursesForPrompt(courses: CourseRecommendation[]) {
  if (!courses.length) return "- Không có khóa học.";
  return courses
    .map((course, index) => {
      const formatLabel = course.format === "offline" ? "Offline" : course.format === "online" ? "Online" : "Chưa rõ";
      return [
        `${index + 1}. ${course.title}`,
        `   - id: ${course.id}`,
        `   - mentor: ${course.mentor_name ?? "Mentor VET"}`,
        `   - category: ${course.category ?? "unknown"}`,
        `   - format: ${formatLabel}`,
        `   - location: ${course.location ?? "Không có địa điểm"}`,
        `   - price: ${formatPrice(course.price)}`,
        `   - rating: ${course.rating ?? "Chưa có"} (${course.review_count ?? 0} đánh giá)`,
        `   - link: ${courseLink(course.id)}`,
      ].join("\n");
    })
    .join("\n");
}

async function buildCourseRecommendationContext(
  serviceClient: ReturnType<typeof createClient> | null,
  intent: DetectedCourseIntent,
) {
  if (!intent.shouldRetrieve) return null;

  const exactCandidates = await fetchApprovedCourses(serviceClient, {
    category: intent.category,
    format: intent.format,
  });
  const exactCourses = rankCourses(exactCandidates, intent, "exact");

  let similarCourses: CourseRecommendation[] = [];
  if (!exactCourses.length) {
    const similarCandidates = await fetchApprovedCourses(serviceClient, {
      category: intent.category,
      format: null,
    });
    similarCourses = rankCourses(similarCandidates, intent, "similar");

    if (!similarCourses.length && (intent.category || intent.format !== "any")) {
      const broadCandidates = await fetchApprovedCourses(serviceClient, { category: null, format: intent.format });
      similarCourses = rankCourses(broadCandidates, intent, "similar");
    }
  }

  const systemContext = `COURSE_RECOMMENDATION_CONTEXT
Người dùng đang hỏi về khóa học thật trên VET.
Yêu cầu gốc: ${intent.originalRequest || "(trống)"}
Intent đã tách:
- keyword: ${intent.keyword ?? "không rõ"}
- category: ${intent.category ?? "any"}
- format: ${intent.format}
- location: ${intent.location ?? "không rõ"}
- needs_location: ${intent.needsLocation ? "true" : "false"}

Khóa học khớp trực tiếp từ Supabase:
${serializeCoursesForPrompt(exactCourses)}

Khóa học tương tự từ Supabase:
${serializeCoursesForPrompt(similarCourses)}

Quy tắc bắt buộc:
- Chỉ nhắc tới khóa học có trong COURSE_RECOMMENDATION_CONTEXT.
- Nếu danh sách khớp trực tiếp có khóa học, hãy giới thiệu tối đa 3 khóa học đó với link ${COURSE_DETAIL_ROUTE_PREFIX}/{id}.
- Nếu không có khớp trực tiếp nhưng có khóa tương tự, nói rõ VET chưa có khóa đúng hoàn toàn rồi giới thiệu khóa tương tự.
- Nếu không có khóa nào, nói rõ VET chưa có khóa phù hợp trong dữ liệu đang hiển thị.
- Nếu needs_location=true, không khẳng định khóa học ở gần người dùng; hãy hỏi thêm khu vực hoặc gợi ý mở Bản đồ.
- Không bịa tên khóa học, mentor, giá, địa điểm, link hoặc tình trạng còn chỗ.`;

  return {
    intent,
    exactCourses,
    similarCourses,
    systemContext,
  } satisfies CourseRecommendationContext;
}

function buildDeterministicCourseAnswer(context: CourseRecommendationContext) {
  const { intent, exactCourses, similarCourses } = context;
  const requestText = intent.originalRequest || "nhu cầu này";
  const intro = intent.needsLocation
    ? "Mình cần khu vực cụ thể hoặc bạn có thể mở Bản đồ để kiểm tra lớp gần vị trí của bạn. Mình không thể tự biết vị trí hiện tại nếu bạn chưa cung cấp."
    : "";
  const courses = exactCourses.length ? exactCourses : similarCourses;

  if (!courses.length) {
    return `${intro ? `${intro}\n\n` : ""}Hiện tại VET chưa có khóa học phù hợp trong dữ liệu đang hiển thị cho nhu cầu "${requestText}". Bạn có thể thử mở rộng khu vực, đổi từ khóa, hoặc theo dõi thêm khi mentor mới đăng khóa học.`;
  }

  const heading = exactCourses.length
    ? "Hiện tại VET có một số khóa học phù hợp với nhu cầu của bạn:"
    : `Hiện tại VET chưa có khóa học đúng hoàn toàn với nhu cầu "${requestText}". Tuy nhiên, bạn có thể tham khảo các khóa học tương tự sau:`;

  const items = courses
    .map((course, index) => {
      const formatLabel = course.format === "offline" ? "Offline" : course.format === "online" ? "Online" : "Chưa rõ hình thức";
      const locationLine = course.format === "offline" ? `\nĐịa điểm: ${course.location ?? "Chưa cập nhật"}` : "";
      const ratingLine = course.rating ? `\nĐánh giá: ${course.rating} (${course.review_count ?? 0} đánh giá)` : "";
      return `${index + 1}. **${course.title}**\nMentor: ${course.mentor_name ?? "Mentor VET"}\nHình thức: ${formatLabel}${locationLine}\nGiá: ${formatPrice(course.price)}${ratingLine}\n[Xem chi tiết khóa học](${courseLink(course.id)})`;
    })
    .join("\n\n");

  return `${intro ? `${intro}\n\n` : ""}${heading}\n\n${items}`;
}

function shouldUseDeterministicCourseAnswer(text: string, context: CourseRecommendationContext | null) {
  if (!context) return false;
  const courses = [...context.exactCourses, ...context.similarCourses];
  if (!courses.length) return !normalizeText(text).includes("chua co");
  return !courses.some((course) => text.includes(courseLink(course.id)));
}

async function updateAiUsageMetadata(
  usageLogId: string | null,
  aiResult: CallAIResult | null,
  task: string,
  extraMetadata: Record<string, unknown> = {},
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
    .update({
      metadata: {
        ...existingMetadata,
        ...extraMetadata,
        provider: aiResult?.provider ?? "internal_course_retrieval",
        model: aiResult?.model ?? null,
        input_tokens: aiResult?.usage?.inputTokens ?? null,
        output_tokens: aiResult?.usage?.outputTokens ?? null,
        total_tokens: aiResult?.usage?.totalTokens ?? null,
        task,
      },
    })
    .eq("id", usageLogId);

  if (error) {
    console.error("ai_usage_logs metadata update error:", {
      message: error.message,
      code: error.code,
    });
  }
}

function getPromptPreview(messages: ChatMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return String(lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "");
}

function sanitizeChatContent(value: unknown, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function buildConversationTitle(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return "Cuộc trò chuyện EduBot";
  const words = compact.split(" ").slice(0, 10).join(" ");
  return words.length > 80 ? `${words.slice(0, 77)}...` : words;
}

async function ensureChatConversation(
  serviceClient: ReturnType<typeof createClient> | null,
  learnerId: string,
  requestedConversationId: string | null,
  titleSeed: string,
) {
  if (!serviceClient) return null;

  try {
    if (requestedConversationId) {
      const { data, error } = await serviceClient
        .from("ai_chat_conversations")
        .select("id")
        .eq("id", requestedConversationId)
        .eq("learner_id", learnerId)
        .maybeSingle();

      if (error) throw error;
      if (data?.id) return data.id as string;
    }

    const { data: latestConversation, error: latestError } = await serviceClient
      .from("ai_chat_conversations")
      .select("id")
      .eq("learner_id", learnerId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    if (latestConversation?.id) return latestConversation.id as string;

    const { data: createdConversation, error: createError } = await serviceClient
      .from("ai_chat_conversations")
      .insert({
        learner_id: learnerId,
        title: buildConversationTitle(titleSeed),
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createError) throw createError;
    return (createdConversation?.id as string | undefined) ?? null;
  } catch (error) {
    console.error("ai-chat conversation save error:", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function saveChatMessage(
  serviceClient: ReturnType<typeof createClient> | null,
  payload: {
    conversationId: string | null;
    learnerId: string;
    role: ChatRole;
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!serviceClient || !payload.conversationId || !payload.content.trim()) return null;

  try {
    const { data, error } = await serviceClient
      .from("ai_chat_messages")
      .insert({
        conversation_id: payload.conversationId,
        learner_id: payload.learnerId,
        role: payload.role,
        content: sanitizeChatContent(payload.content, 8000),
        metadata: payload.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  } catch (error) {
    console.error("ai-chat message save error:", {
      role: payload.role,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function touchChatConversation(
  serviceClient: ReturnType<typeof createClient> | null,
  conversationId: string | null,
  titleSeed: string,
) {
  if (!serviceClient || !conversationId) return;

  try {
    const { data: conversation, error: fetchError } = await serviceClient
      .from("ai_chat_conversations")
      .select("title")
      .eq("id", conversationId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const updates: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
    };

    if (!conversation?.title) {
      updates.title = buildConversationTitle(titleSeed);
    }

    const { error: updateError } = await serviceClient
      .from("ai_chat_conversations")
      .update(updates)
      .eq("id", conversationId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error("ai-chat conversation update error:", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function createSseResponse(text: string, metadata?: ChatHistoryMetadata) {
  const encoder = new TextEncoder();
  const events = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    "",
  ];

  if (metadata?.recommendations?.length) {
    events.push(
      `data: ${JSON.stringify({ recommendations: metadata.recommendations })}`,
      "",
    );
  }

  if (metadata?.conversation_id || metadata?.message_id) {
    events.push(
      `data: ${JSON.stringify({
        conversation_id: metadata.conversation_id ?? null,
        message_id: metadata.message_id ?? null,
      })}`,
      "",
    );
  }

  events.push("data: [DONE]", "");
  const payload = events.join("\n");

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

const systemPrompt = `Bạn là EduBot - trợ lý AI thông minh của VET, nền tảng giáo dục kết nối người học và mentor.

Nhiệm vụ:
- Giúp người dùng tìm khóa học phù hợp.
- Gợi ý mentor dựa trên nhu cầu.
- Tư vấn lộ trình học tập.
- Trả lời câu hỏi về nền tảng.

Danh mục khóa học hợp lệ của VET:
- Cờ & Tư duy chiến thuật (slug: mind-sports)
- Tiếng Anh công việc & học tập (slug: career-english)
- Thể thao hiện đại (slug: modern-sports)
- Barista & Đồ uống (slug: barista-beverage)
- Nội dung, MC & Thuyết trình (slug: content-speaking)
- AI & Công cụ làm việc (slug: ai-productivity)

Nếu cần nhắc tới category trong câu trả lời hoặc gợi ý có cấu trúc, chỉ dùng một trong 6 slug hợp lệ trên.

Khi người dùng hỏi gợi ý khóa học, mentor, lớp học, học online/offline hoặc lớp gần khu vực:
- Luôn dùng COURSE_RECOMMENDATION_CONTEXT nếu được cung cấp.
- Nếu COURSE_RECOMMENDATION_CONTEXT có khóa học khớp, hãy giới thiệu khóa học đó với link chi tiết.
- Nếu không có khóa học khớp trực tiếp, nói rõ VET chưa có khóa đúng hoàn toàn rồi chỉ gợi ý các khóa tương tự có trong context.
- Nếu context không có khóa nào, nói rõ VET hiện chưa có khóa phù hợp trong dữ liệu đang hiển thị.
- Không chỉ bảo người dùng tự đi tìm kiếm/lọc thủ công nếu context đã có khóa học.
- Tuyệt đối không bịa tên khóa học, mentor, giá, địa điểm, link hoặc tình trạng còn chỗ.

Khi có COURSE_DETAIL_CONTEXT:
- Người dùng đang ở trang chi tiết một khóa học cụ thể; hãy ưu tiên trả lời về khóa học đó thay vì search chung.
- Trả lời bằng các mục: Tóm tắt khóa học, Bạn sẽ học được gì, Hình thức học/giá/lịch học, Khóa này phù hợp với ai, Điều nên hỏi mentor thêm.
- Chỉ dùng dữ liệu có trong COURSE_DETAIL_CONTEXT. Nếu thiếu syllabus hoặc learning outcomes, hãy ghi "Theo mô tả hiện có" trước khi diễn giải từ description.
- Không bịa cam kết đầu ra, chứng chỉ, việc làm, số buổi học hoặc lịch học.

Phong cách: thân thiện, ngắn gọn, dùng tiếng Việt. Giữ câu trả lời dưới 150 từ.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const safeMessages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const requestedConversationId =
      typeof body?.conversation_id === "string" && body.conversation_id.trim()
        ? body.conversation_id.trim()
        : null;
    const promptPreview = sanitizeChatContent(getPromptPreview(safeMessages), 1000);
    const courseIntent = detectCourseIntent(promptPreview);
    const pageContext = body?.page_context === "course_detail" ? "course_detail" : null;
    const currentCourseId = pageContext === "course_detail" ? normalizeCourseId(body?.course_id) : null;
    const courseDetailIntent =
      pageContext === "course_detail" && Boolean(currentCourseId) && isCourseDetailQuestion(promptPreview);

    const { error: authError, supabase, userId } = await getAuthedSupabase(req);
    if (authError || !supabase || !userId) {
      return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    }
    supabaseForFinalize = supabase;

    const reservation = await reserveAiUsage(supabase, promptPreview, {
      function: "ai-chat",
      feature: "chat",
      messageCount: safeMessages.length,
      provider: "gemini",
      conversation_id: requestedConversationId,
      page_context: pageContext,
      course_id: currentCourseId,
      task: courseDetailIntent ? "course_detail_chat" : "chat",
      course_detail_intent: courseDetailIntent,
      course_recommendation_intent: courseIntent.shouldRetrieve,
      course_category: courseIntent.category,
      course_format: courseIntent.format,
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const serviceClient = getServiceSupabase();
    const conversationId = await ensureChatConversation(
      serviceClient,
      userId,
      requestedConversationId,
      promptPreview,
    );
    const userMessageId = await saveChatMessage(serviceClient, {
      conversationId,
      learnerId: userId,
      role: "user",
      content: promptPreview,
      metadata: {
        feature: "chat",
        usage_log_id: usageLogId,
        page_context: pageContext,
        course_id: currentCourseId,
        course_detail_intent: courseDetailIntent,
        course_recommendation_intent: courseIntent.shouldRetrieve,
      },
    });

    const courseDetailContext = courseDetailIntent
      ? await fetchCourseDetailContext(serviceClient ?? supabase, currentCourseId)
      : null;
    const courseContext = courseDetailIntent
      ? null
      : await buildCourseRecommendationContext(serviceClient ?? supabase, courseIntent);
    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = safeMessages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content ?? ""),
    }));
    if (courseDetailContext?.systemContext) {
      aiMessages.unshift({ role: "system", content: courseDetailContext.systemContext });
    } else if (courseContext?.systemContext) {
      aiMessages.unshift({ role: "system", content: courseContext.systemContext });
    }

    let aiResult: CallAIResult | null = null;
    let assistantText: string;
    const task = courseDetailIntent ? "course_detail_chat" : "chat";

    if (courseDetailIntent && !courseDetailContext) {
      assistantText =
        "Hiện mình chưa lấy được thông tin chi tiết khóa học này. Bạn có thể thử lại hoặc xem phần mô tả khóa học bên dưới.";
    } else if (courseDetailContext) {
      aiResult = await callAI({
        task: "chat",
        modelTier: "fast",
        systemPrompt,
        messages: aiMessages,
        temperature: 0.45,
      });
      assistantText = aiResult.text;
    } else if (courseContext) {
      assistantText = buildDeterministicCourseAnswer(courseContext);
    } else {
      aiResult = await callAI({
        task: "chat",
        modelTier: "fast",
        systemPrompt,
        messages: aiMessages,
        temperature: 0.7,
      });
      assistantText = aiResult.text;
    }

    const recommendations = courseDetailIntent ? [] : buildPublicCourseRecommendations(courseContext);

    await finalizeAiUsage(supabase, usageLogId, "success", null);

    const assistantMessageId = await saveChatMessage(serviceClient, {
      conversationId,
      learnerId: userId,
      role: "assistant",
      content: assistantText,
      metadata: {
        feature: "chat",
        usage_log_id: usageLogId,
        user_message_id: userMessageId,
        provider: aiResult?.provider ?? "internal_course_retrieval",
        model: aiResult?.model ?? null,
        input_tokens: aiResult?.usage?.inputTokens ?? null,
        output_tokens: aiResult?.usage?.outputTokens ?? null,
        total_tokens: aiResult?.usage?.totalTokens ?? null,
        page_context: pageContext,
        course_id: currentCourseId,
        task,
        course_detail_intent: courseDetailIntent,
        course_detail_found: courseDetailIntent ? Boolean(courseDetailContext) : null,
        course_detail_title: courseDetailContext?.title ?? null,
        course_recommendation_intent: courseIntent.shouldRetrieve,
        exact_course_count: courseContext?.exactCourses.length ?? 0,
        similar_course_count: courseContext?.similarCourses.length ?? 0,
        recommendations,
      },
    });
    await touchChatConversation(serviceClient, conversationId, promptPreview);

    await updateAiUsageMetadata(usageLogId, aiResult, task, {
      conversation_id: conversationId,
      user_message_id: userMessageId,
      assistant_message_id: assistantMessageId,
      page_context: pageContext,
      course_id: currentCourseId,
      course_detail_intent: courseDetailIntent,
      course_detail_found: courseDetailIntent ? Boolean(courseDetailContext) : null,
      course_detail_title: courseDetailContext?.title ?? null,
      course_recommendation_intent: courseIntent.shouldRetrieve,
      course_category: courseIntent.category,
      course_format: courseIntent.format,
      exact_course_count: courseContext?.exactCourses.length ?? 0,
      similar_course_count: courseContext?.similarCourses.length ?? 0,
      recommended_course_ids: recommendations.map((course) => course.id),
    });

    return new Response(createSseResponse(assistantText, {
      conversation_id: conversationId,
      message_id: assistantMessageId,
      recommendations,
    }), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown AI error";
    console.error("ai-chat error:", {
      message,
      name: e instanceof Error ? e.name : null,
    });
    if (supabaseForFinalize && usageLogId) {
      await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    }
    return jsonResponse({
      error: "Không thể dùng EduBot lúc này. Nếu AI đã lỗi, credit sẽ được hoàn qua hệ thống.",
      details: message,
    }, 500);
  }
});
