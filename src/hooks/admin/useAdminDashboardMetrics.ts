import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminDashboardRange = "30d" | "1y";
export type AdminDashboardViewMode = "month" | "year";

export type AdminDashboardPeriodParams = {
  mode: AdminDashboardViewMode;
  month?: number;
  year: number;
};

export type AdminDashboardOverview = {
  totalUsers: number;
  newUsersInRange: number;
  totalLearners: number;
  totalMentors: number;
  activeMentors: number;
  activeMentorsInRange: number;
  totalCourses: number;
  approvedCourses: number;
  newCoursesInRange: number;
  pendingCourses: number;
  totalBookings: number;
  bookingsInRange: number;
  completedBookingsInRange: number;
  gmvInRange: number;
  platformFeeInRange: number;
  pendingReports: number;
  appealedReports: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
  activeVetPlusUsers: number | null;
  aiMessagesThisMonth: number | null;
};

export type AdminMonthlyRevenuePoint = {
  bucketKey: string;
  label: string;
  start: string;
  end: string;
  gmv: number;
  platformFee: number;
};

export type AdminMonthlyBookingPoint = {
  bucketKey: string;
  label: string;
  start: string;
  end: string;
  total: number;
  completed: number;
};

export type AdminLedgerCashFlowPoint = {
  bucketKey: string;
  label: string;
  start: string;
  end: string;
  inflow: number;
  platformFee: number;
  mentorNet: number;
  refund: number;
};

export type AdminPayoutStatusPoint = {
  bucketKey: string;
  label: string;
  start: string;
  end: string;
  paid: number;
  pending: number;
  rejected: number;
  refund: number;
};

export type AdminConversionMetric = {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
  rate: number | null;
  helper: string;
};

export type AdminTrafficFunnelStep = {
  key: string;
  label: string;
  count: number;
};

export type AdminTrafficConversionRate = {
  key: string;
  from: string;
  to: string;
  numerator: number;
  denominator: number;
  rate: number | null;
};

export type AdminPendingActions = {
  pendingCourseCount: number;
  pendingMentorVerificationCount: number | null;
  pendingReportCount: number;
  appealedReportCount: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;
  hiddenCourseRiskCount: number | null;
  mentorStrikeHighRiskCount: number;
};

export type AdminRecentActivityItem = {
  type: "booking" | "transaction" | "report" | "course" | "withdrawal" | string;
  title: string;
  description: string;
  created_at: string;
  link: string;
};

export type AdminDashboardMetricWarning = {
  metric: string;
  error: Record<string, unknown>;
};

export type AdminDashboardMetrics = {
  success: true;
  range?: AdminDashboardRange;
  mode?: AdminDashboardViewMode;
  selectedPeriod?: {
    month?: number;
    year: number;
    label: string;
    start: string;
    end: string;
  };
  granularity: "week" | "month";
  overview: AdminDashboardOverview;
  charts: {
    revenue: AdminMonthlyRevenuePoint[];
    bookings: AdminMonthlyBookingPoint[];
    ledgerCashFlow?: AdminLedgerCashFlowPoint[];
    payoutStatus?: AdminPayoutStatusPoint[];
  };
  operationalRates: AdminConversionMetric[];
  conversions: {
    items: AdminConversionMetric[];
    trackingAvailable: boolean;
    trackingMessage: string;
  };
  trafficFunnel: AdminTrafficFunnelStep[] | null;
  conversionRates: AdminTrafficConversionRate[];
  pendingActions: AdminPendingActions;
  recentActivity: AdminRecentActivityItem[];
  warnings?: AdminDashboardMetricWarning[];
  debug?: {
    successfulTransactionsInRange: number;
    bookingsInRange: number;
    analyticsEventsInRange: number;
    firstTransactionInRange: string | null;
    lastTransactionInRange: string | null;
    firstBookingInRange: string | null;
    lastBookingInRange: string | null;
  };
};

type AdminDashboardErrorPayload = {
  success?: false;
  error?: string | Record<string, unknown>;
  message?: string;
  stage?: string;
  metric?: string;
  details?: Record<string, unknown>;
};

const readPayloadMessage = (payload: AdminDashboardErrorPayload | null) => {
  if (!payload) return null;

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (payload.error && typeof payload.error === "object") {
    const errorMessage = payload.error.message;
    const errorCode = payload.error.code;
    if (typeof errorMessage === "string" && errorMessage.trim()) return errorMessage;
    if (typeof errorCode === "string" && errorCode.trim()) return errorCode;
  }

  return null;
};

const getDefaultPeriod = (): AdminDashboardPeriodParams => {
  const now = new Date();
  return {
    mode: "month",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
};

export function useAdminDashboardMetrics(period: AdminDashboardPeriodParams = getDefaultPeriod(), enabled = true) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const normalizedPeriod = {
    mode: period.mode,
    month: period.mode === "month" ? period.month : undefined,
    year: period.year,
    range: period.mode === "year" ? "1y" as const : "30d" as const,
  };

  return useQuery({
    queryKey: ["admin-dashboard-metrics", session?.user?.id, normalizedPeriod],
    enabled: enabled && Boolean(accessToken),
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? accessToken;

      if (sessionError || !token) {
        throw new Error("Bạn cần đăng nhập Admin để xem dashboard.");
      }

      const { data, error } = await supabase.functions.invoke<AdminDashboardMetrics>("admin-dashboard-metrics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: normalizedPeriod,
      });

      if (import.meta.env.DEV) {
        console.log("dashboard metrics invoke", { data, error });
        console.log("Dashboard metrics response", data);
        console.log("Revenue chart data", data?.charts?.revenue);
        console.log("Booking chart data", data?.charts?.bookings);
        console.log("Traffic funnel data", data?.trafficFunnel);
      }

      if (error) {
        const response = (error as { context?: Response }).context;
        const status = response?.status;
        let backendPayload: AdminDashboardErrorPayload | null = null;

        if (response) {
          try {
            backendPayload = await response.clone().json();
          } catch {
            backendPayload = null;
          }
        }

        if (import.meta.env.DEV) {
          console.error("dashboard metrics invoke error", { error, backendPayload, status });
        }

        const backendMessage = readPayloadMessage(backendPayload);
        const metricText = backendPayload?.metric ? ` at ${backendPayload.metric}` : "";
        const message = status === 403 || error.message?.includes("403")
          ? "Bạn không có quyền truy cập trang này."
          : backendMessage
            ? `${backendPayload?.stage ?? "metrics_query"} failed${metricText}: ${backendMessage}`
            : error.message || "Không thể tải số liệu dashboard.";
        throw new Error(message);
      }

      if (!data) {
        throw new Error("Không thể tải số liệu dashboard.");
      }

      if (import.meta.env.DEV && data.warnings?.length) {
        console.warn("admin-dashboard-metrics warnings", data.warnings);
      }

      return data;
    },
  });
}
