import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MentorDashboardBookingStatus } from "@/hooks/useMentorDashboardAnalytics";

const STATUS_ITEMS: {
  key: keyof MentorDashboardBookingStatus;
  label: string;
  helper: string;
  className: string;
}[] = [
  { key: "pending", label: "Chờ xác nhận", helper: "Cần xử lý sớm", className: "bg-amber-500" },
  { key: "upcoming", label: "Sắp diễn ra", helper: "Đã xác nhận", className: "bg-sky-500" },
  { key: "completed", label: "Đã hoàn thành", helper: "Đã dạy xong", className: "bg-emerald-500" },
  { key: "cancelled", label: "Đã hủy", helper: "Học viên hủy", className: "bg-slate-400" },
  { key: "declined", label: "Đã từ chối", helper: "Mentor từ chối", className: "bg-rose-500" },
];

interface MentorBookingStatusPanelProps {
  status?: MentorDashboardBookingStatus;
  isLoading?: boolean;
}

export function MentorBookingStatusPanel({ status, isLoading }: MentorBookingStatusPanelProps) {
  const total = STATUS_ITEMS.reduce((sum, item) => sum + (status?.[item.key] ?? 0), 0);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Tình trạng booking</CardTitle>
            <CardDescription>Các booking cần theo dõi trong kỳ đã chọn.</CardDescription>
          </div>
          <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {STATUS_ITEMS.map((item) => (
              <Skeleton key={item.key} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex min-h-[250px] items-center justify-center rounded-2xl bg-muted/30 p-8 text-center">
            <div>
              <p className="font-semibold text-foreground">Chưa có booking trong kỳ này</p>
              <p className="mt-1 text-sm text-muted-foreground">Booking mới sẽ xuất hiện tại đây khi học viên đặt lịch.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Tổng booking trong kỳ</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{total.toLocaleString("vi-VN")}</p>
            </div>

            <div className="space-y-4">
              {STATUS_ITEMS.map((item) => {
                const value = status?.[item.key] ?? 0;
                const percent = total ? (value / total) * 100 : 0;
                return (
                  <div key={item.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.helper}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">{value.toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.className}`}
                        style={{ width: value > 0 ? `${Math.max(5, percent)}%` : "0%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link to="/mentor/schedule">
            Xem lịch dạy <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
