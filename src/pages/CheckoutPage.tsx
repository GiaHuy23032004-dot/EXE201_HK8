import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock,
  Loader2, QrCode, ShieldCheck, RefreshCw, Copy, Check,
  AlertTriangle, Wifi,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnerReceipt } from "@/hooks/useLearnerPayments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { calculateDepositBreakdown, calculateVoucherPaymentBreakdown, formatVnd, inferPaymentOptionFromBooking } from "@/lib/learnerPayment";

interface PaymentSession {
  mode: "vietqr" | "sepay" | "manual";
  reference_code: string;
  amount: number;
  transaction_id?: string;
  qr_url?: string;
  qr_data?: string;
  bank_account?: string;
  bank_name?: string;
  message?: string;
}

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const { trackEvent } = useAnalyticsTracker();
  const { data, isLoading, refetch } = useLearnerReceipt(bookingId, session?.user?.id);
  const trackedPaymentSuccessRef = useRef(false);

  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [creating, setCreating] = useState(false);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data && !paymentSession && !creating) createPayment();
  }, [data]);

  useEffect(() => {
    if (!paymentSession || paid) return;
    const interval = setInterval(async () => {
      const result = await refetch();
      if ((result.data as any)?.transaction?.status === "success") {
        setPaid(true);
        clearInterval(interval);
        if (!trackedPaymentSuccessRef.current) {
          trackedPaymentSuccessRef.current = true;
          void trackEvent("payment_success", {
            courseId: (result.data as any)?.booking?.course_id,
            bookingId,
            transactionId: (result.data as any)?.transaction?.id,
            source: "checkout_poll",
            metadata: {
              referenceCode: (result.data as any)?.transaction?.reference_code,
              amount: (result.data as any)?.transaction?.amount,
            },
          });
        }
        toast({ title: "🎉 Thanh toán thành công!" });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentSession, paid]);

  useEffect(() => {
    const transaction = (data as any)?.transaction;
    const booking = (data as any)?.booking;
    if (transaction?.status !== "success" || trackedPaymentSuccessRef.current) return;
    trackedPaymentSuccessRef.current = true;
    void trackEvent("payment_success", {
      courseId: booking?.course_id,
      bookingId,
      transactionId: transaction?.id,
      source: "checkout_loaded_success",
      metadata: {
        referenceCode: transaction?.reference_code,
        amount: transaction?.amount,
      },
    });
  }, [bookingId, data, trackEvent]);

  const createPayment = async () => {
    if (!data || !session) return;
    setCreating(true);
    try {
      const { booking } = data;
      const courseFormat = booking.course?.format === "online" ? "online" : "offline";
      const totalPrice = Number(booking.total_price ?? 0);
      const paymentOption = inferPaymentOptionFromBooking({
        courseFormat, paymentMethod: booking.payment_method,
        totalPrice, transactionAmount: data.transaction?.amount,
      });
      const { depositAmount } = calculateDepositBreakdown(totalPrice);
      const amountDue = paymentOption === "platform_deposit" ? depositAmount : totalPrice;

      const { data: result, error } = await supabase.functions.invoke("create-payment", {
        body: { booking_id: bookingId, amount: amountDue },
      });
      if (error) throw error;
      setPaymentSession(result);
      void trackEvent("payment_start", {
        courseId: booking.course_id,
        bookingId,
        transactionId: result?.transaction_id,
        source: "checkout_create_payment",
        metadata: {
          amount: amountDue,
          referenceCode: result?.reference_code,
          paymentOption,
        },
      });
    } catch (err: any) {
      void trackEvent("payment_failed", {
        courseId: data?.booking?.course_id,
        bookingId,
        source: "checkout_create_payment",
        metadata: {
          message: err.message,
        },
      });
      toast({ title: "Không thể tạo phiên thanh toán", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const copyRef = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Đã copy mã chuyển khoản" });
  };

  if (isLoading || creating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-sky-100 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
          </div>
          <p className="text-sm text-slate-500">{creating ? "Đang tạo mã thanh toán..." : "Đang tải..."}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-slate-500">Không tìm thấy phiên thanh toán.</p>
          <Link to="/learner/dashboard"><Button className="mt-4">Về Dashboard</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const { booking, transaction } = data;
  const courseFormat = booking.course?.format === "online" ? "online" : "offline";
  const totalPrice = Number(booking.total_price ?? 0);
  const originalTotalPrice = Number((booking as any).original_total_price ?? booking.course?.price ?? totalPrice);
  const voucherDiscountAmount = Number((booking as any).voucher_discount_amount ?? 0);
  const voucherBreakdown = calculateVoucherPaymentBreakdown(originalTotalPrice, voucherDiscountAmount);
  const hasVoucherDiscount = voucherBreakdown.discountAmount > 0;
  const paymentOption = inferPaymentOptionFromBooking({
    courseFormat, paymentMethod: booking.payment_method,
    totalPrice, transactionAmount: transaction?.amount,
  });
  const { depositAmount, remainingAmount } = calculateDepositBreakdown(totalPrice);
  const isDeposit = paymentOption === "platform_deposit";
  const amountDue = paymentSession?.amount ?? (isDeposit ? depositAmount : totalPrice);
  const isPaid = paid || transaction?.status === "success";
  const refCode = paymentSession?.reference_code ?? transaction?.reference_code ?? "";

  // ── Màn hình thành công ────────────────────────────────────────────────────
  if (isPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Thanh toán thành công!</h1>
          <p className="text-slate-500 mb-8">Lịch học của bạn đã được xác nhận. Mentor sẽ liên hệ sớm.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/learner/dashboard">
              <Button className="w-full sm:w-auto h-12 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white px-8 transition-all duration-200 hover:-translate-y-0.5">
                Xem lịch đã đặt
              </Button>
            </Link>
            <Link to={`/receipt/${bookingId}`}>
              <Button variant="outline" className="w-full sm:w-auto h-12 rounded-2xl border-slate-200 px-8 transition-all duration-200 hover:-translate-y-0.5">
                Xem biên lai
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Màn hình thanh toán ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container max-w-5xl py-8 px-4">

        {/* Back link */}
        <Link to={`/booking/${booking.course_id}`} className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />Quay lại đặt lịch
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
            <span className="text-xs font-semibold text-sky-700">Thanh toán qua SePay – Chuyển khoản ngân hàng</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2">
            {isDeposit ? "Thanh toán đặt cọc giữ chỗ" : "Thanh toán khóa học"}
          </h1>
          <p className="text-slate-500">Quét mã QR hoặc chuyển khoản đúng nội dung để hệ thống xác nhận tự động.</p>
        </div>

        {/* 2 cột */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* Cột trái — QR + thông tin */}
          <div className="space-y-5">

            {/* Card QR */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100">
                    <QrCode className="h-4 w-4 text-sky-600" />
                  </div>
                  <h2 className="font-semibold text-slate-800">Chuyển khoản ngân hàng / Quét QR</h2>
                </div>
              </div>

              <div className="p-6 flex flex-col items-center">
                <p className="mb-4 text-sm font-medium text-slate-600">Quét mã để thanh toán</p>

                {/* QR box */}
                <div className="mb-4 w-full max-w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  {paymentSession?.qr_url ? (
                    <img src={paymentSession.qr_url} alt="QR thanh toán" className="w-full rounded-xl object-contain" />
                  ) : (
                    <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-slate-50">
                      <QrCode className="h-16 w-16 text-slate-300" />
                      <p className="text-xs text-slate-400">Đang tạo QR...</p>
                    </div>
                  )}
                </div>

                <p className="max-w-xs text-center text-xs text-slate-400">
                  Mở ứng dụng ngân hàng hoặc ví điện tử hỗ trợ VietQR để quét mã.
                </p>

                {/* Trạng thái chờ */}
                <div className="mt-5 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                  </span>
                  <span className="text-xs font-medium text-slate-600">Đang chờ thanh toán</span>
                  <span className="text-xs text-slate-400">— Hệ thống tự động cập nhật</span>
                </div>
              </div>
            </div>

            {/* Card thông tin chuyển khoản */}
            {paymentSession && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-slate-800">Thông tin chuyển khoản</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Nội dung CK</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-600">{refCode}</span>
                      <button
                        onClick={() => copyRef(refCode)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-sky-300 hover:text-sky-600 transition-all duration-200"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-500">Số tiền</span>
                    <span className="font-bold text-sky-600">{formatVnd(amountDue)}</span>
                  </div>

                  {paymentSession.bank_account && (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-500">Số tài khoản</span>
                      <span className="font-mono font-semibold text-slate-700">{paymentSession.bank_account}</span>
                    </div>
                  )}
                </div>

                {/* Cảnh báo */}
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <p className="text-xs text-orange-800 leading-relaxed">
                    Vui lòng ghi đúng nội dung{" "}
                    <strong className="font-bold text-orange-900">{refCode}</strong>{" "}
                    khi chuyển khoản để hệ thống xác nhận tự động.
                  </p>
                </div>

                {isDeposit && (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                    <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <p className="text-xs text-teal-800 leading-relaxed">
                      Sau khi đặt cọc thành công, phần còn lại{" "}
                      <strong>{formatVnd(remainingAmount)}</strong> thanh toán trực tiếp với mentor khi học.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={createPayment}
                disabled={creating}
                variant="outline"
                className="h-12 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 px-6 transition-all duration-200 hover:-translate-y-0.5"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${creating ? "animate-spin" : ""}`} />
                Tạo lại QR
              </Button>
              <Link to="/learner/dashboard" className="flex-1 sm:flex-none">
                <Button className="h-12 w-full rounded-2xl bg-sky-600 hover:bg-sky-700 text-white px-8 transition-all duration-200 hover:-translate-y-0.5">
                  Xem lịch đã đặt
                </Button>
              </Link>
            </div>
          </div>

          {/* Cột phải — Tóm tắt */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 font-semibold text-slate-800">Tóm tắt thanh toán</h2>

              {/* Course info */}
              <div className="mb-5">
                <p className="font-bold text-slate-800 leading-snug">{booking.course?.title}</p>
                <p className="mt-1 text-sm text-slate-400">Mentor: {(booking as any).mentor?.name || "Mentor"}</p>
              </div>

              {/* Schedule */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <Calendar className="mb-1.5 h-4 w-4 text-sky-500" />
                  <p className="text-[11px] text-slate-400">Ngày học</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {new Date(booking.booking_date).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <Clock className="mb-1.5 h-4 w-4 text-sky-500" />
                  <p className="text-[11px] text-slate-400">Giờ học</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {booking.start_time} - {booking.end_time}
                  </p>
                </div>
              </div>

              <Separator className="mb-5" />

              {/* Pricing */}
              <div className="space-y-2.5 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tổng học phí</span>
                  <span className="text-slate-700">{formatVnd(originalTotalPrice)}</span>
                </div>
                {hasVoucherDiscount && (
                  <>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>Voucher VET Plus</span>
                      <span>-{formatVnd(voucherBreakdown.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Sau voucher</span>
                      <span className="font-semibold text-slate-700">{formatVnd(totalPrice)}</span>
                    </div>
                    <p className="rounded-2xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                      Voucher được trừ vào phí nền tảng, mentor không bị giảm thu nhập.
                    </p>
                  </>
                )}
                {isDeposit && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Còn lại trả tại lớp</span>
                    <span className="text-slate-700">{formatVnd(remainingAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3">
                  <span className="font-semibold text-slate-700">Cần thanh toán</span>
                  <span className="text-2xl font-extrabold text-sky-600">{formatVnd(amountDue)}</span>
                </div>
              </div>

              {/* Ref code */}
              {refCode && (
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] text-slate-400">Mã giao dịch</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm font-bold text-slate-700">{refCode}</p>
                    <button
                      onClick={() => copyRef(refCode)}
                      className="rounded-lg p-1 text-slate-400 hover:text-sky-600 transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
