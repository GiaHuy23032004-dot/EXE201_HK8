import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { useLearnerSearchCourses } from "@/hooks/useLearnerCourses";
import { Search, SlidersHorizontal, MapPin, X, LayoutGrid, List, Sparkles, Loader2, GitCompareArrows, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { usePublicMentorTrustBadgeMap } from "@/hooks/usePublicMentorVerification";
import { COURSE_CATEGORIES, getCourseCategoryShortLabel, normalizeCourseCategory } from "@/constants/courseCategories";
import { useToast } from "@/hooks/use-toast";
import { COURSE_COMPARE_GOALS, DEFAULT_COMPARE_GOAL } from "@/utils/courseCompareRubrics";

type CourseSuggestionRecommendation = {
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
    category: string;
    format: "online" | "offline";
    location?: string;
    studentsCount?: number;
    promoted?: boolean;
  };
};

type CourseSuggestionResult = {
  intent_summary: string;
  detected_category: string | null;
  detected_format: "online" | "offline" | "any";
  detected_budget: number | null;
  recommendations: CourseSuggestionRecommendation[];
  follow_up_question: string | null;
};

type SuggestionCourseInput = {
  id: string;
  title: string;
  mentorName: string;
  mentorAvatar: string;
  price: number;
  rating: number;
  reviewCount: number;
  image: string;
  category: string;
  format: "online" | "offline";
  location?: string;
  promoted?: boolean;
  studentsCount?: number;
  scheduleSummary?: string | null;
  mentorBadges?: string[];
};

type CompareCourse = {
  id: string;
  title: string;
  category: string | null;
  format?: "online" | "offline";
  price?: number;
  mentorName: string;
  location?: string | null;
  rating?: number;
  reviewCount?: number;
  studentsCount?: number;
  mentorBadges?: string[];
  scheduleSummary?: string | null;
};

type CompareTableRow = {
  criterion: string;
  values: Array<{ courseId: string; value: string }>;
};

type CompareDecisionBranch = {
  condition: string;
  courseId: string | null;
  reason: string;
};

type CourseCompareResult = {
  relation: "same_category" | "cross_category";
  summary: string;
  decisionBranches: CompareDecisionBranch[];
  tableRows: CompareTableRow[];
  missingInformation: string[];
  questionsToAskMentor: string[];
  courses: CompareCourse[];
};

