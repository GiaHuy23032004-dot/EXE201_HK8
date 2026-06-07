import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Check, GraduationCap, Loader2, Save, Sparkles } from "lucide-react";
import { AIHistoryPanel } from "@/components/ai/AIHistoryPanel";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_CATEGORIES } from "@/constants/courseCategories";
import { useAuth } from "@/contexts/AuthContext";
import {
  useLearnerLearningProfile,
  useUpsertLearnerLearningProfile,
  type LearningProfileFormValues,
} from "@/hooks/useLearnerLearningProfile";
import { useToast } from "@/hooks/use-toast";

const emptyForm: LearningProfileFormValues = {
  primary_goal: "",
  current_level: "",
  preferred_categories: [],
  preferred_format: "any",
  budget_min: null,
  budget_max: null,
  location_preference: "",
  schedule_preference: "",
  learning_style: "",
  notes: "",
};

function toNumberOrNull(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && value.trim() !== "" ? number : null;
}

export default function LearnerLearningProfilePage() {
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { data: profile, isLoading } = useLearnerLearningProfile();
  const upsertProfile = useUpsertLearnerLearningProfile();
  const [form, setForm] = useState<LearningProfileFormValues>(emptyForm);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      primary_goal: profile.primary_goal ?? "",
      current_level: profile.current_level ?? "",
      preferred_categories: profile.preferred_categories ?? [],
      preferred_format: profile.preferred_format ?? "any",
      budget_min: profile.budget_min ?? null,
      budget_max: profile.budget_max ?? null,
      location_preference: profile.location_preference ?? "",
      schedule_preference: profile.schedule_preference ?? "",
      learning_style: profile.learning_style ?? "",
      notes: profile.notes ?? "",
    });
    setBudgetMin(profile.budget_min ? String(profile.budget_min) : "");
    setBudgetMax(profile.budget_max ? String(profile.budget_max) : "");
  }, [profile]);

  const toggleCategory = (slug: string) => {
    setForm((current) => {
      const selected = current.preferred_categories.includes(slug);
      return {
        ...current,
        preferred_categories: selected
          ? current.preferred_categories.filter((item) => item !== slug)
          : [...current.preferred_categories, slug],
      };
    });
  };

  const handleSave = async () => {
    const values: LearningProfileFormValues = {
      ...form,
      budget_min: toNumberOrNull(budgetMin),
      budget_max: toNumberOrNull(budgetMax),
    };

    if (values.budget_min !== null && values.budget_max !== null && values.budget_min > values.budget_max) {
      toast({
        title: "Ngân sách chưa hợp lệ",
        description: "Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.",
        variant: "destructive",
      });
      return;
    }

    try {
      await upsertProfile.mutateAsync(values);
      toast({ title: "Đã lưu hồ sơ học tập", description: "AI có thể dùng thông tin này làm context tham khảo." });
    } catch (error: any) {
      toast({
        title: "Không thể lưu hồ sơ học tập",
        description: error?.message || "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    }
  };

  if (!isLoggedIn) {
    return (
      <MainLayout>
        <div className="container max-w-3xl py-20 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Đăng nhập để tạo hồ sơ học tập</h1>
          <p className="mt-2 text-muted-foreground">
            Hồ sơ học tập giúp AI hiểu mục tiêu và sở thích học của bạn tốt hơn.
          </p>
          <Link to="/auth">
            <Button className="mt-6 rounded-xl border-0 gradient-primary text-primary-foreground">
              Đăng nhập
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Learning Profile
            </div>
            <h1 className="text-3xl font-bold text-foreground">Hồ sơ học tập</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Lưu mục tiêu, sở thích và ngân sách để các tính năng AI tư vấn cá nhân hóa hơn.
            </p>
          </div>
          <Link to="/learner/roadmap">
            <Button variant="outline" className="rounded-xl">
              <GraduationCap className="mr-2 h-4 w-4" />
              Tạo lộ trình AI
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-primary" />
                Thông tin cá nhân hóa AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                  Đang tải hồ sơ...
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Mục tiêu học chính</label>
                    <Textarea
                      value={form.primary_goal ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, primary_goal: event.target.value }))}
                      className="min-h-[110px] rounded-2xl"
                      maxLength={500}
                      placeholder="VD: Tôi muốn giao tiếp tiếng Anh tự tin trong công việc."
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Trình độ hiện tại</label>
                      <Input
                        value={form.current_level ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, current_level: event.target.value }))}
                        className="rounded-xl"
                        placeholder="VD: Mới bắt đầu / Trung cấp"
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Hình thức học ưa thích</label>
                      <select
                        value={form.preferred_format}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            preferred_format: event.target.value as LearningProfileFormValues["preferred_format"],
                          }))
                        }
                        className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="any">Linh hoạt</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Danh mục quan tâm</label>
                    <div className="flex flex-wrap gap-2">
                      {COURSE_CATEGORIES.map((category) => {
                        const selected = form.preferred_categories.includes(category.slug);
                        return (
                          <button
                            key={category.slug}
                            type="button"
                            onClick={() => toggleCategory(category.slug)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {selected && <Check className="mr-1 inline h-3.5 w-3.5" />}
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Ngân sách tối thiểu / buổi</label>
                      <Input
                        type="number"
                        min={0}
                        step={50000}
                        value={budgetMin}
                        onChange={(event) => setBudgetMin(event.target.value)}
                        className="rounded-xl"
                        placeholder="VD: 100000"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Ngân sách tối đa / buổi</label>
                      <Input
                        type="number"
                        min={0}
                        step={50000}
                        value={budgetMax}
                        onChange={(event) => setBudgetMax(event.target.value)}
                        className="rounded-xl"
                        placeholder="VD: 500000"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Địa điểm ưu tiên</label>
                      <Input
                        value={form.location_preference ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, location_preference: event.target.value }))}
                        className="rounded-xl"
                        placeholder="VD: Quận 1, online, gần nhà..."
                        maxLength={160}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Thời gian rảnh</label>
                      <Input
                        value={form.schedule_preference ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, schedule_preference: event.target.value }))}
                        className="rounded-xl"
                        placeholder="VD: Tối thứ 3/5, cuối tuần..."
                        maxLength={160}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Phong cách học</label>
                    <Input
                      value={form.learning_style ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, learning_style: event.target.value }))}
                      className="rounded-xl"
                      placeholder="VD: Thực hành nhiều, cần feedback chi tiết"
                      maxLength={160}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Ghi chú thêm</label>
                    <Textarea
                      value={form.notes ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className="min-h-[96px] rounded-2xl"
                      maxLength={500}
                      placeholder="Không nhập thông tin quá nhạy cảm. Chỉ ghi những điều giúp AI tư vấn học tập tốt hơn."
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      VET chỉ dùng thông tin này làm context ngắn cho AI, không gửi toàn bộ dữ liệu riêng tư không cần thiết.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={upsertProfile.isPending}
                    className="w-full rounded-xl border-0 gradient-primary py-6 text-primary-foreground"
                  >
                    {upsertProfile.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Lưu hồ sơ học tập
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border-primary/15 bg-primary/5 shadow-sm">
              <CardContent className="p-5">
                <p className="font-semibold text-foreground">AI sẽ dùng hồ sơ này như thế nào?</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>• Ưu tiên mục tiêu hiện tại của bạn hơn dữ liệu hồ sơ.</li>
                  <li>• Chỉ gửi context ngắn: mục tiêu, trình độ, danh mục, format, ngân sách.</li>
                  <li>• Không gửi ghi chú quá dài hoặc dữ liệu không cần thiết.</li>
                </ul>
                {form.preferred_categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.preferred_categories.map((slug) => (
                      <Badge key={slug} variant="outline" className="rounded-full bg-background">
                        {slug}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <AIHistoryPanel />
        </div>
      </div>
    </MainLayout>
  );
}
