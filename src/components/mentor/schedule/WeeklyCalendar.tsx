import { BookingSessionCard } from "./BookingSessionCard";
import { cn } from "@/lib/utils";
import type { ScheduleBooking } from "@/hooks/useMentorBookings";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface WeeklyCalendarProps {
  weekStart: Date;
  bookings: ScheduleBooking[];
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onComplete: (id: string) => void;
  busyBookingId?: string | null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function WeeklyCalendar({
  weekStart,
  bookings,
  onConfirm,
  onDecline,
  onComplete,
  busyBookingId,
}: WeeklyCalendarProps) {
  const today = formatLocalDate(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const iso = formatLocalDate(date);
    return {
      date,
      iso,
      label: DAY_LABELS[index],
      bookings: bookings
        .filter((booking) => booking.booking_date === iso)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    };
  });

  return (
    <div className="grid min-w-[1100px] grid-cols-7 gap-3">
      {days.map((day) => {
        const isToday = day.iso === today;

        return (
          <div key={day.iso} className="min-w-0 space-y-3">
            <div
              className={cn(
                "rounded-2xl border px-3 py-3 text-center",
                isToday
                  ? "border-primary/30 bg-primary text-primary-foreground shadow-glow"
                  : "bg-muted/50 text-foreground",
              )}
            >
              <p className="text-xs font-semibold">{day.label}</p>
              <p className="text-lg font-bold leading-tight">{formatDay(day.date)}</p>
            </div>

            <div className="space-y-3">
              {day.bookings.length > 0 ? (
                day.bookings.map((booking) => (
                  <BookingSessionCard
                    key={booking.id}
                    booking={booking}
                    onConfirm={onConfirm}
                    onDecline={onDecline}
                    onComplete={onComplete}
                    isBusy={busyBookingId === booking.id}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-3 py-8 text-center text-xs text-muted-foreground">
                  Không có buổi học
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
