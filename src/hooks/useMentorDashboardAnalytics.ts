import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseCategoryLabel, normalizeCourseCategory } from "@/constants/courseCategories";

export type MentorDashboardPeriod = 7 | 30 | 365;

export interface MentorDashboardAllTime {
  totalViews: number;
  totalSaves: number;
  totalBookings: number;
  totalNetRevenue: number;
  totalPlatformFee: number;
  avgRating: number | null;
  reviewCount: number;
  activeCourses: number;
  pendingCourses: number;
  viewToBookingRate: number | null;
}

export interface MentorDashboardBookingStatus {
  pending: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  declined: number;
}

export interface MentorDashboardWallet {
  balance: number;
  heldBalance: number;
  totalEarned: number;
  pendingWithdrawal: number;
  paidWithdrawal: number;
  walletReconciled: boolean;
  reconciliationDelta: number;
}

export interface MentorDashboardRevenue {
  periodNetRevenue: number;
  periodPlatformFee: number;
  periodGrossRevenue: number;
  lifetimeNetRevenue: number;
}

export interface MentorConversionFunnel {
  totalViews: number;
  totalSaves: number;
  totalBookings: number;
  successfulTransactions: number;
  completedBookings: number;
  viewToSaveRate: number | null;
  viewToBookingRate: number | null;
  bookingToPaidRate: number | null;
  bookingToCompletedRate: number | null;
}

export interface MentorTrafficPoint {
  key?: string;
  label?: string;
  date: string;
  views: number;
  bookings: number;
  revenue: number;
}

export interface MentorCoursePerformance {
  courseId: string;
  title: string;
  category: string;
  status: string;
  views: number;
  saves: number;
  bookings: number;
  pendingBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenue: number;
  platformFee: number;
  netRevenue: number;
  conversionRate: number | null;
  rating: number;
  reviewCount: number;
  studentsCount: number;
  benchmarkLabel: string;
}

export interface MentorDashboardInsight {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning" | "success";
}

export interface MentorDashboardAnalytics {
  allTime: MentorDashboardAllTime;
  period: {
    periodDays: MentorDashboardPeriod;
    totalViews: number;
    totalSaves: number;
    totalBookings: number;
    totalNetRevenue: number;
    totalPlatformFee: number;
    viewToBookingRate: number | null;
    bookingToPaidRate: number | null;
    bookingToCompletedRate: number | null;
    revenue: MentorDashboardRevenue;
    conversionFunnel: MentorConversionFunnel;
    bookingStatus: MentorDashboardBookingStatus;
    trafficSeries: MentorTrafficPoint[];
    coursePerformance: MentorCoursePerformance[];
    topCourses: MentorCoursePerformance[];
    insights: MentorDashboardInsight[];
  };
  wallet: MentorDashboardWallet;
  advancedUnavailable?: boolean;
}

type CourseRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  rating: number | null;
  review_count: number | null;
  students_count: number | null;
};

type BookingRow = {
  id: string;
  course_id: string;
  status: "pending" | "upcoming" | "completed" | "cancelled" | "declined";
  created_at: string;
};

type TransactionRow = {
  id: string;
  course_id: string | null;
  status: string;
  amount: number | null;
  net_amount: number | null;
  platform_fee: number | null;
  created_at: string;
};

type WalletRow = {
  balance: number | null;
  held_balance: number | null;
  total_earned: number | null;
};

type WithdrawalRow = {
  amount: number | null;
  status: "pending" | "paid" | "rejected";
};

type ViewEventRow = {
  course_id: string;
  event_date?: string | null;
  created_at?: string | null;
  viewed_at?: string | null;
};

const EMPTY_STATUS: MentorDashboardBookingStatus = {
  pending: 0,
  upcoming: 0,
  completed: 0,
  cancelled: 0,
  declined: 0,
};

const NO_BENCHMARK = "Chưa đủ dữ liệu so sánh";
const ALL_TIME_SAVED_COUNT_DAYS = 36_500;

