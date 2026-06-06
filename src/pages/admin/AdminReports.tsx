import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Gavel,
  History,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mail,
  Search,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCourseCategoryLabel } from "@/constants/courseCategories";

type ReportStatus = "pending" | "resolved" | "dismissed" | "appealed";
type ReportType = "course" | "mentor" | "comment" | "payment";
type ReportFilter = "all" | ReportStatus | "auto_hidden";
type PenaltyAction = "dismiss" | "strike_1" | "strike_2" | "strike_3";

type ProfileRef = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  is_blocked?: boolean;
  created_at: string;
};

type CourseRef = {
  id: string;
  title: string;
  mentor_id: string;
  status: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  price: number;
  category: string;
  format: string;
  image_url: string | null;
};

type ReportAttachment = {
  id: string;
  report_id: string;
  file_url: string;
  file_path: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
};

type MentorStrike = {
  id: string;
  level: number;
  reason: string;
  expires_at: string | null;
  created_at: string;
};

type MentorViolationSummary = {
  active_count: number;
  total_count: number;
  strikes: MentorStrike[];
};

type ReportRow = {
  id: string;
  type: ReportType;
  title: string;
  reason: string;
  detail: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  course_id: string | null;
  status: ReportStatus;
  admin_verdict: string | null;
  admin_email: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: ProfileRef | null;
  reported_user: ProfileRef | null;
  course: CourseRef | null;
  attachments: ReportAttachment[];
  mentor_id_for_penalty?: string | null;
  mentor_strikes?: MentorStrike[];
  mentor_violation_summary?: MentorViolationSummary;
  course_counts?: { bookings: number; reviews: number; reports: number } | null;
  course_pending_report_count?: number;
  auto_hidden?: boolean;
};

type ReporterHistory = {
  summary: Record<"total" | ReportStatus, number>;
  reports: ReportRow[];
};

const reportFilters: ReportFilter[] = ["all", "pending", "appealed", "resolved", "dismissed", "auto_hidden"];

const filterLabels: Record<ReportFilter, string> = {
  all: "Tất cả",
  pending: "Chờ xử lý",
  appealed: "Kháng cáo",
  resolved: "Đã xử lý",
  dismissed: "Bỏ qua",
  auto_hidden: "Tự động ẩn",
};

const typeLabels: Record<ReportType, string> = {
  course: "Khóa học",
  mentor: "Mentor",
  comment: "Bình luận",
  payment: "Thanh toán",
};

const statusClasses: Record<ReportStatus, string> = {
  pending: "bg-warning/10 text-warning border-0",
  appealed: "bg-primary/10 text-primary border-0",
  resolved: "bg-success/10 text-success border-0",
  dismissed: "bg-muted text-muted-foreground border-0",
};

const penaltyOptions: Array<{
  action: PenaltyAction;
  label: string;
  short: string;
  description: string;
  icon: typeof Ban;
  tone: string;
  selectedTone: string;
}> = [
  {
    action: "dismiss",
    label: "Bỏ qua báo cáo",
    short: "Sai sự thật / Không phạt",
    description: "Không tạo gậy, không ẩn khóa học và không hạn chế mentor.",
    icon: Ban,
    tone: "border-muted bg-muted/20 hover:bg-muted/40",
    selectedTone: "border-muted-foreground bg-muted/60 ring-2 ring-muted-foreground/20",
  },
  {
    action: "strike_1",
    label: "Gậy 1: Nhắc nhở",
    short: "Yêu cầu sửa nội dung",
    description: "Tạo gậy mức 1, hết hạn sau 30 ngày. Không khóa quyền đăng.",
    icon: ShieldCheck,
    tone: "border-yellow-200 bg-yellow-50 hover:bg-yellow-100",
    selectedTone: "border-yellow-400 bg-yellow-100 ring-2 ring-yellow-300",
  },
  {
    action: "strike_2",
    label: "Gậy 2: Gỡ bài & cấm đăng 7 ngày",
    short: "Tạm khóa quyền đăng nội dung mới",
    description: "Tạo gậy mức 2, ẩn khóa học liên quan và cấm đăng 7 ngày.",
    icon: AlertTriangle,
    tone: "border-orange-200 bg-orange-50 hover:bg-orange-100",
    selectedTone: "border-orange-500 bg-orange-100 ring-2 ring-orange-300",
  },
  {
    action: "strike_3",
    label: "Gậy 3: Khóa vĩnh viễn tài khoản Mentor",
    short: "Vi phạm nghiêm trọng / lặp lại nhiều lần",
    description: "Tạo gậy mức 3, khóa mentor và ẩn toàn bộ khóa học đang hoạt động.",
    icon: Lock,
    tone: "border-red-200 bg-red-50 hover:bg-red-100",
    selectedTone: "border-red-500 bg-red-100 ring-2 ring-red-300",
  },
];

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa có");
const formatShortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có");
const safeTextClasses = "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]";
const safeInlineClasses = "min-w-0 max-w-full break-words [overflow-wrap:anywhere] [word-break:break-word]";
const isImageAttachment = (attachment: ReportAttachment) =>
  attachment.file_type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(attachment.file_url);
