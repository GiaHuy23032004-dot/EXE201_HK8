import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WalletSummaryCards } from "./WalletSummaryCards";

interface WalletOverviewProps {
  totalEarned: number;
  balance: number;
  heldBalance: number;
  pendingWithdrawals: number;
  platformFees: number;
  isLoading?: boolean;
}

export function WalletOverview(props: WalletOverviewProps) {
  return (
    <div className="space-y-4">
      <WalletSummaryCards {...props} />
      <Card className="rounded-2xl border-primary/10 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Cách VET xử lý doanh thu</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Tiền khả dụng là số tiền mentor có thể rút. Tiền tạm giữ sẽ được mở khóa sau khi buổi học hoàn tất
              và hết thời gian xử lý khiếu nại. Phí nền tảng là 15%, mentor nhận 85% trên giao dịch đã thanh toán
              thành công.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
