import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  ReceiptText,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminLedger,
  type AdminLedgerEntry,
  type LedgerTypeFilter,
} from "@/hooks/useAdminLedger";
import { MoneyAmount, formatVND } from "@/components/mentor/wallet/MoneyAmount";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const typeOptions: Array<{ value: LedgerTypeFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "inflow", label: "Tiền vào" },
  { value: "refund", label: "Hoàn tiền" },
  { value: "payment_failed", label: "Thanh toán lỗi" },
  { value: "payout_paid", label: "Đã chi cho mentor" },
  { value: "payout_pending", label: "Đang chờ chi" },
  { value: "payout_rejected", label: "Từ chối chi" },
];

const entryTypeConfig: Record<AdminLedgerEntry["type"], { label: string; className: string }> = {
  inflow: { label: "Tiền vào", className: "border-blue-200 bg-blue-50 text-blue-700" },
  refund: { label: "Hoàn tiền", className: "border-violet-200 bg-violet-50 text-violet-700" },
  payment_failed: { label: "Thanh toán lỗi", className: "border-rose-200 bg-rose-50 text-rose-700" },
  payout_paid: { label: "Đã chi cho mentor", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  payout_pending: { label: "Đang chờ chi", className: "border-amber-200 bg-amber-50 text-amber-700" },
  payout_rejected: { label: "Từ chối chi", className: "border-slate-200 bg-slate-50 text-slate-700" },
};

const statusLabels: Record<string, string> = {
  success: "Thành công",
  pending: "Đang chờ",
  failed: "Thất bại",
  refunded: "Hoàn tiền",
  paid: "Đã chi",
  rejected: "Từ chối",
};

const metricDescriptions = {
  totalInflow: "Tổng tiền thanh toán thành công từ learner",
  platformFee: "Phần doanh thu VET giữ lại",
  mentorNet: "Phần tiền thuộc về mentor sau khi trừ phí",
  payoutPaid: "Số tiền admin đã thanh toán cho mentor",
  payoutPending: "Số tiền mentor đã yêu cầu rút nhưng chưa chi",
  refundedAmount: "Tổng tiền đã refund cho learner",
};

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

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function MetricCard({
  label,
  value,
  description,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  description: string;
  tone?: string;
}) {
  return (
    <Card className="h-full rounded-2xl border-border/70 bg-background shadow-sm">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-2xl font-extrabold tabular-nums leading-tight", tone)}>
            {formatVND(value)}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ type }: { type: AdminLedgerEntry["type"] }) {
  const config = entryTypeConfig[type];
  return (
    <Badge variant="outline" className={`whitespace-nowrap rounded-full ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function ActorBlock({
  name,
  email,
  fallback,
}: {
  name?: string | null;
  email?: string | null;
  fallback?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">{name || email || fallback || "—"}</p>
      {email && name && <p className="truncate text-xs text-muted-foreground">{email}</p>}
    </div>
  );
}

function AmountCell({ amount }: { amount: number }) {
  return (
    <MoneyAmount
      amount={amount}
      className={amount < 0 ? "text-rose-600" : undefined}
    />
  );
}

export default function AdminLedger() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<LedgerTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filters = useMemo(() => ({
    from: from || undefined,
    to: to || undefined,
    type,
    search: search.trim() || undefined,
  }), [from, to, type, search]);

  const ledgerQuery = useAdminLedger(filters);
  const entries = ledgerQuery.data?.entries ?? [];
  const warnings = ledgerQuery.data?.warnings ?? [];
  const summary = ledgerQuery.data?.summary ?? {
    totalInflow: 0,
    platformFee: 0,
    mentorNet: 0,
    payoutPaid: 0,
    payoutPending: 0,
    refundedAmount: 0,
    failedAmount: 0,
    demoTransactionCount: 0,
    realTransactionCount: 0,
    successTransactionCount: 0,
    mismatchedSuccessCount: 0,
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [from, to, type, search]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = entries.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, entries.length);
  const paginatedEntries = entries.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const exportCsv = () => {
    const rows = [
      ["Thời gian", "Loại", "Mã tham chiếu", "Người gửi", "Người nhận", "Khóa học", "Tổng tiền", "Phí nền tảng", "Tiền mentor nhận", "Trạng thái", "Ghi chú"],
      ...entries.map((entry) => [
        formatDate(entry.createdAt),
        entryTypeConfig[entry.type]?.label ?? entry.type,
        entry.reference ?? "",
        [entry.senderName, entry.senderEmail].filter(Boolean).join(" - "),
        [entry.receiverName, entry.receiverEmail].filter(Boolean).join(" - "),
        entry.courseTitle ?? "",
        String(entry.amount ?? 0),
        String(entry.platformFee ?? 0),
        String(entry.netAmount ?? 0),
        statusLabel(entry.status),
        entry.note ?? "",
      ]),
    ];

    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`vet-so-cai-${date}.csv`, rows);
    toast({ title: "Đã xuất CSV", description: `${entries.length} dòng sổ cái` });
  };

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Sổ cái dòng tiền</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi dòng tiền, phí nền tảng và giao dịch hệ thống.
        </p>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[140px_140px_210px_minmax(280px,1fr)_120px] xl:items-end">
          <div className="space-y-2">
            <Label>Từ ngày</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Đến ngày</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Loại giao dịch</Label>
            <Select value={type} onValueChange={(value) => setType(value as LedgerTypeFilter)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2 xl:col-span-1">
            <Label className="sr-only">Tìm kiếm</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm mã giao dịch, mentor, learner, khóa học..."
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>
          <Button
            onClick={exportCsv}
            disabled={entries.length === 0}
            variant="outline"
            className="h-10 w-full rounded-xl xl:w-auto xl:justify-self-end"
          >
            <Download className="mr-2 h-4 w-4" />
            Xuất CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Tổng tiền vào"
          value={summary.totalInflow}
          description={metricDescriptions.totalInflow}
          tone="text-blue-700"
        />
        <MetricCard
          label="Phí nền tảng"
          value={summary.platformFee}
          description={metricDescriptions.platformFee}
          tone="text-primary"
        />
        <MetricCard
          label="Tiền mentor nhận"
          value={summary.mentorNet}
          description={metricDescriptions.mentorNet}
          tone="text-emerald-700"
        />
        <MetricCard
          label="Đã chi cho mentor"
          value={summary.payoutPaid}
          description={metricDescriptions.payoutPaid}
          tone="text-emerald-700"
        />
        <MetricCard
          label="Đang chờ chi"
          value={summary.payoutPending}
          description={metricDescriptions.payoutPending}
          tone="text-amber-700"
        />
        <MetricCard
          label="Hoàn tiền"
          value={summary.refundedAmount}
          description={metricDescriptions.refundedAmount}
          tone="text-violet-700"
        />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" />
            Cảnh báo đối soát
          </div>
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Dòng sổ cái</h2>
              <p className="text-sm text-muted-foreground">Dữ liệu tổng hợp từ giao dịch thanh toán và yêu cầu rút tiền.</p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full">
              {entries.length} dòng
            </Badge>
          </div>

          {ledgerQuery.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : ledgerQuery.isError ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
              <p className="font-semibold text-destructive">Không thể tải sổ cái dòng tiền.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ledgerQuery.error instanceof Error ? ledgerQuery.error.message : "Vui lòng thử lại."}
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void ledgerQuery.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <ReceiptText className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Chưa có giao dịch phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">Thử đổi khoảng ngày, loại giao dịch hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Mã & thời gian</TableHead>
                      <TableHead>Người gửi → Người nhận</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead>Loại giao dịch</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">Phí nền tảng</TableHead>
                      <TableHead className="text-right">Tiền mentor nhận</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((entry) => (
                      <TableRow key={`${entry.source}-${entry.id}`} className="align-top hover:bg-muted/20">
                        <TableCell className="min-w-48">
                          <div className="max-w-48 truncate font-medium text-foreground">{entry.reference || entry.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.isDemo && (
                              <Badge variant="outline" className="rounded-full bg-muted/60 text-[10px]">
                                Dữ liệu mẫu
                              </Badge>
                            )}
                            {entry.hasMismatch && (
                              <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                                Cần kiểm tra
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-64">
                          <div className="grid gap-2 text-sm">
                            <div className="rounded-xl bg-muted/30 px-3 py-2">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Người gửi</p>
                              <ActorBlock name={entry.senderName} email={entry.senderEmail} />
                            </div>
                            <div className="rounded-xl bg-muted/30 px-3 py-2">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Người nhận</p>
                              <ActorBlock name={entry.receiverName} email={entry.receiverEmail} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-56">
                          <div className="line-clamp-2 font-medium text-foreground">{entry.courseTitle || entry.note || "—"}</div>
                          {entry.courseTitle && entry.note && <div className="line-clamp-1 text-xs text-muted-foreground">{entry.note}</div>}
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={entry.type} />
                        </TableCell>
                        <TableCell className="text-right">
                          <AmountCell amount={entry.amount} />
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.platformFee == null ? <span className="text-muted-foreground">—</span> : <AmountCell amount={entry.platformFee} />}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.netAmount == null ? <span className="text-muted-foreground">—</span> : <AmountCell amount={entry.netAmount} />}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="whitespace-nowrap rounded-full">
                            {statusLabel(entry.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t bg-muted/10 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Hiển thị {pageStart}–{pageEnd} / {entries.length} giao dịch</span>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
