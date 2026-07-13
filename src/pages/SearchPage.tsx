import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { useLearnerSearchCourses } from "@/hooks/useLearnerCourses";
import {
  Search, SlidersHorizontal, MapPin, X, LayoutGrid, List,
  Sparkles, Loader2, GitCompareArrows, CheckCircle2,
  BookOpen, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { usePublicMentorTrustBadgeMap } from "@/hooks/usePublicMentorVerification";
import { COURSE_CATEGORIES, getCourseCategoryShortLabel, normalizeCourseCategory } from "@/constants/courseCategories";
import { useToast } from "@/hooks/use-toast";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { COURSE_COMPARE_GOALS, DEFAULT_COMPARE_GOAL } from "@/utils/courseCompareRubrics";
import type { CourseData } from "@/components/marketplace/CourseCard";

// ── Types ─────────────────────────────────────────────────────────────────────
type CourseSuggestionRecommendation = {
  course_id: string;
  match_score: number;
  reason: string;
  pros: string[];
  considerations: string[];
  course: {
    id: string; title: string; mentorName: string; mentorAvatar: string;
    price: number; rating: number; reviewCount: number; image: string;
    category: string; format: "online" | "offline"; location?: string;
    studentsCount?: number; promoted?: boolean;
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
  id: string; title: string; mentorName: string; mentorAvatar: string;
  price: number; rating: number; reviewCount: number; image: string;
  category: string; format: "online" | "offline"; location?: string;
  promoted?: boolean; studentsCount?: number;
  scheduleSummary?: string | null; mentorBadges?: string[];
};
type CompareCourse = {
  id: string; title: string; category: string | null;
  format?: "online" | "offline"; price?: number; mentorName: string;
  location?: string | null; rating?: number; reviewCount?: number;
  studentsCount?: number; mentorBadges?: string[]; scheduleSummary?: string | null;
};
type CompareTableRow = { criterion: string; values: Array<{ courseId: string; value: string }> };
type CompareDecisionBranch = { condition: string; courseId: string | null; reason: string };
type CourseCompareResult = {
  relation: "same_category" | "cross_category";
  summary: string;
  decisionBranches: CompareDecisionBranch[];
  tableRows: CompareTableRow[];
  missingInformation: string[];
  questionsToAskMentor: string[];
  courses: CompareCourse[];
};

// ── Helpers (unchanged logic) ─────────────────────────────────────────────────
function formatVnd(v: number | null | undefined) {
  if (!v) return "";
  return `${Math.round(v).toLocaleString("vi-VN")}đ`;
}
function normalizeSearchText(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9\s./-]/g, " ").replace(/\s+/g, " ").trim();
}
function includesAny(text: string, terms: string[]) { return terms.some((t) => text.includes(t)); }

const SUGGESTION_MATCH_THRESHOLD = 25;
const SUGGESTION_TOPIC_GROUPS = [
  { id: "martial_arts", terms: ["vo thuat","mma","boxing","karate","taekwondo","vovinam","muay thai","kickboxing","judo"] },
  { id: "racket_sports", terms: ["pickleball","tennis","cau long","badminton","bong ban"] },
  { id: "guitar", terms: ["guitar","gita","dan guitar","acoustic"] },
  { id: "english", terms: ["tieng anh","english","ielts","toeic","anh van","giao tiep tieng anh"] },
  { id: "programming", terms: ["python","java","react","javascript","typescript","fullstack","backend","frontend","lap trinh","coding","web"] },
  { id: "design_creative", terms: ["photoshop","figma","thiet ke","design","ui ux","illustrator"] },
  { id: "public_speaking", terms: ["mc","thuyet trinh","public speaking","noi truoc dam dong","dan chuong trinh"] },
  { id: "barista", terms: ["barista","pha che","ca phe","coffee","do uong","bartender","cocktail"] },
  { id: "wellness", terms: ["yoga","gym","fitness","boi","swimming"] },
];
function findSuggestionTopicGroup(n: string) {
  return SUGGESTION_TOPIC_GROUPS.find((g) => g.terms.some((t) => n.includes(t))) ?? null;
}
function getSuggestionTopicScore(id: string | null, h: string) {
  if (!id) return { required: false, score: 0 };
  const g = SUGGESTION_TOPIC_GROUPS.find((x) => x.id === id);
  if (!g) return { required: false, score: 0 };
  return g.terms.some((t) => h.includes(t)) ? { required: true, score: 32 } : { required: true, score: 0 };
}
function inferSuggestionCategory(q: string) {
  const n = normalizeSearchText(q);
  const map = [
    { slug: "career-english", terms: ["tieng anh","english","ielts","toeic","giao tiep"] },
    { slug: "modern-sports", terms: ["pickleball","tennis","cau long","badminton","the thao","yoga","fitness","gym","vo thuat","mma","boxing","karate","taekwondo"] },
    { slug: "ai-productivity", terms: ["ai","lap trinh","code","python","react","java","excel","automation","cong cu"] },
    { slug: "content-speaking", terms: ["mc","thuyet trinh","noi truoc dam dong","content","video","sang tao"] },
    { slug: "barista-beverage", terms: ["barista","pha che","ca phe","cafe","do uong","bartender"] },
    { slug: "mind-sports", terms: ["co vua","co tuong","chess","tu duy","chien thuat"] },
  ];
  return map.find((e) => includesAny(n, e.terms))?.slug ?? null;
}
function inferSuggestionFormat(q: string): "online" | "offline" | "any" {
  const n = normalizeSearchText(q);
  if (includesAny(n, ["online","truc tuyen","tu xa"])) return "online";
  if (includesAny(n, ["offline","truc tiep","gan toi","gan day","quan ","o "])) return "offline";
  return "any";
}
function inferSuggestionBudget(q: string) {
  const n = normalizeSearchText(q);
  const hasBudget = includesAny(n, ["duoi","ngan sach","gia","hoc phi","toi da","vnd","dong"," k"," nghin"," trieu"]);
  const m = n.match(/(?:duoi|ngan sach|gia|hoc phi|toi da|<=|<)?\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|tr|trieu|vnd|dong|d)?/);
  if (!m || (!hasBudget && !m[2])) return null;
  const raw = Number(m[1].replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const u = m[2] ?? "";
  if (u === "tr" || u === "trieu") return Math.round(raw * 1_000_000);
  if (u === "k" || u === "nghin") return Math.round(raw * 1_000);
  return raw > 10_000 ? Math.round(raw) : Math.round(raw * 1_000);
}
function extractSuggestionKeywords(q: string) {
  const stop = new Set(["toi","muon","hoc","khoa","lop","tim","goi","y","duoi","tren","gan","o","tai","online","offline","truc","tuyen","tiep"]);
  return normalizeSearchText(q).split(" ").map((t) => t.trim()).filter((t) => t.length >= 3 && !stop.has(t)).slice(0, 8);
}

