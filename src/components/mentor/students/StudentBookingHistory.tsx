import { Banknote, Check, CheckCircle2, Clock, Loader2, StickyNote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/hooks/useMentorBookings";
import type { MentorStudentBooking } from "@/hooks/useMentorStudents";

interface StudentBookingHistoryProps {
  bookings: MentorStudentBooking[];
  busyBookingId?: string | null;
  onConfirm: (booking: MentorStudentBooking) => void;
  onDecline: (booking: MentorStudentBooking) => void;
  onComplete: (booking: MentorStudentBooking) => void;
}

const STATUS_CFG: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ xác nhận", cls: "bg-warning/10 text-warning border-warning/20" },
  upcoming: { label: "Sắp diễn ra", cls: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Đã hoàn thành", cls: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Đã hủy", cls: "bg-muted text-muted-foreground border-border" },
  declined: { label: "Đã từ chối", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  later: "Thanh toán sau",
  platform: "Qua nền tảng",
  credit_card: "Thẻ",
  bank_transfer: "Chuyển khoản",
  e_wallet: "Ví điện tử",
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN");
}

function formatPrice(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

export function StudentBookingHistory({
  bookings,
  busyBookingId,
  onConfirm,
  onDecline,
  onComplete,
}: StudentBookingHistoryProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Chưa có lịch sử đặt học.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const status = STATUS_CFG[booking.status];
        const isBusy = busyBookingId === booking.id;

        return (
          <div key={booking.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {booking.course?.title ?? "Khóa học"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {formatDate(booking.booking_date)} · {booking.start_time.slice(0, 5)} -{" "}
                    {booking.end_time.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-success" />
                    {formatPrice(booking.total_price)}
                  </span>
                  <span>{PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method}</span>
                </div>
              </div>
              <Badge variant="outline" className={cn("w-fit text-[11px] font-semibold", status.cls)}>
                {status.label}
              </Badge>
            </div>

            {booking.note && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{booking.note}</span>
              </div>
            )}

            {booking.status === "pending" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onConfirm(booking)}
                  disabled={isBusy}
                  className="rounded-xl border-0 text-primary-foreground gradient-primary"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Xác nhận
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDecline(booking)}
                  disabled={isBusy}
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="mr-2 h-4 w-4" />
                  Từ chối
                </Button>
              </div>
            )}

            {booking.status === "upcoming" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onComplete(booking)}
                disabled={isBusy}
                className="mt-4 rounded-xl border-success/30 text-success hover:bg-success/10 hover:text-success"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Hoàn thành
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