const isActiveStrike = (strike: MentorStrike) =>
  !strike.expires_at || new Date(strike.expires_at).getTime() > Date.now();
const isAutoHiddenReport = (report: ReportRow) =>
  Boolean(report.auto_hidden || (report.course?.is_hidden && report.course.hidden_reason === "Auto-hidden due to high report volume") || (report.course_pending_report_count ?? 0) >= 5);

function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge className={statusClasses[status]}>{filterLabels[status]}</Badge>;
}

function generateEmailContent(report: ReportRow, penalty: PenaltyAction) {
  const mentorName = report.reported_user?.name || "Mentor";
  const courseLine = report.course ? `Khóa học liên quan: ${report.course.title}.` : "Nội dung liên quan không gắn với một khóa học cụ thể.";
  const opening = `Xin chào ${mentorName},\n\nVET đã xem xét báo cáo "${report.title}". ${courseLine}\n`;

  const bodyByPenalty: Record<PenaltyAction, string> = {
    dismiss:
      "Kết luận: báo cáo chưa đủ cơ sở xử lý hoặc không xác nhận có vi phạm. Tài khoản và khóa học của bạn không bị áp dụng hình phạt.",
    strike_1:
      "Kết luận: hệ thống ghi nhận vi phạm nhẹ. Bạn nhận Gậy 1: Nhắc nhở. Vui lòng rà soát và chỉnh sửa nội dung để tránh tái phạm.",
    strike_2:
      "Kết luận: hệ thống xác nhận vi phạm rõ ràng. Bạn nhận Gậy 2: Gỡ bài & cấm đăng 7 ngày. Khóa học liên quan có thể bị tạm ẩn trong thời gian xử lý.",
    strike_3:
      "Kết luận: hệ thống xác nhận vi phạm nghiêm trọng. Bạn nhận Gậy 3: Khóa tài khoản Mentor. Các khóa học đang hoạt động có thể bị tạm ẩn.",
  };

  return `${opening}\n${bodyByPenalty[penalty]}\n\nNếu bạn cho rằng quyết định này chưa chính xác, bạn có thể gửi kháng cáo để Admin xem xét lại.\n\nĐội ngũ VET`;
}

