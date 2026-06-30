import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MentorDashboardPeriod, MentorTrafficPoint } from "@/hooks/useMentorDashboardAnalytics";

function formatVND(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("vi-VN")}k`;
  return value.toLocaleString("vi-VN");
}

function formatVNDLong(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function formatPercent(part: number, total: number) {
  if (total <= 0) return "—";
  return `${((part / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function getPeriodGroupingLabel(periodDays: MentorDashboardPeriod) {
  if (periodDays === 7) return "ngày";
  if (periodDays === 365) return "tháng";
  return "tuần";
}

function getRevenueTicks(maxRevenue: number) {
  if (maxRevenue <= 0) return [0];
  const rawStep = maxRevenue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const stepMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = stepMultiplier * magnitude;
  const top = Math.ceil(maxRevenue / step) * step;
  return [0, step, step * 2, step * 3, top].filter((value, index, arr) => index === 0 || value > arr[index - 1]);
}

interface MentorTrafficChartProps {
  data?: MentorTrafficPoint[];
  periodDays: MentorDashboardPeriod;
  isLoading?: boolean;
}

export function MentorTrafficChart({ data = [], periodDays, isLoading }: MentorTrafficChartProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showEmptyRows, setShowEmptyRows] = useState(false);

  const totalViews = data.reduce((sum, point) => sum + point.views, 0);
  const totalBookings = data.reduce((sum, point) => sum + point.bookings, 0);
  const totalRevenue = data.reduce((sum, point) => sum + point.revenue, 0);
  const hasAnyData = totalViews > 0 || totalBookings > 0 || totalRevenue > 0;
  const hasRevenue = totalRevenue > 0;
  const showViewsColumn = totalViews > 0;
  const hasTrackingGap = totalViews === 0 && totalBookings > 0;
  const hasEmptyRows = data.some((point) => point.views === 0 && point.bookings === 0 && point.revenue === 0);
  const maxRevenue = Math.max(0, ...data.map((point) => point.revenue));
  const revenueTicks = getRevenueTicks(maxRevenue);
  const axisMax = Math.max(1, revenueTicks[revenueTicks.length - 1] ?? maxRevenue);

  const detailRows = useMemo(
    () => (showEmptyRows ? data : data.filter((point) => point.views > 0 || point.bookings > 0 || point.revenue > 0)),
    [data, showEmptyRows],
  );
  const chartGeometry = useMemo(() => {
    const width = 1000;
    const top = 18;
    const bottom = 260;
    const range = bottom - top;
    const points = data.map((point, index) => {
      const x = data.length <= 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = bottom - (point.revenue / axisMax) * range;
      return { x, y, point };
    });
    const linePath = points.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`).join(" ");
    const areaPath = points.length
      ? `M ${points[0].x} ${bottom} ${points.map((item) => `L ${item.x} ${item.y}`).join(" ")} L ${points[points.length - 1].x} ${bottom} Z`
      : "";
    return { width, top, bottom, points, linePath, areaPath };
  }, [axisMax, data]);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg">Doanh thu theo thời gian</CardTitle>
            <CardDescription className="mt-1">Theo dõi doanh thu thực nhận trong kỳ đã chọn.</CardDescription>
            {!isLoading && (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Tự động gom dữ liệu theo {getPeriodGroupingLabel(periodDays)}.
              </p>
            )}
          </div>
          {!isLoading && (
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 xl:min-w-[380px]">
              <SummaryMetric label="Booking" value={totalBookings.toLocaleString("vi-VN")} />
              <SummaryMetric label="Doanh thu" value={formatVNDLong(totalRevenue)} />
              <SummaryMetric
                label="Xem → Booking"
                value={formatPercent(totalBookings, totalViews)}
                helper={hasTrackingGap ? "Chưa có lượt xem để tính tỷ lệ" : undefined}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[280px] w-full rounded-2xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        ) : (
          <>
            {hasTrackingGap && (
              <div className="inline-flex max-w-2xl items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Có booking trong kỳ nhưng chưa có dữ liệu lượt xem trong kỳ này. Tỷ lệ xem → booking sẽ hiển thị khi hệ thống ghi nhận lượt xem.</p>
              </div>
            )}

            {!hasRevenue ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl bg-muted/30 p-8 text-center">
                <div>
                  <p className="font-semibold text-foreground">
                    {totalBookings > 0 ? "Chưa có doanh thu thực nhận trong kỳ này." : "Chưa có doanh thu trong kỳ này."}
                  </p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    Khi học viên thanh toán thành công, doanh thu thực nhận sẽ hiển thị tại đây.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <LegendDot className="bg-emerald-500" label="Doanh thu" />
                </div>

                <div className="rounded-2xl border bg-gradient-to-b from-background to-slate-50/60 p-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: "86px minmax(0, 1fr)" }}>
                    <div className="relative h-72 border-r border-border/60 pr-2">
                      {revenueTicks.map((tick) => {
                        const bottom = Math.min(100, (tick / axisMax) * 100);
                        return (
                          <div
                            key={tick}
                            className="absolute right-2 translate-y-1/2 text-right text-[11px] font-medium text-muted-foreground"
                            style={{ bottom: `${bottom}%` }}
                          >
                            {formatVNDLong(tick)}
                          </div>
                        );
                      })}
                    </div>

                    <div className="min-w-0">
                      <div className="relative h-72 border-b border-border/70">
                        {revenueTicks.map((tick) => {
                          const bottom = Math.min(100, (tick / axisMax) * 100);
                          return (
                            <div
                              key={`grid-${tick}`}
                              className="absolute inset-x-0 border-t border-dashed border-border/70"
                              style={{ bottom: `${bottom}%` }}
                            />
                          );
                        })}

                        <svg
                          className="absolute inset-0 h-full w-full overflow-visible"
                          viewBox={`0 0 ${chartGeometry.width} 280`}
                          preserveAspectRatio="none"
                          aria-label="Biểu đồ doanh thu theo thời gian"
                        >
                          <defs>
                            <linearGradient id="mentorRevenueArea" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {chartGeometry.areaPath && <path d={chartGeometry.areaPath} fill="url(#mentorRevenueArea)" />}
                          {chartGeometry.linePath && (
                            <path
                              d={chartGeometry.linePath}
                              fill="none"
                              stroke="#0891b2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="5"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                          {chartGeometry.points.map((item, index) => (
                            <g key={`${item.point.key ?? item.point.date}-point-${index}`}>
                              <circle cx={item.x} cy={item.y} r="7" fill="#ffffff" stroke="#0891b2" strokeWidth="4" vectorEffect="non-scaling-stroke" />
                              <title>{`${item.point.label ?? item.point.date}: ${formatVNDLong(item.point.revenue)} doanh thu`}</title>
                            </g>
                          ))}
                        </svg>
                      </div>

                      <div className="mt-3 flex gap-3 text-[10px] font-medium text-muted-foreground">
                        {data.map((point, index) => (
                          <div key={`${point.key ?? point.date}-label-${index}`} className="min-w-0 flex-1 text-center">
                            <span className="block truncate">{point.label ?? point.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {hasAnyData && (
              <Button
                type="button"
                aria-expanded={isDetailOpen}
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setIsDetailOpen((current) => !current)}
              >
                {isDetailOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {isDetailOpen ? "Thu gọn" : "Xem bảng dữ liệu"}
              </Button>
            )}

            {isDetailOpen && (
              <div className="space-y-3">
                {hasEmptyRows && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-muted-foreground"
                    onClick={() => setShowEmptyRows((current) => !current)}
                  >
                    {showEmptyRows ? "Ẩn dòng không có dữ liệu" : "Hiện dòng không có dữ liệu"}
                  </Button>
                )}

                <div className="overflow-x-auto rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-right">Booking</TableHead>
                        <TableHead className="text-right">Doanh thu</TableHead>
                        {showViewsColumn && <TableHead className="text-right">Lượt xem</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRows.map((point, index) => (
                        <TableRow key={`${point.key ?? point.date}-detail-${index}`}>
                          <TableCell className="font-medium">{point.label ?? point.date}</TableCell>
                          <TableCell className="text-right">{point.bookings.toLocaleString("vi-VN")}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">{formatVNDLong(point.revenue)}</TableCell>
                          {showViewsColumn && <TableCell className="text-right">{point.views.toLocaleString("vi-VN")}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/35 px-3 py-2">
      <p className="truncate text-sm font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-muted-foreground">{label}</p>
      {helper && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{helper}</p>}
    </div>
  );
}

function LegendDot({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