function formatVnd(value: number | null | undefined) {
  if (!value) return "";
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

const SUGGESTION_MATCH_THRESHOLD = 25;

const SUGGESTION_TOPIC_GROUPS = [
  { id: "martial_arts", terms: ["vo thuat", "mma", "boxing", "karate", "taekwondo", "vovinam", "muay thai", "kickboxing", "judo"] },
  { id: "racket_sports", terms: ["pickleball", "tennis", "cau long", "badminton", "bong ban"] },
  { id: "guitar", terms: ["guitar", "gita", "dan guitar", "acoustic"] },
  { id: "english", terms: ["tieng anh", "english", "ielts", "toeic", "anh van", "giao tiep tieng anh"] },
  { id: "programming", terms: ["python", "java", "react", "javascript", "typescript", "fullstack", "backend", "frontend", "lap trinh", "coding", "web"] },
  { id: "design_creative", terms: ["photoshop", "figma", "thiet ke", "design", "ui ux", "illustrator"] },
  { id: "public_speaking", terms: ["mc", "thuyet trinh", "public speaking", "noi truoc dam dong", "dan chuong trinh"] },
  { id: "barista", terms: ["barista", "pha che", "ca phe", "coffee", "do uong", "bartender", "cocktail"] },
  { id: "wellness", terms: ["yoga", "gym", "fitness", "boi", "swimming"] },
];

function findSuggestionTopicGroup(normalizedText: string) {
  return SUGGESTION_TOPIC_GROUPS.find((group) => group.terms.some((term) => normalizedText.includes(term))) ?? null;
}

function getSuggestionTopicScore(topicGroupId: string | null, haystack: string) {
  if (!topicGroupId) return { required: false, score: 0 };
  const topicGroup = SUGGESTION_TOPIC_GROUPS.find((group) => group.id === topicGroupId);
  if (!topicGroup) return { required: false, score: 0 };
  return topicGroup.terms.some((term) => haystack.includes(term))
    ? { required: true, score: 32 }
    : { required: true, score: 0 };
}

function inferSuggestionCategory(query: string) {
  const normalized = normalizeSearchText(query);
  const categoryTerms: Array<{ slug: string; terms: string[] }> = [
    { slug: "career-english", terms: ["tieng anh", "english", "ielts", "toeic", "giao tiep"] },
    { slug: "modern-sports", terms: ["pickleball", "tennis", "cau long", "badminton", "bong ro", "the thao", "yoga", "fitness", "gym", "vo thuat", "mma", "boxing", "karate", "taekwondo", "vovinam", "muay thai", "kickboxing", "judo"] },
    { slug: "ai-productivity", terms: ["ai", "lap trinh", "code", "python", "react", "java", "excel", "automation", "cong cu"] },
    { slug: "content-speaking", terms: ["mc", "thuyet trinh", "noi truoc dam dong", "content", "video", "sang tao"] },
    { slug: "barista-beverage", terms: ["barista", "pha che", "ca phe", "cafe", "do uong", "bartender"] },
    { slug: "mind-sports", terms: ["co vua", "co tuong", "chess", "tu duy", "chien thuat"] },
  ];
  return categoryTerms.find((entry) => includesAny(normalized, entry.terms))?.slug ?? null;
}

function inferSuggestionFormat(query: string): "online" | "offline" | "any" {
  const normalized = normalizeSearchText(query);
  if (includesAny(normalized, ["online", "truc tuyen", "tu xa"])) return "online";
  if (includesAny(normalized, ["offline", "truc tiep", "gan toi", "gan day", "quan ", "o "])) return "offline";
  return "any";
}

function inferSuggestionBudget(query: string) {
  const normalized = normalizeSearchText(query);
  const hasBudgetIntent = includesAny(normalized, ["duoi", "ngan sach", "gia", "hoc phi", "toi da", "vnd", "dong", " k", " nghin", " trieu"]);
  const budgetMatch = normalized.match(/(?:duoi|ngan sach|gia|hoc phi|toi da|<=|<)?\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|tr|trieu|vnd|dong|d)?/);
  if (!budgetMatch || (!hasBudgetIntent && !budgetMatch[2])) return null;
  const raw = Number(budgetMatch[1].replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = budgetMatch[2] ?? "";
  if (unit === "tr" || unit === "trieu") return Math.round(raw * 1_000_000);
  if (unit === "k" || unit === "nghin") return Math.round(raw * 1_000);
  return raw > 10_000 ? Math.round(raw) : Math.round(raw * 1_000);
}

function extractSuggestionKeywords(query: string) {
  const stopWords = new Set([
    "toi",
    "muon",
    "hoc",
    "khoa",
    "lop",
    "tim",
    "goi",
    "y",
    "duoi",
    "tren",
    "gan",
    "o",
    "tai",
    "online",
    "offline",
    "truc",
    "tuyen",
    "tiep",
  ]);
  return normalizeSearchText(query)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stopWords.has(term))
    .slice(0, 8);
}

