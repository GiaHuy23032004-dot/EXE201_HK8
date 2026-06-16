import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, Check, CheckCircle2, Copy, Crown, Loader2,
  QrCode, RefreshCw, Sparkles, Ticket, Zap, Brain, Map, BookOpen, ChevronDown, ChevronUp, Shield,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SUBSCRIPTION_PLANS, formatSubscriptionPrice } from "@/constants/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import {
  useCreateSubscriptionPayment,
  useSubscriptionPayments,
  type SubscriptionPaymentSession,
} from "@/hooks/useSubscriptionPayments";

// ── Benefit data ──────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon: Brain,
    gradient: "from-cyan-500 to-blue-600",
    title: "Tìm khóa học nhanh hơn",
    desc: "AI giúp gợi ý khóa học phù hợp với nhu cầu học tập của bạn.",
  },
  {
    icon: Ticket,
    gradient: "from-teal-500 to-emerald-600",
    title: "Tiết kiệm chi phí booking",
    desc: "Nhận voucher hàng tháng để giảm chi phí đặt lịch học.",
  },
  {
    icon: Map,
    gradient: "from-violet-500 to-purple-600",
    title: "Học có lộ trình rõ ràng",
    desc: "AI hỗ trợ xây dựng lộ trình học theo mục tiêu cá nhân.",
  },
  {
    icon: BookOpen,
    gradient: "from-orange-500 to-amber-500",
    title: "Không bỏ lỡ slot phù hợp",
    desc: "Nhận thông báo khóa học và lịch học phù hợp kịp thời.",
  },
];

// ── Comparison table data ─────────────────────────────────────────────────────
const COMPARISON = [
  { feature: "AI credits mỗi tháng",            free: "3",        plus: "60" },
  { feature: "Tìm kiếm khóa học",               free: "✓",        plus: "✓" },
  { feature: "AI gợi ý cá nhân hóa",            free: "—",        plus: "✓" },
  { feature: "AI so sánh khóa học",             free: "—",        plus: "✓" },
  { feature: "AI tạo lộ trình học",             free: "—",        plus: "✓" },
  { feature: "Voucher booking",                  free: "—",        plus: "2 × 30.000đ/tháng" },
  { feature: "Thông báo slot phù hợp",           free: "—",        plus: "✓" },
  { feature: "Lưu hồ sơ học tập cá nhân",       free: "Cơ bản",   plus: "Nâng cao" },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "VET Plus có gì khác gói Free?",
    a: "VET Plus cung cấp 60 AI credits/tháng (thay vì 3), 2 voucher booking 30.000đ, AI gợi ý/so sánh/lộ trình khóa học cá nhân hóa và thông báo slot phù hợp.",
  },
  {
    q: "AI credits dùng để làm gì?",
    a: "AI credits dùng để sử dụng các tính năng AI trên nền tảng như: AI Course Match (1 credit), AI Compare (2 credits), AI Roadmap và AI Chat.",
  },
  {
    q: "Voucher booking áp dụng như thế nào?",
    a: "Mỗi tháng bạn nhận 2 voucher giảm 30.000đ cho mỗi lần booking. Voucher áp dụng cho các khóa học từ 300.000đ trở lên.",
  },
  {
    q: "Tôi có thể tiếp tục dùng gói Free không?",
    a: "Hoàn toàn được. Gói Free vẫn đầy đủ tính năng cơ bản như tìm kiếm, xem mentor, đặt lịch học và lưu khóa học yêu thích.",
  },
];

