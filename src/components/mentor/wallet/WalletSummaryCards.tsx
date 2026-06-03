import { ArrowDownToLine, Banknote, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyAmount } from "./MoneyAmount";

interface WalletSummaryCardsProps {
  totalEarned: number;
  balance: number;
  heldBalance: number;
  pendingWithdrawals: number;
  platformFees: number;
  isLoading?: boolean;
}

export function WalletSummaryCards({
  totalEarned,
  balance,
  heldBalance,
  pendingWithdrawals,
  platformFees,
  isLoading,
}: WalletSummaryCardsProps) {
  const cards = [
    { label: "Tổng đã kiếm", value: totalEarned, icon: Banknote, className: "bg-success/10 text-success" },
    { label: "Khả dụng", value: balance, icon: Wallet, className: "bg-primary/10 text-primary" },
    { label: "Đang tạm giữ", value: heldBalance, icon: Clock3, className: "bg-warning/10 text-warning" },
    { label: "Đang chờ rút", value: pendingWithdrawals, icon: ArrowDownToLine, className: "bg-blue-100 text-blue-700" },
    { label: "Phí nền tảng đã trả", value: platformFees, icon: ShieldCheck, className: "bg-destructive/10 text-destructive" },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-2xl">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="rounded-2xl shadow-card">
            <CardContent className="p-5">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.className}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                <MoneyAmount amount={card.value} />
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
