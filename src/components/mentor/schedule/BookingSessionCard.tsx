import {
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BookingStatus, ScheduleBooking } from "@/hooks/useMentorBookings";

const STATUS_CFG: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ xác nhận", cls: "bg-warning/10 text-warning border-warning/20" },
  upcoming: { label: "Sắp diễn ra", cls: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Đã hoàn thành", cls: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Đã hủy", cls: "bg-muted text-muted-foreground border-border" },
  declined: { label: "Đã từ chối", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface BookingSessionCardProps {
  booking: ScheduleBooking;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onComplete: (id: string) => void;
  isBusy?: boolean;
}

function formatPrice(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

export function BookingSessionCard({
  booking,
  onConfirm,
  onDecline,
  onComplete,
  isBusy,
}: BookingSessionCardProps) {
  const status = STATUS_CFG[booking.status];
  const learnerName = booking.learner?.name ?? "Học viên";
  const learnerInitial = learnerName.trim().charAt(0).toUpperCase() || "H";
  const phone = booking.phone || booking.learner?.phone;
  const isOnline = booking.course?.format === "online";

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {booking.course?.title ?? "Khóa học"}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={booking.learner?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent text-[11px] text-accent-foreground">
                {learnerInitial}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {learnerName}
            </span>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px] font-semibold", status.cls)}>
          {status.label}
        </Badge>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">
            {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
          </span>
        </div>

        <div className="flex items-start gap-1.5">
          {isOnline ? (
            <>
              <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {booking.course?.meeting_link ? (
                <a
                  href={booking.course.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 text-primary hover:underline"
                >
                  Online <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              ) : (
                <span>Online</span>
              )}
            </>
          ) : (
            <>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{booking.course?.location ?? "Offline"}</span>
            </>
          )}
        </div>

        {phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            <span>{phone}</span>
          </div>
        )}

        {booking.learner?.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{booking.learner.email}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Banknote className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{formatPrice(booking.total_price)}</span>
        </div>

        {booking.note && (
          <div className="flex items-start gap-1.5">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{booking.note}</span>
          </div>
        )}

        {!booking.learner?.name && (
          <div className="flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            <span>Chưa có thông tin học viên</span>
          </div>
        )}
      </div>

      {booking.status === "pending" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            onClick={() => onConfirm(booking.id)}
            disabled={isBusy}
            className="h-8 rounded-xl border-0 text-xs text-primary-foreground gradient-primary"
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Xác nhận
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecline(booking.id)}
            disabled={isBusy}
            className="h-8 rounded-xl border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Từ chối
          </Button>
        </div>
      )}

      {booking.status === "upcoming" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onComplete(booking.id)}
          disabled={isBusy}
          className="mt-4 h-8 w-full rounded-xl border-success/30 text-xs text-success hover:bg-success/10 hover:text-success"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          )}
          Hoàn thành
        </Button>
      )}
    </div>
  );
}
