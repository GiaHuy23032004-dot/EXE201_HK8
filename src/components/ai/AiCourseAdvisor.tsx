import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { AiCreditUpgradeDialog } from "@/components/subscription/AiCreditUpgradeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isAiCreditRequiredPayload, readFunctionErrorPayload } from "@/lib/aiCreditErrors";

type FitLevel = "high" | "medium" | "low";

interface AdvisorResult {
  summary: string;
  fit_level: FitLevel;
  fit_score: number;
  why_fit: string[];
  concerns: string[];
  recommended_next_step: string;
  questions_to_ask_mentor: string[];
  booking_advice: string;
}

interface AiAdvisorResponse {
  advisor?: AdvisorResult;
  error?: boolean;
  code?: string;
  stage?: string;
  message?: string;
  creditsRemaining?: number;
  upgradeUrl?: string;
}

interface AiCourseAdvisorProps {
  courseId?: string | null;
  courseTitle?: string | null;
  showBookingButton?: boolean;
  className?: string;
}

const ADVISOR_COST = 1;

const quickQuestions = [
  "Tôi là người mới, khóa này có phù hợp không?",
  "Tôi nên chuẩn bị gì trước khi học?",
  "Khóa này phù hợp học online hay offline hơn?",
  "Tôi nên hỏi mentor điều gì trước khi đặt lịch?",
];

