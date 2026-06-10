import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { useLearnerSearchCourses } from "@/hooks/useLearnerCourses";
import { Search, SlidersHorizontal, MapPin, Monitor, X, LayoutGrid, List, Sparkles, Brain, Loader2, GitCompareArrows, CheckCircle2 } from "lucide-react";
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

const SEARCH_AI_COST = AI_CREDIT_COSTS.search;
const COMPARE_AI_COST = AI_CREDIT_COSTS.compare;

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
  decision_branches?: Array<{
    condition: string;
    recommended_course_id: string;
    reason: string;
  }>;
  factualComparison?: Array<{
    criterion: string;
    courseA: string;
    courseB: string;
  }>;
  goalBasedAnalysis?: Array<{
    goal: string;
    betterChoice: "courseA" | "courseB" | "tie";
    reason: string;
  }>;
  skillInsights?: string[];
  courseAPros?: string[];
  courseACons?: string[];
  courseBPros?: string[];
  courseBCons?: string[];
  questionsToAskMentor?: string[];
  missingInformation?: string[];
  missing_information?: string[];
  best_choice_course_id: string | null;
  comparison_table: Array<{
    criterion: string;
    course_values: Array<{ course_id: string; value: string }>;
  }>;
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

function AiCourseMatchPanel({ result }: { result: AiCourseMatchResult }) {
  return (
    <div className="container pt-6">
      <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-50/60 shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Brain className="h-3.5 w-3.5" />
                AI Course Match
              </div>
              <h2 className="text-xl font-bold text-foreground">Gợi ý khóa học phù hợp</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{result.intent_summary}</p>
            </div>
            {result.fallback && (
              <Badge variant="outline" className="w-fit rounded-full border-amber-200 bg-amber-50 text-amber-700">
                Gợi ý dự phòng
              </Badge>
            )}
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
            {result.credit_refunded && (
              <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                Credit đã được hoàn do AI lỗi
              </Badge>
            )}
          </div>

          {result.recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center">
              <p className="font-semibold text-foreground">Hiện chưa có khóa học phù hợp.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Hãy thử nới ngân sách hoặc chọn hình thức học khác.
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

function AiCompareResultPanel({ result }: { result: AiCompareResponse }) {
  const courseMap = new Map(result.courses.map((course) => [course.id, course]));
  const recommendedCourseId = result.comparison.recommendedCourseId ?? result.comparison.best_choice_course_id;
  const bestCourse = recommendedCourseId
    ? courseMap.get(recommendedCourseId)
    : null;
  const confidenceLabel = result.comparison.confidence === "high"
    ? "Tự tin cao"
    : result.comparison.confidence === "medium"
      ? "Tự tin vừa"
      : "Cần hỏi thêm";
  const confidenceClass = result.comparison.confidence === "high"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : result.comparison.confidence === "medium"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const factualRows = result.comparison.factualComparison?.length
    ? result.comparison.factualComparison
    : result.comparison.comparison_table.map((row) => ({
        criterion: row.criterion,
        courseA: row.course_values.find((item) => item.course_id === result.courses[0]?.id)?.value ?? "-",
        courseB: row.course_values.find((item) => item.course_id === result.courses[1]?.id)?.value ?? "-",
      }));
  const questions = result.comparison.questionsToAskMentor?.length
    ? result.comparison.questionsToAskMentor
    : result.comparison.questions_to_ask_mentor;
  const skillInsights = result.comparison.skillInsights ?? [];
  const compareMode = result.comparison.compare_mode ?? "same_category";
  const isCrossCategory = compareMode === "cross_category";
  const decisionBranches = result.comparison.decision_branches ?? [];
  const missingInfo = result.comparison.missingInformation?.length
    ? result.comparison.missingInformation
    : result.comparison.missing_information ?? [];
  const summary = result.comparison.overall_summary ?? result.comparison.summary;
  const finalAdvice = result.comparison.final_advice ?? result.comparison.recommendation;

  return (
    <div className="container pt-6">
      <Card className="overflow-hidden rounded-2xl border-cyan-200/70 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50/70 shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                <GitCompareArrows className="h-3.5 w-3.5" />
                AI Compare
              </div>
              <h2 className="text-xl font-bold text-foreground">So sánh khóa học bằng AI</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isCrossCategory && (
                <Badge variant="outline" className="w-fit rounded-full border-orange-200 bg-orange-50 text-orange-700">
                  Khác lĩnh vực
                </Badge>
              )}
              <Badge variant="outline" className={`w-fit rounded-full ${confidenceClass}`}>
                {confidenceLabel}
              </Badge>
            </div>
          </div>

          {isCrossCategory && (
            <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm leading-relaxed text-orange-900">
              Hai khóa học thuộc hai hướng học khác nhau, nên lựa chọn phụ thuộc vào mục tiêu của bạn.
              {result.comparison.goal_interpretation ? (
                <span className="ml-1">{result.comparison.goal_interpretation}</span>
              ) : null}
            </div>
          )}

          {bestCourse && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Nếu mục tiêu của bạn là <strong>{result.comparison.best_choice_condition || result.comparison.goalBasedAnalysis?.[0]?.goal || "mục tiêu đã chọn"}</strong>, AI khuyến nghị cân nhắc trước:{" "}
              <Link to={`/course/${bestCourse.id}`} className="font-bold underline underline-offset-2">
                {bestCourse.title}
              </Link>
            </div>
          )}

          {!bestCourse && isCrossCategory && (
            <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-relaxed text-cyan-900">
              AI chưa thể chọn một khóa tốt nhất vì mục tiêu của bạn chưa rõ. Hãy chọn theo nhánh quyết định phù hợp nhất bên dưới.
            </div>
          )}

          {decisionBranches.length > 0 ? (
            <div className="mb-5 grid gap-3 md:grid-cols-2">
              {decisionBranches.map((branch) => {
                const course = courseMap.get(branch.recommended_course_id);
                return (
                  <div key={`${branch.condition}-${branch.recommended_course_id}`} className="rounded-2xl border bg-background p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">{branch.condition}</p>
                    {course && (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Nên cân nhắc:{" "}
                        <Link to={`/course/${course.id}`} className="underline underline-offset-2">
                          {course.title}
                        </Link>
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{branch.reason}</p>
                  </div>
                );
              })}
            </div>
          ) : result.comparison.goalBasedAnalysis?.length ? (
            <div className="mb-5 grid gap-3 md:grid-cols-2">
              {result.comparison.goalBasedAnalysis.map((item) => {
                const betterLabel =
                  item.betterChoice === "courseA"
                    ? result.courses[0]?.title
                    : item.betterChoice === "courseB"
                      ? result.courses[1]?.title
                      : "Tùy mục tiêu";
                return (
                  <div key={`${item.goal}-${item.reason}`} className="rounded-2xl border bg-background p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">Nếu ưu tiên: {item.goal}</p>
                    <p className="mt-1 text-xs font-medium text-primary">Lựa chọn nghiêng về: {betterLabel}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.reason}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {skillInsights.length > 0 && (
            <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
              <p className="mb-2 font-semibold text-cyan-900">Nhận định AI về kỹ năng/chủ đề</p>
              <ul className="space-y-1 text-sm leading-relaxed text-cyan-800">
                {skillInsights.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

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
                      {(course.skill_topic || course.skill_domain) && (
                        <p className="mt-1 text-xs font-normal text-muted-foreground">
                          {[course.category_name, course.skill_topic].filter(Boolean).join(" · ")}
                        </p>
                      )}
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
                    {result.courses.slice(2).map((course) => {
                      const legacyRow = result.comparison.comparison_table.find((item) => item.criterion === row.criterion);
                      const value = legacyRow?.course_values.find((item) => item.course_id === course.id)?.value ?? "-";
                      return <td key={course.id} className="px-4 py-3 text-muted-foreground">{value}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.courses.slice(0, 2).map((course, index) => {
              const analysis = result.comparison.course_analysis.find((item) => item.course_id === course.id);
              const pros = index === 0
                ? result.comparison.courseAPros ?? analysis?.strengths ?? []
                : result.comparison.courseBPros ?? analysis?.strengths ?? [];
              const cons = index === 0
                ? result.comparison.courseACons ?? analysis?.weaknesses ?? []
                : result.comparison.courseBCons ?? analysis?.weaknesses ?? [];
              if (!course) return null;
              return (
                <div key={course.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.mentor_name || "Mentor"} · {course.price ? formatVnd(course.price) : ""}
                  </p>
                  {analysis?.category_understanding && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{analysis.category_understanding}</p>
                  )}
                  {analysis?.practical_outcome && (
                    <p className="mt-3 rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                      {analysis.practical_outcome}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-medium text-foreground">Điểm mạnh</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {pros.map((item) => <li key={item}>+ {item}</li>)}
                  </ul>
                  <p className="mt-3 text-sm font-medium text-foreground">Cần cân nhắc</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {cons.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                  {analysis?.not_best_for && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Không phù hợp nhất nếu: </span>
                      {analysis.not_best_for}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
            <strong>Khuyến nghị:</strong> {finalAdvice}
          </div>

          {missingInfo.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 font-semibold text-amber-900">Thông tin còn thiếu để so sánh chính xác hơn</p>
              <ul className="space-y-1 text-sm text-amber-800">
                {missingInfo.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {questions.length > 0 && (
            <div className="mt-4 rounded-2xl border bg-background p-4">
              <p className="mb-2 font-semibold text-foreground">Nên hỏi mentor trước khi đặt lịch</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {questions.map((question) => (
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
  const { session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const {
    aiCreditsRemaining,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useSubscription();
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap(
    courses.map((course) => course.mentor?.user_id || course.mentor_id),
  );

  // AI Course Match suggestions
  const fetchAiSuggestions = useCallback(async (searchQuery: string) => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setAiSuggestions([]);
      setAiMatchResult(null);
      toast({
        title: "Nhập từ khóa trước khi dùng AI",
        description: "Tính năng này dùng 1 AI credit.",
      });
      return;
    }

    if (!session) {
      toast({
        title: "Vui lòng đăng nhập để dùng AI",
        description: "Free có 3 AI credits dùng thử mỗi tháng.",
      });
      return;
    }

    if (aiCreditsRemaining < SEARCH_AI_COST) {
      setCreditDialogOpen(true);
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: {
          query: cleanQuery,
          type: "course_match",
          filters: {
            category: selectedCategory,
            format,
            budget: priceRange[1] < 1000000 ? priceRange[1] : undefined,
            location: locationQuery,
          },
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) {
          setCreditDialogOpen(true);
          return;
        }
        throw error;
      }

      if (isAiCreditRequiredPayload(data)) {
        setCreditDialogOpen(true);
        return;
      }

      if (Array.isArray(data?.recommendations)) {
        setAiMatchResult(data as AiCourseMatchResult);
        setAiSuggestions([]);
        setShowAiPanel(false);
        if (data.recommendations.length === 0) {
          toast({
            title: "Chưa có khóa học phù hợp",
            description: "Hãy thử nới ngân sách hoặc chọn hình thức học khác.",
          });
        }
        return;
      }

      if (data?.suggestions) {
        let raw = data.suggestions;
        if (Array.isArray(raw)) {
          const suggestions = raw.map((item) => String(item)).filter(Boolean).slice(0, 5);
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
              const suggestions = parsed
                .map((item: unknown) => {
                  if (typeof item === "string") return item;
                  if (item && typeof item === "object" && "title" in item) {
                    const title = (item as { title?: unknown }).title;
                    return typeof title === "string" ? title : "";
                  }
                  return "";
                })
                .filter(Boolean)
                .slice(0, 5);
              setAiSuggestions(suggestions);
              setShowAiPanel(suggestions.length > 0);
              setAiMatchResult(null);
              return;
            }
          } catch (parseError) {
            console.error("Parse AI suggestions error:", parseError);
          }
        }
      }

      toast({
        title: "AI chưa có gợi ý phù hợp",
        description: "Bạn có thể thử từ khóa cụ thể hơn.",
      });
    } catch (error) {
      console.error("AI search error:", error);
      toast({
        title: "Không thể dùng AI lúc này",
        description: "Vui lòng thử lại sau. Nếu AI đã bị lỗi, credit sẽ được hoàn qua hệ thống.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
      await refetchSubscription();
    }
  }, [aiCreditsRemaining, format, locationQuery, priceRange, refetchSubscription, selectedCategory, session, toast]);

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
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  }));

  const selectedCompareCourses = mappedCourses.filter((course) => compareCourseIds.includes(course.id));

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

  const handleAiCompare = async () => {
    if (compareCourseIds.length < 2 || compareCourseIds.length > 3) {
      toast({ title: "Vui lòng chọn từ 2 đến 3 khóa học để so sánh." });
      return;
    }

    if (!session) {
      toast({
        title: "Vui lòng đăng nhập để dùng AI Compare",
        description: "Tính năng này dùng 2 AI credits.",
      });
      return;
    }

    if (aiCreditsRemaining < COMPARE_AI_COST) {
      setCreditDialogOpen(true);
      return;
    }

    setCompareLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compare", {
        body: {
          course_ids: compareCourseIds,
          comparison_goal: compareGoal,
          learner_goal: query.trim() || undefined,
          preferred_format: format === "all" ? "any" : format,
          budget: priceRange[1] < 1000000 ? priceRange[1] : undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) {
          setCreditDialogOpen(true);
          return;
        }
        throw error;
      }

      if (isAiCreditRequiredPayload(data)) {
        setCreditDialogOpen(true);
        return;
      }

      if (!data?.comparison || !Array.isArray(data?.courses)) {
        throw new Error("AI Compare chưa trả về kết quả hợp lệ.");
      }

      setCompareResult(data as AiCompareResponse);
      toast({ title: "AI đã so sánh khóa học", description: "Credit đã được cập nhật trong gói của bạn." });
    } catch (error: any) {
      console.error("AI compare error:", error);
      toast({
        title: "Không thể dùng AI Compare",
        description: error?.message || "Vui lòng thử lại sau. Nếu AI lỗi, credit sẽ được hoàn qua hệ thống.",
        variant: "destructive",
      });
    } finally {
      setCompareLoading(false);
      await refetchSubscription();
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
              {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {query && !aiLoading && (
                <button onClick={() => { setQuery(""); setAiSuggestions([]); setAiMatchResult(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {showAiPanel && aiSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border bg-card p-2 shadow-elevated"
                >
                  <div className="mb-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">AI gợi ý</span>
                  </div>
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(s); setShowAiPanel(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <Sparkles className="h-3 w-3 text-primary/60" />
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAiPanel(false)}
                    className="mt-1 w-full rounded-lg px-3 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Đóng
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
            onClick={() => fetchAiSuggestions(query)}
            disabled={aiLoading || subscriptionLoading}
            className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          >
            {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            {aiLoading ? "AI đang phân tích..." : `AI Course Match · ${SEARCH_AI_COST} credit`}
          </Button>
          <Badge variant="outline" className="hidden rounded-full border-primary/20 bg-background px-3 py-1.5 text-primary md:inline-flex">
            {isLoggedIn ? `Bạn còn ${aiCreditsRemaining} AI credits` : "Đăng nhập để dùng AI"}
          </Badge>
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

      {aiLoading && (
        <div className="container pt-6">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm text-primary shadow-sm">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            AI đang phân tích nhu cầu học của bạn...
          </div>
        </div>
      )}

      {!aiLoading && aiMatchResult && <AiCourseMatchPanel result={aiMatchResult} />}

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
                  onClick={handleAiCompare}
                  disabled={compareLoading || compareCourseIds.length < 2 || subscriptionLoading}
                  className="rounded-xl border-0 gradient-primary text-primary-foreground"
                >
                  {compareLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                  )}
                  {compareLoading ? "AI đang so sánh..." : `So sánh bằng AI · ${COMPARE_AI_COST} credits`}
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
            AI đang so sánh các khóa học bạn chọn...
          </div>
        </div>
      )}

      {!compareLoading && compareResult && <AiCompareResultPanel result={compareResult} />}

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

      <AiCreditUpgradeDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen} />
    </MainLayout>
  );
}