export default function AdminReports() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [penaltyAction, setPenaltyAction] = useState<PenaltyAction | null>(null);
  const [verdict, setVerdict] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmLevel3Open, setConfirmLevel3Open] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reporterHistory, setReporterHistory] = useState<ReporterHistory | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [topDetailExpanded, setTopDetailExpanded] = useState(false);

  const invokeReportAction = async (body: Record<string, unknown>) => {
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Missing admin session");

    const { data, error } = await supabase.functions.invoke("admin-report-actions", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (import.meta.env.DEV) {
      console.log("admin-report-actions response", { body, data, error });
    }

    if (error || data?.error) {
      throw new Error(error?.message || data?.error || "Không thể thực hiện thao tác.");
    }

    return data;
  };

  const {
    data: reports = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-reports"],
    enabled: !!session?.access_token,
    queryFn: async () => {
      const data = await invokeReportAction({ action: "list_reports" });
      return (data.reports ?? []) as ReportRow[];
    },
  });

  const counts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((report) => report.status === "pending").length,
    appealed: reports.filter((report) => report.status === "appealed").length,
    resolved: reports.filter((report) => report.status === "resolved").length,
    dismissed: reports.filter((report) => report.status === "dismissed").length,
    auto_hidden: reports.filter(isAutoHiddenReport).length,
  }), [reports]);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesFilter =
        filter === "all" ? true : filter === "auto_hidden" ? isAutoHiddenReport(report) : report.status === filter;
      const matchesSearch =
        !term ||
        [
          report.title,
          report.reason,
          report.reporter?.name,
          report.reporter?.email,
          report.reported_user?.name,
          report.reported_user?.email,
          report.course?.title,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [filter, reports, search]);

  const imageAttachments = selectedReport?.attachments.filter(isImageAttachment) ?? [];
  const currentLightbox = lightboxIndex !== null ? imageAttachments[lightboxIndex] : null;
  const reportAlreadyClosed = selectedReport?.status === "resolved" || selectedReport?.status === "dismissed";
  const selectedDetail = selectedReport?.detail || "Không có mô tả chi tiết.";
  const hasLongTopDetail = selectedDetail.length > 300;
  const topDetailText = hasLongTopDetail && !topDetailExpanded
    ? `${selectedDetail.slice(0, 300)}...`
    : selectedDetail;

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") setLightboxIndex((index) => Math.max((index ?? 0) - 1, 0));
      if (event.key === "ArrowRight") {
        setLightboxIndex((index) => Math.min((index ?? 0) + 1, Math.max(imageAttachments.length - 1, 0)));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageAttachments.length, lightboxIndex]);

  const openDetail = async (reportId: string) => {
    setDetailLoadingId(reportId);
    try {
      const data = await invokeReportAction({ action: "get_report_detail", reportId });
      const report = data.report as ReportRow;
      setSelectedReport(report);
      setPenaltyAction(null);
      setVerdict(report.admin_verdict ?? "");
      setEmailContent(report.admin_email ?? "");
      setTopDetailExpanded(false);
      setFormError("");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải chi tiết báo cáo.",
        variant: "destructive",
      });
    } finally {
      setDetailLoadingId(null);
    }
  };

  const refreshReports = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] }),
    ]);
  };

  const updateSelected = (report: ReportRow | null) => {
    setSelectedReport(report);
    if (!report) {
      setPenaltyAction(null);
      setVerdict("");
      setEmailContent("");
      setFormError("");
      setLightboxIndex(null);
      setTopDetailExpanded(false);
      setReporterHistory(null);
      setHistoryOpen(false);
      setConfirmLevel3Open(false);
    }
  };

  const selectPenalty = (nextPenalty: PenaltyAction) => {
    if (!selectedReport) return;
    setPenaltyAction(nextPenalty);
    setEmailContent(generateEmailContent(selectedReport, nextPenalty));
    setFormError("");
  };

  const validatePenalty = () => {
    if (!selectedReport) return false;
    if (!penaltyAction) {
      setFormError("Vui lòng chọn hình thức xử lý.");
      return false;
    }
    if (!verdict.trim()) {
      setFormError("Vui lòng nhập phán quyết Admin.");
      return false;
    }
    if ((penaltyAction === "strike_2" || penaltyAction === "strike_3") && verdict.trim().length < 20) {
      setFormError("Gậy 2 và Gậy 3 cần phán quyết rõ ràng hơn, tối thiểu 20 ký tự.");
      return false;
    }
    if (penaltyAction !== "dismiss" && !selectedReport.mentor_id_for_penalty && selectedReport.reported_user?.role !== "mentor") {
      setFormError("Chỉ có thể áp dụng gậy phạt cho tài khoản Mentor.");
      return false;
    }
    if (reportAlreadyClosed) {
      setFormError("Báo cáo đã có kết quả. Không thể áp dụng hình phạt mới.");
      return false;
    }
    return true;
  };

  const submitPenalty = async () => {
    if (!selectedReport || !penaltyAction) return;
    if (!validatePenalty()) return;
    if (penaltyAction === "strike_3") {
      setConfirmLevel3Open(true);
      return;
    }
    await applyPenalty();
  };

  const applyPenalty = async () => {
    if (!selectedReport || !penaltyAction) return;

    setActionLoading("apply-penalty");
    try {
      await invokeReportAction({
        action: "apply_penalty",
        reportId: selectedReport.id,
        penaltyAction,
        verdict: verdict.trim(),
        mentorEmailContent: emailContent.trim(),
      });
      await refreshReports();
      toast({
        title: penaltyAction === "dismiss" ? "Đã bỏ qua báo cáo" : "Đã áp dụng hình thức xử lý",
        description: "Báo cáo và dữ liệu moderation đã được cập nhật.",
      });
      updateSelected(null);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xử lý báo cáo.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmLevel3Open(false);
    }
  };

  const markAppealed = async () => {
    if (!selectedReport) return;
    setActionLoading("appeal");
    try {
      const data = await invokeReportAction({ action: "mark_appealed", reportId: selectedReport.id });
      await refreshReports();
      setSelectedReport(data.report as ReportRow);
      toast({ title: "Đã đánh dấu kháng cáo" });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật báo cáo.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openReporterHistory = async () => {
    if (!selectedReport?.reporter_id) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await invokeReportAction({
        action: "get_reporter_history",
        reporterId: selectedReport.reporter_id,
      });
      setReporterHistory(data.history as ReporterHistory);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải lịch sử báo cáo.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Flag className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Báo cáo</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Điều tra báo cáo, xem bằng chứng và áp dụng hình thức xử lý theo hệ thống 3 gậy.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Tìm theo tiêu đề, người báo cáo, khóa học, lý do..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {reportFilters.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? "default" : "outline"}
                className={`rounded-xl ${filter === item ? "gradient-primary border-0 text-primary-foreground" : ""}`}
                onClick={() => setFilter(item)}
              >
                {filterLabels[item]} ({counts[item]})
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Không thể tải danh sách báo cáo</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Vui lòng thử lại sau."}
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-card">
          <Flag className="mb-3 h-12 w-12 text-muted" />
          <p className="font-semibold text-foreground">Không có báo cáo phù hợp</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div key={report.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="rounded-xl bg-destructive/10 p-3 text-destructive">
                  {report.type === "course" ? <BookOpen className="h-5 w-5" /> : report.type === "payment" ? <FileText className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className={`font-semibold text-foreground ${safeInlineClasses}`}>{report.title}</h2>
                    <StatusBadge status={report.status} />
                    <Badge variant="outline">{typeLabels[report.type]}</Badge>
                    {isAutoHiddenReport(report) && <Badge className="border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
                    {report.attachments.length > 0 && <Badge variant="outline">{report.attachments.length} bằng chứng</Badge>}
                  </div>
                  <p className={`text-sm text-muted-foreground ${safeTextClasses}`}>Lý do: {report.reason}</p>
                  <p className={`mt-1 text-xs text-muted-foreground ${safeTextClasses}`}>
                    Người báo cáo: {report.reporter?.name || report.reporter?.email || "Không rõ"} ·
                    {" "}Bị báo cáo: {report.reported_user?.name || report.reported_user?.email || "Không có"} ·
                    {" "}Khóa học: {report.course?.title || "Không gắn khóa học"}
                  </p>
                  {report.detail && <p className={`mt-2 line-clamp-2 text-sm text-muted-foreground ${safeTextClasses}`}>{report.detail}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tạo lúc: {formatDate(report.created_at)}
                    {report.course_id && <> · Pending reports khóa học: {report.course_pending_report_count ?? 0}</>}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => void openDetail(report.id)}>
                    {detailLoadingId === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    Xem chi tiết
                  </Button>
                  {(report.status === "pending" || report.status === "appealed") && (
                    <Button className="gradient-primary rounded-xl border-0 text-primary-foreground" onClick={() => void openDetail(report.id)}>
                      <Gavel className="mr-2 h-4 w-4" />
                      Xử lý
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && updateSelected(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[min(1400px,calc(100vw-32px))] overflow-hidden rounded-2xl p-0">
          {selectedReport && (
            <>
              <DialogHeader className="min-w-0 border-b px-6 py-5">
                <DialogTitle className={`flex min-w-0 flex-wrap items-center gap-2 text-xl ${safeInlineClasses}`}>
                  Xử lý báo cáo – Quy trình kiểm duyệt
                  <StatusBadge status={selectedReport.status} />
                  {isAutoHiddenReport(selectedReport) && <Badge className="border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="max-h-[calc(90vh-88px)] overflow-y-auto overflow-x-hidden px-6 py-5">
              <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-w-0 space-y-5 overflow-hidden">
                  <StepTitle step="2" title="Thẩm định" />
                  <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-5 shadow-card">
                    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="min-w-0">
                        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
                          <h2 className={`text-lg font-semibold text-foreground ${safeInlineClasses}`}>{selectedReport.title}</h2>
                          <Badge variant="outline">{typeLabels[selectedReport.type]}</Badge>
                        </div>
                        <p className={`text-sm font-medium text-foreground ${safeTextClasses}`}>Lý do: {selectedReport.reason}</p>
                        <div className="mt-3 max-h-40 overflow-y-auto overflow-x-hidden rounded-xl border bg-muted/30 p-3">
                          <p className={`text-sm text-muted-foreground ${safeTextClasses}`}>{topDetailText}</p>
                        </div>
                        {hasLongTopDetail && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-auto rounded-lg px-2 text-primary"
                            onClick={() => setTopDetailExpanded((value) => !value)}
                          >
                            {topDetailExpanded ? "Thu gọn" : "Xem thêm"}
                          </Button>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">Tạo lúc: {formatDate(selectedReport.created_at)}</p>

                        <div className="mt-4 flex min-w-0 flex-wrap gap-3">
                          {selectedReport.course && (
                            <a className="min-w-0" href={`/course/${selectedReport.course.id}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="h-auto whitespace-normal rounded-lg text-left">
                                <ExternalLink className="mr-1 h-4 w-4" />
                                Xem nội dung bài đăng
                              </Button>
                            </a>
                          )}
                          {selectedReport.reported_user && (
                            <a className="min-w-0" href={`/mentor/${selectedReport.reported_user.user_id}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="h-auto whitespace-normal rounded-lg text-left">
                                <ExternalLink className="mr-1 h-4 w-4" />
                                Xem hồ sơ Mentor
                              </Button>
                            </a>
                          )}
                          <Button variant="outline" size="sm" className="h-auto whitespace-normal rounded-lg text-left" onClick={() => void openReporterHistory()}>
                            <History className="mr-1 h-4 w-4" />
                            Lịch sử báo cáo của người tố cáo
                          </Button>
                        </div>
                      </div>

                      <MentorViolationProgress summary={selectedReport.mentor_violation_summary} strikes={selectedReport.mentor_strikes ?? []} />
                    </div>
                  </section>

                  <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Chi tiết nội dung báo cáo</p>
                    <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border bg-muted/30 p-4">
                      <p className={`text-sm text-muted-foreground ${safeTextClasses}`}>{selectedDetail}</p>
                    </div>
                  </section>

                  <section className="grid min-w-0 gap-3 md:grid-cols-2">
                    <PersonCard title="Người báo cáo" profile={selectedReport.reporter} />
                    <PersonCard title="Mentor / người bị báo cáo" profile={selectedReport.reported_user} />
                  </section>

                  <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
                    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Khóa học / sản phẩm liên quan</p>
                        <p className={`text-sm text-muted-foreground ${safeTextClasses}`}>{selectedReport.course?.title || "Không gắn khóa học"}</p>
                      </div>
                      {selectedReport.course && (
                        <a className="min-w-0" href={`/course/${selectedReport.course.id}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-auto whitespace-normal rounded-lg text-left">
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Mở khóa học
                          </Button>
                        </a>
                      )}
                    </div>
                    {selectedReport.course ? (
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <Info label="Danh mục" value={getCourseCategoryLabel(selectedReport.course.category)} />
                        <Info label="Trạng thái" value={selectedReport.course.status} />
                        <Info label="Hiển thị" value={selectedReport.course.is_hidden ? "Đã tạm ẩn" : "Đang hiển thị"} />
                        <Info label="Booking" value={selectedReport.course_counts?.bookings ?? 0} />
                        <Info label="Review" value={selectedReport.course_counts?.reviews ?? 0} />
                        <Info label="Pending reports" value={selectedReport.course_pending_report_count ?? 0} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Báo cáo này không liên kết với khóa học cụ thể.</p>
                    )}
                  </section>

                  <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Bằng chứng đính kèm</p>
                    {selectedReport.attachments.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {selectedReport.attachments.map((attachment) => {
                          const imageIndex = imageAttachments.findIndex((item) => item.id === attachment.id);
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
                              <FileText className="mb-2 h-5 w-5 text-primary" />
                              <span className="line-clamp-2">{attachment.file_name || attachment.file_url}</span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-xl border border-dashed py-8 text-sm text-muted-foreground">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Chưa có bằng chứng đính kèm
                      </div>
                    )}
                  </section>

                  {(selectedReport.admin_verdict || selectedReport.resolved_at || selectedReport.admin_email) && (
                    <section className="min-w-0 overflow-hidden rounded-2xl border bg-muted/30 p-4">
                      <p className="text-sm font-semibold text-foreground">Lịch sử quyết định</p>
                      <p className={`mt-2 text-sm text-muted-foreground ${safeTextClasses}`}>{selectedReport.admin_verdict || "Chưa có phán quyết."}</p>
                      {selectedReport.admin_email && <p className={`mt-2 text-sm text-muted-foreground ${safeTextClasses}`}>Email: {selectedReport.admin_email}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">Resolved at: {formatDate(selectedReport.resolved_at)}</p>
                    </section>
                  )}
                </div>

                <aside className="min-w-0 space-y-5">
                  <StepTitle step="3" title="Phán quyết" />
                  {reportAlreadyClosed && (
                    <div className="rounded-2xl border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
                      Báo cáo này đã có kết quả. Các nút áp dụng hình phạt mới đang bị khóa để tránh ghi đè lịch sử xử lý.
                    </div>
                  )}

                  <section className="rounded-2xl border bg-card p-4 shadow-card">
                    <div className="mb-4 min-w-0">
                      <p className={`font-semibold text-foreground ${safeInlineClasses}`}>Chọn hình thức xử lý (Hệ thống 3 gậy)</p>
                      <p className={`mt-1 text-sm text-muted-foreground ${safeTextClasses}`}>Báo cáo nhiều lần chỉ kích hoạt auto-hide. Gậy chỉ được tạo khi Admin xác nhận vi phạm.</p>
                    </div>

                    <div className="space-y-3">
                      {penaltyOptions.map((option) => (
                        <PenaltyCard
                          key={option.action}
                          option={option}
                          selected={penaltyAction === option.action}
                          disabled={reportAlreadyClosed || actionLoading === "apply-penalty"}
                          onSelect={() => selectPenalty(option.action)}
                        />
                      ))}
                    </div>
                  </section>

                  <StepTitle step="4" title="Nội dung thông báo" />
                  <section className="rounded-2xl border bg-card p-4 shadow-card">
                    <Label htmlFor="admin-verdict">Phán quyết Admin</Label>
                    <Textarea
                      id="admin-verdict"
                      value={verdict}
                      onChange={(event) => {
                        setVerdict(event.target.value);
                        setFormError("");
                      }}
                      className="mt-2 min-h-28"
                      placeholder="Nhập kết luận kiểm duyệt, bằng chứng đã xem xét và lý do áp dụng hình thức xử lý..."
                      disabled={reportAlreadyClosed}
                    />

                    <div className="mt-4 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <Label htmlFor="mentor-email">Nội dung Email sẽ gửi cho Mentor</Label>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nội dung email sẽ tự động sinh ra dựa trên hình thức phạt bạn chọn ở trên.
                    </p>
                    <Textarea
                      id="mentor-email"
                      value={emailContent}
                      onChange={(event) => setEmailContent(event.target.value)}
                      className="mt-2 min-h-40"
                      placeholder="Chọn hình thức xử lý để tạo nội dung thông báo..."
                      disabled={reportAlreadyClosed}
                    />

                    {(penaltyAction === "strike_2" || penaltyAction === "strike_3") && (
                      <div className={`mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 ${safeTextClasses}`}>
                        Hành động này sẽ tác động trực tiếp tới khả năng hiển thị hoặc quyền hoạt động của mentor. Hãy nhập phán quyết rõ ràng trước khi xác nhận.
                      </div>
                    )}

                    {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button variant="outline" className="rounded-xl" onClick={() => updateSelected(null)}>
                        Hủy thao tác
                      </Button>
                      <Button
                        className="gradient-primary rounded-xl border-0 text-primary-foreground"
                        disabled={reportAlreadyClosed || actionLoading === "apply-penalty"}
                        onClick={() => void submitPenalty()}
                      >
                        {actionLoading === "apply-penalty" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Xác nhận & Gửi thông báo
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border bg-card p-4 shadow-card">
                    <p className="mb-3 text-sm font-semibold text-foreground">Trạng thái bổ sung</p>
                    <Button variant="outline" className="w-full rounded-xl" disabled={actionLoading === "appeal"} onClick={() => void markAppealed()}>
                      {actionLoading === "appeal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                      Đánh dấu kháng cáo
                    </Button>
                  </section>
                </aside>
              </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLevel3Open} onOpenChange={setConfirmLevel3Open}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Đây là hành động nghiêm trọng</AlertDialogTitle>
            <AlertDialogDescription>
              Mentor sẽ bị khóa và các khóa học có thể bị ẩn. Bạn có chắc chắn muốn áp dụng Gậy 3 không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void applyPenalty()}
            >
              Xác nhận Gậy 3
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Lịch sử báo cáo của người này</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}
            </div>
          ) : reporterHistory ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-5">
                {(["total", "pending", "resolved", "dismissed", "appealed"] as const).map((key) => (
                  <Info key={key} label={key === "total" ? "Tổng" : filterLabels[key]} value={reporterHistory.summary[key]} />
                ))}
              </div>
              {reporterHistory.summary.dismissed >= Math.max(3, reporterHistory.summary.total / 2) && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  Tỷ lệ báo cáo bị bỏ qua cao. Hãy kiểm tra kỹ khả năng báo cáo thiếu thiện chí.
                </div>
              )}
              <div className="space-y-2">
                {reporterHistory.reports.map((report) => (
                  <div key={report.id} className="min-w-0 overflow-hidden rounded-xl border p-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className={`font-medium text-foreground ${safeTextClasses}`}>{report.title}</p>
                      <StatusBadge status={report.status} />
                      {isAutoHiddenReport(report) && <Badge className="border-0 bg-orange-100 text-orange-700">Tự động ẩn</Badge>}
                    </div>
                    <p className={`mt-1 text-sm text-muted-foreground ${safeTextClasses}`}>{report.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</p>
          )}
        </DialogContent>
      </Dialog>

      {currentLightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white hover:bg-white/10 hover:text-white" onClick={() => setLightboxIndex(null)}>
            <X className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/10 hover:text-white"
            disabled={lightboxIndex === 0}
            onClick={() => setLightboxIndex((index) => Math.max((index ?? 0) - 1, 0))}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <img src={currentLightbox.file_url} alt={currentLightbox.file_name || "Bằng chứng"} className="max-h-[86vh] max-w-[86vw] rounded-xl object-contain" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/10 hover:text-white"
            disabled={lightboxIndex === imageAttachments.length - 1}
            onClick={() => setLightboxIndex((index) => Math.min((index ?? 0) + 1, imageAttachments.length - 1))}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
          <p className="absolute bottom-4 text-sm text-white/80">
            {(lightboxIndex ?? 0) + 1}/{imageAttachments.length} · {currentLightbox.file_name || "Bằng chứng"}
          </p>
        </div>
      )}
    </div>
  );
}

function StepTitle({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {step}
      </span>
      <h2 className={`font-semibold text-foreground ${safeInlineClasses}`}>{title}</h2>
    </div>
  );
}

function PenaltyCard({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: (typeof penaltyOptions)[number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`min-w-0 w-full overflow-hidden rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? option.selectedTone : option.tone}`}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-xl bg-white/70 p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-foreground ${safeTextClasses}`}>{option.label}</p>
          <p className={`mt-1 text-sm font-medium text-muted-foreground ${safeTextClasses}`}>{option.short}</p>
          <p className={`mt-1 text-xs text-muted-foreground ${safeTextClasses}`}>{option.description}</p>
        </div>
      </div>
    </button>
  );
}

function MentorViolationProgress({ summary, strikes }: { summary?: MentorViolationSummary; strikes: MentorStrike[] }) {
  const activeCount = summary?.active_count ?? strikes.filter(isActiveStrike).length;
  const cappedCount = Math.min(activeCount, 3);
  const severityClass = activeCount >= 3 ? "border-red-200 bg-red-50 text-red-700" : activeCount >= 2 ? "border-orange-200 bg-orange-50 text-orange-700" : "border-muted bg-muted/30 text-muted-foreground";

  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${severityClass}`}>
      <p className={`text-sm font-semibold ${safeTextClasses}`}>Lịch sử vi phạm Mentor: {activeCount}/3 lần</p>
      <div className="mt-3 flex gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${index < cappedCount ? "bg-red-500" : "bg-muted-foreground/25"}`}
          />
        ))}
      </div>
      <p className={`mt-3 text-xs ${safeTextClasses}`}>
        Chỉ tính các gậy phạt đã được Admin xác nhận, không tính số lượng báo cáo thô.
      </p>
      {strikes.length > 0 && (
        <div className="mt-3 space-y-2">
          {strikes.slice(0, 3).map((strike) => (
            <div key={strike.id} className="min-w-0 rounded-xl bg-white/70 p-2 text-xs text-muted-foreground">
              <p className={`font-semibold text-foreground ${safeTextClasses}`}>Gậy {strike.level}</p>
              <p className={`line-clamp-2 ${safeTextClasses}`}>{strike.reason}</p>
              <p className={safeTextClasses}>Hết hạn: {strike.expires_at ? formatShortDate(strike.expires_at) : "Không thời hạn"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ title, profile, extraAction }: { title: string; profile: ProfileRef | null; extraAction?: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <p className={`text-sm font-semibold text-foreground ${safeInlineClasses}`}>{title}</p>
      </div>
      {profile ? (
        <div className="min-w-0 space-y-1 text-sm">
          <p className={`font-medium text-foreground ${safeTextClasses}`}>{profile.name || "Không có tên"}</p>
          <p className={`text-muted-foreground ${safeTextClasses}`}>{profile.email || "Chưa có email"}</p>
          <p className={`text-muted-foreground ${safeTextClasses}`}>{profile.phone || "Chưa có số điện thoại"}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{profile.role}</Badge>
            {profile.is_blocked && <Badge className="border-0 bg-destructive/10 text-destructive">Đã khóa</Badge>}
          </div>
          {extraAction && <div className="pt-3">{extraAction}</div>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Không có dữ liệu người dùng.</p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-muted/30 p-3">
      <p className={`text-xs text-muted-foreground ${safeInlineClasses}`}>{label}</p>
      <p className={`mt-1 text-sm font-semibold text-foreground ${safeTextClasses}`}>{value}</p>
    </div>
  );
}