const fitLevelMeta: Record<FitLevel, { label: string; className: string }> = {
  high: {
    label: "Phù hợp cao",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  medium: {
    label: "Cần cân nhắc",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  low: {
    label: "Phù hợp thấp",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

function normalizeScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeAdvisor(value: unknown): AdvisorResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const fitScore = normalizeScore(record.fit_score);
  const fitLevel = record.fit_level === "high" || record.fit_level === "medium" || record.fit_level === "low"
    ? record.fit_level
    : fitScore >= 75
      ? "high"
      : fitScore >= 45
        ? "medium"
        : "low";

  const toList = (input: unknown) =>
    Array.isArray(input)
      ? input.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 5)
      : [];

  return {
    summary: String(record.summary ?? "").trim(),
    fit_level: fitLevel,
    fit_score: fitScore,
    why_fit: toList(record.why_fit),
    concerns: toList(record.concerns),
    recommended_next_step: String(record.recommended_next_step ?? "").trim(),
    questions_to_ask_mentor: toList(record.questions_to_ask_mentor),
    booking_advice: String(record.booking_advice ?? "").trim(),
  };
}

export function AiCourseAdvisor({
  courseId,
  courseTitle,
  showBookingButton = false,
  className = "",
}: AiCourseAdvisorProps) {
  const { session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { aiCreditsRemaining, isLoading: subscriptionLoading, refetch } = useSubscription();
  const [customQuestion, setCustomQuestion] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fitMeta = useMemo(
    () => (result ? fitLevelMeta[result.fit_level] : null),
    [result],
  );

  const handleCreditRequired = (payload?: unknown) => {
    if (isAiCreditRequiredPayload(payload)) {
      toast({
        title: "Bạn đã hết AI credits",
        description: "Nâng cấp VET Plus để tiếp tục dùng AI Advisor.",
        variant: "destructive",
      });
    }
    setUpgradeOpen(true);
  };

  const handleSubmit = async () => {
    const finalQuestion = customQuestion.trim();

    if (!finalQuestion) {
      toast({ title: "Vui lòng nhập câu hỏi.", variant: "destructive" });
      return;
    }

    if (!courseId) {
      toast({ title: "Không tìm thấy khóa học để tư vấn.", variant: "destructive" });
      return;
    }

    if (!isLoggedIn || !session?.access_token) {
      toast({
        title: "Vui lòng đăng nhập để dùng AI Advisor",
        description: "Free có 3 AI credits dùng thử mỗi tháng.",
        variant: "destructive",
      });
      return;
    }

    if (subscriptionLoading) {
      toast({
        title: "Đang tải AI credits",
        description: "Vui lòng thử lại sau vài giây.",
      });
      return;
    }

    if (aiCreditsRemaining < ADVISOR_COST) {
      handleCreditRequired();
      return;
    }

    setIsSubmitting(true);
    try {
      if (import.meta.env.DEV) {
        console.log("ai-advisor request", {
          course_id: courseId,
          question: finalQuestion,
        });
      }

      const { data, error } = await supabase.functions.invoke("ai-advisor", {
        body: {
          course_id: courseId,
          question: finalQuestion,
          learner_context: {},
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) {
          handleCreditRequired(payload);
          return;
        }
        console.error("ai-advisor error:", { error, payload });
        const message =
          (payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "")
            : "") || error.message;
        throw new Error(message || "Không thể dùng AI Advisor lúc này.");
      }

      if (isAiCreditRequiredPayload(data)) {
        handleCreditRequired(data);
        return;
      }

      const response = data as AiAdvisorResponse | null;
      if (response?.error) {
        console.error("ai-advisor error response:", response);
        throw new Error(response.message || "Không thể dùng AI Advisor lúc này.");
      }

      const advisor = normalizeAdvisor(response?.advisor);
      if (!advisor) {
        throw new Error("AI Advisor chưa trả về kết quả hợp lệ.");
      }

      setResult(advisor);
      toast({ title: "AI đã phân tích khóa học", description: "Credit đã được cập nhật trong gói của bạn." });
    } catch (error: any) {
      console.error("AI Advisor submit error:", error);
      toast({
        title: "Không thể dùng AI Advisor",
        description: error?.message || "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      void refetch();
    }
  };

  return (
    <>
      <Card className={`overflow-hidden rounded-2xl border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-cyan-50/60 shadow-card ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Không chắc khóa này phù hợp?</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Hỏi AI Advisor trước khi đặt lịch. Tính năng này dùng {ADVISOR_COST} AI credit.
              </p>
              {courseTitle && (
                <p className="mt-1 line-clamp-1 text-xs font-medium text-foreground">
                  AI sẽ phân tích: {courseTitle}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {subscriptionLoading
                  ? "Đang tải AI credits..."
                  : isLoggedIn
                    ? `Bạn còn ${aiCreditsRemaining} AI credits. Credits dùng chung cho EduBot, AI Advisor và AI Roadmap.`
                    : "Đăng nhập để dùng AI Advisor."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((item) => (
              <Button
                key={item}
                type="button"
                variant={selectedPrompt === item ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedPrompt(item);
                  setCustomQuestion(item);
                }}
                className={`h-auto rounded-full px-3 py-1.5 text-xs ${
                  selectedPrompt === item ? "border-0 gradient-primary text-primary-foreground" : "bg-white/80"
                }`}
              >
                {item}
              </Button>
            ))}
          </div>

          <Textarea
            value={customQuestion}
            onChange={(event) => {
              setCustomQuestion(event.target.value);
              setSelectedPrompt(null);
            }}
            placeholder="Ví dụ: Tôi là người mới, khóa này có phù hợp không?"
            className="min-h-[92px] rounded-2xl bg-white/90"
            maxLength={500}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              AI chỉ tư vấn dựa trên thông tin khóa học hiện có, không cam kết kết quả học tập.
            </p>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                subscriptionLoading ||
                !customQuestion.trim() ||
                (isLoggedIn && aiCreditsRemaining < ADVISOR_COST)
              }
              className="rounded-xl border-0 gradient-primary text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI đang phân tích...
                </>
              ) : (
                <>
                  <MessageSquareText className="mr-2 h-4 w-4" />
                  Hỏi AI Advisor
                </>
              )}
            </Button>
          </div>

          {result && fitMeta && (
            <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <Badge variant="outline" className={`rounded-full ${fitMeta.className}`}>
                  {fitMeta.label}
                </Badge>
                <div className="text-sm font-semibold text-primary">{result.fit_score}/100</div>
              </div>

              <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Vì sao phù hợp
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {result.why_fit.map((item) => (
                      <li key={item} className="break-words leading-relaxed">• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Điểm cần cân nhắc
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {result.concerns.map((item) => (
                      <li key={item} className="break-words leading-relaxed">• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-muted/30 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Nên hỏi mentor
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.questions_to_ask_mentor.map((item) => (
                    <li key={item} className="break-words leading-relaxed">• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-2xl bg-primary/5 p-3 text-sm leading-relaxed text-foreground">
                <strong>Gợi ý bước tiếp theo:</strong> {result.recommended_next_step}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.booking_advice}</p>

              {showBookingButton && courseId && (
                <Link to={`/booking/${courseId}`}>
                  <Button className="mt-4 w-full rounded-xl border-0 gradient-primary text-primary-foreground">
                    Đặt lịch khóa này
                  </Button>
                </Link>
              )}
            </div>
          )}

          {!isLoggedIn && (
            <Link to="/auth">
              <Button variant="outline" className="w-full rounded-xl bg-white/80">
                Đăng nhập để dùng AI Advisor
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      <AiCreditUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
