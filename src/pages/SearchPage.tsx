import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { useLearnerSearchCourses } from "@/hooks/useLearnerCourses";
import {
  Search, SlidersHorizontal, MapPin, X, LayoutGrid, List,
  Sparkles, Brain, Loader2, GitCompareArrows, CheckCircle2,
  ChevronDown, BookOpen, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePublicMentorTrustBadgeMap } from "@/hooks/usePublicMentorVerification";
import { COURSE_CATEGORIES, getCourseCategoryShortLabel, normalizeCourseCategory } from "@/constants/courseCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { AI_CREDIT_COSTS } from "@/constants/aiCredits";
import { AiCreditUpgradeDialog } from "@/components/subscription/AiCreditUpgradeDialog";
import { isAiCreditRequiredPayload, readFunctionErrorPayload } from "@/lib/aiCreditErrors";
import { COURSE_COMPARE_GOALS, DEFAULT_COMPARE_GOAL } from "@/utils/courseCompareRubrics";
import type { CourseData } from "@/components/marketplace/CourseCard";

const SEARCH_AI_COST = AI_CREDIT_COSTS.search;
const COMPARE_AI_COST = AI_CREDIT_COSTS.compare;

// ── Types (unchanged) ────────────────────────────────────────────────────────
type AiCourseMatchRecommendation = {
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

type AiCourseMatchResult = {
  intent_summary: string;
  detected_category: string | null;
  detected_format: "online" | "offline" | "any";
  detected_budget: number | null;
  recommendations: AiCourseMatchRecommendation[];
  follow_up_question: string | null;
  fallback?: boolean;
  fallback_reason?: string;
  credit_refunded?: boolean;
};

type AiCompareCourse = {
  id: string;
  title: string;
  category?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  skill_topic?: string | null;
  skill_domain?: string | null;
  skill_kind?: string | null;
  skill_tags?: string[];
  learning_outcomes?: string[];
  prerequisites?: string[];
  format?: "online" | "offline";
  price?: number;
  mentor_name?: string;
  location?: string | null;
  rating?: number;
  review_count?: number;
  students_count?: number;
  mentor_trust_badges?: string[];
  mentor_verification_status?: string | null;
  schedule_summary?: string | null;
};

type AiCompareResult = {
  compare_mode?: "same_category" | "cross_category";
  goal_interpretation?: string;
  overall_summary?: string;
  summary: string;
  recommendedCourseId?: string | null;
  confidence?: "low" | "medium" | "high";
  best_choice_condition?: string | null;
  decision_branches?: Array<{ condition: string; recommended_course_id: string; reason: string }>;
  factualComparison?: Array<{ criterion: string; courseA: string; courseB: string }>;
  goalBasedAnalysis?: Array<{ goal: string; betterChoice: "courseA" | "courseB" | "tie"; reason: string }>;
  skillInsights?: string[];
  courseAPros?: string[];
  courseACons?: string[];
  courseBPros?: string[];
  courseBCons?: string[];
  questionsToAskMentor?: string[];
  missingInformation?: string[];
  missing_information?: string[];
  best_choice_course_id: string | null;
  comparison_table: Array<{ criterion: string; course_values: Array<{ course_id: string; value: string }> }>;
  course_analysis: Array<{
    course_id: string;
    category_understanding?: string;
    strengths: string[];
    weaknesses: string[];
    best_for: string;
    not_best_for?: string;
    practical_outcome?: string;
  }>;
  recommendation: string;
  final_advice?: string;
  questions_to_ask_mentor: string[];
};

type AiCompareResponse = {
  comparison: AiCompareResult;
  courses: AiCompareCourse[];
  fallback?: boolean;
};

function formatVnd(value: number | null | undefined) {
  if (!value) return "";
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm animate-pulse">
      <div className="aspect-video bg-slate-200/80" />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-slate-200" />
          <div className="h-3 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="h-3 w-16 rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-full bg-slate-200" />
        <div className="h-4 w-3/4 rounded-full bg-slate-200" />
        <div className="h-3 w-28 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({
  query,
  onClearFilters,
}: {
  query: string;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
        <Search className="h-9 w-9 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">Không tìm thấy khóa học phù hợp</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        {query
          ? `Không có kết quả cho "${query}". Hãy thử đổi từ khóa hoặc xóa bớt bộ lọc.`
          : "Hãy thử đổi từ khóa hoặc xóa bớt bộ lọc."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 justify-center">
        <Button
          onClick={onClearFilters}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 border-0 text-white shadow-md"
        >
          Xóa bộ lọc
        </Button>
        <Link to="/search">
          <Button variant="outline" className="rounded-xl">
            Xem tất cả khóa học
          </Button>
        </Link>
      </div>
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Danh mục phổ biến</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {COURSE_CATEGORIES.slice(0, 4).map((cat) => (
            <Link
              key={cat.slug}
              to={`/search?category=${cat.slug}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI panels (unchanged logic, improved styling) ────────────────────────────
function AiCourseMatchPanel({ result }: { result: AiCourseMatchResult }) {
  return (
    <div className="container pt-5">
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-50/60 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Brain className="h-3.5 w-3.5" />AI Course Match
              </div>
              <h2 className="text-lg font-bold text-foreground">Gợi ý khóa học phù hợp</h2>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{result.intent_summary}</p>
            </div>
            {result.fallback && (
              <Badge variant="outline" className="w-fit rounded-full border-amber-200 bg-amber-50 text-amber-700">Gợi ý dự phòng</Badge>
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {result.detected_category && (
              <Badge variant="outline" className="rounded-full bg-background">Danh mục: {getCourseCategoryShortLabel(result.detected_category)}</Badge>
            )}
            <Badge variant="outline" className="rounded-full bg-background">
              {result.detected_format === "any" ? "Linh hoạt" : result.detected_format === "online" ? "Online" : "Offline"}
            </Badge>
            {result.detected_budget && (
              <Badge variant="outline" className="rounded-full bg-background">Ngân sách: dưới {formatVnd(result.detected_budget)}</Badge>
            )}
            {result.credit_refunded && (
              <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">Credit đã hoàn</Badge>
            )}
          </div>
          {result.recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center">
              <p className="font-semibold text-foreground">Hiện chưa có khóa học phù hợp.</p>
              <p className="mt-2 text-sm text-muted-foreground">Hãy thử nới ngân sách hoặc chọn hình thức học khác.</p>
              {result.follow_up_question && <p className="mt-3 text-sm font-medium text-primary">{result.follow_up_question}</p>}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.recommendations.map((item) => (
                <div key={item.course_id} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                  <div className="grid gap-0 sm:grid-cols-[160px_minmax(0,1fr)]">
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
                        <Link to={`/course/${item.course_id}`}>
                          <Button size="sm" className="rounded-xl gradient-primary border-0 text-primary-foreground">Xem chi tiết</Button>
                        </Link>
                        <Link to={`/booking/${item.course_id}`}>
                          <Button size="sm" variant="outline" className="rounded-xl">Đặt lịch</Button>
                        </Link>
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

function AiCompareResultPanel({ result }: { result: AiCompareResponse }) {
  const courseMap = new Map(result.courses.map((c) => [c.id, c]));
  const recommendedCourseId = result.comparison.recommendedCourseId ?? result.comparison.best_choice_course_id;
  const bestCourse = recommendedCourseId ? courseMap.get(recommendedCourseId) : null;
  const confidenceClass = result.comparison.confidence === "high"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : result.comparison.confidence === "medium"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const factualRows = result.comparison.factualComparison?.length
    ? result.comparison.factualComparison
    : result.comparison.comparison_table.map((row) => ({
        criterion: row.criterion,
        courseA: row.course_values.find((v) => v.course_id === result.courses[0]?.id)?.value ?? "-",
        courseB: row.course_values.find((v) => v.course_id === result.courses[1]?.id)?.value ?? "-",
      }));
  const questions = result.comparison.questionsToAskMentor?.length ? result.comparison.questionsToAskMentor : result.comparison.questions_to_ask_mentor;
  const summary = result.comparison.overall_summary ?? result.comparison.summary;
  const finalAdvice = result.comparison.final_advice ?? result.comparison.recommendation;
  const isCrossCategory = result.comparison.compare_mode === "cross_category";
  const decisionBranches = result.comparison.decision_branches ?? [];
  const missingInfo = result.comparison.missingInformation?.length ? result.comparison.missingInformation : result.comparison.missing_information ?? [];

  return (
    <div className="container pt-5">
      <Card className="overflow-hidden rounded-2xl border-cyan-200/70 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50/70 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                <GitCompareArrows className="h-3.5 w-3.5" />AI Compare
              </div>
              <h2 className="text-lg font-bold text-foreground">So sánh khóa học bằng AI</h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isCrossCategory && <Badge variant="outline" className="w-fit rounded-full border-orange-200 bg-orange-50 text-orange-700">Khác lĩnh vực</Badge>}
              <Badge variant="outline" className={`w-fit rounded-full ${confidenceClass}`}>
                {result.comparison.confidence === "high" ? "Tự tin cao" : result.comparison.confidence === "medium" ? "Tự tin vừa" : "Cần hỏi thêm"}
              </Badge>
            </div>
          </div>
          {bestCourse && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              AI khuyến nghị:{" "}
              <Link to={`/course/${bestCourse.id}`} className="font-bold underline underline-offset-2">{bestCourse.title}</Link>
            </div>
          )}
          {decisionBranches.length > 0 && (
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              {decisionBranches.map((branch) => {
                const course = courseMap.get(branch.recommended_course_id);
                return (
                  <div key={`${branch.condition}-${branch.recommended_course_id}`} className="rounded-2xl border bg-background p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">{branch.condition}</p>
                    {course && <p className="mt-1 text-xs font-medium text-primary">Nên cân nhắc: <Link to={`/course/${course.id}`} className="underline">{course.title}</Link></p>}
                    <p className="mt-2 text-sm text-muted-foreground">{branch.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
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
                {factualRows.map((row) => (
                  <tr key={row.criterion} className="border-t">
                    <td className="px-4 py-3 font-medium text-foreground">{row.criterion}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.courseA}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.courseB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {result.courses.slice(0, 2).map((course, idx) => {
              const analysis = result.comparison.course_analysis.find((a) => a.course_id === course.id);
              const pros = idx === 0 ? result.comparison.courseAPros ?? analysis?.strengths ?? [] : result.comparison.courseBPros ?? analysis?.strengths ?? [];
              const cons = idx === 0 ? result.comparison.courseACons ?? analysis?.weaknesses ?? [] : result.comparison.courseBCons ?? analysis?.weaknesses ?? [];
              return (
                <div key={course.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{course.mentor_name || "Mentor"} · {course.price ? formatVnd(course.price) : ""}</p>
                  {analysis?.practical_outcome && <p className="mt-3 rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{analysis.practical_outcome}</p>}
                  <p className="mt-3 text-sm font-medium text-foreground">Điểm mạnh</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{pros.map((p) => <li key={p}>+ {p}</li>)}</ul>
                  <p className="mt-3 text-sm font-medium text-foreground">Cần cân nhắc</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{cons.map((c) => <li key={c}>- {c}</li>)}</ul>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl bg-primary/5 p-4 text-sm text-foreground"><strong>Khuyến nghị:</strong> {finalAdvice}</div>
          {missingInfo.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1.5 font-semibold text-amber-900">Thông tin còn thiếu</p>
              <ul className="space-y-1 text-sm text-amber-800">{missingInfo.map((i) => <li key={i}>• {i}</li>)}</ul>
            </div>
          )}
          {questions.length > 0 && (
            <div className="mt-3 rounded-2xl border bg-background p-4">
              <p className="mb-1.5 font-semibold text-foreground">Nên hỏi mentor trước khi đặt lịch</p>
              <ul className="space-y-1 text-sm text-muted-foreground">{questions.map((q) => <li key={q}>• {q}</li>)}</ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── List view card ─────────────────────────────────────────────────────────────
function CourseListCard({ course, onCompare, selected }: { course: CourseData; onCompare: (id: string) => void; selected: boolean }) {
  return (
    <Link
      to={`/course/${course.id}`}
      className="group flex overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20"
    >
      <div className="relative w-44 shrink-0 overflow-hidden sm:w-52">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
        <div className="absolute bottom-2 right-2">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-foreground shadow">
            {course.price.toLocaleString("vi-VN")}đ
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground rounded-full border px-2 py-0.5">{getCourseCategoryShortLabel(course.category)}</span>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${course.format === "online" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"}`}>
              {course.format === "online" ? "Online" : "Offline"}
            </span>
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{course.title}</h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <img src={course.mentorAvatar} alt={course.mentorName} className="h-5 w-5 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span className="text-xs text-muted-foreground">{course.mentorName}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">⭐ <span className="font-semibold text-foreground">{course.rating}</span> ({course.reviewCount})</span>
            {course.studentsCount != null && course.studentsCount > 0 && <span>{course.studentsCount.toLocaleString()} học viên</span>}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onCompare(course.id); }}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
              selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-border bg-white text-cyan-700 hover:border-cyan-400"
            }`}
          >
            {selected ? <CheckCircle2 className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />}
            So sánh
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SearchPage() {
  const { session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { aiCreditsRemaining, isLoading: subscriptionLoading, refetch: refetchSubscription } = useSubscription();

  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<"default" | "rating" | "price_asc" | "price_desc">("default");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiMatchResult, setAiMatchResult] = useState<AiCourseMatchResult | null>(null);
  const [compareCourseIds, setCompareCourseIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<AiCompareResponse | null>(null);
  const [compareGoal, setCompareGoal] = useState(DEFAULT_COMPARE_GOAL);
  const [compareLoading, setCompareLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    const location = searchParams.get("location");
    const category = searchParams.get("category");
    setQuery(q ?? "");
    setLocationQuery(location ?? "");
    setSelectedCategory(category ? normalizeCourseCategory(category) : null);
  }, [searchParams]);

  const { data: courses = [], isLoading } = useLearnerSearchCourses({
    query, location: locationQuery, category: selectedCategory,
    format, minPrice: priceRange[0], maxPrice: priceRange[1],
  });

  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap(
    courses.map((c) => c.mentor?.user_id || c.mentor_id),
  );

  const fetchAiSuggestions = useCallback(async (searchQuery: string) => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setAiSuggestions([]);
      setAiMatchResult(null);
      toast({ title: "Nhập từ khóa trước khi dùng AI", description: "Tính năng này dùng 1 AI credit." });
      return;
    }
    if (!session) {
      toast({ title: "Vui lòng đăng nhập để dùng AI", description: "Free có 3 AI credits dùng thử mỗi tháng." });
      return;
    }
    if (aiCreditsRemaining < SEARCH_AI_COST) { setCreditDialogOpen(true); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { query: cleanQuery, type: "course_match", filters: { category: selectedCategory, format, budget: priceRange[1] < 1000000 ? priceRange[1] : undefined, location: locationQuery } },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) { setCreditDialogOpen(true); return; }
        throw error;
      }
      if (isAiCreditRequiredPayload(data)) { setCreditDialogOpen(true); return; }
      if (Array.isArray(data?.recommendations)) {
        setAiMatchResult(data as AiCourseMatchResult);
        setAiSuggestions([]);
        setShowAiPanel(false);
        if (data.recommendations.length === 0) toast({ title: "Chưa có khóa học phù hợp", description: "Hãy thử nới ngân sách hoặc chọn hình thức học khác." });
        return;
      }
      if (data?.suggestions) {
        let raw = data.suggestions;
        if (Array.isArray(raw)) {
          const suggestions = raw.map((s: unknown) => String(s)).filter(Boolean).slice(0, 5);
          setAiSuggestions(suggestions);
          setShowAiPanel(suggestions.length > 0);
          setAiMatchResult(null);
          return;
        }
        if (typeof raw === "string") {
          try {
            raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const suggestions = parsed.map((s: unknown) => {
                if (typeof s === "string") return s;
                if (s && typeof s === "object" && "title" in s) return String((s as { title?: unknown }).title ?? "");
                return "";
              }).filter(Boolean).slice(0, 5);
              setAiSuggestions(suggestions);
              setShowAiPanel(suggestions.length > 0);
              setAiMatchResult(null);
              return;
            }
          } catch { /* ignore parse error */ }
        }
      }
      toast({ title: "AI chưa có gợi ý phù hợp", description: "Bạn có thể thử từ khóa cụ thể hơn." });
    } catch {
      toast({ title: "Không thể dùng AI lúc này", description: "Vui lòng thử lại sau.", variant: "destructive" });
    } finally {
      setAiLoading(false);
      await refetchSubscription();
    }
  }, [aiCreditsRemaining, format, locationQuery, priceRange, refetchSubscription, selectedCategory, session, toast]);

  const handleAiCompare = async () => {
    if (compareCourseIds.length < 2 || compareCourseIds.length > 3) { toast({ title: "Vui lòng chọn từ 2 đến 3 khóa học để so sánh." }); return; }
    if (!session) { toast({ title: "Vui lòng đăng nhập để dùng AI Compare" }); return; }
    if (aiCreditsRemaining < COMPARE_AI_COST) { setCreditDialogOpen(true); return; }
    setCompareLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compare", {
        body: { course_ids: compareCourseIds, comparison_goal: compareGoal, learner_goal: query.trim() || undefined, preferred_format: format === "all" ? "any" : format, budget: priceRange[1] < 1000000 ? priceRange[1] : undefined },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) { const payload = await readFunctionErrorPayload(error); if (isAiCreditRequiredPayload(payload)) { setCreditDialogOpen(true); return; } throw error; }
      if (isAiCreditRequiredPayload(data)) { setCreditDialogOpen(true); return; }
      if (!data?.comparison || !Array.isArray(data?.courses)) throw new Error("AI Compare chưa trả về kết quả hợp lệ.");
      setCompareResult(data as AiCompareResponse);
      toast({ title: "AI đã so sánh khóa học" });
    } catch (err: unknown) {
      toast({ title: "Không thể dùng AI Compare", description: err instanceof Error ? err.message : "Vui lòng thử lại sau.", variant: "destructive" });
    } finally {
      setCompareLoading(false);
      await refetchSubscription();
    }
  };

  const toggleCompareCourse = (courseId: string) => {
    setCompareResult(null);
    setCompareCourseIds((curr) => {
      if (curr.includes(courseId)) return curr.filter((id) => id !== courseId);
      if (curr.length >= 3) { toast({ title: "Chỉ so sánh tối đa 3 khóa học" }); return curr; }
      return [...curr, courseId];
    });
  };

  const clearFilters = () => {
    setFormat("all");
    setPriceRange([0, 1000000]);
    setSelectedCategory(null);
    setQuery("");
  };

  // Map + sort
  let mappedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  }));

  if (sortMode === "rating") mappedCourses = [...mappedCourses].sort((a, b) => b.rating - a.rating);
  else if (sortMode === "price_asc") mappedCourses = [...mappedCourses].sort((a, b) => a.price - b.price);
  else if (sortMode === "price_desc") mappedCourses = [...mappedCourses].sort((a, b) => b.price - a.price);

  const selectedCompareCourses = mappedCourses.filter((c) => compareCourseIds.includes(c.id));
  const hasActiveFilters = format !== "all" || priceRange[0] > 0 || priceRange[1] < 1000000 || selectedCategory !== null;

  return (
    <MainLayout>
      {/* ── Search panel ── */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-sm">
        <div className="container py-3">
          {/* Row 1: Search input + action buttons */}
          <div className="flex items-center gap-2.5">
            {/* Search input */}
            <div className="relative flex-1">
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition-all focus-within:border-cyan-400 focus-within:shadow-cyan-100 focus-within:shadow-md">
                <Search className="h-4 w-4 shrink-0 text-cyan-500" />
                <input
                  type="text"
                  placeholder="Bạn muốn học gì? Ví dụ: Tôi muốn học tiếng Anh giao tiếp online buổi tối dưới 400k"
                  className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-500 shrink-0" />}
                {query && !aiLoading && (
                  <button onClick={() => { setQuery(""); setAiSuggestions([]); setAiMatchResult(null); }} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* AI suggestions dropdown */}
              <AnimatePresence>
                {showAiPanel && aiSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold text-cyan-600">
                      <Brain className="h-3.5 w-3.5" />AI gợi ý
                    </div>
                    {aiSuggestions.map((s, i) => (
                      <button key={i} onMouseDown={() => { setQuery(s); setShowAiPanel(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />{s}
                      </button>
                    ))}
                    <button onClick={() => setShowAiPanel(false)} className="mt-1 w-full rounded-xl px-3 py-1.5 text-center text-xs text-slate-400 hover:bg-slate-50 transition-colors">Đóng</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 rounded-xl border-slate-200 transition-all ${showFilters ? "bg-cyan-50 border-cyan-300 text-cyan-700" : "hover:bg-slate-50"}`}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Bộ lọc
              {hasActiveFilters && <span className="ml-1.5 flex h-2 w-2 rounded-full bg-cyan-500" />}
            </Button>

            {/* Map button */}
            <Link to={locationQuery ? `/map?location=${encodeURIComponent(locationQuery)}` : "/map"}>
              <Button variant="outline" size="sm" className="shrink-0 rounded-xl border-slate-200 hover:bg-slate-50">
                <MapPin className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Bản đồ</span>
              </Button>
            </Link>

            {/* AI Course Match button */}
            <Button
              size="sm"
              onClick={() => fetchAiSuggestions(query)}
              disabled={aiLoading || subscriptionLoading}
              className="shrink-0 rounded-xl border border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 shadow-sm hover:from-cyan-100 hover:to-blue-100 hover:shadow-md transition-all"
            >
              {aiLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              <span className="hidden sm:inline">AI Course Match</span>
              <span className="ml-1 hidden sm:inline text-cyan-500 text-[10px]">· {SEARCH_AI_COST} credit</span>
            </Button>

            {/* Credits badge */}
            <div className="hidden lg:flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700">
              <Brain className="h-3.5 w-3.5" />
              {isLoggedIn ? `${aiCreditsRemaining} credits` : "Đăng nhập"}
            </div>
          </div>

          {/* Row 2: Category chips */}
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-medium transition-all shrink-0 ${
                !selectedCategory
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-600"
              }`}
            >
              Tất cả
            </button>
            {COURSE_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-medium transition-all shrink-0 ${
                  selectedCategory === cat.slug
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-600"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Location badge */}
          {locationQuery && (
            <div className="mt-2 flex">
              <Badge variant="outline" className="gap-1.5 rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700 text-xs">
                <MapPin className="h-3 w-3" />
                {locationQuery}
                <button type="button" onClick={() => setLocationQuery("")} className="ml-0.5 rounded-full hover:bg-cyan-100 p-0.5">
                  <X className="h-2.5 w-2.5" />
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
              className="overflow-hidden border-t border-slate-100 bg-slate-50/80"
            >
              <div className="container grid gap-5 py-5 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hình thức học</p>
                  <div className="flex gap-2">
                    {(["all", "online", "offline"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
                          format === f ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
                        }`}
                      >
                        {f === "all" ? "Tất cả" : f === "online" ? "Online" : "Offline"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Giá: {priceRange[0].toLocaleString("vi-VN")}đ — {priceRange[1].toLocaleString("vi-VN")}đ
                  </p>
                  <Slider value={priceRange} onValueChange={setPriceRange} max={1000000} step={50000} className="mt-3" />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200"
                  >
                    Xóa bộ lọc
                  </Button>
                  <Button
                    onClick={() => setShowFilters(false)}
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

      {/* ── AI loading ── */}
      {aiLoading && (
        <div className="container pt-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            AI đang phân tích nhu cầu học của bạn...
          </div>
        </div>
      )}

      {/* ── AI results ── */}
      {!aiLoading && aiMatchResult && <AiCourseMatchPanel result={aiMatchResult} />}

      {/* ── Compare bar ── */}
      {compareCourseIds.length > 0 && (
        <div className="container pt-4">
          <Card className="rounded-2xl border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  <GitCompareArrows className="h-4 w-4" />
                  Đã chọn {compareCourseIds.length}/3 khóa để so sánh
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCompareCourses.map((c) => (
                    <Badge key={c.id} variant="outline" className="max-w-full gap-1.5 rounded-full bg-white">
                      <span className="max-w-[200px] truncate text-xs">{c.title}</span>
                      <button type="button" onClick={() => toggleCompareCourse(c.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
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
                <Button onClick={handleAiCompare} disabled={compareLoading || compareCourseIds.length < 2 || subscriptionLoading} className="rounded-xl border-0 gradient-primary text-primary-foreground">
                  {compareLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompareArrows className="mr-2 h-4 w-4" />}
                  {compareLoading ? "AI đang so sánh..." : `So sánh AI · ${COMPARE_AI_COST} credits`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {compareLoading && (
        <div className="container pt-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />AI đang so sánh các khóa học bạn chọn...
          </div>
        </div>
      )}

      {!compareLoading && compareResult && <AiCompareResultPanel result={compareResult} />}

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
                  {mappedCourses.length > 0 ? (
                    <><span className="text-cyan-600">{mappedCourses.length}</span> kết quả phù hợp{query && <> cho "<span className="text-primary">{query}</span>"</>}</>
                  ) : "Không có kết quả"}
                </p>
                {mappedCourses.length > 0 && (
                  <p className="mt-0.5 text-xs text-slate-400">Tìm thấy các khóa học phù hợp với nhu cầu của bạn</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
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
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-1.5 transition-colors ${viewMode === "grid" ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-1.5 transition-colors ${viewMode === "list" ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}
              >
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
                  {/* Compare button overlay */}
                  <button
                    type="button"
                    onClick={() => toggleCompareCourse(c.id)}
                    className={`absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-md transition-all ${
                      selected
                        ? "border-cyan-600 bg-cyan-600 text-white"
                        : "border-white/80 bg-white/95 text-cyan-700 hover:bg-cyan-50"
                    }`}
                  >
                    {selected ? <CheckCircle2 className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />}
                    So sánh
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mappedCourses.map((c) => (
              <CourseListCard
                key={c.id}
                course={c}
                onCompare={toggleCompareCourse}
                selected={compareCourseIds.includes(c.id)}
              />
            ))}
          </div>
        )}

        {/* Suggestions when few results */}
        {!isLoading && mappedCourses.length > 0 && mappedCourses.length <= 4 && (
          <div className="mt-10 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
            <BookOpen className="mx-auto mb-2 h-7 w-7 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Khám phá thêm danh mục</p>
            <p className="mt-0.5 text-xs text-slate-400 mb-4">Bạn có thể thích các danh mục sau</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {COURSE_CATEGORIES.map((cat) => (
                <Link key={cat.slug} to={`/search?category=${cat.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-600 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <AiCreditUpgradeDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen} />
    </MainLayout>
  );
}