export function createEmptyMentorAnalytics(): MentorDashboardAnalytics {
  return {
    allTime: {
      totalViews: 0,
      totalSaves: 0,
      totalBookings: 0,
      totalNetRevenue: 0,
      totalPlatformFee: 0,
      avgRating: null,
      reviewCount: 0,
      activeCourses: 0,
      pendingCourses: 0,
      viewToBookingRate: null,
    },
    period: {
      periodDays: 30,
      totalViews: 0,
      totalSaves: 0,
      totalBookings: 0,
      totalNetRevenue: 0,
      totalPlatformFee: 0,
      viewToBookingRate: null,
      bookingToPaidRate: null,
      bookingToCompletedRate: null,
      revenue: {
        periodNetRevenue: 0,
        periodPlatformFee: 0,
        periodGrossRevenue: 0,
        lifetimeNetRevenue: 0,
      },
      conversionFunnel: {
        totalViews: 0,
        totalSaves: 0,
        totalBookings: 0,
        successfulTransactions: 0,
        completedBookings: 0,
        viewToSaveRate: null,
        viewToBookingRate: null,
        bookingToPaidRate: null,
        bookingToCompletedRate: null,
      },
      bookingStatus: { ...EMPTY_STATUS },
      trafficSeries: [],
      coursePerformance: [],
      topCourses: [],
      insights: [],
    },
    wallet: {
      balance: 0,
      heldBalance: 0,
      totalEarned: 0,
      pendingWithdrawal: 0,
      paidWithdrawal: 0,
      walletReconciled: true,
      reconciliationDelta: 0,
    },
  };
}

function getPeriodStart(periodDays: MentorDashboardPeriod) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - periodDays + 1);
  return start;
}

function getPeriodEnd() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function safeRate(part: number, total: number) {
  if (total <= 0) return null;
  return Number(((part / total) * 100).toFixed(1));
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function createTrafficPoint(key: string, label: string): MentorTrafficPoint {
  return { key, label, date: label, views: 0, bookings: 0, revenue: 0 };
}

function getAggregatedTrafficBucket(
  dateLike: string | Date | null | undefined,
  periodDays: MentorDashboardPeriod,
  periodStart: Date,
) {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) return { key: "", label: "" };

  if (periodDays > 90) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const [year, month] = key.split("-");
    return { key, label: `${month}/${year}` };
  }

  if (periodDays === 30) {
    const diffDays = Math.max(0, Math.floor((startOfDay(date).getTime() - startOfDay(periodStart).getTime()) / 86_400_000));
    const weekIndex = Math.min(4, Math.floor(diffDays / 8) + 1);
    const key = `week-${weekIndex}`;
    return { key, label: `Tuần ${weekIndex}` };
  }

  if (periodDays > 30) {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + periodDays - 1);
    const cappedEnd = weekEnd > periodEnd ? periodEnd : weekEnd;
    const key = weekStart.toISOString().slice(0, 10);
    return { key, label: `${formatShortDate(weekStart)} - ${formatShortDate(cappedEnd)}` };
  }

  const key = date.toISOString().slice(0, 10);
  return { key, label: formatShortDate(date) };
}

function createAggregatedTrafficBuckets(periodDays: MentorDashboardPeriod): Map<string, MentorTrafficPoint> {
  const buckets = new Map<string, MentorTrafficPoint>();
  const now = new Date();
  const periodStart = getPeriodStart(periodDays);

  if (periodDays > 90) {
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const bucket = getAggregatedTrafficBucket(date, periodDays, periodStart);
      buckets.set(bucket.key, createTrafficPoint(bucket.key, bucket.label));
    }
    return buckets;
  }

  if (periodDays === 30) {
    for (let index = 1; index <= 4; index += 1) {
      const key = `week-${index}`;
      buckets.set(key, createTrafficPoint(key, `Tuần ${index}`));
    }
    return buckets;
  }

  if (periodDays > 30) {
    const weekStarts: Date[] = [];
    let cursor = getWeekStart(periodStart);
    const currentWeek = getWeekStart(now);
    while (cursor <= currentWeek) {
      weekStarts.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    for (const date of weekStarts.slice(-13)) {
      const bucket = getAggregatedTrafficBucket(date, periodDays, periodStart);
      buckets.set(bucket.key, createTrafficPoint(bucket.key, bucket.label));
    }
    return buckets;
  }

  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const bucket = getAggregatedTrafficBucket(date, periodDays, periodStart);
    buckets.set(bucket.key, createTrafficPoint(bucket.key, bucket.label));
  }

  return buckets;
}

