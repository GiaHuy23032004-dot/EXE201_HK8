import { useMemo, useState } from "react";
import { ArrowDownToLine, CreditCard, Loader2, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateWithdrawalRequest, type MentorWithdrawal } from "@/hooks/useMentorWithdrawals";
import { maskAccountNumber, type MentorPayoutMethod } from "@/hooks/useMentorPayoutMethods";
import type { MentorWallet } from "@/hooks/useMentorWallet";
import { MoneyAmount, formatVND } from "./MoneyAmount";
import { WithdrawalConfirmDialog } from "./WithdrawalConfirmDialog";

const MIN_WITHDRAWAL_AMOUNT = 50_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tạo yêu cầu rút tiền.";
}

export function WithdrawalRequestPanel({
  wallet,
  payoutMethods,
  withdrawals,
  isLoading,
  onManagePayoutMethods,
}: {
  wallet: MentorWallet | undefined;
  payoutMethods: MentorPayoutMethod[];
  withdrawals: MentorWithdrawal[];
  isLoading?: boolean;
  onManagePayoutMethods: () => void;
}) {
  const { toast } = useToast();
  const createWithdrawal = useCreateWithdrawalRequest();
  const activeMethods = useMemo(
    () => payoutMethods.filter((method) => method.status === "active"),
    [payoutMethods],
  );
  const defaultMethod = activeMethods.find((method) => method.is_default) ?? activeMethods[0] ?? null;

  const [amountText, setAmountText] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod?.id ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const balance = wallet?.balance ?? 0;
  const pendingAmount = withdrawals
    .filter((withdrawal) => withdrawal.status === "pending")
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);
  const amount = Number(amountText) || 0;
  const selectedMethod =
    activeMethods.find((method) => method.id === selectedMethodId) ??
    defaultMethod;

  const openConfirm = () => {
    if (activeMethods.length === 0) {
      toast({
        title: "Chưa có phương thức nhận tiền",
        description: "Vui lòng thêm tài khoản ngân hàng hoặc ví nhận tiền trước khi rút.",
        variant: "destructive",
      });
      onManagePayoutMethods();
      return;
    }

    if (!selectedMethod) {
      toast({ title: "Vui lòng chọn phương thức nhận tiền.", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      toast({
        title: "Số tiền rút chưa hợp lệ",
        description: `Số tiền rút tối thiểu là ${formatVND(MIN_WITHDRAWAL_AMOUNT)}.`,
        variant: "destructive",
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: "Không đủ số dư",
        description: "Số tiền rút không được vượt quá số dư khả dụng.",
        variant: "destructive",
      });
      return;
    }

    setConfirmOpen(true);
  };

  const confirmWithdrawal = async () => {
    if (!selectedMethod) return;
    try {
      await createWithdrawal.mutateAsync({
        amount,
        payout_method_id: selectedMethod.id,
      });
      setConfirmOpen(false);
      setAmountText("");
      toast({
        title: "Đã gửi yêu cầu rút tiền",
        description: "Số dư đã được trừ và yêu cầu đang chờ Admin xử lý.",
      });
    } catch (error) {
      toast({
        title: "Không thể gửi yêu cầu rút tiền",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              Tạo yêu cầu rút tiền
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">Khả dụng</p>
                <MoneyAmount amount={balance} className="mt-1 block text-xl text-primary" />
              </div>
              <div className="rounded-2xl bg-warning/5 p-4">
                <p className="text-sm text-muted-foreground">Đang chờ rút</p>
                <MoneyAmount amount={pendingAmount} className="mt-1 block text-xl text-warning" />
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Tối thiểu</p>
                <MoneyAmount amount={MIN_WITHDRAWAL_AMOUNT} className="mt-1 block text-xl" />
              </div>
            </div>

            <Alert className="rounded-2xl border-primary/20 bg-primary/5">
              <Wallet className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-muted-foreground">
                Yêu cầu rút tiền được xử lý bằng RPC backend. React chỉ gửi số tiền và phương thức nhận tiền đã chọn, không tự cập nhật ví.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Số tiền muốn rút</Label>
              <Input
                inputMode="numeric"
                value={amountText}
                disabled={isLoading || balance <= 0}
                onChange={(event) => setAmountText(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Nhập số tiền"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Phương thức nhận tiền</Label>
              <Select
                value={selectedMethod?.id ?? selectedMethodId}
                onValueChange={setSelectedMethodId}
                disabled={activeMethods.length === 0}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Chọn tài khoản nhận tiền" />
                </SelectTrigger>
                <SelectContent>
                  {activeMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.nickname || method.provider_name} · {maskAccountNumber(method.account_number)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" className="rounded-xl" onClick={onManagePayoutMethods}>
                <CreditCard className="mr-2 h-4 w-4" />
                Quản lý phương thức nhận tiền
              </Button>
              <Button
                onClick={openConfirm}
                disabled={createWithdrawal.isPending || balance <= 0}
                className="rounded-xl border-0 gradient-primary text-primary-foreground"
              >
                {createWithdrawal.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                )}
                Gửi yêu cầu rút tiền
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Phương thức đang chọn</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMethod ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="font-semibold text-foreground">{selectedMethod.nickname || selectedMethod.provider_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMethod.provider_name}</p>
                  <p className="mt-3 font-mono text-lg font-bold text-foreground">
                    {maskAccountNumber(selectedMethod.account_number)}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Chủ tài khoản</span>
                    <span className="text-right font-medium">{selectedMethod.account_holder}</span>
                  </div>
                  {selectedMethod.branch && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Chi nhánh</span>
                      <span className="text-right">{selectedMethod.branch}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <CreditCard className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
                <p className="font-medium text-foreground">Chưa có phương thức nhận tiền</p>
                <p className="mt-1 text-sm text-muted-foreground">Thêm tài khoản để tạo yêu cầu rút tiền.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <WithdrawalConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        amount={amount}
        balance={balance}
        method={selectedMethod}
        isSubmitting={createWithdrawal.isPending}
        onConfirm={confirmWithdrawal}
      />
    </>
  );
}
