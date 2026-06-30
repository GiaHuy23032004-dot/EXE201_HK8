import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type DashboardRange = "30d" | "1y";
type Granularity = "week" | "month";

type SerializedError = Record<string, unknown> & {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type MetricWarning = {
  metric: string;
  error: SerializedError;
};

type MetricFailure = {
  stage: "metrics_query";
  metric: string;
  error: SerializedError;
};

type Bucket = {
  bucketKey: string;
  label: string;
  start: Date;
  end: Date;
  gmv: number;
  platformFee: number;
  total: number;
  completed: number;
};

type AnalyticsEventRow = {
  event_type: string;
  user_id: string | null;
  visitor_id: string | null;
  created_at: string;
};

const VALID_RANGES: DashboardRange[] = ["30d", "1y"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const serializeError = (err: unknown): SerializedError => {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }

  if (typeof err === "object" && err !== null) {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {
      return {
        message: String(err),
        rawType: typeof err,
      };
    }
  }

  return {
    message: String(err),
    rawType: typeof err,
  };
};

const getErrorMessage = (err: unknown) => {
  const serialized = serializeError(err);
  if (typeof serialized.message === "string" && serialized.message.trim()) return serialized.message;
  if (typeof serialized.code === "string" && serialized.code.trim()) return serialized.code;
  return "KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c lá»—i metric.";
};

const jsonError = (
  error: string,
  stage: string,
  status = 500,
  extra: Record<string, unknown> = {},
) => json({ success: false, error, stage, ...extra }, status);

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toIso = (date: Date) => date.toISOString();

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);
const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthLabel = (date: Date) => `T${date.getMonth() + 1}`;

const isMissingSourceError = (error: unknown) => {
  const serialized = serializeError(error);
  const text = [serialized.code, serialized.message, serialized.details, serialized.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("42p01") ||
    text.includes("42703") ||
    text.includes("pgrst204") ||
    text.includes("pgrst205") ||
    text.includes("does not exist") ||
    text.includes("could not find")
  );
};

const assertNoSupabaseError = (label: string, error: unknown) => {
  if (error) {
    throw {
      label,
      ...serializeError(error),
    };
  }
};

const normalizeRange = (value: unknown): DashboardRange =>
  VALID_RANGES.includes(value as DashboardRange) ? (value as DashboardRange) : "30d";

const getRangeConfig = (range: DashboardRange, now: Date) => {
  const tomorrow = addDays(startOfDay(now), 1);

  if (range === "30d") {
    return { start: addDays(tomorrow, -30), end: tomorrow, granularity: "week" as Granularity };
  }

  const currentMonthStart = new Date(now.getFullYear(), 0, 1);
  return {
    start: currentMonthStart,
    end: addMonths(currentMonthStart, 12),
    granularity: "month" as Granularity,
  };
};

const buildBuckets = (start: Date, end: Date, granularity: Granularity): Bucket[] => {
  const buckets: Bucket[] = [];

  if (granularity === "week") {
    let index = 1;
    for (let cursor = startOfDay(start); cursor < end; cursor = addDays(cursor, 7)) {
      const next = addDays(cursor, 7) < end ? addDays(cursor, 7) : end;
      const daysInBucket = Math.max(1, Math.round((next.getTime() - cursor.getTime()) / 86_400_000));
      buckets.push({
        bucketKey: `${getDateKey(cursor)}_${getDateKey(addDays(next, -1))}`,
        label: daysInBucket < 7 ? "Tuần hiện tại" : `Tuần ${index}`,
        start: cursor,
        end: next,
        gmv: 0,
        platformFee: 0,
        total: 0,
        completed: 0,
      });
      index += 1;
    }
    return buckets;
  }

  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor < end; cursor = addMonths(cursor, 1)) {
    const next = addMonths(cursor, 1);
    buckets.push({
      bucketKey: getMonthKey(cursor),
      label: formatMonthLabel(cursor),
      start: cursor,
      end: next,
      gmv: 0,
      platformFee: 0,
      total: 0,
      completed: 0,
    });
  }

  return buckets;
};

const findBucket = (buckets: Bucket[], value: unknown) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return buckets.find((bucket) => date >= bucket.start && date < bucket.end) ?? null;
};