function buildCourseSuggestions(
  courses: SuggestionCourseInput[],
  query: string,
  selectedCategory: string | null,
  selectedFormat: "all" | "online" | "offline",
  maxBudget: number,
  locationQuery: string,
): CourseSuggestionResult {
  const inferredCategory = selectedCategory || inferSuggestionCategory(query);
  const inferredFormat = selectedFormat !== "all" ? selectedFormat : inferSuggestionFormat(query);
  const inferredBudget = inferSuggestionBudget(query) ?? (maxBudget < 1_000_000 ? maxBudget : null);
  const keywords = extractSuggestionKeywords(query);
  const topicGroup = findSuggestionTopicGroup(normalizeSearchText(query));
  const normalizedLocation = normalizeSearchText(locationQuery || query);

  const scored = courses
    .map((course) => {
      let score = 0;
      const reasons: string[] = [];
      const haystack = normalizeSearchText([
        course.title,
        getCourseCategoryShortLabel(course.category),
        course.mentorName,
        course.location,
      ].filter(Boolean).join(" "));
      const topicScore = getSuggestionTopicScore(topicGroup?.id ?? null, haystack);
      if (topicScore.required && topicScore.score <= 0) {
        return { course, score: 0, reasons };
      }

      const keywordHits = keywords.filter((keyword) => haystack.includes(keyword)).length;
      score += topicScore.score;

      if (keywordHits > 0) {
        score += Math.min(24, keywordHits * 8);
        reasons.push("Khớp với từ khóa bạn nhập.");
      }

      if (inferredCategory && course.category === inferredCategory) {
        score += keywords.length || topicScore.required ? 10 : 25;
        reasons.push(`Khớp với danh mục ${getCourseCategoryShortLabel(course.category)}.`);
      }

      if (!topicScore.required && keywords.length && keywordHits === 0 && inferredCategory !== course.category) {
        return { course, score: 0, reasons: [] };
      }

      if (inferredFormat !== "any" && course.format === inferredFormat) {
        score += 10;
        reasons.push(`Hình thức ${course.format === "online" ? "online" : "offline"}.`);
      }

      if (inferredBudget && course.price <= inferredBudget) {
        score += 10;
        reasons.push(`Phù hợp ngân sách dưới ${formatVnd(inferredBudget)}.`);
      }

      const ratingScore = Math.min(10, Math.round(Number(course.rating ?? 0) + Math.min(Number(course.reviewCount ?? 0), 20) / 4));
      if (ratingScore > 0 && score >= SUGGESTION_MATCH_THRESHOLD) {
        score += ratingScore;
        reasons.push("Có dữ liệu đánh giá/review để tham khảo.");
      }

      const normalizedCourseLocation = normalizeSearchText(course.location);
      if (
        (course.scheduleSummary && inferredFormat !== "online") ||
        (normalizedLocation && normalizedCourseLocation && normalizedLocation.split(" ").some((part) => part.length >= 3 && normalizedCourseLocation.includes(part)))
      ) {
        score += 5;
        reasons.push(course.location ? "Có địa điểm/lịch học để đối chiếu." : "Có lịch học để tham khảo.");
      }

      return { course, score, reasons };
    })
    .filter((item) => item.score >= SUGGESTION_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const recommendations = scored.map(({ course, score, reasons }) => ({
    course_id: course.id,
    match_score: Math.min(100, score),
    reason: reasons.slice(0, 3).join(" "),
    pros: reasons.slice(0, 3),
    considerations: [
      !course.scheduleSummary ? "Chưa có lịch học trong dữ liệu danh sách." : "",
      !course.mentorBadges?.length ? "Chưa có badge uy tín công khai." : "",
    ].filter(Boolean),
    course: {
      id: course.id,
      title: course.title,
      mentorName: course.mentorName,
      mentorAvatar: course.mentorAvatar,
      price: course.price,
      rating: course.rating,
      reviewCount: course.reviewCount,
      image: course.image,
      category: course.category,
      format: course.format,
      location: course.location,
      studentsCount: course.studentsCount,
      promoted: course.promoted,
    },
  }));

  return {
    intent_summary: query.trim() || "Gợi ý dựa trên bộ lọc hiện tại.",
    detected_category: inferredCategory,
    detected_format: inferredFormat,
    detected_budget: inferredBudget,
    recommendations,
    follow_up_question: recommendations.length
      ? "Bạn có thể mở chi tiết khóa học để xem mô tả, lịch học và đặt câu hỏi cho mentor."
      : null,
  };
}

function formatCompareVnd(value: number | null | undefined) {
  return value ? formatVnd(value) : "Chưa cập nhật";
}

function formatCompareRating(course: CompareCourse) {
  const rating = Number(course.rating ?? 0);
  const reviews = Number(course.reviewCount ?? 0);
  if (!rating && !reviews) return "Chưa có đánh giá";
  return `${rating ? rating.toFixed(1) : "Chưa có điểm"} · ${reviews} đánh giá`;
}

function formatCompareSchedule(course: CompareCourse) {
  return course.scheduleSummary || "Chưa có lịch học trong dữ liệu danh sách";
}

function formatCompareTrustBadge(course: CompareCourse) {
  return course.mentorBadges?.length ? course.mentorBadges.join(", ") : "Chưa có badge uy tín công khai";
}

function formatCompareLocation(course: CompareCourse) {
  if (course.format === "online") return "Online";
  return course.location || "Chưa cập nhật địa điểm";
}

function trustScore(course: CompareCourse) {
  const ratingScore = Number(course.rating ?? 0) * 20;
  const reviewScore = Math.min(Number(course.reviewCount ?? 0), 100);
  const studentScore = Math.min(Number(course.studentsCount ?? 0), 100) / 2;
  const badgeScore = course.mentorBadges?.length ? 25 : 0;
  return ratingScore + reviewScore + studentScore + badgeScore;
}

function pickByScore(courses: CompareCourse[], scorer: (course: CompareCourse) => number) {
  let bestCourse: CompareCourse | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const course of courses) {
    const score = scorer(course);
    if (score > bestScore) {
      bestCourse = course;
      bestScore = score;
    }
  }
  return bestCourse;
}

function buildCompareBranch(
  condition: string,
  course: CompareCourse | null,
  reason: string,
): CompareDecisionBranch {
  return {
    condition,
    courseId: course?.id ?? null,
    reason,
  };
}

