import { cn } from "@/lib/utils";
import { BookingSessionCard } from "./BookingSessionCard";
import type { ScheduleBooking } from "@/hooks/useMentorBookings";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface Props {
  weekStart:  Date;
  bookings:   ScheduleBooking[];
  onConfirm:  (id: string) => void;
  onDecline:  (id: string) => void;
  onComplete: (id: string) => void;
  isPending:  boolean;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export function WeeklyCalendar({ weekStart, bookings, onConfirm, onDecline, onComplete, isPending }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso  = date.toISOString().slice(0, 10);
    const dayBookings = bookings
      .filter((b) => b.booking_date === iso)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { date, iso, label: DAY_LABELS[i], dayBookings };
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, iso, label, dayBookings }) => {
        const isToday = iso === today;
        return (
          <div key={iso} className="flex flex-col gap-2 min-w-0">
            {/* Day header */}
            <div className={cn(
              "flex flex-col items-center rounded-xl py-2 text-center",
              isToday ? "bg-primary text-primary-foreground" : "bg-muted/50"
            )}>
              <span className="text-[11px] font-medium">{label}</span>
              <span className={cn("text-lg font-bold leading-tight", isToday ? "text-primary-foreground" : "text-foreground")}>
                {date.getDate()}
              </span>
            </div>

            {/* Booking cards */}
            <div className="flex flex-col gap-1.5">
              {dayBookings.length > 0 ? (
                dayBookings.map((b) => (
                  <BookingSessionCard
                    key={b.id}
                    booking={b}
                    onConfirm={onConfirm}
                    onDecline={onDecline}
                    onComplete={onComplete}
                    isPending={isPending}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 py-4 text-center">
                  <span className="text-[10px] text-muted-foreground/50">—</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
