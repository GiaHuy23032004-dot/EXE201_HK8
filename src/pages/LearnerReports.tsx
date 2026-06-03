import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileImage,
  Flag,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  reportStatusClasses,
  reportStatusLabels,
  reportTypeLabels,
  type LearnerReport,
  type ReportAttachment,
  type ReportStatus,
  useLearnerReports,
} from "@/hooks/use-reports";
import { useAuth } from "@/contexts/AuthContext";

type ReportFilter = "all" | ReportStatus;

const filterLabels: Record<ReportFilter, string> = {
  all: "Tất cả",
  pending: "Chờ xử lý",
  resolved: "Đã xử lý",
  dismissed: "Bỏ qua",
  appealed: "Đang xem xét lại",
};

const isImageAttachment = (attachment: ReportAttachment) =>
  attachment.file_type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(attachment.file_url);

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";

function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge className={`${reportStatusClasses[status]} border`}>{reportStatusLabels[status]}</Badge>;
}

function Timeline({ report }: { report: LearnerReport }) {
  const resultReady = report.status === "resolved" || report.status === "dismissed";
  const steps = [
    { label: "Đã gửi báo cáo", done: true },
    { label: "Admin đang xem xét", done: report.status !== "dismissed" || !resultReady },
    { label: "Đã có kết quả", done: resultReady },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div key={step.label} className={`rounded-xl border p-3 ${step.done ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {index + 1}
            </span>
            {step.done && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-sm font-medium text-foreground">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function LearnerReports() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: reports = [], isLoading, isError, error, refetch } = useLearnerReports(userId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [selectedReport, setSelectedReport] = useState<LearnerReport | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const counts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((report) => report.status === "pending").length,
    resolved: reports.filter((report) => report.status === "resolved").length,
    dismissed: reports.filter((report) => report.status === "dismissed").length,
    appealed: reports.filter((report) => report.status === "appealed").length,
  }), [reports]);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesFilter = filter === "all" || report.status === filter;
      const haystack = [
        report.title,
        report.reason,
        report.detail,
        report.course?.title,
        report.reported_user?.name,
        report.reported_user?.email,
      ].filter(Boolean).join(" ").toLowerCase();

      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [filter, reports, search]);

  const selectedImages = useMemo(
    () => selectedReport?.attachments.filter(isImageAttachment) ?? [],
    [selectedReport],
  );
  const activeImage = lightboxIndex !== null ? selectedImages[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => current === null ? current : (current + 1) % Math.max(selectedImages.length, 1));
      }
      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => current === null ? current : (current - 1 + selectedImages.length) % Math.max(selectedImages.length, 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, selectedImages.length]);

  if (!session) {
    return (
      <MainLayout>
        <div className="container max-w-3xl py-20 text-center">
          <Flag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Báo cáo của tôi</h1>
          <p className="mt-2 text-muted-foreground">Vui lòng đăng nhập để xem và gửi báo cáo.</p>
          <Link to="/auth">
            <Button className="mt-6 gradient-primary border-0 text-primary-foreground">Đăng nhập</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link to="/learner/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ChevronLeft className="h-4 w-4" />
              Quay lại dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
                <Flag className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Báo cáo của tôi</h1>
                <p className="text-sm text-muted-foreground">Theo dõi trạng thái các báo cáo bạn đã gửi cho VET.</p>
              </div>
            </div>
          </div>
          <Link to="/search">
            <Button variant="outline" className="rounded-xl">Tìm khóa học</Button>
          </Link>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-5">
          {(Object.keys(filterLabels) as ReportFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                filter === item ? "border-primary bg-primary/5 text-primary" : "bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-xs text-muted-foreground">{filterLabels[item]}</p>
              <p className="mt-1 text-xl font-bold">{counts[item]}</p>
            </button>
          ))}
        </div>

        <div className="mb-5 rounded-2xl border bg-card p-4 shadow-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tiêu đề, lý do, khóa học hoặc mentor..."
              className="rounded-xl pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-14 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
            <p className="font-semibold text-foreground">Không thể tải danh sách báo cáo</p>
            <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Vui lòng thử lại."}</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void refetch()}>Thử lại</Button>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-card">
            <Flag className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-semibold text-foreground">Bạn chưa gửi báo cáo nào</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Khi gặp vấn đề với khóa học, mentor hoặc thanh toán, bạn có thể gửi báo cáo từ trang liên quan.</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-card">
            <Search className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-semibold text-foreground">Không tìm thấy báo cáo phù hợp</p>
            <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa hoặc bộ lọc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div key={report.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{reportTypeLabels[report.type]}</Badge>
                      <StatusBadge status={report.status} />
                      {report.attachments.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <FileImage className="h-3 w-3" />
                          {report.attachments.length} ảnh
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-foreground">{report.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Lý do: {report.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {report.course?.title ? `Khóa học: ${report.course.title}` : report.reported_user?.name ? `Người liên quan: ${report.reported_user.name}` : "Không có đối tượng liên quan"}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(report.created_at)}
                    </p>
                  </div>

                  <Button variant="outline" className="rounded-xl" onClick={() => setSelectedReport(report)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Xem chi tiết
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Chi tiết báo cáo
                  <StatusBadge status={selectedReport.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <section className="rounded-2xl border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{reportTypeLabels[selectedReport.type]}</Badge>
                    <span className="text-xs text-muted-foreground">Tạo lúc: {formatDate(selectedReport.created_at)}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedReport.title}</h2>
                  <p className="mt-2 text-sm font-medium text-foreground">Lý do: {selectedReport.reason}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{selectedReport.detail}</p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Khóa học liên quan" value={selectedReport.course?.title || "Không có"} />
                    <Info label="Người liên quan" value={selectedReport.reported_user?.name || selectedReport.reported_user?.email || "Không có"} />
                    <Info label="Ngày gửi" value={formatDate(selectedReport.created_at)} />
                    <Info label="Ngày xử lý" value={formatDate(selectedReport.resolved_at)} />
                  </div>
                </section>

                <section className="rounded-2xl border bg-card p-4">
                  <p className="mb-3 font-semibold text-foreground">Tiến trình xử lý</p>
                  <Timeline report={selectedReport} />
                </section>

                {(selectedReport.status === "resolved" || selectedReport.status === "dismissed") && selectedReport.admin_verdict && (
                  <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-semibold text-foreground">Kết quả từ Admin</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{selectedReport.admin_verdict}</p>
                    {selectedReport.resolved_at && (
                      <p className="mt-3 text-xs text-muted-foreground">Cập nhật lúc: {formatDate(selectedReport.resolved_at)}</p>
                    )}
                  </section>
                )}

                <section className="rounded-2xl border bg-card p-4">
                  <p className="mb-3 font-semibold text-foreground">Bằng chứng đã gửi</p>
                  {selectedReport.attachments.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {selectedReport.attachments.map((attachment) => {
                        const imageIndex = selectedImages.findIndex((item) => item.id === attachment.id);
                        return isImageAttachment(attachment) ? (
                          <button
                            key={attachment.id}
                            type="button"
                            className="overflow-hidden rounded-xl border bg-muted text-left"
                            onClick={() => setLightboxIndex(imageIndex)}
                          >
                            <img src={attachment.file_url} alt={attachment.file_name || "Bằng chứng"} className="h-32 w-full object-cover" />
                            <p className="truncate px-3 py-2 text-xs text-muted-foreground">{attachment.file_name || "Ảnh bằng chứng"}</p>
                          </button>
                        ) : (
                          <a key={attachment.id} href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border p-3 text-sm hover:bg-muted">
                            {attachment.file_name || attachment.file_url}
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bạn không gửi ảnh bằng chứng cho báo cáo này.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {activeImage && lightboxIndex !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4">
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white hover:bg-white/10 hover:text-white" onClick={() => setLightboxIndex(null)}>
            <X className="h-6 w-6" />
          </Button>
          {selectedImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setLightboxIndex((lightboxIndex - 1 + selectedImages.length) % selectedImages.length)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          <img src={activeImage.file_url} alt={activeImage.file_name || "Bằng chứng"} className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" />
          {selectedImages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setLightboxIndex((lightboxIndex + 1) % selectedImages.length)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
          <p className="absolute bottom-4 max-w-[80vw] truncate text-sm text-white/80">
            {activeImage.file_name || "Bằng chứng"} ({lightboxIndex + 1}/{selectedImages.length})
          </p>
        </div>
      )}
    </MainLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
