import { CreditCard, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MentorRevenueTransaction, MentorWalletTransaction } from "@/hooks/useMentorWalletHistory";
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <Wallet className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function WalletHistoryTable({
  walletTransactions,
  transactions,
  isLoading,
}: {
  walletTransactions: MentorWalletTransaction[];
  transactions: MentorRevenueTransaction[];
  isLoading?: boolean;
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            Sổ ví mentor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : walletTransactions.length === 0 ? (
            <EmptyState
              title="Chưa có biến động ví"
              description="Doanh thu, rút tiền và hoàn tiền sẽ được ghi lại tại đây."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead className="text-right">Biến động</TableHead>
                    <TableHead className="text-right">Số dư sau</TableHead>
                    <TableHead>Mã tham chiếu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletTransactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <StatusBadge status={item.kind} />
                      </TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">{item.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                      <TableCell className={item.delta >= 0 ? "text-right font-semibold text-success" : "text-right font-semibold text-destructive"}>
                        {item.delta >= 0 ? "+" : "-"}
                        <MoneyAmount amount={Math.abs(item.delta)} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <MoneyAmount amount={item.balance_after} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.reference_code ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Giao dịch khóa học
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              title="Chưa có giao dịch thanh toán"
              description="Các giao dịch thanh toán thành công của học viên sẽ hiển thị tại đây."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khóa học</TableHead>
                    <TableHead>Học viên</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead className="text-right">Học viên trả</TableHead>
                    <TableHead className="text-right">Phí VET</TableHead>
                    <TableHead className="text-right">Mentor nhận</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{transaction.course?.title ?? "Khóa học"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{transaction.reference_code ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">{transaction.learner?.name ?? "Học viên"}</div>
                        <div className="text-xs text-muted-foreground">{transaction.learner?.email ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(transaction.created_at)}</TableCell>
                      <TableCell className="text-right font-medium">
                        <MoneyAmount amount={transaction.amount} />
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        <MoneyAmount amount={transaction.platform_fee} />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        <MoneyAmount amount={transaction.net_amount} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={transaction.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
