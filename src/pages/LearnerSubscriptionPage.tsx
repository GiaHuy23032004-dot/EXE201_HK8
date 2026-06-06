import { Link } from "react-router-dom";
import { CalendarDays, Check, Crown, Gift, Info, Sparkles, Ticket } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { SUBSCRIPTION_PLAN_BY_CODE, formatSubscriptionPrice, type SubscriptionVoucher } from "@/constants/subscription";
import { useSubscription } from "@/hooks/useSubscription";
import { useSubscriptionVouchers } from "@/hooks/useSubscriptionVouchers";

const vetPlusGradient =
  "bg-[linear-gradient(135deg,#0369a1_0%,#0891b2_48%,#0f766e_100%)] text-white shadow-lg shadow-primary/25";
const vetPlusCta =
  `${vetPlusGradient} hover:brightness-110 hover:shadow-xl active:scale-[0.99]`;

function formatDate(value: string | null) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";
  return date.toLocaleDateString("vi-VN");
}

function getVoucherState(voucher: SubscriptionVoucher) {
  const expiresAt = voucher.expires_at ? new Date(voucher.expires_at) : null;
  const expired = voucher.status === "expired" || Boolean(expiresAt && expiresAt.getTime() < Date.now());

  if (expired) return { label: "Hết hạn", className: "bg-muted text-muted-foreground border-border" };
  if (voucher.status === "used" || voucher.used_at || voucher.booking_id) {
    return { label: "Đã dùng", className: "bg-success/10 text-success border-success/20" };
  }
  return { label: "Chưa dùng", className: "bg-primary/10 text-primary border-primary/20" };
}

