import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  QrCode,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnerReceipt } from "@/hooks/useLearnerPayments";
import {
  calculateDepositBreakdown,
  formatVnd,
  inferPaymentOptionFromBooking,
} from "@/lib/learnerPayment";

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const { session } = useAuth();
  const { data, isLoading } = useLearnerReceipt(bookingId, session?.user?.id);

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
          <p className="text-muted-foreground">Không tìm thấy phiên thanh toán.</p>
          <Link to="/learner/dashboard">
            <Button className="mt-4">Về Dashboard</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const { booking, transaction } = data;
  const courseFormat = booking.course?.format === "online" ? "online" : "offline";
  const totalPrice = booking.total_price;
  const paymentOption = inferPaymentOptionFromBooking({
    courseFormat,
    paymentMethod: booking.payment_method,
    totalPrice,
    transactionAmount: transaction?.amount,
  });
  // TODO: Backend integration point: create payment session and transaction via Edge Function.
  // This page is a mock checkout and must not write to the transactions table from the browser.
  const isDeposit = paymentOption === "platform_deposit";
  const { remainingAmount } = calculateDepositBreakdown(totalPrice);
  const amountDue = transaction?.amount ?? (isDeposit ? totalPrice - remainingAmount : totalPrice);
  const title = isDeposit ? "Thanh toán đặt cọc giữ chỗ" : "Thanh toán khóa học";

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        <Link to={`/booking/${booking.course_id}`} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />Quay lại đặt lịch
        </Link>

        <div className="mb-8">
          <Badge className="mb-3 rounded-full border-0 bg-blue-100 text-blue-700">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Thanh toán qua nền tảng
          </Badge>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đây là giao diện thanh toán mô phỏng để chuẩn bị cho tích hợp cổng thanh toán thật trong backend.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                Chuyển khoản ngân hàng / QR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
                <div className="mb-4 rounded-2xl bg-background p-5 shadow-sm">
                  <QrCode className="h-20 w-20 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">QR thanh toán sẽ hiển thị tại đây</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Backend sẽ tạo phiên thanh toán, trả về QR/thông tin chuyển khoản và webhook sẽ xác nhận giao dịch.
                </p>
              </div>

              {isDeposit && (
                <Alert className="rounded-2xl border-teal-200 bg-teal-50 text-teal-800">
                  <Receipt className="h-4 w-4" />
                  <AlertDescription>
                    Sau khi đặt cọc thành công, phần còn lại sẽ thanh toán trực tiếp với mentor khi học.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <Link to="/learner/dashboard">
                  <Button variant="outline" className="rounded-xl">Xem lịch đã đặt</Button>
                </Link>
                <Link to={`/receipt/${booking.id}`}>
                  <Button className="rounded-xl border-0 gradient-primary text-primary-foreground">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Xem biên lai
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Tóm tắt thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{booking.course?.title}</p>
                <p className="text-xs text-muted-foreground">Mentor: {booking.mentor?.name || "Mentor"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <Calendar className="mb-1 h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Ngày học</p>
                  <p className="font-medium text-foreground">{new Date(booking.booking_date).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <Clock className="mb-1 h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Giờ học</p>
                  <p className="font-medium text-foreground">{booking.start_time} - {booking.end_time}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng học phí</span>
                  <span className="text-foreground">{formatVnd(totalPrice)}</span>
                </div>
                {isDeposit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Còn lại trả tại lớp</span>
                    <span className="text-foreground">{formatVnd(Math.max(0, totalPrice - amountDue))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Cần thanh toán</span>
                  <span className="text-primary">{formatVnd(amountDue)}</span>
                </div>
              </div>
              {transaction?.reference_code && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Mã giao dịch</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{transaction.reference_code}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