function buildCourseSuggestions(courses: SuggestionCourseInput[], query: string, selectedCategory: string | null, selectedFormat: "all" | "online" | "offline", maxBudget: number, locationQuery: string): CourseSuggestionResult {
  const inferredCategory = selectedCategory || inferSuggestionCategory(query);
  const inferredFormat = selectedFormat !== "all" ? selectedFormat : inferSuggestionFormat(query);
  const inferredBudget = inferSuggestionBudget(query) ?? (maxBudget < 1_000_000 ? maxBudget : null);
  const keywords = extractSuggestionKeywords(query);
  const topicGroup = findSuggestionTopicGroup(normalizeSearchText(query));
  const normalizedLocation = normalizeSearchText(locationQuery || query);
  const scored = courses.map((course) => {
    let score = 0; const reasons: string[] = [];
    const haystack = normalizeSearchText([course.title, getCourseCategoryShortLabel(course.category), course.mentorName, course.location].filter(Boolean).join(" "));
    const topicScore = getSuggestionTopicScore(topicGroup?.id ?? null, haystack);
    if (topicScore.required && topicScore.score <= 0) return { course, score: 0, reasons };
    const keywordHits = keywords.filter((kw) => haystack.includes(kw)).length;
    score += topicScore.score;
    if (keywordHits > 0) { score += Math.min(24, keywordHits * 8); reasons.push("Khớp với từ khóa bạn nhập."); }
    if (inferredCategory && course.category === inferredCategory) { score += keywords.length || topicScore.required ? 10 : 25; reasons.push(`Khớp với danh mục ${getCourseCategoryShortLabel(course.category)}.`); }
    if (!topicScore.required && keywords.length && keywordHits === 0 && inferredCategory !== course.category) return { course, score: 0, reasons: [] };
    if (inferredFormat !== "any" && course.format === inferredFormat) { score += 10; reasons.push(`Hình thức ${course.format}.`); }
    if (inferredBudget && course.price <= inferredBudget) { score += 10; reasons.push(`Phù hợp ngân sách dưới ${formatVnd(inferredBudget)}.`); }
    const ratingScore = Math.min(10, Math.round(Number(course.rating ?? 0) + Math.min(Number(course.reviewCount ?? 0), 20) / 4));
    if (ratingScore > 0 && score >= SUGGESTION_MATCH_THRESHOLD) { score += ratingScore; reasons.push("Có dữ liệu đánh giá/review."); }
    const normalizedCourseLocation = normalizeSearchText(course.location);
    if (normalizedLocation && normalizedCourseLocation && normalizedLocation.split(" ").some((p) => p.length >= 3 && normalizedCourseLocation.includes(p))) { score += 5; reasons.push("Có địa điểm phù hợp."); }
    return { course, score, reasons };
  }).filter((item) => item.score >= SUGGESTION_MATCH_THRESHOLD).sort((a, b) => b.score - a.score).slice(0, 4);
  const recommendations = scored.map(({ course, score, reasons }) => ({
    course_id: course.id, match_score: Math.min(100, score), reason: reasons.slice(0, 3).join(" "),
    pros: reasons.slice(0, 3),
    considerations: [!course.scheduleSummary ? "Chưa có lịch học." : "", !course.mentorBadges?.length ? "Chưa có badge uy tín." : ""].filter(Boolean),
    course: { id: course.id, title: course.title, mentorName: course.mentorName, mentorAvatar: course.mentorAvatar, price: course.price, rating: course.rating, reviewCount: course.reviewCount, image: course.image, category: course.category, format: course.format, location: course.location, studentsCount: course.studentsCount, promoted: course.promoted },
  }));
  return { intent_summary: query.trim() || "Gợi ý dựa trên bộ lọc hiện tại.", detected_category: inferredCategory, detected_format: inferredFormat, detected_budget: inferredBudget, recommendations, follow_up_question: recommendations.length ? "Bạn có thể mở chi tiết để xem lịch học và hỏi mentor." : null };
}

