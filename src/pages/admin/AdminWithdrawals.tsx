import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Eye,
  Loader2,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminWithdrawalActions,
  useAdminWithdrawalDetail,
  useAdminWithdrawals,
  type AdminWithdrawal,
  type WithdrawalStatus,
} from "@/hooks/useAdminWithdrawals";
import { maskAccountNumber } from "@/hooks/useMentorPayoutMethods";
import { MoneyAmount, formatVND } from "@/components/mentor/wallet/MoneyAmount";

type WithdrawalFilter = "all" | WithdrawalStatus;
type ActionMode = "paid" | "reject";

const PAGE_SIZE = 10;
const DEMO_MARKER_PATTERN = /\[(?:DEMO[^\]]*)\]\s*/i;
const INTERNAL_DEMO_PATTERN = /\[(?:DEMO[^\]]*)\]|pending withdrawal dashboard|paid withdrawal dashboard|DEMO MENTOR/i;

const filterLabels: Record<WithdrawalFilter, string> = {
  all: "Tất cả",
  pending: "Đang chờ",
  paid: "Đã chi",
  rejected: "Từ chối",
};

const statusConfig: Record<WithdrawalStatus, { label: string; className: string }> = {
  pending: { label: "Đang chờ", className: "border-amber-200 bg-amber-50 text-amber-700" },
  paid: { label: "Đã chi", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Từ chối", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const historyLabels: Record<string, string> = {
  requested: "Tạo yêu cầu",
  approved_paid: "Đánh dấu đã chi",
  rejected: "Từ chối",
  failed_attempt: "Xử lý thất bại",
  note_added: "Thêm ghi chú",
};

function hasDemoMarker(value?: string | null) {
  return Boolean(value && INTERNAL_DEMO_PATTERN.test(value));
}

function cleanDemoText(value?: string | null) {
  if (!value) return "";
  const normalized = value.replace(DEMO_MARKER_PATTERN, "").trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("paid withdrawal dashboard")) return "Yêu cầu đã chi mẫu";
  if (lower.includes("pending withdrawal dashboard") || lower.includes("demo mentor") || INTERNAL_DEMO_PATTERN.test(value)) {
    return "Yêu cầu rút tiền mẫu";
  }

  return normalized;
}

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

function getMentorName(withdrawal?: AdminWithdrawal | null) {
  return withdrawal?.mentor?.name || withdrawal?.mentor?.email || "Mentor";
}

function getLast4(value?: string | null) {
  return value?.replace(/\D/g, "").slice(-4) || "";
}

function getDisplayNote(withdrawal: AdminWithdrawal) {
  return cleanDemoText(
    withdrawal.rejected_reason ||
    withdrawal.rejection_reason ||
    withdrawal.admin_note ||
    withdrawal.paid_reference ||
    withdrawal.processed_reference,
  );
}

function getHistoryLabel(action: string) {
  if (historyLabels[action]) return historyLabels[action];
  return action.includes("_") ? "Cập nhật trạng thái" : action;
}

