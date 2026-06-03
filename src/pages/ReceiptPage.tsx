import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLearnerReceipt } from "@/hooks/useLearnerPayments";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Download, ArrowLeft, Loader2, Calendar, Clock, User, CreditCard, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ReportModal } from "@/components/reports/ReportModal";
import {
  formatVnd,
  getPlatformPaymentAmount,
  inferPaymentOptionFromBooking,
} from "@/lib/learnerPayment";

export default function ReceiptPage() {
  const { bookingId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading } = useLearnerReceipt(bookingId, session?.user?.id);

  const handleDownload = () => {
    if (!data) return;
    const { booking, transaction: txn } = data;
    const paymentOption = inferPaymentOptionFromBooking({
      courseFormat: booking.course?.format,
      paymentMethod: booking.payment_method,
      totalPrice: booking.total_price,
      transactionAmount: txn?.amount,
    });
    const platformAmount = txn?.amount ?? getPlatformPaymentAmount(paymentOption, booking.total_price);
    const remainingAmount = Math.max(0, booking.total_price - platformAmount);
    const receiptTitle = paymentOption === "platform_deposit" ? "BIÊN NHẬN ĐẶT CỌC" : "BIÊN LAI ĐẶT LỊCH HỌC";
    const content = [
      `=== ${receiptTitle} ===`,
      `Mã biên lai: ${txn?.reference_code || booking.id.slice(0, 8).toUpperCase()}`,
      `Ngày tạo: ${new Date(booking.created_at).toLocaleString("vi-VN")}`,
      "",
      "--- THÔNG TIN KHÓA HỌC ---",
      `Khóa học: ${booking.course?.title}`,
      `Mentor: ${booking.mentor?.name}`,
      `Ngày học: ${new Date(booking.booking_date).toLocaleDateString("vi-VN")}`,
      `Giờ học: ${booking.start_time} - ${booking.end_time}`,
      "",
      "--- THANH TOÁN ---",
      `Phương thức: ${
        paymentOption === "platform_full"
          ? "Thanh toán khóa học qua nền tảng"
          : paymentOption === "platform_deposit"
            ? "Đặt cọc giữ chỗ qua nền tảng"
            : "Trả tại lớp"
      }`,
      `Tổng học phí: ${formatVnd(booking.total_price)}`,
      `Cần thanh toán qua nền tảng: ${formatVnd(platformAmount)}`,
      paymentOption === "platform_deposit" ? `Còn lại trả tại lớp: ${formatVnd(remainingAmount)}` : null,
      `Trạng thái: ${booking.status === "pending" ? "Chờ xác nhận" : booking.status === "upcoming" ? "Đã xác nhận" : "Hoàn thành"}`,
      "",
      "Cảm ơn bạn đã sử dụng VET!",
    ].filter(Boolean).join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bien-lai-${txn?.reference_code || booking.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Đã tải biên lai" });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy biên lai.</p>
          <Link to="/learner/dashboard">
            <Button className="mt-4">Về Dashboard</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const { booking, transaction: txn } = data;
  const refCode = txn?.reference_code || `BK-${booking.id.slice(0, 8).toUpperCase()}`;
  const paymentOption = inferPaymentOptionFromBooking({
    courseFormat: booking.course?.format,
    paymentMethod: booking.payment_method,
    totalPrice: booking.total_price,
    transactionAmount: txn?.amount,
  });
  const platformAmount = txn?.amount ?? getPlatformPaymentAmount(paymentOption, booking.total_price);
  const remainingAmount = Math.max(0, booking.total_price - platformAmount);
  const isDeposit = paymentOption === "platform_deposit";
  const receiptTitle = isDeposit
    ? "Biên nhận đặt cọc"
    : paymentOption === "platform_full"
      ? "Thanh toán khóa học"
      : "Biên lai đặt lịch";

  const statusInfo = {
    pending:   { label: "Chờ xác nhận", color: "bg-warning/10 text-warning" },
    upcoming:  { label: "Đã xác nhận",  color: "bg-secondary/10 text-secondary" },
    completed: { label: "Hoàn thành",   color: "bg-success/10 text-success" },
    cancelled: { label: "Đã hủy",       color: "bg-muted text-muted-foreground" },
    declined:  { label: "Bị từ chối",   color: "bg-destructive/10 text-destructive" },
  }[booking.status] ?? { label: booking.status, color: "bg-muted text-muted-foreground" };

  return (
    <MainLayout>
      <div className="container max-w-2xl py-8">
        <Link to="/learner/dashboard" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />Về Dashboard
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-success/10 p-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{receiptTitle}</h1>
              <p className="text-sm text-muted-foreground font-mono">{refCode}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />Tải biên lai
            </Button>
            <Button variant="ghost" onClick={() => setReportOpen(true)} className="gap-2 text-muted-foreground hover:text-destructive">
              <Flag className="h-4 w-4" />Báo cáo thanh toán
            </Button>
          </div>
        </div>

        {/* Receipt card */}
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          {/* Course info */}
          <div className="p-6 border-b">
            <div className="flex gap-4">
              <img
                src={booking.course?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop"}
                alt={booking.course?.title}
                className="h-20 w-20 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">{booking.course?.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{booking.mentor?.name}</p>
                </div>
                <Badge className={`mt-2 ${statusInfo.color} border-0 text-xs`}>{statusInfo.label}</Badge>
              </div>
            </div>
          </div>

          {/* Booking details */}
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Chi tiết lịch học</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Ngày học</p>
                  <p className="text-sm font-medium text-foreground">{new Date(booking.booking_date).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Giờ học</p>
                  <p className="text-sm font-medium text-foreground">{booking.start_time} - {booking.end_time}</p>
                </div>
              </div>
            </div>

            {booking.phone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số điện thoại</span>
                <span className="font-medium text-foreground">{booking.phone}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment details */}
          <div className="p-6 space-y-3">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Thanh toán</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Phương thức</span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                {paymentOption === "platform_full"
                  ? "Thanh toán khóa học"
                  : paymentOption === "platform_deposit"
                    ? "Đặt cọc giữ chỗ"
                    : "Trả tại lớp"}
              </span>
            </div>
            {txn && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mã giao dịch</span>
                  <span className="font-mono text-xs text-foreground">{txn.reference_code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trạng thái GD</span>
                  <Badge className={txn.status === "success" ? "bg-success/10 text-success border-0 text-xs" : "bg-warning/10 text-warning border-0 text-xs"}>
                    {txn.status === "success" ? "Thành công" : txn.status === "pending" ? "Đang xử lý" : txn.status}
                  </Badge>
                </div>
              </>
            )}
            {!txn && booking.payment_method === "platform" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trạng thái GD</span>
                <Badge className="bg-muted text-muted-foreground border-0 text-xs">Chưa có giao dịch</Badge>
              </div>
            )}
            <Separator />
            {isDeposit && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{txn?.status === "success" ? "Đã đặt cọc" : "Cần đặt cọc"}</span>
                  <span className="font-semibold text-primary">{formatVnd(platformAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Còn lại trả tại lớp</span>
                  <span className="font-medium text-foreground">{formatVnd(remainingAmount)}</span>
                </div>
                <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  Phần còn lại thanh toán trực tiếp với mentor khi học.
                </p>
              </>
            )}
            {paymentOption === "pay_at_class" && (
              <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                Bạn sẽ thanh toán trực tiếp với mentor khi đến lớp.
              </p>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>{isDeposit ? "Tổng học phí" : "Tổng cộng"}</span>
              <span className="text-primary">{formatVnd(booking.total_price)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/20 px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground">Ngày đặt: {new Date(booking.created_at).toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground mt-1">Cảm ơn bạn đã sử dụng VET 🎓</p>
          </div>
        </div>
      </div>
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        type="payment"
        courseId={booking.course_id}
        reportedUserId={booking.mentor_id}
        bookingId={booking.id}
        transactionId={txn?.id ?? null}
        contextTitle={booking.course?.title || "Buổi học đã đặt"}
        contextDescription={`${new Date(booking.booking_date).toLocaleDateString("vi-VN")} · ${booking.start_time} - ${booking.end_time} · ${refCode}`}
      />
    </MainLayout>
  );
}