// ── FAQ Accordion ─────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const { isLoading, planCode, isPlus, refetch: refetchSubscription } = useSubscription();
  const { refetch: refetchPayments } = useSubscriptionPayments();
  const createSubscriptionPayment = useCreateSubscriptionPayment();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSession, setPaymentSession] = useState<SubscriptionPaymentSession | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const vetPlusPlan = useMemo(() => SUBSCRIPTION_PLANS.find((p) => p.code === "vet_plus"), []);

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
        (p) => p.reference_code === paymentSession.reference_code,
      );
      if (subscriptionActive || matchingPayment?.payment_status === "success") {
        setPaymentSuccess(true);
        toast({ title: "VET Plus đã được kích hoạt." });
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentOpen || !paymentSession || paymentSuccess) return;
    const interval = window.setInterval(checkPaymentStatus, 5000);
    return () => window.clearInterval(interval);
  }, [paymentOpen, paymentSession, paymentSuccess]);

  const handleUpgrade = async () => {
    if (!isLoggedIn) {
      toast({ title: "Vui lòng đăng nhập", description: "Bạn cần đăng nhập trước khi nâng cấp VET Plus.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (isPlus) { toast({ title: "Bạn đang sử dụng VET Plus." }); return; }
    try {
      const session = await createSubscriptionPayment.mutateAsync({ planCode: "vet_plus" });
      setPaymentSession(session);
      setPaymentSuccess(false);
      setPaymentOpen(true);
      if (session.reused) toast({ title: "Bạn đã có yêu cầu thanh toán đang chờ", description: "Vui lòng dùng mã chuyển khoản hiện tại." });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "ALREADY_ACTIVE") { toast({ title: "Bạn đang sử dụng VET Plus." }); await refetchSubscription(); return; }
      toast({ title: "Không thể tạo phiên thanh toán", description: e?.message || "Vui lòng thử lại sau.", variant: "destructive" });
    }
  };

  const copyReference = () => {
    if (!paymentSession?.reference_code) return;
    navigator.clipboard?.writeText(paymentSession.reference_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    toast({ title: "Đã copy nội dung chuyển khoản." });
  };

  const paymentStatusLabel = paymentSuccess ? "Thanh toán thành công" : checkingPayment ? "Đang kiểm tra..." : "Đang chờ thanh toán";

  return (
    <MainLayout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-cyan-50/60" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-blue-200/25 blur-3xl" />
        </div>
        <div className="container relative text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-1.5 shadow-sm">
            <Crown className="h-3.5 w-3.5 text-cyan-600" />
            <span className="text-xs font-semibold text-cyan-700">VET Plus</span>
          </div>
          <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Học thông minh hơn với{" "}
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              VET Plus
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-500 md:text-base">
            Chọn gói phù hợp để tìm khóa học, nhận gợi ý cá nhân hóa và chuẩn bị tốt hơn trước mỗi buổi học.
          </p>
          {/* Benefit pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {[
              { icon: Sparkles, text: "60 AI credits/tháng" },
              { icon: Ticket, text: "2 voucher 30.000đ" },
              { icon: Brain, text: "AI gợi ý cá nhân hóa" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                <Icon className="h-3.5 w-3.5 text-cyan-500" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Cards ── */}
      <section className="container pb-10">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const current = plan.code === planCode;
            const plusPlan = plan.code === "vet_plus";
            const freePlan = plan.code === "free";

            const freeFeatures = [
              "3 AI credits dùng thử mỗi tháng",
              "Tìm kiếm khóa học cơ bản",
              "Xem mentor và khóa học",
              "Đặt lịch học",
              "Lưu khóa học yêu thích",
            ];
            const plusFeatures = [
              "60 AI credits mỗi tháng",
              "AI gợi ý khóa học cá nhân hóa",
              "AI so sánh khóa học",
              "AI tạo lộ trình học",
              "2 voucher 30.000đ mỗi tháng",
              "Thông báo khóa học và slot phù hợp",
            ];
            const features = plusPlan ? plusFeatures : freeFeatures;

            return (
              <div
                key={plan.code}
                className={`relative flex flex-col overflow-hidden rounded-3xl transition-all duration-200 ${
                  plusPlan
                    ? "border-2 border-cyan-400/60 bg-white shadow-xl shadow-cyan-100/60 hover:shadow-2xl hover:shadow-cyan-200/50 hover:-translate-y-1"
                    : "border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                {/* Glow for Plus */}
                {plusPlan && (
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-50/50 to-transparent" />
                )}

                {/* Recommended badge */}
                {plusPlan && (
                  <div className="absolute right-5 top-5">
                    <span className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                      Khuyến nghị
                    </span>
                  </div>
                )}

                <div className="relative p-7">
                  {/* Plan icon */}
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-md ${
                    plusPlan
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-200"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {plusPlan ? <Crown className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                  </div>

                  {/* Plan name + desc */}
                  <h2 className={`text-2xl font-bold ${plusPlan ? "text-slate-900" : "text-slate-800"}`}>{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{plan.summary}</p>

                  {/* Price */}
                  <div className="mt-4 flex items-end gap-2">
                    <span className={`text-4xl font-extrabold ${plusPlan ? "text-cyan-600" : "text-slate-800"}`}>
                      {formatSubscriptionPrice(plan.price)}
                    </span>
                    {plan.billingInterval === "month" && (
                      <span className="mb-1 text-sm text-slate-400">/tháng</span>
                    )}
                  </div>

                  {/* AI credits + voucher strip */}
                  <div className={`mt-4 grid grid-cols-2 gap-2 rounded-2xl p-3 ${plusPlan ? "bg-cyan-50" : "bg-slate-50"}`}>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <Sparkles className={`h-3.5 w-3.5 ${plusPlan ? "text-cyan-500" : "text-slate-400"}`} />
                      {plan.aiCreditsPerMonth} AI credits/tháng
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <Ticket className={`h-3.5 w-3.5 ${plusPlan ? "text-cyan-500" : "text-slate-400"}`} />
                      {plan.voucherCount > 0 ? `${plan.voucherCount} voucher ${formatSubscriptionPrice(plan.voucherAmount)}` : "Chưa có voucher"}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="mt-5 space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plusPlan ? "text-cyan-500" : "text-slate-400"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Free plan note */}
                  {freePlan && (
                    <p className="mt-4 text-xs text-slate-400 italic">Phù hợp để bắt đầu khám phá VET miễn phí.</p>
                  )}
                </div>

                {/* CTA */}
                <div className="mt-auto p-7 pt-0">
                  {isLoading ? (
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  ) : current ? (
                    <Button className="h-12 w-full rounded-2xl text-sm font-semibold" variant="outline" disabled>
                      Gói hiện tại
                    </Button>
                  ) : plusPlan ? (
                    <Button
                      className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-200 hover:brightness-110 hover:-translate-y-0.5 transition-all"
                      onClick={handleUpgrade}
                      disabled={createSubscriptionPayment.isPending}
                    >
                      {createSubscriptionPayment.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Crown className="mr-2 h-4 w-4" />}
                      Nâng cấp lên VET Plus
                    </Button>
                  ) : (
                    <Link to="/learner/subscription">
                      <Button className="h-12 w-full rounded-2xl text-sm" variant="outline">Xem gói của tôi</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Vì sao nên nâng cấp ── */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-14">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Vì sao nên nâng cấp VET Plus?</h2>
            <p className="mt-2 text-sm text-slate-500">Trải nghiệm học tập thông minh hơn với AI và ưu đãi dành riêng cho bạn.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, gradient, title, desc }) => (
              <div
                key={title}
                className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="bg-white py-14">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">So sánh Free và VET Plus</h2>
            <p className="mt-2 text-sm text-slate-500">Xem chi tiết sự khác biệt giữa hai gói.</p>
          </div>

          {/* Desktop table */}
          <div className="mx-auto hidden max-w-3xl overflow-hidden rounded-2xl border border-slate-200 shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-700">Tính năng</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-slate-500">Free</th>
                  <th className="px-5 py-3.5 text-center font-bold text-cyan-600">
                    <span className="flex items-center justify-center gap-1.5">
                      <Crown className="h-4 w-4" />VET Plus
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3 text-slate-700">{row.feature}</td>
                    <td className="px-5 py-3 text-center text-slate-400">
                      {row.free === "✓" ? <Check className="mx-auto h-4 w-4 text-slate-400" /> : row.free === "—" ? <span className="text-slate-300">—</span> : row.free}
                    </td>
                    <td className="px-5 py-3 text-center font-medium text-cyan-600">
                      {row.plus === "✓" ? <Check className="mx-auto h-4 w-4 text-cyan-500" /> : row.plus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mx-auto max-w-md space-y-3 md:hidden">
            {COMPARISON.map((row) => (
              <div key={row.feature} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <span className="text-sm text-slate-700">{row.feature}</span>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400">Free</p>
                    {row.free === "✓" ? <Check className="mx-auto h-3.5 w-3.5 text-slate-400" /> : row.free === "—" ? <span className="text-slate-300">—</span> : <span className="text-slate-500">{row.free}</span>}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-cyan-600">Plus</p>
                    {row.plus === "✓" ? <Check className="mx-auto h-3.5 w-3.5 text-cyan-500" /> : <span className="text-cyan-600 font-medium">{row.plus}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment trust section ── */}
      <section className="bg-slate-50 py-10">
        <div className="container">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Thanh toán an toàn & tiện lợi</h3>
              <p className="mt-1 text-sm text-slate-500">
                Thanh toán qua VietQR / SePay, xác nhận tự động. Voucher và ưu đãi được áp dụng khi booking đủ điều kiện.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-14">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Câu hỏi thường gặp</h2>
          </div>
          <div className="mx-auto max-w-2xl space-y-3">
            {FAQS.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ── Payment Dialog (logic unchanged) ── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentSuccess ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Crown className="h-5 w-5 text-cyan-600" />}
              Thanh toán VET Plus
            </DialogTitle>
            <DialogDescription>
              Sau khi thanh toán thành công, hệ thống sẽ tự kích hoạt VET Plus.
            </DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-slate-800">VET Plus đã được kích hoạt!</h3>
              <p className="mt-2 text-sm text-slate-500">Bạn đã nhận 60 AI credits và voucher VET Plus theo gói.</p>
            </div>
          ) : paymentSession ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{paymentStatusLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Mã pending có hiệu lực 30 phút.</p>
                </div>
                <Badge variant="outline" className={`rounded-full text-xs ${checkingPayment ? "border-amber-200 bg-amber-50 text-amber-700" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                  {paymentStatusLabel}
                </Badge>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-500">Giá gói</span>
                <span className="text-xl font-bold text-cyan-600">
                  {formatSubscriptionPrice(paymentSession.amount || vetPlusPlan?.price || 99000)}
                </span>
              </div>

              {/* QR */}
              <div className="flex flex-col items-center rounded-2xl border bg-white p-4">
                {paymentSession.qr_url ? (
                  <img src={paymentSession.qr_url} alt="QR thanh toán VET Plus" className="h-60 w-60 rounded-xl object-contain" />
                ) : (
                  <div className="flex h-60 w-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-slate-50 text-slate-400">
                    <QrCode className="h-16 w-16" />
                    <p className="text-xs">Thanh toán thủ công</p>
                  </div>
                )}
                <p className="mt-3 text-center text-xs text-slate-400">Quét VietQR hoặc chuyển khoản đúng nội dung bên dưới.</p>
              </div>

              {/* Transfer info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">Nội dung chuyển khoản</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-cyan-600">{paymentSession.reference_code}</span>
                    <button type="button" onClick={copyReference} className="rounded-lg border bg-white p-1.5 text-slate-400 hover:text-cyan-600 transition-colors">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {paymentSession.bank_account && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Số tài khoản</span>
                    <span className="font-mono text-sm font-semibold text-slate-800">{paymentSession.bank_account}</span>
                  </div>
                )}
                {paymentSession.bank_name && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Ngân hàng</span>
                    <span className="font-semibold text-slate-800">{paymentSession.bank_name}</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Vui lòng ghi đúng nội dung chuyển khoản <strong>{paymentSession.reference_code}</strong>. Hệ thống sẽ tự kích hoạt VET Plus sau khi xác nhận.
                </p>
              </div>
            </div>
          ) : null}

          <Separator />

          <DialogFooter className="gap-2">
            {paymentSuccess ? (
              <Link to="/learner/subscription">
                <Button className="rounded-xl border-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-white">Đi tới gói của tôi</Button>
              </Link>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl" onClick={() => setPaymentOpen(false)}>Để sau</Button>
                <Button
                  className="rounded-xl border-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  onClick={checkPaymentStatus}
                  disabled={!paymentSession || checkingPayment}
                >
                  {checkingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
