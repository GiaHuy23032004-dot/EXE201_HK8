import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Megaphone, Search, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  useAdminPromotions,
  useApprovePromotion,
  useRejectPromotion,
  type Promotion,
} from "@/hooks/usePromotion";

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(value?: string | null) {
  return (value || "M")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusBadge({ status }: { status: Promotion["status"] }) {
  const map: Record<Promotion["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending:  { label: "Chờ duyệt",  variant: "secondary" },
    active:   { label: "Đang chạy",  variant: "default" },
    expired:  { label: "Hết hạn",    variant: "outline" },
    rejected: { label: "Bị từ chối", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

function RejectDialog({
  promotion,
  open,
  onOpenChange,
}: {
  promotion: Promotion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const rejectPromotion = useRejectPromotion();
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!promotion) return;
    if (!reason.trim()) {
      toast({ title: "Vui lòng nhập lý do từ chối", variant: "destructive" });
      return;
    }
    try {
      await rejectPromotion.mutateAsync({ promotionId: promotion.id, reason });
      toast({ title: "Đã từ chối quảng cáo", description: "Số tiền sẽ được hoàn lại vào ví mentor." });
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Không thể từ chối",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Từ chối quảng cáo</DialogTitle>
        </DialogHeader>
        {promotion && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khóa học</span>
                <span className="font-medium text-right">{promotion.course?.title ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mentor</span>
                <span className="font-medium">{promotion.mentor?.name ?? promotion.mentor?.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí đã trả</span>
                <span className="font-semibold text-primary">{formatVND(promotion.paid_amount)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lý do từ chối</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do để mentor biết..."
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
            disabled={rejectPromotion.isPending}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {rejectPromotion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Từ chối & hoàn tiền
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPromotions() {
  const promotionsQuery = useAdminPromotions();
  const approvePromotion = useApprovePromotion();
  const { toast } = useToast();

  const promotions = promotionsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<Promotion | null>(null);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return promotions.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const text = [p.course?.title, p.mentor?.name, p.mentor?.email].filter(Boolean).join(" ").toLowerCase();
      return matchStatus && (!kw || text.includes(kw));
    });
  }, [promotions, search, statusFilter]);

  const stats = useMemo(() => ({
    total: promotions.length,
    pending: promotions.filter((p) => p.status === "pending").length,
    active: promotions.filter((p) => p.status === "active").length,
    revenue: promotions.filter((p) => p.status !== "rejected").reduce((s, p) => s + p.paid_amount, 0),
  }), [promotions]);

  const handleApprove = async (promo: Promotion) => {
    try {
      await approvePromotion.mutateAsync(promo.id);
      toast({ title: "Đã duyệt quảng cáo", description: `Khóa học "${promo.course?.title}" sẽ hiển thị nổi bật.` });
    } catch (err) {
      toast({
        title: "Không thể duyệt",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quản lý quảng cáo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Duyệt hoặc từ chối yêu cầu quảng cáo khóa học từ mentor.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Tổng</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Chờ duyệt</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Đang chạy</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Doanh thu phí QC</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formatVND(stats.revenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-primary" />
              Danh sách quảng cáo
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm khóa học, mentor..."
                  className="w-full rounded-xl pl-9 sm:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full rounded-xl sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="active">Đang chạy</SelectItem>
                  <SelectItem value="expired">Hết hạn</SelectItem>
                  <SelectItem value="rejected">Bị từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {promotionsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
              <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold">Không có quảng cáo phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khóa học</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead className="text-right">Phí</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {promo.course?.thumbnail_url ? (
                            <img
                              src={promo.course.thumbnail_url}
                              className="h-10 w-10 rounded-lg object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Megaphone className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <span className="max-w-[180px] truncate font-medium">{promo.course?.title ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={promo.mentor?.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(promo.mentor?.name ?? promo.mentor?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">{promo.mentor?.name ?? "Mentor"}</div>
                            <div className="text-xs text-muted-foreground">{promo.mentor?.email ?? "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{formatDate(promo.starts_at)}</div>
                        <div className="text-xs">→ {formatDate(promo.expires_at)}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatVND(promo.paid_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={promo.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {promo.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectTarget(promo)}
                              className="rounded-xl text-destructive hover:text-destructive"
                            >
                              <XCircle className="mr-1.5 h-4 w-4" />
                              Từ chối
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(promo)}
                              disabled={approvePromotion.isPending}
                              className="rounded-xl border-0 gradient-primary text-primary-foreground"
                            >
                              {approvePromotion.isPending ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              )}
                              Duyệt
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

      <RejectDialog
        promotion={rejectTarget}
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      />
    </div>
  );
}