function StatusBadge({ status }: { status: WithdrawalStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`rounded-full ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function CopyButton({ value, label }: { value?: string | null; label: string }) {
  const { toast } = useToast();
  if (!value) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 rounded-lg"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast({ title: "Đã copy", description: label });
      }}
    >
      <Clipboard className="mr-1 h-3.5 w-3.5" />
      Copy
    </Button>
  );
}

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const withdrawalsQuery = useAdminWithdrawals();
  const withdrawals = withdrawalsQuery.data?.withdrawals ?? [];
  const metrics = withdrawalsQuery.data?.metrics ?? {
    total: withdrawals.length,
    pending: withdrawals.filter((item) => item.status === "pending").length,
    pending_amount: withdrawals.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0),
    paid: withdrawals.filter((item) => item.status === "paid").length,
    paid_amount: withdrawals.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
    rejected: withdrawals.filter((item) => item.status === "rejected").length,
  };

  const actions = useAdminWithdrawalActions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WithdrawalFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionWithdrawal, setActionWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [paidReference, setPaidReference] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const detailQuery = useAdminWithdrawalDetail(detailId, Boolean(detailId));
  const detailWithdrawal = detailQuery.data ?? withdrawals.find((item) => item.id === detailId) ?? null;
  const actionIsPending = actions.markPaid.isPending || actions.rejectWithdrawal.isPending;

  const counts = useMemo(() => ({
    all: withdrawals.length,
    pending: withdrawals.filter((item) => item.status === "pending").length,
    paid: withdrawals.filter((item) => item.status === "paid").length,
    rejected: withdrawals.filter((item) => item.status === "rejected").length,
  }), [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return withdrawals.filter((withdrawal) => {
      const matchesStatus = statusFilter === "all" || withdrawal.status === statusFilter;
      const searchable = [
        withdrawal.mentor?.name,
        withdrawal.mentor?.email,
        withdrawal.mentor?.phone,
        withdrawal.bank_name,
        getLast4(withdrawal.bank_account),
        withdrawal.bank_holder,
        withdrawal.reference_code,
        withdrawal.paid_reference,
        withdrawal.processed_reference,
        getDisplayNote(withdrawal),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!keyword || searchable.includes(keyword));
    });
  }, [search, statusFilter, withdrawals]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWithdrawals.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = filteredWithdrawals.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, filteredWithdrawals.length);
  const paginatedWithdrawals = filteredWithdrawals.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const openActionDialog = (withdrawal: AdminWithdrawal, mode: ActionMode) => {
    if (withdrawal.status !== "pending") {
      toast({
        title: "Yêu cầu đã được xử lý",
        description: "Chỉ yêu cầu đang chờ mới có thể cập nhật trạng thái.",
        variant: "destructive",
      });
      return;
    }

    setActionWithdrawal(withdrawal);
    setActionMode(mode);
    setPaidReference(withdrawal.paid_reference || withdrawal.processed_reference || "");
    setRejectedReason("");
    setAdminNote("");
  };

  const closeActionDialog = () => {
    setActionWithdrawal(null);
    setActionMode(null);
    setPaidReference("");
    setRejectedReason("");
    setAdminNote("");
  };

  const submitAction = async () => {
    if (!actionWithdrawal || !actionMode) return;

    if (actionWithdrawal.status !== "pending") {
      toast({
        title: "Yêu cầu đã được xử lý",
        description: "Không thể xử lý lại yêu cầu đã chi hoặc đã từ chối.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "reject" && !rejectedReason.trim()) {
      toast({
        title: "Thiếu lý do từ chối",
        description: "Vui lòng nhập lý do từ chối yêu cầu.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (actionMode === "paid") {
        await actions.markPaid.mutateAsync({
          requestId: actionWithdrawal.id,
          paidReference: paidReference.trim() || undefined,
          adminNote: adminNote.trim() || undefined,
        });
        toast({
          title: "Đã đánh dấu đã chi",
          description: "Trạng thái yêu cầu rút tiền đã được cập nhật.",
        });
      } else {
        await actions.rejectWithdrawal.mutateAsync({
          requestId: actionWithdrawal.id,
          rejectedReason: rejectedReason.trim(),
          adminNote: adminNote.trim() || undefined,
        });
        toast({
          title: "Đã từ chối yêu cầu",
          description: "Trạng thái yêu cầu rút tiền đã được cập nhật.",
        });
      }
      closeActionDialog();
    } catch (error) {
      toast({
        title: "Không thể xử lý yêu cầu",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  const renderActions = (withdrawal: AdminWithdrawal) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setDetailId(withdrawal.id)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem chi tiết
      </Button>
      {withdrawal.status === "pending" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-destructive hover:text-destructive"
            onClick={() => openActionDialog(withdrawal, "reject")}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Từ chối
          </Button>
          <Button
            size="sm"
            className="gradient-primary rounded-xl border-0 text-primary-foreground"
            onClick={() => openActionDialog(withdrawal, "paid")}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Đánh dấu đã chi
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Yêu cầu rút tiền</h1>
        <p className="text-sm text-muted-foreground">
          Đối soát và cập nhật trạng thái yêu cầu rút tiền của mentor.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tổng yêu cầu" value={metrics.total} />
        <MetricCard label="Đang chờ xử lý" value={metrics.pending} tone="text-amber-600" />
        <MetricCard label="Số tiền đang chờ" value={formatVND(metrics.pending_amount)} tone="text-primary" />
        <MetricCard label="Đã chi" value={metrics.paid} tone="text-emerald-600" />
        <MetricCard label="Từ chối" value={metrics.rejected} tone="text-rose-600" />
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm mentor, email, ngân hàng, 4 số cuối, mã tham chiếu..."
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(filterLabels) as WithdrawalFilter[]).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={statusFilter === item ? "default" : "outline"}
                  className={`rounded-full ${statusFilter === item ? "gradient-primary border-0 text-primary-foreground" : "bg-background"}`}
                  onClick={() => setStatusFilter(item)}
                >
                  {filterLabels[item]} ({counts[item]})
                </Button>
              ))}
            </div>
          </div>

          {withdrawalsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : withdrawalsQuery.isError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
              <p className="font-semibold text-destructive">Không thể tải yêu cầu rút tiền.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {withdrawalsQuery.error instanceof Error ? withdrawalsQuery.error.message : "Vui lòng thử lại."}
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void withdrawalsQuery.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <Wallet className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Không có yêu cầu phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Mentor</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Ngân hàng</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWithdrawals.map((withdrawal) => {
                      const note = getDisplayNote(withdrawal);
                      const demo = hasDemoMarker(withdrawal.admin_note) || hasDemoMarker(withdrawal.mentor?.name);

                      return (
                        <TableRow key={withdrawal.id} className="align-top hover:bg-muted/20">
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={withdrawal.mentor?.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(withdrawal.mentor?.name ?? withdrawal.mentor?.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">{cleanDemoText(withdrawal.mentor?.name) || "Mentor"}</div>
                                <div className="truncate text-xs text-muted-foreground">{withdrawal.mentor?.email ?? withdrawal.mentor_id}</div>
                                {demo && <Badge variant="outline" className="mt-1 rounded-full bg-muted/60 text-[10px]">Dữ liệu mẫu</Badge>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(withdrawal.created_at)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{withdrawal.bank_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {maskAccountNumber(withdrawal.bank_account)} · {withdrawal.bank_holder}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyAmount amount={withdrawal.amount} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={withdrawal.status} />
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="line-clamp-2 text-sm text-muted-foreground">{note || "—"}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {renderActions(withdrawal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t bg-muted/10 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Hiển thị {pageStart}–{pageEnd} / {filteredWithdrawals.length} yêu cầu</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  >
                    Trước
                  </Button>
                  <span className="min-w-16 text-center text-xs">{safeCurrentPage}/{totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Chi tiết yêu cầu rút tiền</SheetTitle>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
            </div>
          ) : detailWithdrawal ? (
            <div className="mt-6 space-y-5">
              <section className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Số tiền yêu cầu</p>
                    <MoneyAmount amount={detailWithdrawal.amount} className="text-2xl text-primary" />
                  </div>
                  <StatusBadge status={detailWithdrawal.status} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Mã yêu cầu" value={detailWithdrawal.reference_code || detailWithdrawal.id} />
                  <Info label="Ngày tạo" value={formatDate(detailWithdrawal.created_at)} />
                  <Info label="Ngày xử lý" value={formatDate(detailWithdrawal.processed_at)} />
                  <Info label="Mã tham chiếu chuyển khoản" value={detailWithdrawal.paid_reference || detailWithdrawal.processed_reference} />
                  <Info label="Lý do từ chối" value={detailWithdrawal.rejected_reason || detailWithdrawal.rejection_reason} />
                  <Info label="Ghi chú Admin" value={cleanDemoText(detailWithdrawal.admin_note)} />
                </div>
              </section>

              <section className="rounded-2xl border p-4">
                <p className="mb-3 font-semibold text-foreground">Thông tin Mentor</p>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailWithdrawal.mentor?.avatar_url ?? undefined} />
                    <AvatarFallback>{getInitials(getMentorName(detailWithdrawal))}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{cleanDemoText(getMentorName(detailWithdrawal))}</p>
                    <p className="truncate text-sm text-muted-foreground">{detailWithdrawal.mentor?.email || "Chưa có email"}</p>
                    {detailWithdrawal.mentor?.is_blocked && <Badge className="mt-1 border-0 bg-destructive/10 text-destructive">Đã khóa</Badge>}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Số điện thoại" value={detailWithdrawal.mentor?.phone} />
                  <Info label="Ngày tạo tài khoản" value={formatDate(detailWithdrawal.mentor?.created_at)} />
                </div>
              </section>

              {detailWithdrawal.wallet && (
                <section className="rounded-2xl border p-4">
                  <p className="mb-1 font-semibold text-foreground">Thông tin ví</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Thông tin chỉ dùng để tham khảo. Hành động trên yêu cầu rút tiền ở trang này chỉ cập nhật trạng thái yêu cầu.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Info label="Số dư khả dụng" value={formatVND(detailWithdrawal.wallet.balance ?? 0)} />
                    <Info label="Tiền đang giữ" value={formatVND(detailWithdrawal.wallet.held_balance ?? 0)} />
                    <Info label="Tổng đã kiếm" value={formatVND(detailWithdrawal.wallet.total_earned ?? 0)} />
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                <p className="mb-3 font-semibold text-sky-950">Tài khoản nhận tiền</p>
                <div className="grid gap-3">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-muted-foreground">Ngân hàng</p>
                    <p className="font-semibold">{detailWithdrawal.bank_name}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Số tài khoản</p>
                        <p className="font-semibold">{detailWithdrawal.bank_account}</p>
                      </div>
                      <CopyButton value={detailWithdrawal.bank_account} label="Số tài khoản" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Chủ tài khoản</p>
                        <p className="font-semibold">{detailWithdrawal.bank_holder}</p>
                      </div>
                      <CopyButton value={detailWithdrawal.bank_holder} label="Chủ tài khoản" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border p-4">
                <p className="mb-3 font-semibold text-foreground">Ghi chú và lịch sử</p>
                {detailWithdrawal.audit_logs?.length ? (
                  <div className="space-y-3">
                    {detailWithdrawal.audit_logs.map((log) => (
                      <div key={log.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{getHistoryLabel(log.action)}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {log.old_status || "—"} → {log.new_status || "—"} · {formatVND(log.amount ?? 0)}
                        </p>
                        {log.note && <p className="mt-1 text-muted-foreground">{cleanDemoText(log.note)}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Chưa có lịch sử xử lý.</p>
                )}
              </section>

              {detailWithdrawal.status === "pending" && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="rounded-xl text-destructive hover:text-destructive" onClick={() => openActionDialog(detailWithdrawal, "reject")}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Từ chối yêu cầu
                    </Button>
                    <Button className="gradient-primary rounded-xl border-0 text-primary-foreground" onClick={() => openActionDialog(detailWithdrawal, "paid")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Đánh dấu đã chi
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Không tìm thấy yêu cầu rút tiền.</p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!actionWithdrawal && !!actionMode} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionMode === "reject" ? "Từ chối yêu cầu rút tiền" : "Đánh dấu đã chi"}
            </DialogTitle>
          </DialogHeader>

          {actionWithdrawal && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Mentor</span>
                  <span className="text-right font-medium">{cleanDemoText(getMentorName(actionWithdrawal))}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Số tiền</span>
                  <MoneyAmount amount={actionWithdrawal.amount} className="text-primary" />
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Tài khoản nhận</span>
                  <span className="text-right">{actionWithdrawal.bank_name} · {actionWithdrawal.bank_account}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Chủ tài khoản</span>
                  <span className="text-right font-medium">{actionWithdrawal.bank_holder}</span>
                </div>
              </div>

              {actionMode === "paid" ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Chỉ đánh dấu đã chi sau khi bạn đã chuyển khoản thành công ngoài ngân hàng.
                  </div>
                  <div className="space-y-2">
                    <Label>Mã tham chiếu chuyển khoản</Label>
                    <Input
                      value={paidReference}
                      onChange={(event) => setPaidReference(event.target.value)}
                      placeholder="VD: VCB-20260630-001"
                      className="rounded-xl"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Lý do từ chối *</Label>
                  <Textarea
                    value={rejectedReason}
                    onChange={(event) => setRejectedReason(event.target.value)}
                    placeholder="Nhập lý do từ chối..."
                    className="min-h-24 rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Ghi chú Admin</Label>
                <Textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Ghi chú nội bộ hoặc thông tin bổ sung..."
                  className="min-h-24 rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeActionDialog} className="rounded-xl">
              Hủy
            </Button>
            <Button
              onClick={() => void submitAction()}
              disabled={actionIsPending}
              className={actionMode === "reject" ? "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary rounded-xl border-0 text-primary-foreground"}
            >
              {actionIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionMode === "reject" ? "Từ chối yêu cầu" : "Đánh dấu đã chi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
