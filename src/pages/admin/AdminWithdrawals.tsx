import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Wallet, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAdminWithdrawals, useProcessWithdrawalRequest, type AdminWithdrawal } from "@/hooks/useAdminWithdrawals";
import { maskAccountNumber } from "@/hooks/useMentorPayoutMethods";
import { MoneyAmount } from "@/components/mentor/wallet/MoneyAmount";
import { StatusBadge } from "@/components/mentor/wallet/StatusBadge";

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

function getInitials(value?: string | null) {
  return (value || "Mentor")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể xử lý yêu cầu rút tiền.";
}

function ProcessingDialog({
  withdrawal,
  action,
  open,
  onOpenChange,
}: {
  withdrawal: AdminWithdrawal | null;
  action: "paid" | "rejected" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const processWithdrawal = useProcessWithdrawalRequest();
  const [adminNote, setAdminNote] = useState("");
  const [processedReference, setProcessedReference] = useState("");

  const isReject = action === "rejected";

  const handleSubmit = async () => {
    if (!withdrawal || !action) return;
    if (isReject && !adminNote.trim()) {
      toast({
        title: "Thiếu lý do từ chối",
        description: "Vui lòng nhập ghi chú để mentor biết lý do yêu cầu bị từ chối.",
        variant: "destructive",
      });
      return;
    }

    try {
      await processWithdrawal.mutateAsync({
        withdrawal_request_id: withdrawal.id,
        new_status: action,
        admin_note: adminNote,
        processed_reference: processedReference,
      });
      toast({
        title: action === "paid" ? "Đã xác nhận chuyển khoản." : "Đã từ chối yêu cầu rút tiền.",
        description: action === "rejected" ? "Số tiền sẽ được hoàn lại ví mentor bởi RPC." : undefined,
      });
      setAdminNote("");
      setProcessedReference("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Không thể xử lý yêu cầu",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isReject ? "Từ chối yêu cầu rút tiền" : "Xác nhận đã chuyển khoản"}</DialogTitle>
        </DialogHeader>

        {withdrawal && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Mentor</span>
                <span className="text-right font-medium">{withdrawal.mentor?.name ?? withdrawal.mentor?.email ?? withdrawal.mentor_id}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted-foreground">Số tiền</span>
                <MoneyAmount amount={withdrawal.amount} className="text-primary" />
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted-foreground">Tài khoản nhận</span>
                <span className="text-right">
                  {withdrawal.bank_name} · {maskAccountNumber(withdrawal.bank_account)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted-foreground">Chủ tài khoản</span>
                <span className="text-right font-medium">{withdrawal.bank_holder}</span>
              </div>
            </div>

            {!isReject && (
              <div className="space-y-2">
                <Label>Mã tham chiếu chuyển khoản</Label>
                <Input
                  value={processedReference}
                  onChange={(event) => setProcessedReference(event.target.value)}
                  placeholder="VD: VCB-20260603-001"
                  className="rounded-xl"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{isReject ? "Lý do từ chối" : "Ghi chú Admin"}</Label>
              <Textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder={isReject ? "Nhập lý do từ chối..." : "Ghi chú nội bộ hoặc thông tin bổ sung..."}
                className="min-h-24 rounded-xl"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processWithdrawal.isPending}
            className={isReject ? "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" : "rounded-xl border-0 gradient-primary text-primary-foreground"}
          >
            {processWithdrawal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReject ? "Từ chối & hoàn tiền ví" : "Xác nhận đã thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWithdrawals() {
  const withdrawalsQuery = useAdminWithdrawals();
  const withdrawals = withdrawalsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [processingAction, setProcessingAction] = useState<"paid" | "rejected" | null>(null);

  const filteredWithdrawals = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return withdrawals.filter((withdrawal) => {
      const matchesStatus = statusFilter === "all" || withdrawal.status === statusFilter;
      const searchable = [
        withdrawal.mentor?.name,
        withdrawal.mentor?.email,
        withdrawal.mentor?.phone,
        withdrawal.bank_name,
        withdrawal.bank_account,
        withdrawal.bank_holder,
        withdrawal.reference_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!keyword || searchable.includes(keyword));
    });
  }, [search, statusFilter, withdrawals]);

  const stats = useMemo(() => {
    const pending = withdrawals.filter((item) => item.status === "pending");
    const paid = withdrawals.filter((item) => item.status === "paid");
    const rejected = withdrawals.filter((item) => item.status === "rejected");
    return {
      total: withdrawals.length,
      pending: pending.length,
      pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
      paid: paid.length,
      rejected: rejected.length,
    };
  }, [withdrawals]);

  const openProcessDialog = (withdrawal: AdminWithdrawal, action: "paid" | "rejected") => {
    setSelectedWithdrawal(withdrawal);
    setProcessingAction(action);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Yêu cầu rút tiền</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kiểm tra và xử lý yêu cầu rút tiền của mentor bằng RPC bảo vệ số dư ví.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Tổng yêu cầu</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Đang chờ xử lý</p>
            <p className="mt-1 text-2xl font-bold text-warning">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Số tiền đang chờ</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              <MoneyAmount amount={stats.pendingAmount} />
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Đã xử lý / Từ chối</p>
            <p className="mt-1 text-2xl font-bold">{stats.paid} / {stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              Danh sách yêu cầu
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mentor, ngân hàng..."
                  className="w-full rounded-xl pl-9 sm:w-72"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full rounded-xl sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Đang chờ</SelectItem>
                  <SelectItem value="paid">Đã chuyển khoản</SelectItem>
                  <SelectItem value="rejected">Bị từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawalsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : withdrawalsQuery.isError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
              <p className="font-semibold text-destructive">Không thể tải yêu cầu rút tiền.</p>
              <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(withdrawalsQuery.error)}</p>
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <Wallet className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Không có yêu cầu phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Ngân hàng</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={withdrawal.mentor?.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(withdrawal.mentor?.name ?? withdrawal.mentor?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">{withdrawal.mentor?.name ?? "Mentor"}</div>
                            <div className="text-xs text-muted-foreground">{withdrawal.mentor?.email ?? withdrawal.mentor_id}</div>
                          </div>
                        </div>
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
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {withdrawal.rejection_reason || withdrawal.admin_note || withdrawal.processed_reference || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {withdrawal.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProcessDialog(withdrawal, "rejected")}
                              className="rounded-xl text-destructive hover:text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Từ chối
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openProcessDialog(withdrawal, "paid")}
                              className="rounded-xl border-0 gradient-primary text-primary-foreground"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Đã chuyển
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Đã xử lý</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProcessingDialog
        withdrawal={selectedWithdrawal}
        action={processingAction}
        open={!!selectedWithdrawal && !!processingAction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWithdrawal(null);
            setProcessingAction(null);
          }
        }}
      />
    </div>
  );
}
