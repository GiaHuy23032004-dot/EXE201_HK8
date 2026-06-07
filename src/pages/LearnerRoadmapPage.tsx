import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, CalendarDays, Loader2, Route, Sparkles, Target } from "lucide-react";
import { AiCreditUpgradeDialog } from "@/components/subscription/AiCreditUpgradeDialog";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { AI_CREDIT_COSTS } from "@/constants/aiCredits";
import { COURSE_CATEGORIES, getCourseCategoryShortLabel } from "@/constants/courseCategories";
import { supabase } from "@/integrations/supabase/client";
import { isAiCreditRequiredPayload, readFunctionErrorPayload } from "@/lib/aiCreditErrors";

const ROADMAP_COST = AI_CREDIT_COSTS.roadmap;

type RoadmapCourse = {
  id: string;
  title: string;
  category?: string | null;
  format?: "online" | "offline";
  price?: number;
  mentor_name?: string;
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

type RoadmapResponse = {
  roadmap: RoadmapResult;
  courses: RoadmapCourse[];
  fallback?: boolean;
};

function formatVnd(value?: number | null) {
  if (!value) return "";
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

export default function LearnerRoadmapPage() {
  const { session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { aiCreditsRemaining, refetch } = useSubscription();
  const [goal, setGoal] = useState("Tôi muốn học tiếng Anh giao tiếp trong 8 tuần");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("beginner");
  const [durationWeeks, setDurationWeeks] = useState("8");
  const [preferredFormat, setPreferredFormat] = useState("any");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [result, setResult] = useState<RoadmapResponse | null>(null);

  const courseMap = useMemo(
    () => new Map((result?.courses ?? []).map((course) => [course.id, course])),
    [result],
  );

  const handleSubmit = async () => {
    const cleanGoal = goal.trim();
    if (!cleanGoal) {
      toast({ title: "Vui lòng nhập mục tiêu học tập.", variant: "destructive" });
      return;
    }

    if (!isLoggedIn || !session) {
      toast({
        title: "Vui lòng đăng nhập để tạo lộ trình AI",
        description: "Tính năng này dùng 3 AI credits.",
      });
      return;
    }

    if (aiCreditsRemaining < ROADMAP_COST) {
      setUpgradeOpen(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-roadmap", {
        body: {
          goal: cleanGoal,
          category: category || undefined,
          level,
          duration_weeks: Number(durationWeeks) || undefined,
          preferred_format: preferredFormat,
          budget: budget ? Number(budget) : undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) {
          setUpgradeOpen(true);
          return;
        }
        throw error;
      }

      if (isAiCreditRequiredPayload(data)) {
        setUpgradeOpen(true);
        return;
      }

      if (!data?.roadmap) {
        throw new Error("AI Roadmap chưa trả về lộ trình hợp lệ.");
      }

      setResult(data as RoadmapResponse);
      toast({ title: "Đã tạo lộ trình AI", description: "Credit đã được cập nhật trong gói của bạn." });
    } catch (error: any) {
      console.error("AI roadmap error:", error);
      toast({
        title: "Không thể tạo lộ trình AI",
        description: error?.message || "Vui lòng thử lại sau. Nếu AI lỗi, credit sẽ được hoàn qua hệ thống.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      await refetch();
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Brain className="h-3.5 w-3.5" />
              AI Roadmap · {ROADMAP_COST} credits
            </div>
            <h1 className="text-3xl font-bold text-foreground">Lộ trình học cá nhân hóa</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Nhập mục tiêu của bạn, VET sẽ dùng AI để gợi ý kế hoạch học theo tuần và khóa học phù hợp.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-background px-3 py-1.5 text-primary">
            {isLoggedIn ? `Bạn còn ${aiCreditsRemaining} AI credits` : "Đăng nhập để dùng AI"}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="h-fit rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Mục tiêu học tập
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Bạn muốn đạt được gì?</label>
                <Textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="min-h-[120px] rounded-2xl"
                  maxLength={500}
                  placeholder="VD: Tôi muốn học tiếng Anh giao tiếp trong 8 tuần"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Danh mục</label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="">AI tự nhận diện</option>
                    {COURSE_CATEGORIES.map((item) => (
                      <option key={item.slug} value={item.slug}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Trình độ</label>
                  <select
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="beginner">Mới bắt đầu</option>
                    <option value="intermediate">Trung cấp</option>
                    <option value="advanced">Nâng cao</option>
                    <option value="unknown">Chưa rõ</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Số tuần</label>
                  <Input
                    type="number"
                    min={2}
                    max={24}
                    value={durationWeeks}
                    onChange={(event) => setDurationWeeks(event.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Hình thức ưu tiên</label>
                  <select
                    value={preferredFormat}
                    onChange={(event) => setPreferredFormat(event.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="any">Linh hoạt</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Ngân sách tối đa / buổi</label>
                  <Input
                    type="number"
                    min={0}
                    step={50000}
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="VD: 500000"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !goal.trim()}
                className="w-full rounded-xl border-0 gradient-primary py-6 text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI đang tạo lộ trình...
                  </>
                ) : (
                  <>
                    <Route className="mr-2 h-4 w-4" />
                    Tạo lộ trình bằng AI · {ROADMAP_COST} credits
                  </>
                )}
              </Button>

              {!isLoggedIn && (
                <Link to="/auth">
                  <Button variant="outline" className="w-full rounded-xl">
                    Đăng nhập để dùng AI Roadmap
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <div className="min-w-0">
            {loading && (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm text-primary shadow-sm">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                AI đang thiết kế lộ trình học theo mục tiêu của bạn...
              </div>
            )}

            {!loading && !result && (
              <Card className="rounded-2xl border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <Sparkles className="mb-4 h-12 w-12 text-primary" />
                  <p className="text-lg font-semibold text-foreground">Sẵn sàng tạo lộ trình</p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    AI sẽ chỉ dùng tối đa 8 khóa học phù hợp từ database VET và không thay đổi marketplace thường.
                  </p>
                </CardContent>
              </Card>
            )}

            {!loading && result && (
              <div className="space-y-6">
                <Card className="rounded-2xl border-primary/15 bg-gradient-to-br from-primary/5 via-background to-cyan-50/60 shadow-card">
                  <CardContent className="p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">{result.roadmap.roadmap_title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.roadmap.goal_summary}</p>
                      </div>
                      <Badge className="rounded-full bg-primary text-primary-foreground">
                        <CalendarDays className="mr-1 h-3.5 w-3.5" />
                        {result.roadmap.estimated_duration_weeks} tuần
                      </Badge>
                    </div>
                    {result.fallback && (
                      <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                        Lộ trình dự phòng
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {result.roadmap.weekly_plan.map((week) => (
                    <Card key={week.week} className="rounded-2xl shadow-sm">
                      <CardContent className="p-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Badge variant="outline" className="mb-2 rounded-full">Tuần {week.week}</Badge>
                            <h3 className="font-semibold text-foreground">{week.focus}</h3>
                          </div>
                        </div>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {week.tasks.map((task) => <li key={task}>• {task}</li>)}
                        </ul>
                        {week.suggested_course_ids.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {week.suggested_course_ids.map((courseId) => {
                              const course = courseMap.get(courseId);
                              if (!course) return null;
                              return (
                                <Link key={courseId} to={`/course/${courseId}`}>
                                  <Badge variant="outline" className="rounded-full bg-primary/5 text-primary hover:bg-primary/10">
                                    {course.title}
                                  </Badge>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {result.roadmap.recommended_courses.length > 0 && (
                  <Card className="rounded-2xl shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Khóa học gợi ý</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      {result.roadmap.recommended_courses.map((item) => {
                        const course = courseMap.get(item.course_id);
                        if (!course) return null;
                        return (
                          <Link key={item.course_id} to={`/course/${item.course_id}`}>
                            <div className="h-full rounded-2xl border bg-background p-4 transition-colors hover:border-primary">
                              <div className="mb-2 flex flex-wrap gap-2">
                                {course.category && (
                                  <Badge variant="outline" className="rounded-full">
                                    {getCourseCategoryShortLabel(course.category)}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="rounded-full">
                                  {course.format === "online" ? "Online" : "Offline"}
                                </Badge>
                              </div>
                              <p className="font-semibold text-foreground">{course.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {course.mentor_name || "Mentor"} · {formatVnd(course.price)}
                              </p>
                              <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="mb-2 font-semibold text-foreground">Mẹo học tập</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {result.roadmap.study_tips.map((tip) => <li key={tip}>• {tip}</li>)}
                    </ul>
                    <div className="mt-4 rounded-2xl bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
                      <strong>Bước tiếp theo:</strong> {result.roadmap.next_step}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <AiCreditUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </MainLayout>
  );
}
