import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  QrCode,
  RefreshCw,
  Sparkles,
  Ticket,
  Zap,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SUBSCRIPTION_PLANS, formatSubscriptionPrice } from "@/constants/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import {
  useCreateSubscriptionPayment,
  useSubscriptionPayments,
  type SubscriptionPaymentSession,
} from "@/hooks/useSubscriptionPayments";

const vetPlusGradient =
  "bg-[linear-gradient(135deg,#0369a1_0%,#0891b2_48%,#0f766e_100%)] text-white shadow-lg shadow-primary/25";
const vetPlusCta =
  `${vetPlusGradient} hover:brightness-110 hover:shadow-xl active:scale-[0.99]`;

export default function PricingPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const {
    isLoading,
    planCode,
    isPlus,
    refetch: refetchSubscription,
  } = useSubscription();
  const { refetch: refetchPayments } = useSubscriptionPayments();
  const createSubscriptionPayment = useCreateSubscriptionPayment();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSession, setPaymentSession] = useState<SubscriptionPaymentSession | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const vetPlusPlan = useMemo(
    () => SUBSCRIPTION_PLANS.find((plan) => plan.code === "vet_plus"),
    [],
  );

  const checkPaymentStatus = async () => {
    if (!paymentSession) return;
    setCheckingPayment(true);
    try {
      const [subscriptionResult, paymentsResult] = await Promise.all([
        refetchSubscription(),
        refetchPayments(),
      ]);

      const subscriptionActive = Boolean(subscriptionResult.data?.is_plus);
      const matchingPayment = (paymentsResult.data ?? []).find(
        (payment) => payment.reference_code === paymentSession.reference_code,
      );
      const paymentActivated = matchingPayment?.payment_status === "success";

      if (subscriptionActive || paymentActivated) {
        setPaymentSuccess(true);
        toast({ title: "VET Plus đã được kích hoạt." });
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentOpen || !paymentSession || paymentSuccess) return;

    const interval = window.setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [paymentOpen, paymentSession, paymentSuccess]);

  const handleUpgrade = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Vui lòng đăng nhập",
        description: "Bạn cần đăng nhập trước khi nâng cấp VET Plus.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (isPlus) {
      toast({ title: "Bạn đang sử dụng VET Plus." });
      return;
    }

    try {
      const session = await createSubscriptionPayment.mutateAsync({ planCode: "vet_plus" });
      setPaymentSession(session);
      setPaymentSuccess(false);
      setPaymentOpen(true);

      if (session.reused) {
        toast({
          title: "Bạn đã có yêu cầu thanh toán đang chờ",
          description: "Vui lòng dùng mã chuyển khoản hiện tại.",
        });
      }
    } catch (err: any) {
      if (err?.code === "ALREADY_ACTIVE") {
        toast({ title: "Bạn đang sử dụng VET Plus." });
        await refetchSubscription();
        return;
      }

      toast({
        title: "Không thể tạo phiên thanh toán",
        description: err?.message || "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    }
  };

  const copyReference = () => {
    if (!paymentSession?.reference_code) return;
    navigator.clipboard?.writeText(paymentSession.reference_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    toast({ title: "Đã copy nội dung chuyển khoản." });
  };

  const paymentStatusLabel = paymentSuccess
    ? "Thanh toán thành công"
    : checkingPayment
      ? "Đang kiểm tra thanh toán"
      : "Đang chờ thanh toán";

  return (
    <MainLayout>
      <div className="bg-gradient-to-b from-sky-50 via-background to-background">
        <section className="container py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 rounded-full border-0 bg-primary/10 px-4 py-1.5 text-primary">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              VET Plus
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
              Học thông minh hơn với AI và ưu đãi booking
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Chọn gói phù hợp để tìm khóa học, nhận gợi ý cá nhân hóa và chuẩn bị tốt hơn trước mỗi buổi học.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const current = plan.code === planCode;
              const plusPlan = plan.code === "vet_plus";

              return (
                <Card
                  key={plan.code}
                  className={`relative overflow-hidden rounded-2xl border bg-card shadow-card ${
                    plusPlan ? "border-primary/30 shadow-glow" : "border-border"
                  }`}
                >
                  {plusPlan && (
                    <div className="absolute right-5 top-5">
                      <Badge className={`rounded-full border-0 ${vetPlusGradient}`}>
                        Khuyến nghị
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="space-y-4 p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      plusPlan ? vetPlusGradient : "bg-muted text-muted-foreground"
                    }`}>
                      {plusPlan ? <Crown className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        {formatSubscriptionPrice(plan.price)}
                      </span>
                      {plan.billingInterval === "month" && (
                        <span className="pb-1 text-sm text-muted-foreground">/tháng</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6 pt-0">
                    <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>{plan.aiCreditsPerMonth} AI credits/tháng</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Ticket className="h-4 w-4 text-secondary" />
                        <span>
                          {plan.voucherCount > 0
                            ? `${plan.voucherCount} voucher ${formatSubscriptionPrice(plan.voucherAmount)}`
                            : "Chưa có voucher"}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm text-card-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isLoading ? (
                      <Skeleton className="h-11 w-full rounded-xl" />
                    ) : current ? (
                      <Button className="h-11 w-full rounded-xl" variant="outline" disabled>
                        Gói hiện tại
                      </Button>
                    ) : plusPlan ? (
                      <Button
                        className={`h-11 w-full rounded-xl border-0 font-semibold ${vetPlusCta}`}
                        onClick={handleUpgrade}
                        disabled={createSubscriptionPayment.isPending}
                      >
                        {createSubscriptionPayment.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Crown className="mr-2 h-4 w-4" />
                        )}
                        Nâng cấp lên VET Plus
                      </Button>
                    ) : (
                      <Link to="/learner/subscription">
                        <Button className="h-11 w-full rounded-xl" variant="outline">
                          Xem gói của tôi
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border bg-card/80 p-5 text-sm text-muted-foreground shadow-card">
            <strong className="text-foreground">Phase 4A:</strong> VET Plus có thể thanh toán bằng SePay/VietQR.
            Booking payment, voucher checkout và mentor wallet vẫn chạy theo luồng riêng.
          </div>
        </section>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Crown className="h-5 w-5 text-primary" />
              )}
              Thanh toán VET Plus
            </DialogTitle>
            <DialogDescription>
              Sau khi thanh toán thành công, hệ thống sẽ tự kích hoạt VET Plus.
            </DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="rounded-2xl border border-success/20 bg-success/10 p-5 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-foreground">VET Plus đã được kích hoạt</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Bạn đã nhận 60 AI credits mỗi tháng và voucher VET Plus theo gói.
              </p>
            </div>
          ) : paymentSession ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{paymentStatusLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mã thanh toán pending được tái sử dụng trong 30 phút. Sau thời gian đó, bạn có thể bấm nâng cấp lại để tạo mã mới.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`rounded-full ${
                    checkingPayment
                      ? "border-warning/20 bg-warning/10 text-warning"
                      : "border-primary/20 bg-primary/10 text-primary"
                  }`}
                >
                  {paymentStatusLabel}
                </Badge>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Giá gói</span>
                  <span className="text-xl font-bold text-primary">
                    {formatSubscriptionPrice(paymentSession.amount || vetPlusPlan?.price || 99000)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center rounded-2xl border bg-card p-4">
                {paymentSession.qr_url ? (
                  <img
                    src={paymentSession.qr_url}
                    alt="QR thanh toán VET Plus"
                    className="h-64 w-64 rounded-xl object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
                    <QrCode className="h-16 w-16" />
                    <p className="text-sm">Thanh toán thủ công</p>
                  </div>
                )}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Quét VietQR hoặc chuyển khoản đúng nội dung bên dưới.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Nội dung chuyển khoản</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-sm font-bold text-primary">
                      {paymentSession.reference_code}
                    </span>
                    <button
                      type="button"
                      onClick={copyReference}
                      className="rounded-lg border bg-background p-1.5 text-muted-foreground hover:text-primary"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {paymentSession.bank_account && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Số tài khoản</span>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {paymentSession.bank_account}
                    </span>
                  </div>
                )}

                {paymentSession.bank_name && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Ngân hàng</span>
                    <span className="font-semibold text-foreground">{paymentSession.bank_name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Vui lòng ghi đúng nội dung chuyển khoản {paymentSession.reference_code}. Hệ thống sẽ tự kích hoạt VET Plus sau khi webhook xác nhận.
                </p>
              </div>
            </div>
          ) : null}

          <Separator />

          <DialogFooter className="gap-2 sm:gap-0">
            {paymentSuccess ? (
              <Link to="/learner/subscription">
                <Button className="rounded-xl border-0 gradient-primary text-primary-foreground">
                  Đi tới gói của tôi
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setPaymentOpen(false)}
                >
                  Để sau
                </Button>
                <Button
                  className="rounded-xl border-0 gradient-primary text-primary-foreground"
                  onClick={checkPaymentStatus}
                  disabled={!paymentSession || checkingPayment}
                >
                  {checkingPayment ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Kiểm tra thanh toán
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