function buildCourseComparison(courses: CompareCourse[], selectedGoal: string): CourseCompareResult {
  const categorySet = new Set(courses.map((course) => course.category).filter(Boolean));
  const relation = categorySet.size <= 1 ? "same_category" : "cross_category";
  const lowerCostCourse = pickByScore(courses, (course) => -Number(course.price ?? Number.MAX_SAFE_INTEGER));
  const trustedCourse = pickByScore(courses, trustScore);
  const flexibleCourse = pickByScore(courses, (course) => {
    const onlineScore = course.format === "online" ? 40 : 0;
    const scheduleScore = course.scheduleSummary ? 20 : 0;
    return onlineScore + scheduleScore + trustScore(course) / 20;
  });
  const practicalCourse = pickByScore(courses, (course) => {
    const offlineScore = course.format === "offline" ? 45 : 0;
    const categoryScore = ["modern-sports", "barista-beverage", "content-speaking"].includes(course.category ?? "") ? 25 : 0;
    return offlineScore + categoryScore + trustScore(course) / 20;
  });
  const careerCourse = pickByScore(courses, (course) => {
    const categoryScore = ["ai-productivity", "career-english", "content-speaking"].includes(course.category ?? "") ? 45 : 0;
    return categoryScore + trustScore(course) / 20;
  });
  const beginnerCourse = pickByScore(courses, (course) => {
    const affordableScore = course.price ? Math.max(0, 50 - course.price / 20000) : 10;
    return affordableScore + trustScore(course) / 25;
  });
  const confidenceCourse = pickByScore(courses, (course) => {
    const categoryScore = ["career-english", "content-speaking"].includes(course.category ?? "") ? 45 : 0;
    const offlineScore = course.format === "offline" ? 12 : 0;
    return categoryScore + offlineScore + trustScore(course) / 20;
  });
  const hobbyCourse = pickByScore(courses, (course) => {
    const categoryScore = ["modern-sports", "mind-sports", "barista-beverage"].includes(course.category ?? "") ? 35 : 0;
    return categoryScore + trustScore(course) / 25;
  });

  const branches = [
    buildCompareBranch(
      "Học để đi làm",
      careerCourse,
      careerCourse
        ? `${careerCourse.title} có tín hiệu phù hợp hơn với mục tiêu ứng dụng nghề nghiệp dựa trên category, đánh giá và dữ liệu mentor hiện có.`
        : "Các khóa thuộc hướng học khác nhau; VET chưa có đủ dữ liệu đầu ra nghề nghiệp để chọn thay bạn.",
    ),
    buildCompareBranch(
      "Học từ số 0",
      beginnerCourse,
      "VET chưa có field yêu cầu đầu vào riêng, nên gợi ý này ưu tiên học phí dễ tiếp cận và tín hiệu tin cậy công khai.",
    ),
    buildCompareBranch(
      "Giao tiếp/tự tin hơn",
      confidenceCourse,
      "Ưu tiên khóa thuộc hướng tiếng Anh, nội dung, MC hoặc thuyết trình; nếu khác lĩnh vực, hãy chọn theo mục tiêu thật của bạn.",
    ),
    buildCompareBranch(
      "Giải trí/sức khỏe",
      hobbyCourse,
      "Ưu tiên các khóa thể thao, tư duy chiến thuật hoặc trải nghiệm thực hành nhẹ nhàng nếu dữ liệu category phù hợp.",
    ),
    buildCompareBranch(
      "Tiết kiệm học phí",
      lowerCostCourse,
      lowerCostCourse ? `${lowerCostCourse.title} đang có học phí thấp hơn trong các khóa đã chọn.` : "Chưa đủ dữ liệu học phí để so sánh.",
    ),
    buildCompareBranch(
      "Mentor uy tín hơn",
      trustedCourse,
      trustedCourse
        ? `${trustedCourse.title} có tín hiệu tin cậy tốt hơn dựa trên rating, số đánh giá, số học viên và badge công khai nếu có.`
        : "Chưa đủ dữ liệu rating, review hoặc badge để so sánh độ tin cậy.",
    ),
    buildCompareBranch(
      "Linh hoạt lịch học",
      flexibleCourse,
      flexibleCourse
        ? `${flexibleCourse.title} có lợi thế hơn nếu bạn ưu tiên học online hoặc khóa có lịch học đã được cập nhật.`
        : "Chưa đủ dữ liệu lịch học để đánh giá độ linh hoạt.",
    ),
  ];

  const selectedGoalMap: Record<string, string> = {
    career: "Học để đi làm",
    beginner_zero: "Học từ số 0",
    communication_confidence: "Giao tiếp/tự tin hơn",
    hobby_health: "Giải trí/sức khỏe",
    lower_cost: "Tiết kiệm học phí",
    trusted_mentor: "Mentor uy tín hơn",
    unsure: "Mentor uy tín hơn",
  };
  const selectedCondition = selectedGoalMap[selectedGoal];
  const orderedBranches = selectedCondition
    ? [
        ...branches.filter((branch) => branch.condition === selectedCondition),
        ...branches.filter((branch) => branch.condition !== selectedCondition),
      ]
    : branches;

  const tableRows: CompareTableRow[] = [
    { criterion: "Học phí", values: courses.map((course) => ({ courseId: course.id, value: formatCompareVnd(course.price) })) },
    { criterion: "Hình thức", values: courses.map((course) => ({ courseId: course.id, value: course.format === "online" ? "Online" : "Offline" })) },
    { criterion: "Lịch học", values: courses.map((course) => ({ courseId: course.id, value: formatCompareSchedule(course) })) },
    { criterion: "Đánh giá", values: courses.map((course) => ({ courseId: course.id, value: formatCompareRating(course) })) },
    { criterion: "Mentor", values: courses.map((course) => ({ courseId: course.id, value: course.mentorName || "Mentor VET" })) },
    { criterion: "Số học viên", values: courses.map((course) => ({ courseId: course.id, value: `${course.studentsCount ?? 0} học viên` })) },
    { criterion: "Badge uy tín", values: courses.map((course) => ({ courseId: course.id, value: formatCompareTrustBadge(course) })) },
    { criterion: "Địa điểm", values: courses.map((course) => ({ courseId: course.id, value: formatCompareLocation(course) })) },
  ];

  const missingInformation = [
    "Chưa có đầu ra cụ thể sau khóa học trong dữ liệu danh sách.",
    "Chưa có yêu cầu đầu vào trong dữ liệu danh sách.",
    "Chưa rõ tỷ lệ thực hành/feedback từ dữ liệu hiện có.",
    ...courses
      .filter((course) => !course.mentorBadges?.length)
      .map((course) => `${course.title}: chưa có badge uy tín công khai.`),
    ...courses
      .filter((course) => !course.scheduleSummary)
      .map((course) => `${course.title}: chưa có lịch học trong dữ liệu danh sách.`),
  ];

  return {
    relation,
    summary:
      relation === "cross_category"
        ? "Hai khóa học thuộc hai hướng học khác nhau. Lựa chọn phù hợp phụ thuộc vào mục tiêu học của bạn."
        : "Các khóa học có thể so sánh trực tiếp theo giá, lịch học, hình thức và đánh giá.",
    decisionBranches: orderedBranches,
    tableRows,
    missingInformation: [...new Set(missingInformation)],
    questionsToAskMentor: [
      "Khóa học có đầu ra cụ thể hoặc sản phẩm thực hành cuối khóa không?",
      "Người mới bắt đầu cần chuẩn bị kiến thức hoặc dụng cụ gì?",
      "Mentor phản hồi bài tập và theo dõi tiến độ như thế nào?",
      "Lịch học có thể điều chỉnh nếu learner bận không?",
    ],
    courses,
  };
}