async function callPeriodRpc(functionName: string, periodDays: number) {
  const typedClient = supabase as any;
  const first = await typedClient.rpc(functionName, { _period_days: periodDays });
  if (!first.error) return first.data ?? [];

  const message = `${first.error.message ?? ""} ${first.error.details ?? ""}`.toLowerCase();
  if (message.includes("_period_days") || message.includes("schema cache") || message.includes("function")) {
    const fallback = await typedClient.rpc(functionName, { period_days: periodDays });
    if (!fallback.error) return fallback.data ?? [];
  }

  throw first.error;
}

async function fetchCourseViews(
  typedClient: any,
  userId: string,
  range?: { startDate: string; endDate: string; startIso: string; endIso: string },
): Promise<ViewEventRow[]> {
  let eventDateQuery = typedClient
    .from("course_view_events")
    .select("id,course_id,mentor_id,event_date,created_at")
    .eq("mentor_id", userId);

  if (range) {
    eventDateQuery = eventDateQuery.gte("event_date", range.startDate).lte("event_date", range.endDate);
  }

  const byEventDate = await eventDateQuery;

  console.log("viewEvents", byEventDate.data ?? []);
  console.log("viewEventsError", byEventDate.error ?? null);

  if (!byEventDate.error) return (byEventDate.data ?? []) as ViewEventRow[];

  const eventDateErrorText = `${byEventDate.error.message ?? ""} ${byEventDate.error.details ?? ""} ${byEventDate.error.hint ?? ""}`.toLowerCase();
  const canFallbackToCreatedAt =
    eventDateErrorText.includes("event_date") ||
    eventDateErrorText.includes("schema cache") ||
    eventDateErrorText.includes("could not find");

  if (!canFallbackToCreatedAt) {
    console.warn("course_view_events query failed", byEventDate.error);
    throw byEventDate.error;
  }

  console.warn("course_view_events event_date query failed, falling back to created_at", byEventDate.error);

  let createdAtQuery = typedClient
    .from("course_view_events")
    .select("id,course_id,mentor_id,created_at")
    .eq("mentor_id", userId);

  if (range) {
    createdAtQuery = createdAtQuery.gte("created_at", range.startIso).lte("created_at", range.endIso);
  }

  const byCreatedAt = await createdAtQuery;

  if (byCreatedAt.error) {
    console.warn("course_view_events created_at query failed", byCreatedAt.error);
    throw byCreatedAt.error;
  }

  return (byCreatedAt.data ?? []) as ViewEventRow[];
}

function getViewEventDate(view: ViewEventRow) {
  return view.event_date ?? view.created_at ?? view.viewed_at;
}

function optionalValue<T>(result: PromiseSettledResult<T>, fallback: T, label: string) {
  if (result.status === "fulfilled") return result.value;
  console.warn("optional analytics failed", { source: label, error: result.reason });
  return fallback;
}

function readCourseId(row: Record<string, unknown>) {
  return String(row.course_id ?? row.courseId ?? row.id ?? "");
}

function readSaveCount(row: Record<string, unknown>) {
  return toNumber(row.save_count ?? row.saved_count ?? row.total_saves ?? row.count ?? row.saves);
}

function readBenchmarkLabel(row: Record<string, unknown>) {
  return String(row.benchmark_label ?? row.benchmarkLabel ?? row.label ?? row.comparison_label ?? NO_BENCHMARK);
}

