import { useState } from "react";
import { Megaphone, Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useMentorPromotions,
  useRequestPromotion,
  PROMOTION_PACKAGES,
  type Promotion,
} from "@/hooks/usePromotion";
import { useMentorCourses } from "@/hooks/use-courses";
import { useMentorWallet } from "@/hooks/useMentorWallet";
import { useAuth } from "@/contexts/AuthContext";

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function RequestPromotionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: courses = [], isLoading: loadingCourses } = useMentorCourses(user?.id);
  const { data: wallet } = useMentorWallet();
  const requestPromotion = useRequestPromotion();

  const [courseId, setCourseId] = useState("");
  const [days, setDays] = useState(7);

  const selectedPackage = PROMOTION_PACKAGES.find((p) => p.days === days) ?? PROMOTION_PACKAGES[1];
  const balance = wallet?.balance ?? 0;
  const canAfford = balance >= selectedPackage.price;

  const handleSubmit = async () => {
    if (!courseId) {
      toast({ title: "Vui lòng chọn khóa học", variant: "destructive" });
      return;
    }
    if (!canAfford) {
      toast({
        title: "Số dư không đủ",
        description: `Bạn cần ít nhất ${formatVND(selectedPackage.price)} trong ví. Hãy nạp tiền hoặc chờ nhận doanh thu.`,
        variant: "destructive",
      });
      return;
    }
    try {
      await requestPromotion.mutateAsync({ course_id: courseId, days });
      toast({ title: "Đã gửi yêu cầu quảng cáo", description: "Admin sẽ xét duyệt trong 24 giờ." });
      onOpenChange(false);
      setCourseId("");
      setDays(7);
    } catch (err) {
      toast({
        title: "Không thể tạo quảng cáo",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Đăng quảng cáo khóa học</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Balance info */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Số dư ví</span>
            <span className={`font-semibold ${balance === 0 ? "text-destructive" : "text-primary"}`}>
              {formatVND(balance)}
            </span>
          </div>

          {/* Course select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chọn khóa học</label>
            <Select value={courseId} onValueChange={setCourseId} disabled={loadingCourses}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={loadingCourses ? "Đang tải..." : "Chọn khóa học muốn quảng cáo"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c: { id: string; title: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Package select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Gói quảng cáo (15.000đ/ngày)</label>
            <div className="grid grid-cols-2 gap-2">
              {PROMOTION_PACKAGES.map((pkg) => (
                <button
                  key={pkg.days}
                  type="button"
                  onClick={() => setDays(pkg.days)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    days === pkg.days
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold text-sm">{pkg.label}</div>
                  <div className={`text-xs mt-0.5 ${days === pkg.days ? "text-primary" : "text-muted-foreground"}`}>
                    {formatVND(pkg.price)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thời gian</span>
              <span className="font-medium">{days} ngày</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí quảng cáo</span>
              <span className="font-semibold text-primary">{formatVND(selectedPackage.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số dư sau khi trừ</span>
              <span className={`font-medium ${balance - selectedPackage.price < 0 ? "text-destructive" : "text-foreground"}`}>
                {formatVND(Math.max(0, balance - selectedPackage.price))}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Số dư không đủ. Hãy nạp tiền vào ví hoặc chờ nhận doanh thu từ khóa học.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={requestPromotion.isPending || !canAfford || !courseId}
            className="rounded-xl border-0 gradient-primary text-primary-foreground"
          >
            {requestPromotion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi yêu cầu ({formatVND(selectedPackage.price)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MentorPromotions() {
  const { data: promotions = [], isLoading, isError } = useMentorPromotions();
  const [dialogOpen, setDialogOpen] = useState(false);

  const active = promotions.filter((p) => p.status === "active").length;
  const pending = promotions.filter((p) => p.status === "pending").length;

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quảng cáo khóa học</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tăng lượt hiển thị khóa học của bạn với gói quảng cáo 15.000đ/ngày.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="rounded-xl border-0 gradient-primary text-primary-foreground"
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Đăng quảng cáo mới
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Tổng quảng cáo</p>
              <p className="mt-1 text-2xl font-bold">{promotions.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Đang chạy</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{active}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Chờ duyệt</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600">{pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-primary" />
              Lịch sử quảng cáo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                <p className="font-semibold text-destructive">Không thể tải danh sách quảng cáo.</p>
              </div>
            ) : promotions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
                <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-semibold text-foreground">Chưa có quảng cáo nào</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tạo quảng cáo để khóa học của bạn xuất hiện nổi bật hơn.
                </p>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="mt-4 rounded-xl border-0 gradient-primary text-primary-foreground"
                >
                  Đăng quảng cáo đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {promo.course?.thumbnail_url ? (
                        <img
                          src={promo.course.thumbnail_url}
                          alt={promo.course.title}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground line-clamp-1">
                          {promo.course?.title ?? "Khóa học"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(promo.starts_at)} – {formatDate(promo.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Phí</p>
                        <p className="font-semibold text-primary">{formatVND(promo.paid_amount)}</p>
                      </div>
                      <StatusBadge status={promo.status} />
                    </div>
                    {promo.status === "rejected" && promo.rejection_reason && (
                      <div className="w-full rounded-xl bg-destructive/5 px-3 py-2 text-xs text-destructive sm:hidden">
                        Lý do: {promo.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RequestPromotionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </MentorLayout>
  );
}
