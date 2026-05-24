import { motion } from "framer-motion";
import { CalendarCheck, Clock, AlertCircle, TrendingUp } from "lucide-react";
import type { ScheduleBooking } from "@/hooks/useMentorBookings";

interface Props { bookings: ScheduleBooking[] }

function diffHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

export function ScheduleStats({ bookings }: Props) {
  const today     = new Date().toISOString().slice(0, 10);
  const todayCount   = bookings.filter((b) => b.booking_date === today && b.status === "upcoming").length;
  const upcomingCount = bookings.filter((b) => b.booking_date >= today && b.status === "upcoming").length;
  const pendingCount  = bookings.filter((b) => b.status === "pending").length;

  // total teaching hours this week
  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10);
  })();
  const weekHours = bookings
    .filter((b) => b.booking_date >= weekStart && b.booking_date <= weekEnd && b.status !== "cancelled" && b.status !== "declined")
    .reduce((sum, b) => sum + diffHours(b.start_time, b.end_time), 0);

  const cards = [
    { icon: CalendarCheck, label: "Buổi học hôm nay",      value: todayCount,              color: "text-primary",     bg: "bg-primary/10"     },
    { icon: Clock,         label: "Sắp diễn ra",           value: upcomingCount,           color: "text-secondary-foreground", bg: "bg-accent" },
    { icon: AlertCircle,   label: "Chờ xác nhận",          value: pendingCount,            color: "text-warning",     bg: "bg-warning/10"     },
    { icon: TrendingUp,    label: "Tổng giờ dạy tuần này", value: `${weekHours.toFixed(1)}h`, color: "text-success",  bg: "bg-success/10"     },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="rounded-2xl border bg-card p-5 shadow-card"
        >
          <div className={`mb-3 inline-flex rounded-xl p-2.5 ${c.bg}`}>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <p className="text-2xl font-bold text-foreground">{c.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
