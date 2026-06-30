import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, BadgeCheck, BookOpen, Info, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMentorDashboardAnalytics,
  type MentorDashboardPeriod,
  type MentorCoursePerformance,
} from "@/hooks/useMentorDashboardAnalytics";
import { useMentorVerification, type MentorVerificationStatus } from "@/hooks/useMentorVerification";
import { MentorAnalyticsKpiCards } from "@/components/mentor/dashboard/MentorAnalyticsKpiCards";
import { MentorBookingStatusPanel } from "@/components/mentor/dashboard/MentorBookingStatusPanel";
import { MentorConversionFunnel } from "@/components/mentor/dashboard/MentorConversionFunnel";
import { MentorCoursePerformanceTable } from "@/components/mentor/dashboard/MentorCoursePerformanceTable";
import { MentorInsightCards } from "@/components/mentor/dashboard/MentorInsightCards";
import { MentorTrafficChart } from "@/components/mentor/dashboard/MentorTrafficChart";
import { MentorWalletQuickCard } from "@/components/mentor/dashboard/MentorWalletQuickCard";
import { PeriodSelector } from "@/components/mentor/dashboard/PeriodSelector";

const verificationBannerCopy: Record<Exclude<MentorVerificationStatus, "approved">, {
  title: string;
  description: string;
  button?: string;
}> = {
  unverified: {
    title: "Hoàn tất xác minh để tăng độ tin cậy",
    description: "Bổ sung hồ sơ và bằng chứng chuyên môn để nhận huy hiệu Verified Mentor.",
    button: "Xác minh ngay",
  },
  draft: {
    title: "Hồ sơ xác minh chưa hoàn tất",
    description: "Bạn có thể tiếp tục bổ sung thông tin trước khi gửi duyệt.",
    button: "Tiếp tục xác minh",
  },
  pending: {
    title: "Hồ sơ đang chờ duyệt",
    description: "Admin đang xem xét hồ sơ xác minh của bạn.",
  },
  rejected: {
    title: "Hồ sơ cần bổ sung",
    description: "Hồ sơ cần bổ sung thêm thông tin.",
    button: "Bổ sung hồ sơ",
  },
  revision_requested: {
    title: "Hồ sơ cần chỉnh sửa",
    description: "Admin đã yêu cầu chỉnh sửa một số thông tin trong hồ sơ xác minh.",
    button: "Bổ sung hồ sơ",
  },
  revoked: {
    title: "Xác minh đã bị thu hồi",
    description: "Trạng thái Verified Mentor không còn hiệu lực. Vui lòng xem ghi chú hoặc liên hệ Admin nếu cần.",
  },
};

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải dữ liệu tổng quan. Vui lòng thử lại.";
}