function buildInsights(courses: MentorCoursePerformance[], status: MentorDashboardBookingStatus): MentorDashboardInsight[] {
  const insights: MentorDashboardInsight[] = [];
  const totalViews = courses.reduce((sum, course) => sum + course.views, 0);
  const totalBookings = Object.values(status).reduce((sum, value) => sum + value, 0);

  if (courses.length > 0 && totalViews === 0 && totalBookings > 0) {
    insights.push({
      id: "booking-without-view-tracking",
      title: "Có booking nhưng chưa có dữ liệu lượt xem",
      description: "Có thể các booking này được tạo trước khi hệ thống bắt đầu ghi nhận lượt xem. Khi có thêm lượt xem mới, tỷ lệ chuyển đổi sẽ rõ hơn.",
      tone: "info",
    });
  }

  if (courses.length > 0 && totalViews === 0 && totalBookings === 0) {
    insights.push({
      id: "no-views",
      title: "Chưa có lượt xem trong kỳ này",
      description: "Hãy kiểm tra ảnh đại diện, tiêu đề khóa học và mô tả ngắn để khóa học dễ được học viên chú ý hơn.",
      tone: "info",
    });
  }

  const highViewLowBooking = courses.find(
    (course) => course.views >= 10 && course.conversionRate !== null && course.conversionRate < 5,
  );
  if (highViewLowBooking) {
    insights.push({
      id: "high-view-low-booking",
      title: "Lượt xem cao nhưng booking còn thấp",
      description: `${highViewLowBooking.title} có nhiều lượt xem nhưng tỷ lệ booking thấp. Hãy kiểm tra mô tả, giá hoặc lịch học.`,
      tone: "warning",
    });
  }

  const highSaveLowBooking = courses.find((course) => course.saves >= 3 && course.bookings === 0);
  if (highSaveLowBooking) {
    insights.push({
      id: "high-save-low-booking",
      title: "Nhiều lượt lưu nhưng chưa chuyển đổi",
      description: `${highSaveLowBooking.title} đang được học viên quan tâm. Có thể cân nhắc ưu đãi, lịch học rõ hơn hoặc CTA mạnh hơn.`,
      tone: "info",
    });
  }

  if (status.pending >= 3 || (totalBookings > 0 && status.pending / totalBookings >= 0.35)) {
    insights.push({
      id: "pending-bookings",
      title: "Nhiều booking đang chờ xác nhận",
      description: "Hãy phản hồi booking sớm để giảm rủi ro học viên đổi ý hoặc đặt lịch với mentor khác.",
      tone: "warning",
    });
  }

  if (totalBookings > 0 && status.cancelled / totalBookings >= 0.25 && status.cancelled >= 2) {
    insights.push({
      id: "cancelled-bookings",
      title: "Tỷ lệ hủy lịch đang cao",
      description: "Hãy xem lại lịch dạy, quy trình xác nhận hoặc trao đổi trước buổi học để giảm hủy lịch.",
      tone: "warning",
    });
  }

  const bestCourse = [...courses].sort((a, b) => b.revenue - a.revenue)[0];
  if (bestCourse?.revenue > 0) {
    insights.push({
      id: "best-course",
      title: "Khóa học hiệu quả nhất",
      description: `${bestCourse.title} đang tạo doanh thu tốt nhất trong kỳ này. Bạn có thể dùng mô tả/lịch học của khóa này làm mẫu cho các khóa khác.`,
      tone: "success",
    });
  }

  return insights;
}

