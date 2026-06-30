import { Link } from "react-router-dom";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MentorCoursePerformance } from "@/hooks/useMentorDashboardAnalytics";

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function statusLabel(status: string) {
  if (status === "approved") return "Đã duyệt";
  if (status === "pending") return "Chờ duyệt";
  if (status === "rejected") return "Từ chối";
  return status;
}

function statusClassName(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-border bg-muted text-muted-foreground";
}

function compactBenchmark(label: string) {
  if (!label) return "Chưa đủ dữ liệu";
  const cleaned = label
    .replace(/\s+trong ngành\s+[\w-]+/gi, "")
    .replace(/\s+ngành\s+[\w-]+/gi, "")
    .replace("Chưa đủ dữ liệu so sánh", "Chưa đủ dữ liệu")
    .replace("Cao hơn trung bình ngành", "Top 30% ngành")
    .replace("Thấp hơn trung bình ngành", "Cần tối ưu")
    .replace("Gần trung bình ngành", "Ổn định");
  return cleaned.trim() || "Chưa đủ dữ liệu";
}

function compactCategory(label: string) {
  if (label.includes("AI &")) return "Công cụ làm việc";
  if (label.includes("Tiếng Anh")) return "Tiếng Anh";
  if (label.includes("Thể thao")) return "Thể thao";
  if (label.includes("Barista")) return "Pha chế";
  if (label.includes("Nội dung")) return "MC & Nội dung";
  if (label.includes("Cờ")) return "Tư duy";
  return label;
}

function benchmarkClassName(label: string) {
  const compact = compactBenchmark(label).toLowerCase();
  if (compact.includes("tốt")) return "bg-emerald-50 text-emerald-700";
  if (compact.includes("tối ưu")) return "bg-amber-50 text-amber-700";
  if (compact.includes("ổn")) return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

interface MentorCoursePerformanceTableProps {
  courses?: MentorCoursePerformance[];
  isLoading?: boolean;
}

export function MentorCoursePerformanceTable({ courses = [], isLoading }: MentorCoursePerformanceTableProps) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Hiệu quả từng khóa học</CardTitle>
          <CardDescription>So sánh lượt xem, lượt lưu, booking, doanh thu và chất lượng từng khóa.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/mentor/courses">
            Quản lý khóa học <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl bg-muted/30 p-8 text-center">
            <div>
              <p className="font-semibold text-foreground">Bạn chưa có khóa học nào</p>
              <p className="mt-1 text-sm text-muted-foreground">Tạo khóa học đầu tiên để bắt đầu theo dõi hiệu quả.</p>
              <Button asChild className="mt-4 rounded-xl border-0 text-primary-foreground gradient-primary">
                <Link to="/mentor/create-course">Tạo khóa học mới</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-background">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-50">
                <TableRow>
                  <TableHead className="min-w-[260px]">Khóa học</TableHead>
                  <TableHead className="text-right">Lượt xem</TableHead>
                  <TableHead className="text-right">Lượt lưu</TableHead>
                  <TableHead className="text-right">Booking</TableHead>
                  <TableHead className="min-w-[150px] text-right">Tỷ lệ đặt lịch</TableHead>
                  <TableHead className="text-right">Hoàn thành</TableHead>
                  <TableHead className="text-right">Doanh thu thực nhận</TableHead>
                  <TableHead className="text-right">Đánh giá</TableHead>
                  <TableHead className="min-w-[130px]">So sánh ngành</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.courseId} className="hover:bg-slate-50/80">
                    <TableCell className="py-4">
                      <div className="space-y-2">
                        <p className="line-clamp-2 font-semibold leading-5 text-foreground">{course.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full font-medium">
                            {compactCategory(course.category)}
                          </Badge>
                          <Badge variant="outline" className={`rounded-full font-medium ${statusClassName(course.status)}`}>
                            {statusLabel(course.status)}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-700">{course.views.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right font-semibold text-slate-700">{course.saves.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right font-bold text-cyan-700">{course.bookings.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right">
                      {course.conversionRate === null ? (
                        <div>
                          <p className="font-semibold">—</p>
                          <p className="text-[11px] text-muted-foreground">Chưa có lượt xem</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-bold text-foreground">{formatPercent(course.conversionRate)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {course.bookings.toLocaleString("vi-VN")} / {course.views.toLocaleString("vi-VN")} lượt xem
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {course.bookings > 0 ? (
                        <div>
                          <p>{course.completedBookings.toLocaleString("vi-VN")}/{course.bookings.toLocaleString("vi-VN")}</p>
                          <p className="text-[11px] text-muted-foreground">buổi học</p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatVND(course.revenue)}</TableCell>
                    <TableCell className="text-right">
                      {course.reviewCount > 0 ? (
                        <div>
                          <p className="font-semibold">{course.rating.toFixed(1)}</p>
                          <p className="text-[11px] text-muted-foreground">{course.reviewCount} review</p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 rounded-full border-0 ${benchmarkClassName(course.benchmarkLabel)}`}>
                        <TrendingUp className="h-3 w-3" />
                        {compactBenchmark(course.benchmarkLabel)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