function formatCompareVnd(v: number | null | undefined) { return v ? formatVnd(v) : "Chưa cập nhật"; }
function formatCompareRating(c: CompareCourse) { const r = Number(c.rating ?? 0); const rv = Number(c.reviewCount ?? 0); if (!r && !rv) return "Chưa có đánh giá"; return `${r ? r.toFixed(1) : "Chưa có điểm"} · ${rv} đánh giá`; }
function formatCompareSchedule(c: CompareCourse) { return c.scheduleSummary || "Chưa có lịch học"; }
function formatCompareTrustBadge(c: CompareCourse) { return c.mentorBadges?.length ? c.mentorBadges.join(", ") : "Chưa có badge"; }
function formatCompareLocation(c: CompareCourse) { if (c.format === "online") return "Online"; return c.location || "Chưa cập nhật"; }
function trustScore(c: CompareCourse) { return Number(c.rating ?? 0) * 20 + Math.min(Number(c.reviewCount ?? 0), 100) + Math.min(Number(c.studentsCount ?? 0), 100) / 2 + (c.mentorBadges?.length ? 25 : 0); }
function pickByScore(courses: CompareCourse[], scorer: (c: CompareCourse) => number) {
  let best: CompareCourse | null = null; let bestScore = Number.NEGATIVE_INFINITY;
  for (const c of courses) { const s = scorer(c); if (s > bestScore) { best = c; bestScore = s; } }
  return best;
}
function buildCompareBranch(condition: string, course: CompareCourse | null, reason: string): CompareDecisionBranch {
  return { condition, courseId: course?.id ?? null, reason };
}
function buildCourseComparison(courses: CompareCourse[], selectedGoal: string): CourseCompareResult {
  const categorySet = new Set(courses.map((c) => c.category).filter(Boolean));
  const relation = categorySet.size <= 1 ? "same_category" : "cross_category";
  const lowerCostCourse = pickByScore(courses, (c) => -Number(c.price ?? Number.MAX_SAFE_INTEGER));
  const trustedCourse = pickByScore(courses, trustScore);
  const flexibleCourse = pickByScore(courses, (c) => (c.format === "online" ? 40 : 0) + (c.scheduleSummary ? 20 : 0) + trustScore(c) / 20);
  const practicalCourse = pickByScore(courses, (c) => (c.format === "offline" ? 45 : 0) + (["modern-sports","barista-beverage","content-speaking"].includes(c.category ?? "") ? 25 : 0) + trustScore(c) / 20);
  const careerCourse = pickByScore(courses, (c) => (["ai-productivity","career-english","content-speaking"].includes(c.category ?? "") ? 45 : 0) + trustScore(c) / 20);
  const beginnerCourse = pickByScore(courses, (c) => Math.max(0, 50 - Number(c.price ?? 0) / 20000) + trustScore(c) / 25);
  const confidenceCourse = pickByScore(courses, (c) => (["career-english","content-speaking"].includes(c.category ?? "") ? 45 : 0) + (c.format === "offline" ? 12 : 0) + trustScore(c) / 20);
  const hobbyCourse = pickByScore(courses, (c) => (["modern-sports","mind-sports","barista-beverage"].includes(c.category ?? "") ? 35 : 0) + trustScore(c) / 25);
  void practicalCourse;
  const branches = [
    buildCompareBranch("Học để đi làm", careerCourse, careerCourse ? `${careerCourse.title} phù hợp hơn với mục tiêu nghề nghiệp.` : "Chưa đủ dữ liệu để so sánh."),
    buildCompareBranch("Học từ số 0", beginnerCourse, "Ưu tiên học phí dễ tiếp cận và tín hiệu tin cậy."),
    buildCompareBranch("Giao tiếp/tự tin hơn", confidenceCourse, "Ưu tiên khóa tiếng Anh, nội dung, MC hoặc thuyết trình."),
    buildCompareBranch("Giải trí/sức khỏe", hobbyCourse, "Ưu tiên thể thao, tư duy chiến thuật hoặc trải nghiệm thực hành."),
    buildCompareBranch("Tiết kiệm học phí", lowerCostCourse, lowerCostCourse ? `${lowerCostCourse.title} có học phí thấp hơn.` : "Chưa đủ dữ liệu học phí."),
    buildCompareBranch("Mentor uy tín hơn", trustedCourse, trustedCourse ? `${trustedCourse.title} có tín hiệu tin cậy tốt hơn.` : "Chưa đủ dữ liệu."),
    buildCompareBranch("Linh hoạt lịch học", flexibleCourse, flexibleCourse ? `${flexibleCourse.title} có lợi thế về online hoặc lịch học.` : "Chưa đủ dữ liệu lịch học."),
  ];
  const goalMap: Record<string, string> = { career: "Học để đi làm", beginner_zero: "Học từ số 0", communication_confidence: "Giao tiếp/tự tin hơn", hobby_health: "Giải trí/sức khỏe", lower_cost: "Tiết kiệm học phí", trusted_mentor: "Mentor uy tín hơn", unsure: "Mentor uy tín hơn" };
  const selectedCondition = goalMap[selectedGoal];
  const orderedBranches = selectedCondition ? [...branches.filter((b) => b.condition === selectedCondition), ...branches.filter((b) => b.condition !== selectedCondition)] : branches;
  const tableRows: CompareTableRow[] = [
    { criterion: "Học phí", values: courses.map((c) => ({ courseId: c.id, value: formatCompareVnd(c.price) })) },
    { criterion: "Hình thức", values: courses.map((c) => ({ courseId: c.id, value: c.format === "online" ? "Online" : "Offline" })) },
    { criterion: "Lịch học", values: courses.map((c) => ({ courseId: c.id, value: formatCompareSchedule(c) })) },
    { criterion: "Đánh giá", values: courses.map((c) => ({ courseId: c.id, value: formatCompareRating(c) })) },
    { criterion: "Mentor", values: courses.map((c) => ({ courseId: c.id, value: c.mentorName || "Mentor VET" })) },
    { criterion: "Số học viên", values: courses.map((c) => ({ courseId: c.id, value: `${c.studentsCount ?? 0} học viên` })) },
    { criterion: "Badge uy tín", values: courses.map((c) => ({ courseId: c.id, value: formatCompareTrustBadge(c) })) },
    { criterion: "Địa điểm", values: courses.map((c) => ({ courseId: c.id, value: formatCompareLocation(c) })) },
  ];
  return { relation, summary: relation === "cross_category" ? "Hai khóa học thuộc hai hướng học khác nhau." : "Các khóa có thể so sánh trực tiếp theo giá, lịch học, hình thức và đánh giá.", decisionBranches: orderedBranches, tableRows, missingInformation: ["Chưa có đầu ra cụ thể sau khóa học.", "Chưa có yêu cầu đầu vào.", ...courses.filter((c) => !c.mentorBadges?.length).map((c) => `${c.title}: chưa có badge uy tín.`)], questionsToAskMentor: ["Khóa học có đầu ra cụ thể không?", "Người mới cần chuẩn bị gì?", "Mentor phản hồi bài tập như thế nào?", "Lịch học có thể điều chỉnh không?"], courses };
}