function VoucherCard({ voucher }: { voucher: SubscriptionVoucher }) {
  const state = getVoucherState(voucher);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mã voucher</p>
          <p className="mt-1 break-all text-lg font-bold text-foreground">{voucher.code || "VETPLUS"}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 rounded-full ${state.className}`}>
          {state.label}
        </Badge>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Giá trị</span>
          <span className="font-semibold text-foreground">{formatSubscriptionPrice(voucher.amount)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Điều kiện</span>
          <span className="text-right font-medium text-foreground">
            Áp dụng cho booking từ {formatSubscriptionPrice(voucher.min_booking_amount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Hết hạn</span>
          <span className="font-medium text-foreground">{formatDate(voucher.expires_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function LearnerSubscriptionPage() {
  const { isLoggedIn } = useAuth();
  const { subscription, isLoading, isPlus, aiCreditsRemaining, error } = useSubscription();
  const {
    unusedVouchers,
    usedVouchers,
    expiredVouchers,
    isLoading: vouchersLoading,
  } = useSubscriptionVouchers();
  const plan = SUBSCRIPTION_PLAN_BY_CODE[subscription.plan_code];
  const creditPercent = Math.min(100, Math.round((aiCreditsRemaining / Math.max(1, subscription.ai_credits_per_month)) * 100));
  const orderedVouchers = [...unusedVouchers, ...usedVouchers, ...expiredVouchers];

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3 rounded-full border-0 bg-primary/10 text-primary">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Gói của tôi
            </Badge>
            <h1 className="text-3xl font-bold text-foreground">Gói của tôi</h1>
            <p className="mt-2 text-muted-foreground">
              Theo dõi gói hiện tại, AI credits và các quyền lợi VET Plus.
            </p>
          </div>
          <Link to="/pricing">
            <Button variant="outline" className="rounded-xl">
              Xem bảng giá
            </Button>
          </Link>
        </div>

        {!isLoggedIn && (
          <Alert className="mb-6 rounded-2xl border-primary/20 bg-primary/5">
            <Info className="h-4 w-4" />
            <AlertTitle>Đăng nhập để xem trạng thái gói của bạn</AlertTitle>
            <AlertDescription>
              Khi chưa đăng nhập, VET hiển thị trạng thái Free mặc định. Hãy đăng nhập để đọc dữ liệu subscription từ hệ thống.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 rounded-2xl border-warning/30 bg-warning/10">
            <Info className="h-4 w-4" />
            <AlertTitle>Không thể tải dữ liệu subscription</AlertTitle>
            <AlertDescription>
              VET đang hiển thị trạng thái Free an toàn. Bạn có thể thử tải lại sau.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    isPlus ? vetPlusGradient : "bg-muted text-muted-foreground"
                  }`}>
                    {isPlus ? <Crown className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      {isLoading ? <Skeleton className="h-8 w-40" /> : subscription.plan_name}
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border-0 bg-success/10 text-success">Active</Badge>
                      {isPlus && (
                        <Badge className="rounded-full border-0 bg-primary/10 text-primary">VET Plus Active</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-muted-foreground">Giá gói</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatSubscriptionPrice(subscription.price)}
                    {subscription.billing_interval === "month" && <span className="text-sm font-medium text-muted-foreground">/tháng</span>}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Bắt đầu chu kỳ
                      </div>
                      <p className="font-semibold text-foreground">{formatDate(subscription.current_period_start)}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Hết hạn chu kỳ
                      </div>
                      <p className="font-semibold text-foreground">{formatDate(subscription.current_period_end)}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Sparkles className="h-4 w-4" />
                          AI credits còn lại
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {subscription.ai_credits_remaining}/{subscription.ai_credits_per_month}
                        </span>
                      </div>
                      <Progress value={creditPercent} className="h-2" />
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Ticket className="h-4 w-4" />
                        Voucher hằng tháng
                      </div>
                      <p className="font-semibold text-foreground">
                        {subscription.voucher_count > 0
                          ? `${subscription.voucher_count} voucher ${formatSubscriptionPrice(subscription.voucher_amount)}`
                          : "Chưa có voucher"}
                      </p>
                      {subscription.voucher_min_booking_amount > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Áp dụng cho booking từ {formatSubscriptionPrice(subscription.voucher_min_booking_amount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {isPlus ? (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                      <h2 className="flex items-center gap-2 font-semibold text-primary">
                        <Crown className="h-5 w-5" />
                        Bạn đang sử dụng VET Plus
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        AI credits đang hoạt động. Voucher VET Plus đã được ghi nhận trong gói và sẽ áp dụng vào checkout ở phase tiếp theo.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5">
                      <h2 className="flex items-center gap-2 font-semibold text-secondary">
                        <Gift className="h-5 w-5" />
                        Nâng cấp để học thông minh hơn
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        VET Plus mở khóa 60 AI credits mỗi tháng, voucher booking và các gợi ý cá nhân hóa.
                      </p>
                      <Link to="/pricing">
                        <Button className={`mt-4 rounded-xl border-0 font-semibold ${vetPlusCta}`}>
                          Nâng cấp lên VET Plus
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Quyền lợi gói hiện tại</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-5/6" />
                    <Skeleton className="h-5 w-4/5" />
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {(subscription.features.length ? subscription.features : plan.features).map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-dashed shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Quyền lợi sắp có</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Thanh toán subscription thật sẽ được tích hợp ở phase tiếp theo.</p>
                <p>Voucher VET Plus hiện đã được ghi nhận trong gói; việc áp dụng voucher vào booking checkout sẽ hoàn thiện ở phase tiếp theo.</p>
                <p>AI credits được kiểm tra và cập nhật sau mỗi lần dùng tính năng AI.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6 rounded-2xl shadow-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Ticket className="h-5 w-5 text-primary" />
                Voucher VET Plus
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                2 voucher 30.000đ mỗi tháng cho booking từ 300.000đ.
              </p>
            </div>
            {isPlus && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                  {unusedVouchers.length} chưa dùng
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {usedVouchers.length} đã dùng
                </Badge>
                {expiredVouchers.length > 0 && (
                  <Badge variant="outline" className="rounded-full bg-muted text-muted-foreground">
                    {expiredVouchers.length} hết hạn
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isPlus && vouchersLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
              </div>
            ) : !isPlus ? (
              <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Ticket className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">Chưa có voucher</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Nâng cấp VET Plus để nhận 2 voucher 30.000đ mỗi tháng cùng 60 AI credits.
                </p>
                <Link to="/pricing">
                  <Button className={`mt-4 rounded-xl border-0 font-semibold ${vetPlusCta}`}>
                    Nâng cấp lên VET Plus
                  </Button>
                </Link>
              </div>
            ) : orderedVouchers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {orderedVouchers.map((voucher) => (
                  <VoucherCard key={voucher.voucher_id || voucher.code} voucher={voucher} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-primary/5 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Ticket className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">Voucher sẽ sớm xuất hiện</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Voucher sẽ được tạo khi gói Plus được kích hoạt hoặc gia hạn.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