const sortNewest = <T extends { created_at: string }>(rows: T[], count = 8) =>
  [...rows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, count);

const conversion = (
  key: string,
  label: string,
  numerator: number,
  denominator: number,
  helper: string,
) => ({
  key,
  label,
  numerator,
  denominator,
  rate: denominator > 0 ? numerator / denominator : null,
  helper,
});

const trafficConversion = (
  key: string,
  from: string,
  to: string,
  numerator: number,
  denominator: number,
) => ({
  key,
  from,
  to,
  numerator,
  denominator,
  rate: denominator > 0 ? numerator / denominator : null,
});

const getFirstLastCreatedAt = (rows: Array<{ created_at?: unknown }>) => {
  const sorted = rows
    .map((row) => String(row.created_at ?? ""))
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    first: sorted[0] ?? null,
    last: sorted[sorted.length - 1] ?? null,
  };
};

const uniqueActorCount = (rows: AnalyticsEventRow[], eventType: string) =>
  new Set(
    rows
      .filter((row) => row.event_type === eventType)
      .map((row) => row.user_id ?? row.visitor_id)
      .filter(Boolean),
  ).size;

const eventCount = (rows: AnalyticsEventRow[], eventType: string) =>
  rows.filter((row) => row.event_type === eventType).length;

const uniqueActorOrEventCount = (rows: AnalyticsEventRow[], eventType: string) => {
  const uniqueCount = uniqueActorCount(rows, eventType);
  return uniqueCount > 0 ? uniqueCount : eventCount(rows, eventType);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let stage = "init";

  try {
    stage = "auth";
    const jwt = getBearerToken(req);
    if (!jwt) {
      return jsonError("Missing authorization token", stage, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonError("Server env not configured", stage, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    const currentUser = userData.user;

    if (userError || !currentUser) {
      console.error("admin-dashboard-metrics auth error", serializeError(userError));
      return jsonError("Invalid authorization token", stage, 401, {
        details: userError ? serializeError(userError) : null,
      });
    }

    stage = "admin_check";
    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) {
      console.error("admin-dashboard-metrics admin role lookup error", serializeError(adminRoleError));
      return jsonError("Admin role lookup failed", stage, 500, {
        details: serializeError(adminRoleError),
      });
    }

    if (adminRole?.role !== "admin") {
      return jsonError("Forbidden", stage, 403);
    }

    stage = "parse_body";
    let body: Record<string, unknown> = {};
    try {
      body = req.method === "GET" ? {} : await req.json();
    } catch {
      body = {};
    }

    const range = normalizeRange(body.range);
    const now = new Date();
    const { start: rangeStart, end: rangeEnd, granularity } = getRangeConfig(range, now);
    const buckets = buildBuckets(rangeStart, rangeEnd, granularity);

    stage = "metrics_query";
    const warnings: MetricWarning[] = [];

    const runMetric = async <T>(
      label: string,
      fn: () => Promise<T>,
      options?: { optional?: boolean; fallback?: T },
    ): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        const serialized = serializeError(err);
        console.error(`[admin-dashboard-metrics] metric failed: ${label}`, serialized);

        if (options?.optional) {
          warnings.push({ metric: label, error: serialized });
          return options.fallback as T;
        }

        throw {
          stage: "metrics_query",
          metric: label,
          error: serialized,
        } satisfies MetricFailure;
      }
    };

    const countMetric = (label: string, table: string, apply?: (query: any) => any) =>
      runMetric(label, async () => {
        const baseQuery = adminClient.from(table).select("*", { count: "exact", head: true });
        const query = apply ? apply(baseQuery) : baseQuery;
        const { count, error } = await query;
        assertNoSupabaseError(label, error);
        return count ?? 0;
      });

    const fetchRows = <T>(
      label: string,
      table: string,
      select: string,
      apply?: (query: any) => any,
      options?: { optional?: boolean; fallback?: T[] },
    ) =>
      runMetric<T[]>(label, async () => {
        const baseQuery = adminClient.from(table).select(select);
        const query = apply ? apply(baseQuery) : baseQuery;
        const { data, error } = await query;
        assertNoSupabaseError(label, error);
        return (data ?? []) as T[];
      }, options);

    const tableExists = (tableName: string) =>
      runMetric(`optional table exists:${tableName}`, async () => {
        const { error } = await adminClient
          .from(tableName)
          .select("*", { count: "exact", head: true })
          .limit(1);
        if (!error) return true;
        if (isMissingSourceError(error)) return false;
        assertNoSupabaseError(`table exists ${tableName}`, error);
        return false;
      }, { optional: true, fallback: false });

    const columnExists = (tableName: string, columnName: string) =>
      runMetric(`optional column exists:${tableName}.${columnName}`, async () => {
        const { error } = await adminClient
          .from(tableName)
          .select(columnName, { count: "exact", head: true })
          .limit(1);
        if (!error) return true;
        if (isMissingSourceError(error)) return false;
        assertNoSupabaseError(`column exists ${tableName}.${columnName}`, error);
        return false;
      }, { optional: true, fallback: false });

    const [
      hasBookingsUpdatedAt,
      hasBookingsCompletedAt,
      hasTransactionsPlatformFee,
      hasCoursesHidden,
      hasMentorVerifications,
      hasLearnerSubscriptions,
      hasAiUsageLogs,
      hasAnalyticsEvents,
    ] = await Promise.all([
      columnExists("bookings", "updated_at"),
      columnExists("bookings", "completed_at"),
      columnExists("transactions", "platform_fee"),
      columnExists("courses", "is_hidden"),
      tableExists("mentor_verifications"),
      tableExists("learner_subscriptions"),
      tableExists("ai_usage_logs"),
      tableExists("analytics_events"),
    ]);

    const addOptionalWarning = (metric: string, message: string) => {
      warnings.push({ metric, error: { message } });
    };

    if (!hasBookingsUpdatedAt) addOptionalWarning("bookings.updated_at", "Optional column missing. completed booking metrics use created_at fallback.");
    if (!hasBookingsCompletedAt) addOptionalWarning("bookings.completed_at", "Optional column missing. completed booking metrics use updated_at/created_at fallback.");
    if (!hasTransactionsPlatformFee) addOptionalWarning("transactions.platform_fee", "Optional column missing. Platform fee metrics return 0.");
    if (!hasCoursesHidden) addOptionalWarning("courses.is_hidden", "Optional column missing. Hidden-course risk metric returns null.");
    if (!hasMentorVerifications) addOptionalWarning("mentor_verifications", "Optional table missing. Mentor verification pending metric returns null.");
    if (!hasLearnerSubscriptions) addOptionalWarning("learner_subscriptions", "Optional table missing. VET Plus active metric returns null.");
    if (!hasAiUsageLogs) addOptionalWarning("ai_usage_logs", "Optional table missing. AI usage metric returns null.");
    if (!hasAnalyticsEvents) addOptionalWarning("analytics_events", "ChÆ°a cÃ³ dá»¯ liá»‡u tracking.");

    const bookingCompletionColumn = hasBookingsCompletedAt
      ? "completed_at"
      : hasBookingsUpdatedAt
        ? "updated_at"
        : "created_at";
    const completedBookingSelect = bookingCompletionColumn === "created_at"
      ? "created_at, status"
      : `${bookingCompletionColumn}, created_at, status`;
    const transactionSelect = `id, amount, status, reference_code, created_at${hasTransactionsPlatformFee ? ", platform_fee" : ""}`;

    const [
      totalUsers,
      newUsersInRange,
      totalLearners,
      totalMentors,
      totalCourses,
      approvedCourses,
      newCoursesInRange,
      pendingCourses,
      totalBookings,
      bookingsInRange,
      completedBookingRowsInRange,
      pendingReports,
      appealedReports,
      pendingWithdrawals,
      pendingWithdrawalRows,
      approvedCourseMentorRows,
      allBookingMentorRows,
      rangeBookingMentorRows,
      transactionRowsInRangeForRevenue,
      allTransactionsInRange,
      chartTransactionRows,
      chartBookings,
      chartCompletedBookings,
      highRiskStrikeRows,
      reviewsInRange,
      coursesCreatedInRange,
      reportsCreatedInRange,
      withdrawalsCreatedInRange,
    ] = await Promise.all([
      countMetric("totalUsers", "profiles"),
      countMetric("newUsersInRange", "profiles", (query) => query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))),
      countMetric("totalLearners", "profiles", (query) => query.eq("role", "learner")),
      countMetric("totalMentors", "profiles", (query) => query.eq("role", "mentor")),
      countMetric("totalCourses", "courses"),
      countMetric("approvedCourses", "courses", (query) => query.eq("status", "approved")),
      countMetric("newCoursesInRange", "courses", (query) => query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))),
      countMetric("pendingCourses", "courses", (query) => query.eq("status", "pending")),
      countMetric("totalBookings", "bookings"),
      countMetric("bookingsInRange", "bookings", (query) => query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))),
      fetchRows<Record<string, unknown>>("completedBookingsInRange", "bookings", completedBookingSelect, (query) =>
        query.gte(bookingCompletionColumn, toIso(rangeStart)).lt(bookingCompletionColumn, toIso(rangeEnd))
      ),
      countMetric("pendingReports", "reports", (query) => query.eq("status", "pending")),
      countMetric("appealedReports", "reports", (query) => query.eq("status", "appealed")),
      countMetric("pendingWithdrawals", "withdrawal_requests", (query) => query.eq("status", "pending")),
      fetchRows<{ amount: number | null }>("pendingWithdrawalAmount", "withdrawal_requests", "amount", (query) => query.eq("status", "pending")),
      fetchRows<{ mentor_id: string | null }>("activeMentors.approvedCourses", "courses", "mentor_id", (query) => query.eq("status", "approved").not("mentor_id", "is", null)),
      fetchRows<{ mentor_id: string | null; created_at: string }>("activeMentors.allBookings", "bookings", "mentor_id, created_at", (query) =>
        query.not("mentor_id", "is", null)
      ),
      fetchRows<{ mentor_id: string | null; created_at: string }>("activeMentors.rangeBookings", "bookings", "mentor_id, created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd)).not("mentor_id", "is", null)
      ),
      fetchRows<Record<string, unknown>>("gmvInRange", "transactions", transactionSelect, (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<Record<string, unknown>>("transactionsInRange", "transactions", transactionSelect, (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<Record<string, unknown>>("revenueChart", "transactions", transactionSelect, (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<{ created_at: string }>("bookingChart.total", "bookings", "created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<Record<string, unknown>>("bookingChart.completed", "bookings", completedBookingSelect, (query) =>
        query.gte(bookingCompletionColumn, toIso(rangeStart)).lt(bookingCompletionColumn, toIso(rangeEnd))
      ),
      fetchRows<{ mentor_id: string; level: number; expires_at: string | null }>("mentorStrikeHighRiskCount", "mentor_strikes", "mentor_id, level, expires_at", (query) => query.gte("level", 2)),
      fetchRows<{ id: string; created_at: string }>("reviewsInRange", "reviews", "id, created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<{ id: string; status: string; created_at: string }>("courseApprovalRate", "courses", "id, status, created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<{ id: string; status: string; created_at: string }>("reportResolutionRate", "reports", "id, status, created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
      fetchRows<{ id: string; status: string; amount: number | null; created_at: string }>("withdrawalProcessingRate", "withdrawal_requests", "id, status, amount, created_at", (query) =>
        query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd))
      ),
    ]);

    const allActiveMentorIds = new Set<string>();
    approvedCourseMentorRows.forEach((row) => {
      if (row.mentor_id) allActiveMentorIds.add(row.mentor_id);
    });

    const activeMentorIdsInRange = new Set<string>();
    allBookingMentorRows.forEach((row) => {
      if (row.mentor_id) {
        allActiveMentorIds.add(row.mentor_id);
      }
    });
    rangeBookingMentorRows.forEach((row) => {
      if (row.mentor_id) {
        activeMentorIdsInRange.add(row.mentor_id);
      }
    });

    const successfulTransactionsInRange = transactionRowsInRangeForRevenue.filter(
      (transaction) => String(transaction.status ?? "") === "success",
    );
    const chartTransactions = chartTransactionRows.filter(
      (transaction) => String(transaction.status ?? "") === "success",
    );
    const completedBookingRowsInRangeFiltered = completedBookingRowsInRange.filter(
      (booking) => String(booking.status ?? "") === "completed",
    );
    const chartCompletedBookingRows = chartCompletedBookings.filter(
      (booking) => String(booking.status ?? "") === "completed",
    );
    const completedBookingsInRange = completedBookingRowsInRangeFiltered.length;
    const gmvInRange = successfulTransactionsInRange.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const platformFeeInRange = hasTransactionsPlatformFee
      ? successfulTransactionsInRange.reduce((sum, transaction) => sum + toNumber(transaction.platform_fee), 0)
      : 0;
    const pendingWithdrawalAmount = pendingWithdrawalRows.reduce((sum, request) => sum + toNumber(request.amount), 0);

    const mentorStrikeHighRiskCount = new Set(
      highRiskStrikeRows
        .filter((strike) => !strike.expires_at || new Date(strike.expires_at) > now)
        .map((strike) => strike.mentor_id),
    ).size;

    chartTransactions.forEach((transaction) => {
      const bucket = findBucket(buckets, transaction.created_at);
      if (!bucket) return;
      bucket.gmv += toNumber(transaction.amount);
      bucket.platformFee += hasTransactionsPlatformFee ? toNumber(transaction.platform_fee) : 0;
    });

    chartBookings.forEach((booking) => {
      const bucket = findBucket(buckets, booking.created_at);
      if (!bucket) return;
      bucket.total += 1;
    });

    chartCompletedBookingRows.forEach((booking) => {
      const bucket = findBucket(buckets, booking[bookingCompletionColumn] ?? booking.created_at);
      if (!bucket) return;
      bucket.completed += 1;
    });

    const transactionRangeDebug = getFirstLastCreatedAt(successfulTransactionsInRange);
    const bookingRangeDebug = getFirstLastCreatedAt(chartBookings);
    const chartDebug = {
      successfulTransactionsInRange: successfulTransactionsInRange.length,
      bookingsInRange: chartBookings.length,
      firstTransactionCreatedAt: transactionRangeDebug.first,
      lastTransactionCreatedAt: transactionRangeDebug.last,
      firstBookingCreatedAt: bookingRangeDebug.first,
      lastBookingCreatedAt: bookingRangeDebug.last,
      rangeStart: toIso(rangeStart),
      rangeEnd: toIso(rangeEnd),
      granularity,
      bucketCount: buckets.length,
    };
    console.log("admin-dashboard-metrics chart debug", chartDebug);
    warnings.push({
      metric: "chart_data_debug",
      error: {
        message: "Chart source counts for selected range.",
        ...chartDebug,
      },
    });

    const successTransactions = successfulTransactionsInRange.length;
    const refundedTransactions = allTransactionsInRange.filter((transaction) => String(transaction.status) === "refunded").length;
    const approvedCoursesCreatedInRange = coursesCreatedInRange.filter((course) => course.status === "approved").length;
    const resolvedReportsInRange = reportsCreatedInRange.filter((report) => ["resolved", "dismissed"].includes(report.status)).length;
    const processedWithdrawalsInRange = withdrawalsCreatedInRange.filter((request) => ["paid", "rejected"].includes(request.status)).length;

    const pendingMentorVerificationCount = hasMentorVerifications
      ? await runMetric<number | null>("pendingMentorVerificationCount", async () => {
          const { count, error } = await adminClient
            .from("mentor_verifications")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending");
          assertNoSupabaseError("pendingMentorVerificationCount", error);
          return count ?? 0;
        }, { optional: true, fallback: null })
      : null;

    const hiddenCourseRiskCount = hasCoursesHidden
      ? await runMetric<number | null>("hiddenCourseRiskCount", async () => {
          const { count, error } = await adminClient
            .from("courses")
            .select("*", { count: "exact", head: true })
            .eq("is_hidden", true);
          assertNoSupabaseError("hiddenCourseRiskCount", error);
          return count ?? 0;
        }, { optional: true, fallback: null })
      : null;

    const activeVetPlusUsers = hasLearnerSubscriptions
      ? await runMetric<number | null>("activeVetPlusUsers", async () => {
          const { data, error } = await adminClient
            .from("learner_subscriptions")
            .select("status, plan_code, current_period_end, expires_at");
          assertNoSupabaseError("activeVetPlusUsers", error);
          return (data ?? []).filter((subscription: Record<string, unknown>) => {
            if (String(subscription.status ?? "") !== "active") return false;
            const planCode = String(subscription.plan_code ?? "").toLowerCase();
            if (planCode && planCode !== "vet_plus") return false;
            const endDateValue = subscription.current_period_end ?? subscription.expires_at;
            if (!endDateValue) return true;
            const endDate = new Date(String(endDateValue));
            return Number.isNaN(endDate.getTime()) || endDate > now;
          }).length;
        }, { optional: true, fallback: null })
      : null;

    const aiMessagesInRange = hasAiUsageLogs
      ? await runMetric<number | null>("aiMessagesInRange", async () => {
          const { count, error } = await adminClient
            .from("ai_usage_logs")
            .select("*", { count: "exact", head: true })
            .gte("created_at", toIso(rangeStart))
            .lt("created_at", toIso(rangeEnd));
          assertNoSupabaseError("aiMessagesInRange", error);
          return count ?? 0;
        }, { optional: true, fallback: null })
      : null;

    const analyticsRows = hasAnalyticsEvents
      ? await fetchRows<AnalyticsEventRow>(
          "analyticsEventsInRange",
          "analytics_events",
          "event_type, user_id, visitor_id, created_at",
          (query) => query.gte("created_at", toIso(rangeStart)).lt("created_at", toIso(rangeEnd)),
          { optional: true, fallback: [] },
        )
      : [];
    const hasTrafficData = hasAnalyticsEvents && analyticsRows.length > 0;

    const trafficFunnel = hasTrafficData
      ? [
          { key: "page_view", label: "Truy cap", count: uniqueActorOrEventCount(analyticsRows, "page_view") },
          { key: "search_submit", label: "Tim kiem", count: uniqueActorOrEventCount(analyticsRows, "search_submit") },
          { key: "course_view", label: "Xem khoa hoc", count: uniqueActorOrEventCount(analyticsRows, "course_view") },
          { key: "booking_start", label: "Bat dau dat lich", count: uniqueActorOrEventCount(analyticsRows, "booking_start") },
          { key: "booking_created", label: "Tao booking", count: uniqueActorOrEventCount(analyticsRows, "booking_created") },
          { key: "payment_success", label: "Thanh toan thanh cong", count: uniqueActorOrEventCount(analyticsRows, "payment_success") },
        ]
      : null;

    const getFunnelCount = (key: string) => trafficFunnel?.find((item) => item.key === key)?.count ?? 0;
    const trafficConversionRates = hasTrafficData
      ? [
          trafficConversion("search_per_visit", "Truy cap", "Tim kiem", getFunnelCount("search_submit"), getFunnelCount("page_view")),
          trafficConversion("course_view_per_search", "Tim kiem", "Xem khoa hoc", getFunnelCount("course_view"), getFunnelCount("search_submit")),
          trafficConversion("booking_start_per_course_view", "Xem khoa hoc", "Bat dau dat lich", getFunnelCount("booking_start"), getFunnelCount("course_view")),
          trafficConversion("booking_created_per_booking_start", "Bat dau dat lich", "Tao booking", getFunnelCount("booking_created"), getFunnelCount("booking_start")),
          trafficConversion("payment_success_per_booking_created", "Tao booking", "Thanh toan thanh cong", getFunnelCount("payment_success"), getFunnelCount("booking_created")),
        ]
      : [];

    const recentBookings = await fetchRows<Record<string, unknown>>(
      "recentActivity.bookings",
      "bookings",
      "id, status, total_price, created_at",
      (query) => query.order("created_at", { ascending: false }).limit(8),
      { optional: true, fallback: [] },
    );
    const recentTransactions = await fetchRows<Record<string, unknown>>(
      "recentActivity.transactions",
      "transactions",
      "id, amount, status, reference_code, created_at",
      (query) => query.eq("status", "success").order("created_at", { ascending: false }).limit(8),
      { optional: true, fallback: [] },
    );
    const recentReports = await fetchRows<{ id: string; title: string | null; type: string; status: string; created_at: string }>(
      "recentActivity.reports",
      "reports",
      "id, title, type, status, created_at",
      (query) => query.order("created_at", { ascending: false }).limit(8),
      { optional: true, fallback: [] },
    );
    const recentPendingCourses = await fetchRows<{ id: string; title: string | null; status: string; created_at: string }>(
      "recentActivity.courses",
      "courses",
      "id, title, status, created_at",
      (query) => query.eq("status", "pending").order("created_at", { ascending: false }).limit(8),
      { optional: true, fallback: [] },
    );
    const recentWithdrawals = await fetchRows<{ id: string; amount: number | null; status: string; created_at: string }>(
      "recentActivity.withdrawals",
      "withdrawal_requests",
      "id, amount, status, created_at",
      (query) => query.order("created_at", { ascending: false }).limit(8),
      { optional: true, fallback: [] },
    );

    const recentActivity = [
      ...sortNewest(recentBookings as Array<Record<string, string>>).map((booking) => ({
        type: "booking",
        title: "Booking mới",
        description: `Booking ${booking.status ?? ""}${booking.total_price ? ` • ${toNumber(booking.total_price).toLocaleString("vi-VN")}đ` : ""}`,
        created_at: booking.created_at,
        link: "/admin/dashboard",
      })),
      ...sortNewest(recentTransactions as Array<Record<string, string>>).map((transaction) => ({
        type: "transaction",
        title: "Thanh toán thành công",
        description: `${transaction.reference_code ?? "Giao dịch"} • ${toNumber(transaction.amount).toLocaleString("vi-VN")}đ`,
        created_at: transaction.created_at,
        link: "/admin/ledger",
      })),
      ...sortNewest(recentReports).map((report) => ({
        type: "report",
        title: "Báo cáo mới",
        description: report.title ?? `Báo cáo ${report.type}`,
        created_at: report.created_at,
        link: "/admin/reports",
      })),
      ...sortNewest(recentPendingCourses).map((course) => ({
        type: "course",
        title: "Khóa học chờ duyệt",
        description: course.title ?? "Khóa học mới",
        created_at: course.created_at,
        link: "/admin/courses?status=pending",
      })),
      ...sortNewest(recentWithdrawals).map((request) => ({
        type: "withdrawal",
        title: "Yêu cầu rút tiền",
        description: `${toNumber(request.amount).toLocaleString("vi-VN")}đ • ${request.status}`,
        created_at: request.created_at,
        link: "/admin/withdrawals?status=pending",
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    const revenue = buckets.map((bucket) => ({
      bucketKey: bucket.bucketKey,
      label: bucket.label,
      start: toIso(bucket.start),
      end: toIso(bucket.end),
      gmv: bucket.gmv,
      platformFee: bucket.platformFee,
    }));

    const bookings = buckets.map((bucket) => ({
      bucketKey: bucket.bucketKey,
      label: bucket.label,
      start: toIso(bucket.start),
      end: toIso(bucket.end),
      total: bucket.total,
      completed: bucket.completed,
    }));

    const debug = {
      successfulTransactionsInRange: successfulTransactionsInRange.length,
      bookingsInRange: chartBookings.length,
      analyticsEventsInRange: analyticsRows.length,
      firstTransactionInRange: transactionRangeDebug.first,
      lastTransactionInRange: transactionRangeDebug.last,
      firstBookingInRange: bookingRangeDebug.first,
      lastBookingInRange: bookingRangeDebug.last,
    };
    const operationalRates = [
      conversion("course_approval_rate", "Tỷ lệ duyệt khóa học", approvedCoursesCreatedInRange, coursesCreatedInRange.length, "Khóa đã duyệt / khóa tạo mới"),
      conversion("report_resolution_rate", "Tỷ lệ xử lý báo cáo", resolvedReportsInRange, reportsCreatedInRange.length, "Report đã xử lý hoặc bỏ qua / report mới"),
      conversion("withdrawal_processing_rate", "Tỷ lệ xử lý rút tiền", processedWithdrawalsInRange, withdrawalsCreatedInRange.length, "Yêu cầu đã xử lý / yêu cầu rút tiền mới"),
    ];

    return json({
      success: true,
      range,
      granularity,
      overview: {
        totalUsers,
        newUsersInRange,
        totalLearners,
        totalMentors,
        activeMentors: allActiveMentorIds.size,
        activeMentorsInRange: activeMentorIdsInRange.size,
        totalCourses,
        approvedCourses,
        newCoursesInRange,
        pendingCourses,
        totalBookings,
        bookingsInRange,
        completedBookingsInRange,
        gmvInRange,
        platformFeeInRange,
        pendingReports,
        appealedReports,
        pendingWithdrawals,
        pendingWithdrawalAmount,
        activeVetPlusUsers,
        aiMessagesThisMonth: aiMessagesInRange,
      },
      charts: {
        revenue,
        bookings,
      },
      operationalRates,
      conversions: {
        items: [
          conversion("booking_to_payment_success", "Booking â†’ thanh toÃ¡n thÃ nh cÃ´ng", successTransactions, bookingsInRange, "Giao dá»‹ch thÃ nh cÃ´ng / booking Ä‘Æ°á»£c táº¡o"),
          conversion("payment_success_to_completed_booking", "Thanh toÃ¡n â†’ hoÃ n thÃ nh buá»•i há»c", completedBookingsInRange, successTransactions, "Booking hoÃ n thÃ nh / giao dá»‹ch thÃ nh cÃ´ng"),
          conversion("completed_booking_to_review", "HoÃ n thÃ nh â†’ Ä‘Ã¡nh giÃ¡", reviewsInRange.length, completedBookingsInRange, "Review Ä‘Æ°á»£c gá»­i / booking hoÃ n thÃ nh"),
          conversion("refund_rate", "Tá»· lá»‡ hoÃ n tiá»n", refundedTransactions, successTransactions, "Giao dá»‹ch hoÃ n tiá»n / giao dá»‹ch thÃ nh cÃ´ng"),
          conversion("course_approval_rate", "Tá»· lá»‡ duyá»‡t khÃ³a há»c", approvedCoursesCreatedInRange, coursesCreatedInRange.length, "KhÃ³a Ä‘Ã£ duyá»‡t / khÃ³a táº¡o má»›i"),
          conversion("report_resolution_rate", "Tá»· lá»‡ xá»­ lÃ½ bÃ¡o cÃ¡o", resolvedReportsInRange, reportsCreatedInRange.length, "Report resolved hoáº·c dismissed / report má»›i"),
          conversion("withdrawal_processing_rate", "Tá»· lá»‡ xá»­ lÃ½ rÃºt tiá»n", processedWithdrawalsInRange, withdrawalsCreatedInRange.length, "YÃªu cáº§u paid hoáº·c rejected / yÃªu cáº§u rÃºt tiá»n má»›i"),
        ],
        trackingAvailable: hasAnalyticsEvents,
        trackingMessage: hasAnalyticsEvents
          ? "Traffic funnel is ready when event tracking data exists."
          : "Chua co du lieu tracking.",
      },
      trafficFunnel,
      conversionRates: trafficConversionRates,
      pendingActions: {
        pendingCourseCount: pendingCourses,
        pendingMentorVerificationCount,
        pendingReportCount: pendingReports,
        appealedReportCount: appealedReports,
        pendingWithdrawalCount: pendingWithdrawals,
        pendingWithdrawalAmount,
        hiddenCourseRiskCount,
        mentorStrikeHighRiskCount,
      },
      recentActivity,
      warnings,
      debug,
    });
  } catch (error) {
    const serialized = serializeError(error);
    const metricFailure = serialized as Partial<MetricFailure>;
    const responseStage = typeof metricFailure.stage === "string" ? metricFailure.stage : stage;
    const metric = typeof metricFailure.metric === "string" ? metricFailure.metric : undefined;
    const errorDetails = metricFailure.error ? serializeError(metricFailure.error) : serialized;
    const message = getErrorMessage(errorDetails);

    console.error("admin-dashboard-metrics error", {
      stage: responseStage,
      metric,
      error: errorDetails,
    });

    return json({
      success: false,
      stage: responseStage,
      metric,
      error: errorDetails,
      message,
    }, 500);
  }
});
