import { ArrowDownToLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maskAccountNumber } from "@/hooks/useMentorPayoutMethods";
import type { MentorWithdrawal } from "@/hooks/useMentorWithdrawals";
import { MoneyAmount } from "./MoneyAmount";
import { StatusBadge } from "./StatusBadge";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WithdrawalHistoryTable({
  withdrawals,
  isLoading,
}: {
  withdrawals: MentorWithdrawal[];
  isLoading?: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          Lịch sử rút tiền
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
            <ArrowDownToLine className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">Chưa có yêu cầu rút tiền</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Các yêu cầu rút tiền và kết quả xử lý của Admin sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã yêu cầu</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Phương thức nhận</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày xử lý</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {withdrawal.reference_code ?? withdrawal.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(withdrawal.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{withdrawal.bank_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {maskAccountNumber(withdrawal.bank_account)} · {withdrawal.bank_holder}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MoneyAmount amount={withdrawal.amount} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={withdrawal.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(withdrawal.processed_at)}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {withdrawal.rejection_reason || withdrawal.admin_note || withdrawal.processed_reference || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