// ── UI Components ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="aspect-video bg-slate-200/80" />
      <div className="p-3.5 space-y-2.5">
        <div className="flex gap-2 items-center">
          <div className="h-5 w-5 rounded-full bg-slate-200" />
          <div className="h-3 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="h-3 w-14 rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-full bg-slate-200" />
        <div className="h-4 w-3/4 rounded-full bg-slate-200" />
        <div className="h-3 w-24 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function EmptyState({ query, onClearFilters }: { query: string; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
        <Search className="h-9 w-9 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-800">Không tìm thấy khóa học phù hợp</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {query ? `Không có kết quả cho "${query}". ` : ""}
        Hãy thử đổi từ khóa hoặc xóa bớt bộ lọc.
      </p>
      <div className="mt-5 flex flex-wrap gap-3 justify-center">
        <Button onClick={onClearFilters} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 border-0 text-white shadow-md">
          Xóa bộ lọc
        </Button>
        <Link to="/search"><Button variant="outline" className="rounded-xl">Xem tất cả khóa học</Button></Link>
      </div>
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Danh mục phổ biến</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {COURSE_CATEGORIES.slice(0, 4).map((cat) => (
            <Link key={cat.slug} to={`/search?category=${cat.slug}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-600 transition-colors shadow-sm"
            >{cat.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseListCard({ course, onCompare, selected }: { course: CourseData; onCompare: (id: string) => void; selected: boolean }) {
  const { trackEvent } = useAnalyticsTracker();

  return (
    <Link to={`/course/${course.id}`}
      onClick={() => void trackEvent("course_detail_click", {
        courseId: course.id,
        source: "search_list",
        metadata: { title: course.title, category: course.category, format: course.format },
      })}
      className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-cyan-300"
    >
      <div className="relative w-44 shrink-0 overflow-hidden sm:w-52">
        <img src={course.image} alt={course.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute bottom-2 right-2">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-slate-800 shadow">{course.price.toLocaleString("vi-VN")}đ</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">{getCourseCategoryShortLabel(course.category)}</span>
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${course.format === "online" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
              {course.format === "online" ? "Online" : "Offline"}
            </span>
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-cyan-600 transition-colors">{course.title}</h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <img src={course.mentorAvatar} alt={course.mentorName} className="h-5 w-5 rounded-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span className="text-xs text-slate-500">{course.mentorName}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">⭐ <span className="font-bold text-slate-700">{course.rating}</span> ({course.reviewCount})</span>
            {course.studentsCount != null && course.studentsCount > 0 && <span>{course.studentsCount.toLocaleString()} học viên</span>}
          </div>
          <button type="button" onClick={(e) => { e.preventDefault(); onCompare(course.id); }}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-white text-cyan-700 hover:border-cyan-400"}`}
          >
            {selected ? <CheckCircle2 className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />} So sánh
          </button>
        </div>
      </div>
    </Link>
  );
}

// ── CourseSuggestionPanel ──────────────────────────────────────────────────────
function CourseSuggestionPanel({ result }: { result: CourseSuggestionResult }) {
  const { trackEvent } = useAnalyticsTracker();

  return (
    <div className="container pt-5">
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-50/60 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />Gợi ý khóa học
              </div>
              <h2 className="text-lg font-bold text-foreground">Gợi ý khóa học phù hợp</h2>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">VET gợi ý dựa trên từ khóa, danh mục, hình thức học, học phí và đánh giá.</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {result.detected_category && <Badge variant="outline" className="rounded-full bg-background">Danh mục: {getCourseCategoryShortLabel(result.detected_category)}</Badge>}
            <Badge variant="outline" className="rounded-full bg-background">{result.detected_format === "any" ? "Linh hoạt" : result.detected_format === "online" ? "Online" : "Offline"}</Badge>
            {result.detected_budget && <Badge variant="outline" className="rounded-full bg-background">Ngân sách: dưới {formatVnd(result.detected_budget)}</Badge>}
          </div>
          {result.recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center">
              <p className="font-semibold text-foreground">Chưa có khóa học phù hợp.</p>
              <p className="mt-2 text-sm text-muted-foreground">Hãy thử đổi từ khóa, ngân sách hoặc hình thức học.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.recommendations.map((item) => (
                <div key={item.course_id} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                  <div className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
                    <img src={item.course.image} alt={item.course.title} className="h-40 w-full object-cover sm:h-full" />
                    <div className="min-w-0 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full bg-primary text-primary-foreground">{item.match_score}% phù hợp</Badge>
                        <Badge variant="outline" className="rounded-full">{getCourseCategoryShortLabel(item.course.category)}</Badge>
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-foreground">{item.course.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{item.course.mentorName} · {formatVnd(item.course.price)}</p>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.reason}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/course/${item.course_id}`}
                          onClick={() => void trackEvent("course_detail_click", {
                            courseId: item.course_id,
                            source: "course_suggestion",
                            metadata: { matchScore: item.match_score, title: item.course.title },
                          })}
                        >
                          <Button size="sm" className="rounded-xl gradient-primary border-0 text-primary-foreground">Xem chi tiết</Button>
                        </Link>
                        <Link to={`/booking/${item.course_id}`}><Button size="sm" variant="outline" className="rounded-xl">Đặt lịch</Button></Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.follow_up_question && result.recommendations.length > 0 && (
            <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-primary">{result.follow_up_question}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── CourseCompareResultPanel ───────────────────────────────────────────────────
function CourseCompareResultPanel({ result }: { result: CourseCompareResult }) {
  const courseMap = new Map(result.courses.map((c) => [c.id, c]));
  const isCrossCategory = result.relation === "cross_category";
  return (
    <div className="container pt-5">
      <Card className="overflow-hidden rounded-2xl border-cyan-200/70 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50/70 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                <GitCompareArrows className="h-3.5 w-3.5" />So sánh khóa học
              </div>
              <h2 className="text-lg font-bold text-foreground">So sánh khóa học</h2>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{result.summary}</p>
            </div>
            <Badge variant="outline" className={`w-fit rounded-full ${isCrossCategory ? "border-orange-200 bg-orange-50 text-orange-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {isCrossCategory ? "Khác lĩnh vực" : "Cùng lĩnh vực"}
            </Badge>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {result.decisionBranches.map((branch) => {
              const course = branch.courseId ? courseMap.get(branch.courseId) : null;
              return (
                <div key={`${branch.condition}-${branch.courseId ?? "none"}`} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">{branch.condition}</p>
                  {course ? <p className="mt-1 text-xs font-medium text-primary">Nên cân nhắc: <Link to={`/course/${course.id}`} className="underline">{course.title}</Link></p>
                    : <p className="mt-1 text-xs text-muted-foreground">Không đủ dữ liệu để chọn.</p>}
                  <p className="mt-2 text-sm text-muted-foreground">{branch.reason}</p>
                </div>
              );
            })}
          </div>
          <div className="mb-4 overflow-x-auto rounded-2xl border bg-background">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="w-40 px-4 py-3 font-semibold text-foreground">Tiêu chí</th>
                  {result.courses.map((c) => (
                    <th key={c.id} className="px-4 py-3 font-semibold text-foreground">
                      <Link to={`/course/${c.id}`} className="hover:text-primary">{c.title}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.tableRows.map((row) => (
                  <tr key={row.criterion} className="border-t">
                    <td className="px-4 py-3 font-medium text-foreground">{row.criterion}</td>
                    {result.courses.map((c) => <td key={c.id} className="px-4 py-3 text-muted-foreground">{row.values.find((v) => v.courseId === c.id)?.value ?? "-"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.missingInformation.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1.5 font-semibold text-amber-900">Thông tin còn thiếu</p>
              <ul className="space-y-1 text-sm text-amber-800">{result.missingInformation.map((i) => <li key={i}>• {i}</li>)}</ul>
            </div>
          )}
          {result.questionsToAskMentor.length > 0 && (
            <div className="mt-3 rounded-2xl border bg-background p-4">
              <p className="mb-1.5 font-semibold text-foreground">Nên hỏi mentor trước khi đặt lịch</p>
              <ul className="space-y-1 text-sm text-muted-foreground">{result.questionsToAskMentor.map((q) => <li key={q}>• {q}</li>)}</ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main SearchPage ─────────────────────────────────────────────────────────
export default function SearchPage() {
  const { toast } = useToast();
  const { trackEvent } = useAnalyticsTracker();
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<"default" | "rating" | "price_asc" | "price_desc">("default");
  const [courseSuggestionResult, setCourseSuggestionResult] = useState<CourseSuggestionResult | null>(null);
  const [compareCourseIds, setCompareCourseIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<CourseCompareResult | null>(null);
  const [compareGoal, setCompareGoal] = useState(DEFAULT_COMPARE_GOAL);
  const [compareLoading, setCompareLoading] = useState(false);
  const [courseSuggestionLoading, setCourseSuggestionLoading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    const location = searchParams.get("location");
    const category = searchParams.get("category");
    setQuery(q ?? "");
    setLocationQuery(location ?? "");
    setSelectedCategory(category ? normalizeCourseCategory(category) : null);
  }, [searchParams]);

  const { data: courses = [], isLoading } = useLearnerSearchCourses({ query, location: locationQuery, category: selectedCategory, format, minPrice: priceRange[0], maxPrice: priceRange[1] });
  const { data: suggestionCandidateCourses = [] } = useLearnerSearchCourses({ location: locationQuery, category: selectedCategory, format, minPrice: priceRange[0], maxPrice: priceRange[1] });
  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap([...courses, ...suggestionCandidateCourses].map((c) => c.mentor?.user_id || c.mentor_id));

  const mapCourse = (c: typeof courses[0]) => ({
    id: c.id, title: c.title, mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "", price: c.price, rating: c.rating,
    reviewCount: c.review_count, image: c.image_url || "",
    category: c.category, format: c.format, location: c.location || undefined,
    promoted: c.is_promoted, studentsCount: c.students_count,
    scheduleSummary: c.course_schedules?.length ? c.course_schedules.map((s) => `${s.day_of_week}: ${s.start_time}-${s.end_time}`).join(", ") : null,
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  });

  let mappedCourses = courses.map(mapCourse);
  const mappedSuggestionCourses = suggestionCandidateCourses.map(mapCourse);

  if (sortMode === "rating") mappedCourses = [...mappedCourses].sort((a, b) => b.rating - a.rating);
  else if (sortMode === "price_asc") mappedCourses = [...mappedCourses].sort((a, b) => a.price - b.price);
  else if (sortMode === "price_desc") mappedCourses = [...mappedCourses].sort((a, b) => b.price - a.price);

  const selectedCompareCourses = mappedCourses.filter((c) => compareCourseIds.includes(c.id));
  const hasActiveFilters = format !== "all" || priceRange[0] > 0 || priceRange[1] < 1000000 || selectedCategory !== null;

  const clearFilters = () => { setFormat("all"); setPriceRange([0, 1000000]); setSelectedCategory(null); setQuery(""); };

  const handleCourseSuggestions = () => {
    void trackEvent("search_submit", {
      source: "search_page",
      metadata: {
        query,
        selectedCategory,
        format,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        locationQuery,
      },
    });
    setCourseSuggestionLoading(true);
    try {
      const result = buildCourseSuggestions(mappedSuggestionCourses, query, selectedCategory, format, priceRange[1], locationQuery);
      setCourseSuggestionResult(result);
      toast({ title: result.recommendations.length ? "Đã gợi ý khóa học phù hợp" : "Chưa có khóa học phù hợp", description: "Kết quả dựa trên dữ liệu khóa học hiện có." });
    } finally { setCourseSuggestionLoading(false); }
  };

  const toggleCompareCourse = (courseId: string) => {
    setCompareResult(null);
    setCompareCourseIds((curr) => {
      if (curr.includes(courseId)) return curr.filter((id) => id !== courseId);
      if (curr.length >= 3) { toast({ title: "Chỉ so sánh tối đa 3 khóa học" }); return curr; }
      return [...curr, courseId];
    });
  };

  const handleCourseCompare = () => {
    if (compareCourseIds.length < 2 || compareCourseIds.length > 3) { toast({ title: "Vui lòng chọn từ 2 đến 3 khóa học để so sánh." }); return; }
    setCompareLoading(true);
    try {
      setCompareResult(buildCourseComparison(selectedCompareCourses, compareGoal));
      toast({ title: "Đã tạo bảng so sánh khóa học" });
    } catch { toast({ title: "Không thể so sánh", variant: "destructive" }); }
    finally { setCompareLoading(false); }
  };

  return (
    <MainLayout>
      {/* ── Sticky Search Panel ── */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-sm">
        <div className="container py-3">
          {/* Row 1: Search + Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Search input */}
            <div className="relative flex-1">
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition-all focus-within:border-cyan-400 focus-within:shadow-md focus-within:shadow-cyan-100">
                <Search className="h-4 w-4 shrink-0 text-cyan-500" />
                <input type="text"
                  placeholder="Bạn muốn học gì? Ví dụ: Tôi muốn học tiếng Anh giao tiếp online buổi tối dưới 400k"
                  className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void trackEvent("search_submit", {
                        source: "search_enter",
                        metadata: { query, selectedCategory, format, minPrice: priceRange[0], maxPrice: priceRange[1], locationQuery },
                      });
                    }
                  }}
                />
                {courseSuggestionLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-500 shrink-0" />}
                {query && !courseSuggestionLoading && (
                  <button onClick={() => { setQuery(""); setCourseSuggestionResult(null); }} className="shrink-0 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Filter */}
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 rounded-xl border-slate-200 transition-all ${showFilters ? "bg-cyan-50 border-cyan-300 text-cyan-700" : "hover:bg-slate-50"}`}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Bộ lọc
              {hasActiveFilters && <span className="ml-1.5 h-2 w-2 rounded-full bg-cyan-500 inline-block" />}
            </Button>
            {/* Map */}
            <Link to={locationQuery ? `/map?location=${encodeURIComponent(locationQuery)}` : "/map"}>
              <Button variant="outline" size="sm" className="shrink-0 rounded-xl border-slate-200 hover:bg-slate-50" title="Xem khóa học gần bạn trên bản đồ">
                <MapPin className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Bản đồ</span>
              </Button>
            </Link>
            {/* Suggestion — premium button */}
            <Button size="sm" onClick={handleCourseSuggestions} disabled={courseSuggestionLoading}
              className="shrink-0 rounded-xl border border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 shadow-sm hover:from-cyan-100 hover:to-blue-100 hover:shadow-md hover:shadow-cyan-100 transition-all"
            >
              {courseSuggestionLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              <span className="hidden sm:inline">Gợi ý khóa học</span>
            </Button>
          </div>

          {/* Row 2: Category chips — chỉ hiện category có khóa học thực */}
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap shrink-0 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${!selectedCategory ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-600"}`}
            >Tất cả</button>
            {[
              { slug: "modern-sports", label: "Thể thao & Sức khỏe" },
              { slug: "career-english", label: "Tiếng Anh & Học tập" },
              { slug: "barista-beverage", label: "Barista & Dạy nghề" },
            ].map((cat) => (
              <button key={cat.slug} onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                className={`whitespace-nowrap shrink-0 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${selectedCategory === cat.slug ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-600"}`}
              >{cat.label}</button>
            ))}
          </div>

          {/* Location badge */}
          {locationQuery && (
            <div className="mt-2 flex">
              <Badge variant="outline" className="gap-1.5 rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700 text-xs">
                <MapPin className="h-3 w-3" />{locationQuery}
                <button type="button" onClick={() => setLocationQuery("")} className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-100">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-100 bg-slate-50/80"
            >
              <div className="container grid gap-5 py-5 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hình thức học</p>
                  <div className="flex gap-2">
                    {(["all", "online", "offline"] as const).map((f) => (
                      <button key={f} onClick={() => setFormat(f)}
                        className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${format === f ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"}`}
                      >{f === "all" ? "Tất cả" : f === "online" ? "Online" : "Offline"}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Giá: {priceRange[0].toLocaleString("vi-VN")}đ — {priceRange[1].toLocaleString("vi-VN")}đ</p>
                  <Slider value={priceRange} onValueChange={setPriceRange} max={1000000} step={50000} className="mt-3" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={clearFilters} variant="outline" size="sm" className="rounded-xl border-slate-200">Xóa bộ lọc</Button>
                  <Button
                    onClick={() => {
                      void trackEvent("search_submit", {
                        source: "filter_apply",
                        metadata: { query, selectedCategory, format, minPrice: priceRange[0], maxPrice: priceRange[1], locationQuery },
                      });
                      setShowFilters(false);
                    }}
                    size="sm"
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 border-0 text-white"
                  >
                    Áp dụng
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── AI/Compare results ── */}
      {courseSuggestionLoading && (
        <div className="container pt-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />VET đang tìm khóa phù hợp...
          </div>
        </div>
      )}
      {!courseSuggestionLoading && courseSuggestionResult && <CourseSuggestionPanel result={courseSuggestionResult} />}

      {/* Compare bar */}
      {compareCourseIds.length > 0 && (
        <div className="container pt-4">
          <Card className="rounded-2xl border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  <GitCompareArrows className="h-4 w-4" />Đã chọn {compareCourseIds.length}/3 khóa để so sánh
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCompareCourses.map((c) => (
                    <Badge key={c.id} variant="outline" className="max-w-full gap-1.5 rounded-full bg-white">
                      <span className="max-w-[200px] truncate text-xs">{c.title}</span>
                      <button type="button" onClick={() => toggleCompareCourse(c.id)} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {COURSE_COMPARE_GOALS.map((goal) => (
                    <button key={goal.value} type="button" onClick={() => { setCompareGoal(goal.value); setCompareResult(null); }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${compareGoal === goal.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-cyan-200 bg-white text-slate-600 hover:border-primary/40"}`}
                      title={goal.description}
                    >{goal.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" className="rounded-xl bg-white" onClick={() => { setCompareCourseIds([]); setCompareResult(null); }}>Bỏ chọn</Button>
                <Button onClick={handleCourseCompare} disabled={compareLoading || compareCourseIds.length < 2} className="rounded-xl border-0 gradient-primary text-primary-foreground">
                  {compareLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompareArrows className="mr-2 h-4 w-4" />}
                  {compareLoading ? "Đang so sánh..." : "So sánh khóa học"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {compareLoading && (
        <div className="container pt-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />VET đang so sánh các khóa học bạn chọn...
          </div>
        </div>
      )}
      {!compareLoading && compareResult && <CourseCompareResultPanel result={compareResult} />}

      {/* ── Results ── */}
      <div className="container py-6">
        {/* Result header */}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isLoading ? (
              <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200" />
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-800">
                  {mappedCourses.length > 0 ? <><span className="text-cyan-600">{mappedCourses.length}</span> kết quả phù hợp{query && <> cho "<span className="text-primary">{query}</span>"</>}</> : "Không có kết quả"}
                </p>
                {mappedCourses.length > 0 && <p className="mt-0.5 text-xs text-slate-400">Các khóa học được tìm thấy theo bộ lọc hiện tại</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="relative">
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="default">Phù hợp nhất</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="price_asc">Giá thấp đến cao</option>
                <option value="price_desc">Giá cao đến thấp</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1">
              <button onClick={() => setViewMode("grid")} className={`rounded-lg p-1.5 transition-colors ${viewMode === "grid" ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} className={`rounded-lg p-1.5 transition-colors ${viewMode === "list" ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : mappedCourses.length === 0 ? (
          <EmptyState query={query} onClearFilters={clearFilters} />
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mappedCourses.map((c) => {
              const selected = compareCourseIds.includes(c.id);
              return (
                <div key={c.id} className="relative">
                  <CourseCard course={c} />
                  <button type="button" onClick={() => toggleCompareCourse(c.id)}
                    className={`absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-md transition-all ${selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-white/80 bg-white/95 text-cyan-700 hover:bg-cyan-50"}`}
                  >
                    {selected ? <CheckCircle2 className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />} So sánh
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mappedCourses.map((c) => <CourseListCard key={c.id} course={c} onCompare={toggleCompareCourse} selected={compareCourseIds.includes(c.id)} />)}
          </div>
        )}

        {/* Suggestions when few results */}
        {!isLoading && mappedCourses.length > 0 && mappedCourses.length < 8 && (
          <div className="mt-10 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
            <BookOpen className="mx-auto mb-2 h-7 w-7 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Có thể bạn cũng quan tâm</p>
            <p className="mt-0.5 mb-4 text-xs text-slate-400">Khám phá thêm các danh mục phổ biến</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {COURSE_CATEGORIES.map((cat) => (
                <Link key={cat.slug} to={`/search?category=${cat.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                >{cat.label}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
