import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MentorDashboardWallet } from "@/hooks/useMentorDashboardAnalytics";

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

interface MentorWalletQuickCardProps {
  wallet?: MentorDashboardWallet;
  isLoading?: boolean;
}

export function MentorWalletQuickCard({ wallet, isLoading }: MentorWalletQuickCardProps) {
  const currentBalance = [
    { label: "Khả dụng", value: formatVND(wallet?.balance ?? 0), highlight: true },
    { label: "Đang tạm giữ", value: formatVND(wallet?.heldBalance ?? 0) },
  ];

  const cashFlow = [
    { label: "Đang chờ rút", value: formatVND(wallet?.pendingWithdrawal ?? 0) },
    { label: "Đã rút", value: formatVND(wallet?.paidWithdrawal ?? 0) },
    { label: "Tổng đã kiếm", value: formatVND(wallet?.totalEarned ?? 0), highlight: true },
  ];

  const isReconciled = wallet?.walletReconciled ?? true;
  const reconciliationDelta = wallet?.reconciliationDelta ?? 0;

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Doanh thu & Ví</CardTitle>
            <CardDescription>Tóm tắt số dư, tiền tạm giữ và các khoản rút.</CardDescription>
          </div>
          <WalletCards className="h-5 w-5 shrink-0 text-emerald-600" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-emerald-50/70 p-4">
              <p className="text-sm font-semibold text-emerald-900">Số dư hiện tại</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {currentBalance.map((row) => (
                  <MetricRow key={row.label} {...row} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Dòng tiền</p>
              <div className="mt-3 space-y-2">
                {cashFlow.map((row) => (
                  <MetricRow key={row.label} {...row} compact />
                ))}
              </div>
            </section>

            <div className="rounded-2xl bg-muted/30 p-3">
              <p className="mb-2 text-xs leading-5 text-muted-foreground">
                Tổng đã kiếm = Khả dụng + Tạm giữ + Đã/đang rút
              </p>
              {isReconciled ? (
                <div className="flex items-start gap-2 text-xs leading-5 text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Không có chênh lệch dòng tiền.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs leading-5 text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Có chênh lệch dòng tiền {formatVND(Math.abs(reconciliationDelta))}, cần kiểm tra lịch sử ví.</p>
                </div>
              )}
            </div>
          </>
        )}

        <Button asChild className="w-full rounded-xl border-0 text-primary-foreground gradient-primary">
          <Link to="/mentor/wallet">
            Xem Doanh thu & Ví <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center justify-between gap-4" : "rounded-xl bg-background/80 p-3"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={highlight ? "text-lg font-bold text-primary" : "font-semibold text-foreground"}>{value}</p>
    </div>
  );
}
