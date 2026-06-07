import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bot,
  Copy,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminSubscriptionSummary = {
  totalRevenue: number;
  monthlyRevenue: number;
  activePlusUsers: number;
  pendingPayments: number;
  successPayments: number;
  failedPayments: number;
  totalAiCreditsRemaining: number;
  unusedVouchers: number;
  usedVouchers: number;
};

type AdminLearnerSubscription = {
  learner_id: string;
  learner_name: string | null;
  learner_email: string | null;
  plan_code: string;
  plan_name: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  ai_credits_remaining: number;
  created_at: string | null;
  voucher_count: number;
  unused_voucher_count: number;
  used_voucher_count: number;
};

type AdminSubscriptionPayment = {
  payment_id: string;
  learner_id: string;
  learner_name: string | null;
  learner_email: string | null;
  reference_code: string | null;
  amount: number;
  payment_status: string;
  provider: string | null;
  payment_method: string | null;
  created_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

type AdminPaymentWebhookEvent = {
  id: string;
  provider: string | null;
  event_key: string | null;
  payment_type: string | null;
  reference_code: string | null;
  amount: number;
  status: string | null;
  reason: string | null;
  created_at: string | null;
  processed_at: string | null;
};

type AdminSubscriptionsResponse = {
  summary: AdminSubscriptionSummary;
  subscriptions: AdminLearnerSubscription[];
  payments: AdminSubscriptionPayment[];
  webhookEvents: AdminPaymentWebhookEvent[];
};

type SummaryCard = {
  label: string;
  value: string;
  icon: typeof Activity;
  color: string;
  warning?: boolean;
  description?: string;
};

const defaultSummary: AdminSubscriptionSummary = {
  totalRevenue: 0,
  monthlyRevenue: 0,
  activePlusUsers: 0,
  pendingPayments: 0,
  successPayments: 0,
  failedPayments: 0,
  totalAiCreditsRemaining: 0,
  unusedVouchers: 0,
  usedVouchers: 0,
};

const successStatuses = ["success", "paid", "completed", "processed"];
const pendingStatuses = ["pending", "received"];
const failedStatuses = ["failed", "cancelled", "canceled", "expired", "error"];

function formatVnd(value: number) {
  return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("vi-VN")}đ`;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN");
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchSearch(search: string, fields: unknown[]) {
  const needle = normalize(search);
  if (!needle) return true;
  return fields.some((field) => normalize(field).includes(needle));
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getPaymentStatusGroup(status?: string | null) {
  const value = normalize(status || "pending");
  if (successStatuses.includes(value)) return "success";
  if (failedStatuses.includes(value)) return "failed";
  if (pendingStatuses.includes(value)) return "pending";
  return value || "pending";
}

function getWebhookStatusGroup(status?: string | null) {
  const value = normalize(status || "received");
  if (successStatuses.includes(value)) return "processed";
  if (failedStatuses.includes(value)) return "failed";
  if (value === "ignored") return "ignored";
  if (pendingStatuses.includes(value)) return "received";
  return value || "received";
}

function getPaymentProvider(payment: AdminSubscriptionPayment) {
  return normalize(payment.provider || payment.payment_method || "unknown");
}

function getWebhookPaymentType(event: AdminPaymentWebhookEvent) {
  const value = normalize(event.payment_type);
  return value || "unknown";
}

function getSubscriptionComputedStatus(subscription: AdminLearnerSubscription) {
  const status = normalize(subscription.status || "pending");
  if (status === "active" && subscription.current_period_end) {
    const end = toTimestamp(subscription.current_period_end);
    if (end > 0 && end < Date.now()) return "expired";
  }
  return status || "pending";
}

function isSubscriptionActive(subscription: AdminLearnerSubscription) {
  return getSubscriptionComputedStatus(subscription) === "active";
}

function isExpiringSoon(subscription: AdminLearnerSubscription) {
  if (!isSubscriptionActive(subscription) || !subscription.current_period_end) return false;
  const end = toTimestamp(subscription.current_period_end);
  if (!end) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return end >= Date.now() && end - Date.now() <= sevenDays;
}

function statusBadge(status?: string | null) {
  const value = normalize(status || "pending");

  if (value === "active") {
    return { label: "Active", className: "bg-primary/10 text-primary border-primary/20" };
  }

  if (successStatuses.includes(value)) {
    return { label: value === "processed" ? "Đã xử lý" : "Thành công", className: "bg-success/10 text-success border-success/20" };
  }

  if (pendingStatuses.includes(value)) {
    return { label: value === "received" ? "Đã nhận" : "Đang chờ", className: "bg-warning/10 text-warning border-warning/20" };
  }

  if (failedStatuses.includes(value)) {
    return { label: value === "expired" ? "Hết hạn" : "Thất bại", className: "bg-destructive/10 text-destructive border-destructive/20" };
  }

  if (value === "ignored") {
    return { label: "Bỏ qua", className: "bg-muted text-muted-foreground border-border" };
  }

  if (["cancelled", "canceled"].includes(value)) {
    return { label: "Đã hủy", className: "bg-muted text-muted-foreground border-border" };
  }

  return { label: status || "Unknown", className: "bg-muted text-muted-foreground border-border" };
}

function StatusBadge({ status }: { status?: string | null }) {
  const state = statusBadge(status);
  return (
    <Badge variant="outline" className={cn("rounded-full", state.className)}>
      {state.label}
    </Badge>
  );
}

function CopyButton({
  value,
  label,
  onCopy,
}: {
  value?: string | null;
  label: string;
  onCopy: (value: string) => void;
}) {
  if (!value) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
      aria-label={label}
      onClick={() => onCopy(value)}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CreditCard className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-xl pl-9"
      />
    </div>
  );
}

export default function AdminSubscriptions() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentProvider, setPaymentProvider] = useState("all");
  const [webhookSearch, setWebhookSearch] = useState("");
  const [webhookPaymentType, setWebhookPaymentType] = useState("all");
  const [webhookStatus, setWebhookStatus] = useState("all");

  const query = useQuery({
    queryKey: ["admin-subscriptions"],
    enabled: !!session?.access_token,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-subscriptions", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (import.meta.env.DEV) {
        console.log("admin-subscriptions response", { data, error });
      }

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 403) {
          throw new Error("Bạn không có quyền truy cập trang này.");
        }
        throw new Error(error.message || "Không thể tải dữ liệu subscription.");
      }

      if (data?.error) {
        const message = String(data.error);
        throw new Error(message === "Forbidden" ? "Bạn không có quyền truy cập trang này." : message);
      }

      return data as AdminSubscriptionsResponse;
    },
  });

  const data = query.data ?? {
    summary: defaultSummary,
    subscriptions: [],
    payments: [],
    webhookEvents: [],
  };

  const paymentProviders = useMemo(
    () =>
      Array.from(new Set(data.payments.map(getPaymentProvider)))
        .filter((provider) => provider && provider !== "unknown")
        .sort(),
    [data.payments],
  );

  const totalPayments =
    data.summary.pendingPayments + data.summary.successPayments + data.summary.failedPayments;
  const paymentSuccessRate =
    totalPayments > 0 ? Math.round((data.summary.successPayments / totalPayments) * 100) : 0;
  const webhookFailedCount = data.webhookEvents.filter((event) => getWebhookStatusGroup(event.status) === "failed").length;
  const webhookSubscriptionProcessed = data.webhookEvents.filter(
    (event) => getWebhookPaymentType(event) === "subscription" && getWebhookStatusGroup(event.status) === "processed",
  ).length;

  const summaryCards = useMemo<SummaryCard[]>(() => [
    {
      label: "Doanh thu subscription",
      value: formatVnd(data.summary.totalRevenue),
      icon: WalletCards,
      color: "text-emerald-600",
    },
    {
      label: "Doanh thu tháng này",
      value: formatVnd(data.summary.monthlyRevenue),
      icon: CreditCard,
      color: "text-sky-600",
    },
    {
      label: "Learner Plus active",
      value: data.summary.activePlusUsers.toLocaleString("vi-VN"),
      icon: Users,
      color: "text-violet-600",
    },
    {
      label: "Tỷ lệ payment success",
      value: `${paymentSuccessRate}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      description: totalPayments ? `${data.summary.successPayments}/${totalPayments} payment` : "Chưa có payment",
    },
    {
      label: "Payment pending",
      value: data.summary.pendingPayments.toLocaleString("vi-VN"),
      icon: Activity,
      color: "text-amber-600",
    },
    {
      label: "Payment failed",
      value: data.summary.failedPayments.toLocaleString("vi-VN"),
      icon: AlertCircle,
      color: "text-red-600",
      warning: data.summary.failedPayments > 0,
    },
    {
      label: "Webhook failed",
      value: webhookFailedCount.toLocaleString("vi-VN"),
      icon: AlertCircle,
      color: "text-red-600",
      warning: webhookFailedCount > 0,
    },
    {
      label: "Webhook subscription processed",
      value: webhookSubscriptionProcessed.toLocaleString("vi-VN"),
      icon: Sparkles,
      color: "text-emerald-600",
    },
    {
      label: "Voucher chưa dùng",
      value: data.summary.unusedVouchers.toLocaleString("vi-VN"),
      icon: Ticket,
      color: "text-cyan-600",
    },
    {
      label: "AI credits còn lại",
      value: data.summary.totalAiCreditsRemaining.toLocaleString("vi-VN"),
      icon: Bot,
      color: "text-blue-600",
    },
  ], [data.summary, paymentSuccessRate, totalPayments, webhookFailedCount, webhookSubscriptionProcessed]);

  const filteredSubscriptions = useMemo(
    () =>
      data.subscriptions
        .filter((subscription) =>
          matchSearch(subscriptionSearch, [subscription.learner_name, subscription.learner_email]),
        )
        .filter((subscription) => {
          if (subscriptionStatus === "all") return true;
          const status = getSubscriptionComputedStatus(subscription);
          if (subscriptionStatus === "cancelled") return ["cancelled", "canceled"].includes(status);
          return status === subscriptionStatus;
        })
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [data.subscriptions, subscriptionSearch, subscriptionStatus],
  );

  const filteredPayments = useMemo(
    () =>
      data.payments
        .filter((payment) =>
          matchSearch(paymentSearch, [payment.reference_code, payment.learner_name, payment.learner_email]),
        )
        .filter((payment) => paymentStatus === "all" || getPaymentStatusGroup(payment.payment_status) === paymentStatus)
        .filter((payment) => paymentProvider === "all" || getPaymentProvider(payment) === paymentProvider)
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [data.payments, paymentProvider, paymentSearch, paymentStatus],
  );

  const filteredWebhookEvents = useMemo(
    () =>
      data.webhookEvents
        .filter((event) => matchSearch(webhookSearch, [event.reference_code, event.event_key, event.reason]))
        .filter((event) => webhookPaymentType === "all" || getWebhookPaymentType(event) === webhookPaymentType)
        .filter((event) => webhookStatus === "all" || getWebhookStatusGroup(event.status) === webhookStatus)
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [data.webhookEvents, webhookPaymentType, webhookSearch, webhookStatus],
  );

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Đã copy" });
    } catch (error) {
      toast({
        title: "Không thể copy",
        description: error instanceof Error ? error.message : "Trình duyệt không cho phép copy.",
        variant: "destructive",
      });
    }
  };

  const queryErrorMessage =
    query.error instanceof Error ? query.error.message : "Đã xảy ra lỗi khi tải dữ liệu.";
  const displayErrorMessage =
    normalize(queryErrorMessage).includes("forbidden") || queryErrorMessage.includes("403")
      ? "Bạn không có quyền truy cập trang này."
      : queryErrorMessage;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            VET Plus Admin
          </div>
          <h1 className="text-3xl font-bold text-foreground">Gói VET Plus</h1>
          <p className="mt-2 text-muted-foreground">
            Theo dõi subscription, payment và webhook logs của VET Plus.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Tải lại
        </Button>
      </div>

      {query.isError && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-5 text-destructive sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Không thể tải dữ liệu VET Plus.</p>
                <p className="mt-1 text-sm">{displayErrorMessage}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => query.refetch()}
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={cn(
                "rounded-2xl shadow-card",
                card.warning && "border-destructive/30 bg-destructive/5",
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">{card.label}</p>
                    {query.isLoading ? (
                      <Skeleton className="mt-3 h-8 w-24" />
                    ) : (
                      <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
                    )}
                    {card.description && !query.isLoading && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{card.description}</p>
                    )}
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Icon className={cn("h-5 w-5", card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
          <TabsTrigger value="subscriptions" className="rounded-xl">Learner Plus</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-xl">Payments</TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-xl">Webhook Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="gap-4">
              <CardTitle>Learner Plus</CardTitle>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <SearchBox
                  value={subscriptionSearch}
                  onChange={setSubscriptionSearch}
                  placeholder="Tìm theo tên hoặc email learner..."
                />
                <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <LoadingTable />
              ) : filteredSubscriptions.length === 0 ? (
                <EmptyState
                  title="Không có learner Plus phù hợp."
                  description="Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."
                />
              ) : (
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Learner</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Gói</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>AI credits</TableHead>
                      <TableHead>Bắt đầu</TableHead>
                      <TableHead>Hết hạn</TableHead>
                      <TableHead>Voucher</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((subscription) => (
                      <TableRow
                        key={`${subscription.learner_id}-${subscription.created_at}`}
                        className={cn(isSubscriptionActive(subscription) && "bg-primary/5 hover:bg-primary/10")}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isSubscriptionActive(subscription) && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                            <span>{subscription.learner_name || "Learner"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{subscription.learner_email || "Chưa có"}</TableCell>
                        <TableCell>{subscription.plan_name || subscription.plan_code}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={getSubscriptionComputedStatus(subscription)} />
                            {isExpiringSoon(subscription) && (
                              <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                                Sắp hết hạn
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{subscription.ai_credits_remaining.toLocaleString("vi-VN")}</TableCell>
                        <TableCell>{formatDate(subscription.current_period_start)}</TableCell>
                        <TableCell>{formatDate(subscription.current_period_end)}</TableCell>
                        <TableCell>
                          {subscription.unused_voucher_count} chưa dùng / {subscription.used_voucher_count} đã dùng
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="gap-4">
              <CardTitle>Subscription Payments</CardTitle>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                <SearchBox
                  value={paymentSearch}
                  onChange={setPaymentSearch}
                  placeholder="Tìm reference code, tên hoặc email learner..."
                />
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentProvider} onValueChange={setPaymentProvider}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả provider</SelectItem>
                    {paymentProviders.length === 0 ? (
                      <SelectItem value="sepay">SePay</SelectItem>
                    ) : (
                      paymentProviders.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider.toUpperCase()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <LoadingTable />
              ) : filteredPayments.length === 0 ? (
                <EmptyState
                  title="Không có payment phù hợp với bộ lọc."
                  description="Thử tìm reference code khác hoặc đổi status/provider."
                />
              ) : (
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference code</TableHead>
                      <TableHead>Learner</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Created at</TableHead>
                      <TableHead>Paid at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.payment_id || payment.reference_code || payment.created_at}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">
                              {payment.reference_code || "Không có"}
                            </span>
                            <CopyButton
                              value={payment.reference_code}
                              label="Copy reference code"
                              onCopy={handleCopy}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.learner_name || "Learner"}</p>
                            <p className="text-xs text-muted-foreground">{payment.learner_email || "Chưa có email"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{formatVnd(payment.amount)}</TableCell>
                        <TableCell><StatusBadge status={payment.payment_status} /></TableCell>
                        <TableCell className="uppercase">{payment.provider || payment.payment_method || "unknown"}</TableCell>
                        <TableCell>{formatDate(payment.created_at)}</TableCell>
                        <TableCell>{formatDate(payment.paid_at || payment.completed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="gap-4">
              <CardTitle>Webhook Logs</CardTitle>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                <SearchBox
                  value={webhookSearch}
                  onChange={setWebhookSearch}
                  placeholder="Tìm reference code, event key hoặc reason..."
                />
                <Select value={webhookPaymentType} onValueChange={setWebhookPaymentType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả type</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={webhookStatus} onValueChange={setWebhookStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Webhook status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả status</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="ignored">Ignored</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <LoadingTable />
              ) : filteredWebhookEvents.length === 0 ? (
                <EmptyState
                  title="Không có webhook log phù hợp."
                  description="Thử đổi reference code, payment type hoặc webhook status."
                />
              ) : (
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Payment type</TableHead>
                      <TableHead>Reference code</TableHead>
                      <TableHead>Event key</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Created at</TableHead>
                      <TableHead>Processed at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWebhookEvents.map((event) => (
                      <TableRow
                        key={event.id || event.event_key || event.created_at}
                        className={cn(
                          getWebhookStatusGroup(event.status) === "failed" && "bg-destructive/5 hover:bg-destructive/10",
                        )}
                      >
                        <TableCell className="uppercase">{event.provider || "unknown"}</TableCell>
                        <TableCell>{event.payment_type || "unknown"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">
                              {event.reference_code || "Không có"}
                            </span>
                            <CopyButton
                              value={event.reference_code}
                              label="Copy reference code"
                              onCopy={handleCopy}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                              {event.event_key || "Không có"}
                            </span>
                            <CopyButton
                              value={event.event_key}
                              label="Copy event key"
                              onCopy={handleCopy}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{formatVnd(event.amount)}</TableCell>
                        <TableCell><StatusBadge status={getWebhookStatusGroup(event.status)} /></TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {event.reason || "Không có"}
                        </TableCell>
                        <TableCell>{formatDate(event.created_at)}</TableCell>
                        <TableCell>{formatDate(event.processed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
