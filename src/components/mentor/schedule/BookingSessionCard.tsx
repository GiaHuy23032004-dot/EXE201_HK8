import { Check, X, CheckCircle2, Phone, StickyNote, MapPin, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ScheduleBooking, BookingStatus } from "@/hooks/useMentorBookings";

// ─── status config ────────────────────────────────────────────────────────────

export const STATUS_CFG: Record<BookingStatus, { label: string; cls: string }> = {
  pending:   { label: "Chờ xác nhận", cls: "bg-warning/10 text-warning border-0"           },
  upcoming:  { label: "Sắp diễn ra",  cls: "bg-primary/10 text-primary border-0"           },
  completed: { label: "Đã hoàn thành",cls: "bg-success/10 text-success border-0"           },
  cancelled: { label: "Đã hủy",       cls: "bg-muted text-muted-foreground border-0"       },
  declined:  { label: "Đã từ chối",   cls: "bg-destructive/10 text-destructive border-0"   },
};

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  booking:    ScheduleBooking;
  onConfirm:  (id: string) => void;
  onDecline:  (id: string) => void;
  onComplete: (id: string) => void;
  isPending:  boolean;
}

export function BookingSessionCard({ booking: b, onConfirm, onDecline, onComplete, isPending }: Props) {
  const cfg = STATUS_CFG[b.status];
  const isToday = b.booking_date === new Date().toISOString().slice(0, 10);

  return (
    <div className={cn(
      "rounded-2xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover",
      isToday && "border-primary/30 bg-primary/[0.02]"
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={b.learner?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">
              {b.learner?.name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {b.learner?.name ?? "Học viên"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{b.course?.title}</p>
          </div>
        </div>
        <Badge className={cn("shrink-0 text-[10px]", cfg.cls)}>{cfg.label}</Badge>
      </div>

      {/* Time + date */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {new Date(b.booking_date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
        </span>
        <span>{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
        {b.course?.format === "online"
          ? <span className="flex items-center gap-1"><Video  className="h-3 w-3" />Online</span>
          : <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.course?.location ?? "Offline"}</span>}
        {isToday && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Hôm nay</span>
        )}
      </div>

      {/* Phone / note */}
      {b.phone && (
        <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />{b.phone}
        </p>
      )}
      {b.note && (
        <p className="mb-2 flex items-start gap-1 text-xs text-muted-foreground">
          <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{b.note}</span>
        </p>
      )}

      {/* Price */}
      <p className="mb-3 text-sm font-bold text-primary">
        {b.total_price.toLocaleString("vi-VN")}đ
      </p>

      {/* Actions */}
      {b.status === "pending" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onConfirm(b.id)}
            disabled={isPending}
            className="flex-1 gradient-primary border-0 text-primary-foreground rounded-xl text-xs h-8"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="mr-1 h-3.5 w-3.5" />Xác nhận</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecline(b.id)}
            disabled={isPending}
            className="flex-1 rounded-xl text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <X className="mr-1 h-3.5 w-3.5" />Từ chối
          </Button>
        </div>
      )}
      {b.status === "upcoming" && (
        <Button
          size="sm"
          onClick={() => onComplete(b.id)}
          disabled={isPending}
          variant="outline"
          className="w-full rounded-xl text-xs h-8 text-success hover:bg-success/10 hover:text-success border-success/30"
        >
          {isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Đánh dấu hoàn thành</>}
        </Button>
      )}
    </div>
  );
}
