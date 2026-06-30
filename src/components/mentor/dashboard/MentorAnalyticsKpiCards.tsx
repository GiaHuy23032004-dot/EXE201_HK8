import { BookOpen, CalendarCheck, Eye, Heart, Star, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MentorDashboardAllTime } from "@/hooks/useMentorDashboardAnalytics";
import { cn } from "@/lib/utils";

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

interface MentorAnalyticsKpiCardsProps {
  overview?: MentorDashboardAllTime;
  isLoading?: boolean;
}

export function MentorAnalyticsKpiCards({ overview, isLoading }: MentorAnalyticsKpiCardsProps) {
  const primaryCards = [
    {
      label: "Lượt xem",
      value: overview?.totalViews.toLocaleString("vi-VN") ?? "0",
      subtext: "Sức hút khóa học từ trước đến nay",
      icon: Eye,
      iconBg: "bg-sky-50",
      accent: "text-sky-600",
      ring: "ring-sky-100",
    },
    {
      label: "Booking",
      value: overview?.totalBookings.toLocaleString("vi-VN") ?? "0",
      subtext:
        overview?.viewToBookingRate === null
          ? "View → Booking: —"
          : `View → Booking: ${formatPercent(overview?.viewToBookingRate)}`,
      icon: CalendarCheck,
      iconBg: "bg-cyan-50",
      accent: "text-cyan-600",
      ring: "ring-cyan-100",
    },
    {
      label: "Doanh thu",
      value: formatVND(overview?.totalNetRevenue ?? 0),
      subtext: `Phí nền tảng: ${formatVND(overview?.totalPlatformFee ?? 0)}`,
      icon: Wallet,
      iconBg: "bg-emerald-50",
      accent: "text-emerald-600",
      ring: "ring-emerald-100",
    },
    {
      label: "Đánh giá",
      value: overview?.avgRating ? overview.avgRating.toFixed(1) : "—",
      subtext: `${overview?.reviewCount ?? 0} lượt đánh giá`,
      icon: Star,
      iconBg: "bg-amber-50",
      accent: "text-amber-600",
      ring: "ring-amber-100",
    },
  ];

  const secondaryStats = [
    {
      label: "Lượt lưu",
      value: overview?.totalSaves.toLocaleString("vi-VN") ?? "0",
      helper: "Người học quan tâm",
      icon: Heart,
    },
    {
      label: "Khóa học hoạt động",
      value: overview?.activeCourses.toLocaleString("vi-VN") ?? "0",
      helper: `${overview?.pendingCourses ?? 0} khóa chờ duyệt`,
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="overflow-hidden rounded-2xl border-border/70 bg-background shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="relative p-5">
                <span className={cn("absolute inset-x-0 top-0 h-1", card.iconBg)} />
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                        <p className="mt-3 truncate text-3xl font-bold tracking-tight text-foreground">{card.value}</p>
                      </div>
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1", card.iconBg, card.ring)}>
                        <Icon className={cn("h-5 w-5", card.accent)} />
                      </div>
                    </div>
                    <p className="mt-3 min-h-5 text-sm leading-5 text-muted-foreground">{card.subtext}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[240px_240px_1fr]">
        {secondaryStats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              {isLoading ? (
                <Skeleton className="h-5 w-28" />
              ) : (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {item.value} <span className="font-medium text-muted-foreground">{item.label.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{item.helper}</p>
                </div>
              )}
            </div>
          );
        })}
        <div className="hidden items-center rounded-2xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground xl:flex">
          Số liệu tổng quan được tính từ dữ liệu thật của khóa học, booking và giao dịch.
        </div>
      </div>
    </div>
  );
}
