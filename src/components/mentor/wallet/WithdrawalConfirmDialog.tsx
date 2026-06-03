import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { maskAccountNumber, type MentorPayoutMethod } from "@/hooks/useMentorPayoutMethods";
import { formatVND, MoneyAmount } from "./MoneyAmount";

export function WithdrawalConfirmDialog({
  open,
  onOpenChange,
  amount,
  balance,
  method,
  isSubmitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  balance: number;
  method: MentorPayoutMethod | null;
  isSubmitting?: boolean;
  onConfirm: () => void;
}) {
  const remaining = Math.max(0, balance - amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Xác nhận yêu cầu rút tiền</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Số dư khả dụng</span>
            <MoneyAmount amount={balance} />
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Số tiền rút</span>
            <MoneyAmount amount={amount} className="text-primary" />
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Còn lại sau yêu cầu</span>
            <MoneyAmount amount={remaining} />
          </div>
          <Separator />
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Ngân hàng / Nhà cung cấp</span>
            <span className="text-right font-medium text-foreground">{method?.provider_name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Chủ tài khoản</span>
            <span className="text-right font-medium text-foreground">{method?.account_holder ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Số tài khoản</span>
            <span className="font-mono font-medium text-foreground">{maskAccountNumber(method?.account_number)}</span>
          </div>

          <Alert className="rounded-2xl border-warning/30 bg-warning/5 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Thông tin chuyển khoản sẽ được lưu vào lịch sử rút tiền tại thời điểm tạo yêu cầu.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Hủy</Button>
          <Button onClick={onConfirm} disabled={isSubmitting || !method || amount <= 0} className="rounded-xl border-0 gradient-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận rút {formatVND(amount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
