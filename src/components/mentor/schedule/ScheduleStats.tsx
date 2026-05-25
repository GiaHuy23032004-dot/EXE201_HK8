import { AlertCircle, CalendarCheck, Clock, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ScheduleBooking } from "@/hooks/useMentorBookings";

interface ScheduleStatsProps {
  bookings: ScheduleBooking[];
  weekStart: Date;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffHours(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

export function ScheduleStats({ bookings, weekStart }: ScheduleStatsProps) {
  const today = formatLocalDate(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartIso = formatLocalDate(weekStart);
  const weekEndIso = formatLocalDate(weekEnd);

  const todayCount = bookings.filter(
    (booking) =>
      booking.booking_date === today &&
      (booking.status === "pending" || booking.status === "upcoming"),
  ).length;
  const upcomingCount = bookings.filter(
    (booking) => booking.booking_date >= today && booking.status === "upcoming",
  ).length;
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const weekHours = bookings
    .filter(
      (booking) =>
        booking.booking_date >= weekStartIso &&
        booking.booking_date <= weekEndIso &&
        (booking.status === "upcoming" || booking.status === "completed"),
    )
    .reduce((total, booking) => total + diffHours(booking.start_time, booking.end_time), 0);

  const cards = [
    {
      icon: CalendarCheck,
      label: "Buổi học hôm nay",
      value: todayCount,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Clock,
      label: "Sắp diễn ra",
      value: upcomingCount,
      color: "text-secondary-foreground",
      bg: "bg-accent",
    },
    {
      icon: AlertCircle,
      label: "Chờ xác nhận",
      value: pendingCount,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      icon: Timer,
      label: "Tổng giờ dạy tuần này",
      value: `${weekHours.toFixed(1)}h`,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className={`mb-3 inline-flex rounded-xl p-2.5 ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