function TopCoursesCard({ courses }: { courses: MentorCoursePerformance[] }) {
  const topCourses = courses.slice(0, 3);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Top khóa học</CardTitle>
            <CardDescription>Khóa học nổi bật theo doanh thu, booking và lượt xem.</CardDescription>
          </div>
          <Trophy className="h-5 w-5 shrink-0 text-amber-600" />
        </div>
      </CardHeader>
      <CardContent>
        {topCourses.length === 0 ? (
          <div className="rounded-2xl bg-muted/30 p-6 text-center">
            <p className="font-semibold text-foreground">Chưa có dữ liệu xếp hạng</p>
            <p className="mt-1 text-sm text-muted-foreground">Khi có lượt xem hoặc booking, top khóa học sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-background">
            {topCourses.map((course, index) => (
              <div key={course.courseId} className="border-b p-4 transition-colors last:border-b-0 hover:bg-muted/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold text-foreground">{course.title}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:max-w-lg">
                      <MiniMetric label="Booking" value={course.bookings.toLocaleString("vi-VN")} />
                      <MiniMetric label="Lượt xem" value={course.views.toLocaleString("vi-VN")} />
                      <MiniMetric label="Doanh thu" value={formatVND(course.revenue)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <Badge variant="secondary" className="rounded-full">
                      Tỷ lệ {formatPercent(course.conversionRate)}
                    </Badge>
                    <Link to={`/courses/${course.courseId}`} className="text-xs font-semibold text-primary hover:underline">
                      Xem khóa học
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/40 px-2.5 py-2">
      <p className="truncate font-bold text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">{eyebrow}</p>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function MentorDashboard() {
  const [periodDays, setPeriodDays] = useState<MentorDashboardPeriod>(30);
  const { session } = useAuth();
  const mentorId = session?.user?.id;
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useMentorDashboardAnalytics(periodDays);
  const { data: verificationContext } = useMentorVerification(mentorId);

  const verification = verificationContext?.verification;
  const verificationStatus = verification?.status ?? "unverified";
  const isVerified = verificationStatus === "approved";
  const showVerificationBanner = !isVerified;
  const verificationCopy = showVerificationBanner
    ? verificationBannerCopy[verificationStatus as Exclude<MentorVerificationStatus, "approved">]
    : null;
  const hasNoCourses = !isLoading && !isError && (data?.period.coursePerformance.length ?? 0) === 0;
  const hasAllTimeTrackingGap = !isLoading && !isError && (data?.allTime.totalViews ?? 0) === 0 && (data?.allTime.totalBookings ?? 0) > 0;

  return (
    <MentorLayout>
      <div className="space-y-8 p-5 lg:p-8">
        <section className="rounded-3xl border bg-gradient-to-br from-background via-background to-sky-50/70 p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">Tổng quan</h1>
                {isVerified && (
                  <Badge className="gap-1 rounded-full border-0 bg-emerald-50 text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified Mentor
                  </Badge>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Theo dõi hiệu quả khóa học, booking và doanh thu của bạn.
              </p>
            </div>
            <PeriodSelector value={periodDays} onChange={setPeriodDays} />
          </div>
        </section>

        {showVerificationBanner && verificationCopy && (
          <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{verificationCopy.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {verificationStatus === "rejected" && verification?.admin_note
                    ? verification.admin_note
                    : verificationCopy.description}
                </p>
              </div>
              {verificationCopy.button && (
                <Button asChild className="rounded-xl border-0 text-primary-foreground gradient-primary">
                  <Link to="/mentor/profile?tab=verification">{verificationCopy.button}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-destructive">Không thể tải dữ liệu tổng quan.</p>
                <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Thử lại
              </Button>
            </CardContent>
          </Card>
        )}

        {import.meta.env.DEV && !isError && data?.advancedUnavailable && (
          <Card className="rounded-2xl border-sky-200 bg-sky-50/70 shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <p className="text-sm leading-6 text-sky-800">
                Dữ liệu nâng cao đang được đồng bộ. Các chỉ số khóa học, booking và doanh thu vẫn hoạt động bình thường.
              </p>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Tổng quan"
            title="Tình hình tổng quan"
            description="Các chỉ số chính từ trước đến nay của hoạt động mentor."
          />
          <MentorAnalyticsKpiCards overview={data?.allTime} isLoading={isLoading} />
          {hasAllTimeTrackingGap && (
            <Card className="rounded-2xl border-sky-200 bg-sky-50/70 shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p className="text-sm leading-6 text-sky-800">
                  Có booking nhưng chưa có dữ liệu lượt xem. Hãy kiểm tra course_view_events hoặc tracking course detail.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {hasNoCourses && (
          <Card className="rounded-2xl border-dashed border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">Bạn chưa có khóa học nào</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Tạo khóa học đầu tiên để bắt đầu nhận lượt xem, lượt lưu, booking và dữ liệu doanh thu thật.
              </p>
              <Button asChild className="mt-5 rounded-xl border-0 text-primary-foreground gradient-primary">
                <Link to="/mentor/create-course">Tạo khóa học mới</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Hiệu quả trong kỳ"
            title="Từ quan tâm đến đặt lịch"
            description="Theo dõi lượt xem, chuyển đổi booking, doanh thu và trạng thái cần xử lý trong kỳ."
          />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <MentorTrafficChart data={data?.period.trafficSeries} periodDays={periodDays} isLoading={isLoading} />
            <MentorBookingStatusPanel status={data?.period.bookingStatus} isLoading={isLoading} />
          </div>
          <MentorConversionFunnel funnel={data?.period.conversionFunnel} isLoading={isLoading} />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Hành động tiếp theo"
            title="Tối ưu hiệu quả khóa học"
            description="Xem khóa nào đang tạo kết quả tốt, khóa nào cần cải thiện và ưu tiên xử lý tiếp theo."
          />
          <MentorCoursePerformanceTable courses={data?.period.coursePerformance} isLoading={isLoading} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <TopCoursesCard courses={data?.period.topCourses ?? []} />
            <MentorWalletQuickCard wallet={data?.wallet} isLoading={isLoading} />
          </div>
          <MentorInsightCards insights={data?.period.insights} isLoading={isLoading} />
        </section>

        <div className="flex justify-end">
          <Button asChild variant="ghost" className="rounded-xl text-muted-foreground">
            <Link to="/mentor/courses">
              Đi tới quản lý khóa học <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </MentorLayout>
  );
}