async function fetchMentorDashboardAnalytics(
  userId: string,
  periodDays: MentorDashboardPeriod,
): Promise<MentorDashboardAnalytics> {
  const periodStartDate = getPeriodStart(periodDays);
  const periodEndDate = getPeriodEnd();
  const periodStart = periodStartDate.toISOString();
  const periodEnd = periodEndDate.toISOString();
  const periodRange = {
    startDate: toDateString(periodStartDate),
    endDate: toDateString(periodEndDate),
    startIso: periodStart,
    endIso: periodEnd,
  };
  const typedClient = supabase as any;

  const [
    coursesResult,
    allBookingsResult,
    periodBookingsResult,
    allTransactionsResult,
    periodTransactionsResult,
    walletResult,
    withdrawalsResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("mentor_id", userId),
    supabase
      .from("bookings")
      .select("*")
      .eq("mentor_id", userId),
    supabase
      .from("bookings")
      .select("*")
      .eq("mentor_id", userId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
    supabase
      .from("transactions")
      .select("*")
      .eq("mentor_id", userId),
    supabase
      .from("transactions")
      .select("*")
      .eq("mentor_id", userId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd),
    supabase
      .from("mentor_wallets")
      .select("*")
      .eq("mentor_id", userId)
      .maybeSingle(),
    supabase
      .from("withdrawal_requests")
      .select("amount,status")
      .eq("mentor_id", userId),
  ]);

  const coreError =
    coursesResult.error ??
    allBookingsResult.error ??
    periodBookingsResult.error ??
    allTransactionsResult.error ??
    periodTransactionsResult.error ??
    walletResult.error ??
    withdrawalsResult.error;
  if (coreError) {
    console.error("Mentor analytics core error:", coreError);
    throw new Error("Không thể tải dữ liệu tổng quan. Vui lòng thử lại.");
  }

  const courses = (coursesResult.data ?? []) as CourseRow[];
  const allBookings = (allBookingsResult.data ?? []) as BookingRow[];
  const periodBookings = (periodBookingsResult.data ?? []) as BookingRow[];
  const allTransactions = (allTransactionsResult.data ?? []) as TransactionRow[];
  const periodTransactions = (periodTransactionsResult.data ?? []) as TransactionRow[];
  const wallet = walletResult.data as WalletRow | null;
  const withdrawals = (withdrawalsResult.data ?? []) as WithdrawalRow[];

  const [allViewsResult, periodViewsResult, allSavedCountsResult, periodSavedCountsResult, benchmarksResult] = await Promise.allSettled([
    fetchCourseViews(typedClient, userId),
    fetchCourseViews(typedClient, userId, periodRange),
    callPeriodRpc("get_mentor_saved_counts", ALL_TIME_SAVED_COUNT_DAYS),
    callPeriodRpc("get_mentor_saved_counts", periodDays),
    callPeriodRpc("get_mentor_category_benchmarks", periodDays),
  ]);

  const allViews = optionalValue(allViewsResult, [] as ViewEventRow[], "course_view_events:all_time");
  const periodViews = optionalValue(periodViewsResult, [] as ViewEventRow[], "course_view_events:period");
  const allSavedCounts = optionalValue(allSavedCountsResult, [] as Record<string, unknown>[], "get_mentor_saved_counts:all_time");
  const periodSavedCounts = optionalValue(periodSavedCountsResult, [] as Record<string, unknown>[], "get_mentor_saved_counts:period");
  const benchmarks = optionalValue(benchmarksResult, [] as Record<string, unknown>[], "get_mentor_category_benchmarks");
  const advancedUnavailable =
    allViewsResult.status === "rejected" ||
    periodViewsResult.status === "rejected" ||
    allSavedCountsResult.status === "rejected" ||
    periodSavedCountsResult.status === "rejected" ||
    benchmarksResult.status === "rejected";

  const allSavesByCourse = new Map<string, number>();
  for (const row of (allSavedCounts ?? []) as Record<string, unknown>[]) {
    const courseId = readCourseId(row);
    if (courseId) allSavesByCourse.set(courseId, readSaveCount(row));
  }

  const periodSavesByCourse = new Map<string, number>();
  for (const row of (periodSavedCounts ?? []) as Record<string, unknown>[]) {
    const courseId = readCourseId(row);
    if (courseId) periodSavesByCourse.set(courseId, readSaveCount(row));
  }
  for (const [courseId, periodCount] of periodSavesByCourse.entries()) {
    allSavesByCourse.set(courseId, Math.max(allSavesByCourse.get(courseId) ?? 0, periodCount));
  }

  const benchmarkByCourse = new Map<string, string>();
  const benchmarkByCategory = new Map<string, string>();
  for (const row of (benchmarks ?? []) as Record<string, unknown>[]) {
    const label = readBenchmarkLabel(row);
    const courseId = readCourseId(row);
    const category = row.category ? normalizeCourseCategory(String(row.category)) : "";
    if (courseId) benchmarkByCourse.set(courseId, label);
    if (category) benchmarkByCategory.set(category, label);
  }

  const statusCounts = periodBookings.reduce<MentorDashboardBookingStatus>(
    (acc, booking) => {
      acc[booking.status] += 1;
      return acc;
    },
    { ...EMPTY_STATUS },
  );

  const allSuccessfulTransactions = allTransactions.filter((transaction) => transaction.status === "success");
  const periodSuccessfulTransactions = periodTransactions.filter((transaction) => transaction.status === "success");
  const allTotalViews = Math.max(allViews.length, periodViews.length);
  const periodTotalViews = periodViews.length;
  const allTotalBookings = allBookings.length;
  const periodTotalBookings = periodBookings.length;
  const allTotalSaves = Array.from(allSavesByCourse.values()).reduce((sum, count) => sum + count, 0);
  const periodTotalSaves = Array.from(periodSavesByCourse.values()).reduce((sum, count) => sum + count, 0);
  const completedBookings = statusCounts.completed;
  const allRevenue = allSuccessfulTransactions.reduce((sum, transaction) => sum + toNumber(transaction.net_amount), 0);
  const allPlatformFee = allSuccessfulTransactions.reduce((sum, transaction) => sum + toNumber(transaction.platform_fee), 0);
  const periodRevenue = periodSuccessfulTransactions.reduce((sum, transaction) => sum + toNumber(transaction.net_amount), 0);
  const periodGrossRevenue = periodSuccessfulTransactions.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const periodPlatformFee = periodSuccessfulTransactions.reduce((sum, transaction) => sum + toNumber(transaction.platform_fee), 0);
  const walletBalance = toNumber(wallet?.balance);
  const walletHeldBalance = toNumber(wallet?.held_balance);
  const walletTotalEarned = toNumber(wallet?.total_earned);
  const pendingWithdrawal = withdrawals
    .filter((withdrawal) => withdrawal.status === "pending")
    .reduce((sum, withdrawal) => sum + toNumber(withdrawal.amount), 0);
  const paidWithdrawal = withdrawals
    .filter((withdrawal) => withdrawal.status === "paid")
    .reduce((sum, withdrawal) => sum + toNumber(withdrawal.amount), 0);
  const walletAllocated = walletBalance + walletHeldBalance + pendingWithdrawal + paidWithdrawal;
  const reconciliationDelta = walletTotalEarned - walletAllocated;
  const walletReconciled = Math.abs(reconciliationDelta) <= 1;
  const reviewCount = courses.reduce((sum, course) => sum + toNumber(course.review_count), 0);
  const ratedCourses = courses.filter((course) => toNumber(course.review_count) > 0);
  const avgRating = ratedCourses.length
    ? Number((ratedCourses.reduce((sum, course) => sum + toNumber(course.rating), 0) / ratedCourses.length).toFixed(1))
    : null;

  const periodViewsByCourse = new Map<string, number>();
  for (const view of periodViews) {
    periodViewsByCourse.set(view.course_id, (periodViewsByCourse.get(view.course_id) ?? 0) + 1);
  }

  const bookingsByCourse = new Map<string, BookingRow[]>();
  for (const booking of periodBookings) {
    const courseBookings = bookingsByCourse.get(booking.course_id) ?? [];
    courseBookings.push(booking);
    bookingsByCourse.set(booking.course_id, courseBookings);
  }

  const transactionsByCourse = new Map<string, TransactionRow[]>();
  for (const transaction of periodSuccessfulTransactions) {
    if (!transaction.course_id) continue;
    const courseTransactions = transactionsByCourse.get(transaction.course_id) ?? [];
    courseTransactions.push(transaction);
    transactionsByCourse.set(transaction.course_id, courseTransactions);
  }

  const trafficBuckets = createAggregatedTrafficBuckets(periodDays);
  const trafficPeriodStart = getPeriodStart(periodDays);
  for (const view of periodViews) {
    const timeBucket = getAggregatedTrafficBucket(getViewEventDate(view), periodDays, trafficPeriodStart);
    const bucket = trafficBuckets.get(timeBucket.key);
    if (bucket) bucket.views += 1;
  }
  for (const booking of periodBookings) {
    const timeBucket = getAggregatedTrafficBucket(booking.created_at, periodDays, trafficPeriodStart);
    const bucket = trafficBuckets.get(timeBucket.key);
    if (bucket) bucket.bookings += 1;
  }
  for (const transaction of periodSuccessfulTransactions) {
    const timeBucket = getAggregatedTrafficBucket(transaction.created_at, periodDays, trafficPeriodStart);
    const bucket = trafficBuckets.get(timeBucket.key);
    if (bucket) bucket.revenue += toNumber(transaction.net_amount);
  }

  const coursePerformance = courses.map<MentorCoursePerformance>((course) => {
    const courseBookings = bookingsByCourse.get(course.id) ?? [];
    const courseTransactions = transactionsByCourse.get(course.id) ?? [];
    const viewsCount = periodViewsByCourse.get(course.id) ?? 0;
    const category = normalizeCourseCategory(course.category);
    const courseRevenue = courseTransactions.reduce((sum, transaction) => sum + toNumber(transaction.net_amount), 0);
    const coursePlatformFee = courseTransactions.reduce((sum, transaction) => sum + toNumber(transaction.platform_fee), 0);

    return {
      courseId: course.id,
      title: course.title,
      category: getCourseCategoryLabel(category),
      status: course.status,
      views: viewsCount,
      saves: periodSavesByCourse.get(course.id) ?? 0,
      bookings: courseBookings.length,
      pendingBookings: courseBookings.filter((booking) => booking.status === "pending").length,
      upcomingBookings: courseBookings.filter((booking) => booking.status === "upcoming").length,
      completedBookings: courseBookings.filter((booking) => booking.status === "completed").length,
      cancelledBookings: courseBookings.filter((booking) => booking.status === "cancelled" || booking.status === "declined").length,
      revenue: courseRevenue,
      platformFee: coursePlatformFee,
      netRevenue: courseRevenue,
      conversionRate: safeRate(courseBookings.length, viewsCount),
      rating: toNumber(course.rating),
      reviewCount: toNumber(course.review_count),
      studentsCount: toNumber(course.students_count),
      benchmarkLabel: benchmarkByCourse.get(course.id) ?? benchmarkByCategory.get(category) ?? NO_BENCHMARK,
    };
  });

  const topCourses = [...coursePerformance]
    .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings || b.views - a.views)
    .slice(0, 5);

  return {
    allTime: {
      totalViews: allTotalViews,
      totalSaves: allTotalSaves,
      totalBookings: allTotalBookings,
      totalNetRevenue: allRevenue,
      totalPlatformFee: allPlatformFee,
      avgRating,
      reviewCount,
      activeCourses: courses.filter((course) => course.status === "approved").length,
      pendingCourses: courses.filter((course) => course.status === "pending").length,
      viewToBookingRate: safeRate(allTotalBookings, allTotalViews),
    },
    period: {
      periodDays,
      totalViews: periodTotalViews,
      totalSaves: periodTotalSaves,
      totalBookings: periodTotalBookings,
      totalNetRevenue: periodRevenue,
      totalPlatformFee: periodPlatformFee,
      viewToBookingRate: safeRate(periodTotalBookings, periodTotalViews),
      bookingToPaidRate: safeRate(periodSuccessfulTransactions.length, periodTotalBookings),
      bookingToCompletedRate: safeRate(completedBookings, periodTotalBookings),
      revenue: {
        periodNetRevenue: periodRevenue,
        periodPlatformFee,
        periodGrossRevenue,
        lifetimeNetRevenue: walletTotalEarned,
      },
      conversionFunnel: {
        totalViews: periodTotalViews,
        totalSaves: periodTotalSaves,
        totalBookings: periodTotalBookings,
        successfulTransactions: periodSuccessfulTransactions.length,
        completedBookings,
        viewToSaveRate: safeRate(periodTotalSaves, periodTotalViews),
        viewToBookingRate: safeRate(periodTotalBookings, periodTotalViews),
        bookingToPaidRate: safeRate(periodSuccessfulTransactions.length, periodTotalBookings),
        bookingToCompletedRate: safeRate(completedBookings, periodTotalBookings),
      },
      bookingStatus: statusCounts,
      trafficSeries: Array.from(trafficBuckets.values()),
      coursePerformance,
      topCourses,
      insights: buildInsights(coursePerformance, statusCounts),
    },
    wallet: {
      balance: walletBalance,
      heldBalance: walletHeldBalance,
      totalEarned: walletTotalEarned,
      pendingWithdrawal,
      paidWithdrawal,
      walletReconciled,
      reconciliationDelta,
    },
    advancedUnavailable,
  };
}

export function useMentorDashboardAnalytics(periodDays: MentorDashboardPeriod) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["mentor-dashboard-analytics", userId, periodDays],
    enabled: !!userId,
    queryFn: () => fetchMentorDashboardAnalytics(userId!, periodDays),
  });
}
