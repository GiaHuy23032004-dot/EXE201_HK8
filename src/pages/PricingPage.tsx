import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, Sparkles, Ticket, Zap } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SUBSCRIPTION_PLANS, formatSubscriptionPrice } from "@/constants/subscription";
import { useSubscription } from "@/hooks/useSubscription";

const vetPlusGradient =
  "bg-[linear-gradient(135deg,#0369a1_0%,#0891b2_48%,#0f766e_100%)] text-white shadow-lg shadow-primary/25";
const vetPlusCta =
  `${vetPlusGradient} hover:brightness-110 hover:shadow-xl active:scale-[0.99]`;

export default function PricingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { isLoading, planCode, isPlus } = useSubscription();

  return (
    <MainLayout>
      <div className="bg-gradient-to-b from-sky-50 via-background to-background">
        <section className="container py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 rounded-full border-0 bg-primary/10 px-4 py-1.5 text-primary">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              VET Plus
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
              Học thông minh hơn với AI và ưu đãi booking
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Chọn gói phù hợp để tìm khóa học, nhận gợi ý cá nhân hóa và chuẩn bị tốt hơn trước mỗi buổi học.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const current = plan.code === planCode;
              const plusPlan = plan.code === "vet_plus";

              return (
                <Card
                  key={plan.code}
                  className={`relative overflow-hidden rounded-2xl border bg-card shadow-card ${
                    plusPlan ? "border-primary/30 shadow-glow" : "border-border"
                  }`}
                >
                  {plusPlan && (
                    <div className="absolute right-5 top-5">
                      <Badge className={`rounded-full border-0 ${vetPlusGradient}`}>
                        Khuyến nghị
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="space-y-4 p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      plusPlan ? vetPlusGradient : "bg-muted text-muted-foreground"
                    }`}>
                      {plusPlan ? <Crown className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-foreground">
                        {formatSubscriptionPrice(plan.price)}
                      </span>
                      {plan.billingInterval === "month" && (
                        <span className="pb-1 text-sm text-muted-foreground">/tháng</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6 pt-0">
                    <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>{plan.aiCreditsPerMonth} AI credits/tháng</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Ticket className="h-4 w-4 text-secondary" />
                        <span>
                          {plan.voucherCount > 0
                            ? `${plan.voucherCount} voucher ${formatSubscriptionPrice(plan.voucherAmount)}`
                            : "Chưa có voucher"}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm text-card-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isLoading ? (
                      <Skeleton className="h-11 w-full rounded-xl" />
                    ) : current ? (
                      <Button className="h-11 w-full rounded-xl" variant="outline" disabled>
                        Gói hiện tại
                      </Button>
                    ) : plusPlan ? (
                      <Button
                        className={`h-11 w-full rounded-xl border-0 font-semibold ${vetPlusCta}`}
                        onClick={() => setUpgradeOpen(true)}
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        Nâng cấp lên VET Plus
                      </Button>
                    ) : (
                      <Link to="/learner/subscription">
                        <Button className="h-11 w-full rounded-xl" variant="outline">
                          Xem gói của tôi
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border bg-card/80 p-5 text-sm text-muted-foreground shadow-card">
            <strong className="text-foreground">Phase 2:</strong> AI credits đã được kiểm soát khi dùng tính năng AI.
            Thanh toán subscription thật và voucher checkout sẽ được tích hợp ở phase tiếp theo.
          </div>
        </section>
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thanh toán VET Plus sắp ra mắt</DialogTitle>
            <DialogDescription>
              Thanh toán subscription sẽ được tích hợp ở phase tiếp theo. Hiện tại hệ thống chỉ hiển thị thông tin gói và trạng thái subscription.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Link to="/learner/subscription">
              <Button variant="outline" className="rounded-xl">Xem gói của tôi</Button>
            </Link>
            <Button className="rounded-xl" onClick={() => setUpgradeOpen(false)}>
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