function CourseSuggestionPanel({ result }: { result: CourseSuggestionResult }) {
  return (
    <div className="container pt-6">
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-50/60 shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Gợi ý khóa học
              </div>
              <h2 className="text-xl font-bold text-foreground">Gợi ý khóa học phù hợp</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                VET gợi ý dựa trên từ khóa, danh mục, hình thức học, học phí và đánh giá.
              </p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {result.detected_category && (
              <Badge variant="outline" className="rounded-full bg-background">
                Danh mục: {getCourseCategoryShortLabel(result.detected_category)}
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full bg-background">
              Hình thức: {result.detected_format === "any" ? "Linh hoạt" : result.detected_format === "online" ? "Online" : "Offline"}
            </Badge>
            {result.detected_budget && (
              <Badge variant="outline" className="rounded-full bg-background">
                Ngân sách: dưới {formatVnd(result.detected_budget)}
              </Badge>
            )}
          </div>

          {result.recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center">
              <p className="font-semibold text-foreground">Chưa có khóa học phù hợp.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Hãy thử đổi từ khóa, ngân sách hoặc hình thức học.
              </p>
              {result.follow_up_question && (
                <p className="mt-3 text-sm font-medium text-primary">{result.follow_up_question}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.recommendations.map((item) => (
                <div key={item.course_id} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                  <div className="grid gap-0 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <img
                      src={item.course.image}
                      alt={item.course.title}
                      className="h-40 w-full object-cover sm:h-full"
                    />
                    <div className="min-w-0 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full bg-primary text-primary-foreground">
                          {item.match_score}% phù hợp
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {getCourseCategoryShortLabel(item.course.category)}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {item.course.format === "online" ? "Online" : "Offline"}
                        </Badge>
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-foreground">{item.course.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.course.mentorName} · {formatVnd(item.course.price)}
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>

                      {item.pros.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {item.pros.slice(0, 2).map((pro, index) => (
                            <li key={index}>+ {pro}</li>
                          ))}
                        </ul>
                      )}
                      {item.considerations.length > 0 && (
                        <p className="mt-2 text-xs text-amber-700">
                          Lưu ý: {item.considerations[0]}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link to={`/course/${item.course_id}`}>
                          <Button size="sm" className="rounded-xl gradient-primary border-0 text-primary-foreground">
                            Xem chi tiết
                          </Button>
                        </Link>
                        <Link to={`/booking/${item.course_id}`}>
                          <Button size="sm" variant="outline" className="rounded-xl">
                            Đặt lịch
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.follow_up_question && result.recommendations.length > 0 && (
            <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-primary">
              {result.follow_up_question}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CourseCompareResultPanel({ result }: { result: CourseCompareResult }) {
  const courseMap = new Map(result.courses.map((course) => [course.id, course]));
  const isCrossCategory = result.relation === "cross_category";

  return (
    <div className="container pt-6">
      <Card className="overflow-hidden rounded-2xl border-cyan-200/70 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50/70 shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                <GitCompareArrows className="h-3.5 w-3.5" />
                So sánh khóa học
              </div>
              <h2 className="text-xl font-bold text-foreground">So sánh khóa học</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                VET so sánh dựa trên dữ liệu khóa học hiện có: học phí, hình thức, lịch học, đánh giá và mentor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={`w-fit rounded-full ${
                  isCrossCategory
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {isCrossCategory ? "Khác lĩnh vực" : "Cùng lĩnh vực"}
              </Badge>
            </div>
          </div>

          <div className={`mb-5 rounded-2xl border p-4 text-sm leading-relaxed ${
            isCrossCategory
              ? "border-orange-200 bg-orange-50 text-orange-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}>
            {result.summary}
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {result.decisionBranches.map((branch) => {
              const course = branch.courseId ? courseMap.get(branch.courseId) : null;
              return (
                <div key={`${branch.condition}-${branch.courseId ?? "none"}`} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">{branch.condition}</p>
                  {course ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Nên cân nhắc:{" "}
                      <Link to={`/course/${course.id}`} className="underline underline-offset-2">
                        {course.title}
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Không đủ dữ liệu để chọn một khóa cụ thể.</p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{branch.reason}</p>
                </div>
              );
            })}
          </div>

          <div className="mb-5 overflow-x-auto rounded-2xl border bg-background">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="w-48 px-4 py-3 font-semibold text-foreground">Tiêu chí</th>
                  {result.courses.map((course) => (
                    <th key={course.id} className="px-4 py-3 font-semibold text-foreground">
                      <Link to={`/course/${course.id}`} className="hover:text-primary">
                        {course.title}
                      </Link>
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        {getCourseCategoryShortLabel(course.category ?? "")}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.tableRows.map((row) => (
                  <tr key={row.criterion} className="border-t">
                    <td className="px-4 py-3 font-medium text-foreground">{row.criterion}</td>
                    {result.courses.map((course) => (
                      <td key={course.id} className="px-4 py-3 text-muted-foreground">
                        {row.values.find((item) => item.courseId === course.id)?.value ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.courses.map((course) => (
              <div key={course.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{getCourseCategoryShortLabel(course.category ?? "")}</Badge>
                  <Badge variant="outline" className="rounded-full">{course.format === "online" ? "Online" : "Offline"}</Badge>
                </div>
                <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {course.mentorName || "Mentor"} · {formatCompareVnd(course.price)}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li>Đánh giá: {formatCompareRating(course)}</li>
                  <li>Số học viên: {course.studentsCount ?? 0}</li>
                  <li>Lịch học: {formatCompareSchedule(course)}</li>
                  <li>Badge uy tín: {formatCompareTrustBadge(course)}</li>
                  {course.format === "offline" && <li>Địa điểm: {formatCompareLocation(course)}</li>}
                </ul>
              </div>
            ))}
          </div>

          {result.missingInformation.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 font-semibold text-amber-900">Thông tin còn thiếu</p>
              <ul className="space-y-1 text-sm text-amber-800">
                {result.missingInformation.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.questionsToAskMentor.length > 0 && (
            <div className="mt-4 rounded-2xl border bg-background p-4">
              <p className="mb-2 font-semibold text-foreground">Nên hỏi mentor trước khi đặt lịch</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.questionsToAskMentor.map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [courseSuggestionResult, setCourseSuggestionResult] = useState<CourseSuggestionResult | null>(null);
  const [compareCourseIds, setCompareCourseIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<CourseCompareResult | null>(null);
  const [compareGoal, setCompareGoal] = useState(DEFAULT_COMPARE_GOAL);
  const [compareLoading, setCompareLoading] = useState(false);
  const [courseSuggestionLoading, setCourseSuggestionLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // Read query from URL
  useEffect(() => {
    const q = searchParams.get("q");
    const location = searchParams.get("location");
    const category = searchParams.get("category");
    setQuery(q ?? "");
    setLocationQuery(location ?? "");
    setSelectedCategory(category ? normalizeCourseCategory(category) : null);
  }, [searchParams]);

  // Fetch courses từ Supabase
  const { data: courses = [], isLoading } = useLearnerSearchCourses({
    query,
    location: locationQuery,
    category: selectedCategory,
    format,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
  });
  const { data: suggestionCandidateCourses = [] } = useLearnerSearchCourses({
    location: locationQuery,
    category: selectedCategory,
    format,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
  });
  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap(
    [...courses, ...suggestionCandidateCourses].map((course) => course.mentor?.user_id || course.mentor_id),
  );

  // Map Supabase course sang CourseCard format
  const mappedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
    scheduleSummary: c.course_schedules?.length
      ? c.course_schedules.map((slot) => `${slot.day_of_week}: ${slot.start_time} - ${slot.end_time}`).join(", ")
      : null,
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  }));
  const mappedSuggestionCourses = suggestionCandidateCourses.map((c) => ({
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
    scheduleSummary: c.course_schedules?.length
      ? c.course_schedules.map((slot) => `${slot.day_of_week}: ${slot.start_time} - ${slot.end_time}`).join(", ")
      : null,
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  }));

  const selectedCompareCourses = mappedCourses.filter((course) => compareCourseIds.includes(course.id));

  const handleCourseSuggestions = () => {
    setCourseSuggestionLoading(true);
    try {
      const result = buildCourseSuggestions(
        mappedSuggestionCourses,
        query,
        selectedCategory,
        format,
        priceRange[1],
        locationQuery,
      );
      setCourseSuggestionResult(result);
      toast({
        title: result.recommendations.length ? "Đã gợi ý khóa học phù hợp" : "Chưa có khóa học phù hợp",
        description: result.recommendations.length
          ? "Kết quả dựa trên dữ liệu khóa học hiện có trên VET."
          : "Hãy thử đổi từ khóa, ngân sách hoặc hình thức học.",
      });
    } finally {
      setCourseSuggestionLoading(false);
    }
  };

  const toggleCompareCourse = (courseId: string) => {
    setCompareResult(null);
    setCompareCourseIds((current) => {
      if (current.includes(courseId)) return current.filter((id) => id !== courseId);
      if (current.length >= 3) {
        toast({
          title: "Chỉ so sánh tối đa 3 khóa học",
          description: "Hãy bỏ chọn một khóa trước khi thêm khóa mới.",
        });
        return current;
      }
      return [...current, courseId];
    });
  };

  const handleCourseCompare = () => {
    if (compareCourseIds.length < 2 || compareCourseIds.length > 3) {
      toast({ title: "Vui lòng chọn từ 2 đến 3 khóa học để so sánh." });
      return;
    }

    setCompareLoading(true);
    try {
      setCompareResult(buildCourseComparison(selectedCompareCourses, compareGoal));
      toast({
        title: "Đã tạo bảng so sánh khóa học",
        description: "Kết quả dựa trên dữ liệu khóa học hiện có trên VET.",
      });
    } catch (error) {
      console.error("Course compare error:", error);
      toast({
        title: "Không thể so sánh khóa học",
        description: "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <MainLayout>
      {/* Search bar */}
      <div className="sticky top-16 z-40 border-b glass">
        <div className="container flex items-center gap-2 py-3">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:shadow-glow/30">
              <Search className="h-4 w-4 text-primary" />
              <input
                type="text"
                placeholder="Bạn muốn học gì? Ví dụ: Tôi muốn học tiếng Anh giao tiếp online buổi tối dưới 400k"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {courseSuggestionLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {query && !courseSuggestionLoading && (
                <button onClick={() => { setQuery(""); setCourseSuggestionResult(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "gradient-primary border-0 text-primary-foreground" : ""}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Bộ lọc
          </Button>
          <Link to={locationQuery ? `/map?location=${encodeURIComponent(locationQuery)}` : "/map"}>
            <Button variant="outline" size="sm">
              <MapPin className="mr-2 h-4 w-4" />
              Bản đồ
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCourseSuggestions}
            disabled={courseSuggestionLoading}
            className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          >
            {courseSuggestionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {courseSuggestionLoading ? "Đang gợi ý..." : "Gợi ý khóa học"}
          </Button>
        </div>

        {/* Category pills */}
        <div className="container flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              !selectedCategory ? "gradient-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            Tất cả
          </button>
          {COURSE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                selectedCategory === cat.slug ? "gradient-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:border-primary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {locationQuery && (
          <div className="container flex pb-3">
            <Badge variant="outline" className="gap-2 rounded-full border-primary/20 bg-primary/5 px-3 py-1.5 text-primary">
              <MapPin className="h-3.5 w-3.5" />
              Khu vực: {locationQuery}
              <button
                type="button"
                onClick={() => setLocationQuery("")}
                className="rounded-full p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
                aria-label="Xóa khu vực tìm kiếm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b bg-muted/20"
          >
            <div className="container grid gap-6 py-6 md:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Hình thức</p>
                <div className="flex gap-2">
                  {(["all", "online", "offline"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                        format === f ? "border-primary bg-accent text-accent-foreground shadow-sm" : "bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {f === "all" ? "Tất cả" : f === "online" ? "Online" : "Offline"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Giá: {priceRange[0].toLocaleString("vi-VN")}đ - {priceRange[1].toLocaleString("vi-VN")}đ
                </p>
                <Slider value={priceRange} onValueChange={setPriceRange} max={1000000} step={50000} className="mt-3" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => { setFormat("all"); setPriceRange([0, 1000000]); setSelectedCategory(null); }}>
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {courseSuggestionLoading && (
        <div className="container pt-6">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm text-primary shadow-sm">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            VET đang tìm khóa phù hợp với nhu cầu của bạn...
          </div>
        </div>
      )}

      {!courseSuggestionLoading && courseSuggestionResult && <CourseSuggestionPanel result={courseSuggestionResult} />}

      {compareCourseIds.length > 0 && (
        <div className="container pt-6">
          <Card className="rounded-2xl border-cyan-200 bg-cyan-50/50 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  <GitCompareArrows className="h-4 w-4" />
                  Đã chọn {compareCourseIds.length}/3 khóa để so sánh
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCompareCourses.map((course) => (
                    <Badge key={course.id} variant="outline" className="max-w-full gap-2 rounded-full bg-background">
                      <span className="max-w-[220px] truncate">{course.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleCompareCourse(course.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Bỏ chọn ${course.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900/70">
                    Mục tiêu so sánh
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COURSE_COMPARE_GOALS.map((goal) => (
                      <button
                        key={goal.value}
                        type="button"
                        onClick={() => {
                          setCompareGoal(goal.value);
                          setCompareResult(null);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          compareGoal === goal.value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-cyan-200 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                        title={goal.description}
                      >
                        {goal.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl bg-background"
                  onClick={() => {
                    setCompareCourseIds([]);
                    setCompareResult(null);
                  }}
                >
                  Bỏ chọn
                </Button>
                <Button
                  type="button"
                  onClick={handleCourseCompare}
                  disabled={compareLoading || compareCourseIds.length < 2}
                  className="rounded-xl border-0 gradient-primary text-primary-foreground"
                >
                  {compareLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                  )}
                  {compareLoading ? "Đang so sánh..." : "So sánh khóa học"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {compareLoading && (
        <div className="container pt-6">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-800 shadow-sm">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            VET đang so sánh các khóa học bạn chọn...
          </div>
        </div>
      )}

      {!compareLoading && compareResult && <CourseCompareResultPanel result={compareResult} />}

      {/* Results */}
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Đang tải...</span>
            ) : (
              <><span className="font-semibold text-foreground">{mappedCourses.length}</span> kết quả
              {query && <> cho "<span className="text-primary font-medium">{query}</span>"</>}</>
            )}
          </p>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid gap-4"}>
            {mappedCourses.map((c) => {
              const selected = compareCourseIds.includes(c.id);
              return (
                <div key={c.id} className="relative">
                  <CourseCard course={c} />
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => toggleCompareCourse(c.id)}
                    className={`absolute left-3 top-3 z-10 h-8 rounded-full text-xs shadow-lg ${
                      selected
                        ? "border-0 bg-cyan-600 text-white hover:bg-cyan-700"
                        : "bg-white/95 text-cyan-700 hover:bg-cyan-50"
                    }`}
                  >
                    {selected ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <GitCompareArrows className="mr-1 h-3.5 w-3.5" />}
                    So sánh
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && mappedCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Không tìm thấy kết quả</p>
            <p className="text-sm text-muted-foreground">Thử thay đổi từ khóa hoặc bộ lọc</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
