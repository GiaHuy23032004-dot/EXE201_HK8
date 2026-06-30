import { CheckCircle2, CreditCard, Eye, Heart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MentorConversionFunnel as MentorConversionFunnelData } from "@/hooks/useMentorDashboardAnalytics";

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

interface MentorConversionFunnelProps {
  funnel?: MentorConversionFunnelData;
  isLoading?: boolean;
}

export function MentorConversionFunnel({ funnel, isLoading }: MentorConversionFunnelProps) {
  const stages = [
    {
      label: "Xem khóa học",
      count: funnel?.totalViews ?? 0,
      rate: null,
      helper: "Điểm bắt đầu",
      icon: Eye,
      color: "bg-sky-500",
    },
    {
      label: "Lưu khóa học",
      count: funnel?.totalSaves ?? 0,
      rate: funnel?.viewToSaveRate ?? null,
      helper:
        funnel?.viewToSaveRate === null
          ? "Chưa đủ dữ liệu"
          : `${funnel?.totalSaves ?? 0} / ${funnel?.totalViews ?? 0} lượt xem`,
      icon: Heart,
      color: "bg-rose-500",
    },
    {
      label: "Đặt lịch",
      count: funnel?.totalBookings ?? 0,
      rate: funnel?.viewToBookingRate ?? null,
      helper:
        funnel?.viewToBookingRate === null
          ? "Chưa đủ dữ liệu"
          : `${funnel?.totalBookings ?? 0} / ${funnel?.totalViews ?? 0} lượt xem`,
      icon: CreditCard,
      color: "bg-cyan-500",
    },
    {
      label: "Hoàn thành",
      count: funnel?.completedBookings ?? 0,
      rate: funnel?.bookingToCompletedRate ?? null,
      helper:
        funnel?.bookingToCompletedRate === null
          ? "Chưa đủ dữ liệu"
          : `${funnel?.completedBookings ?? 0} / ${funnel?.totalBookings ?? 0} booking`,
      icon: CheckCircle2,
      color: "bg-emerald-500",
    },
  ];

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Phễu chuyển đổi</CardTitle>
        <CardDescription>Từ lượt xem đến booking và hoàn thành buổi học trong kỳ đã chọn.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 rounded-2xl" />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-gradient-to-r from-slate-50 via-background to-slate-50/70">
            <div className="relative grid gap-0 md:grid-cols-4">
              <div className="absolute left-[12%] right-[12%] top-8 hidden h-px bg-gradient-to-r from-sky-200 via-cyan-200 to-emerald-200 md:block" />
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.label} className="relative min-w-0 border-b p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${stage.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {index === 0 ? "Gốc" : formatPercent(stage.rate)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-muted-foreground">{stage.label}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                      {stage.count.toLocaleString("vi-VN")}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{stage.helper}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
