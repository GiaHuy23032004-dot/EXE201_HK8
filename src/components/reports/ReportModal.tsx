import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileImage, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { reportTypeLabels, type ReportType, useSubmitReport } from "@/hooks/use-reports";

type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ReportType;
  courseId?: string | null;
  reportedUserId?: string | null;
  bookingId?: string | null;
  transactionId?: string | null;
  commentId?: string | null;
  contextTitle?: string;
  contextDescription?: string;
};

const reasonOptions: Record<ReportType, string[]> = {
  course: [
    "Nội dung khóa học không đúng mô tả",
    "Giá hoặc thông tin khóa học gây hiểu nhầm",
    "Nội dung không phù hợp",
    "Nghi ngờ lừa đảo",
    "Khác",
  ],
  mentor: [
    "Thông tin hồ sơ không trung thực",
    "Hành vi không phù hợp",
    "Không tham gia buổi học",
    "Nghi ngờ lừa đảo",
    "Khác",
  ],
  payment: [
    "Đã thanh toán nhưng chưa được xác nhận",
    "Mentor không thực hiện buổi học",
    "Sai số tiền",
    "Yêu cầu hoàn tiền",
    "Khác",
  ],
  comment: ["Ngôn từ xúc phạm", "Spam", "Nội dung không phù hợp", "Quấy rối", "Khác"],
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TITLE_MAX_LENGTH = 120;
const REASON_MAX_LENGTH = 160;
const DETAIL_MIN_LENGTH = 20;
const DETAIL_MAX_LENGTH = 1200;
const ALLOWED_FILE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function validateFiles(files: File[]) {
  if (files.length > MAX_FILES) return "Bạn chỉ có thể tải lên tối đa 5 ảnh.";
  const invalidType = files.find((file) => !ALLOWED_FILE_TYPES.has(file.type));
  if (invalidType) return "Bằng chứng chỉ hỗ trợ PNG, JPG/JPEG hoặc WEBP.";
  const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE);
  if (tooLarge) return "Mỗi ảnh bằng chứng không được vượt quá 5MB.";
  return null;
}

export function ReportModal({
  open,
  onOpenChange,
  type,
  courseId,
  reportedUserId,
  bookingId,
  transactionId,
  commentId,
  contextTitle,
  contextDescription,
}: ReportModalProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const submitReport = useSubmitReport();
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const cleanTitle = title.trim();
  const cleanReason = reason.trim();
  const cleanDetail = detail.trim();
  const titleOverLimit = cleanTitle.length > TITLE_MAX_LENGTH;
  const reasonOverLimit = cleanReason.length > REASON_MAX_LENGTH;
  const detailOverLimit = cleanDetail.length > DETAIL_MAX_LENGTH;
  const hasLengthError = titleOverLimit || reasonOverLimit || detailOverLimit;

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setReason("");
      setDetail("");
      setFiles([]);
      setFileError(null);
      setFieldError(null);
    }
  }, [open]);

  useEffect(() => {
    setReason("");
  }, [type]);

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const nextFiles = [...files, ...Array.from(selectedFiles)];
    const error = validateFiles(nextFiles);
    setFileError(error);
    if (!error) setFiles(nextFiles);
  };

  const removeFile = (index: number) => {
    const nextFiles = files.filter((_, itemIndex) => itemIndex !== index);
    setFiles(nextFiles);
    setFileError(validateFiles(nextFiles));
  };

  const handleSubmit = async () => {
    const reporterId = session?.user?.id;

    setFieldError(null);

    if (!reporterId) {
      toast({ title: "Vui lòng đăng nhập để gửi báo cáo", variant: "destructive" });
      return;
    }
    if (reportedUserId && reportedUserId === reporterId) {
      setFieldError("Bạn không thể báo cáo chính mình.");
      return;
    }
    if (!cleanTitle) {
      setFieldError("Vui lòng nhập tiêu đề báo cáo.");
      return;
    }
    if (cleanTitle.length > TITLE_MAX_LENGTH) {
      setFieldError("Tiêu đề báo cáo không được vượt quá 120 ký tự.");
      return;
    }
    if (!cleanReason) {
      setFieldError("Vui lòng chọn lý do báo cáo.");
      return;
    }
    if (cleanReason.length > REASON_MAX_LENGTH) {
      setFieldError("Lý do báo cáo không được vượt quá 160 ký tự.");
      return;
    }
    if (cleanDetail.length < DETAIL_MIN_LENGTH || cleanDetail.length > DETAIL_MAX_LENGTH) {
      setFieldError("Nội dung báo cáo phải từ 20 đến 1200 ký tự.");
      return;
    }

    const validationError = validateFiles(files);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    try {
      await submitReport.mutateAsync({
        type,
        title: cleanTitle,
        reason: cleanReason,
        detail: cleanDetail,
        reporterId,
        reportedUserId,
        courseId,
        bookingId,
        transactionId,
        commentId,
        files,
      });
      toast({
        title: "Đã gửi báo cáo",
        description: "Admin sẽ xem xét trong thời gian sớm nhất.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Không thể gửi báo cáo",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Gửi báo cáo {reportTypeLabels[type].toLowerCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Alert className="border-warning/20 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm">
              Vui lòng cung cấp thông tin trung thực. Báo cáo sai sự thật hoặc spam có thể bị hạn chế tài khoản.
            </AlertDescription>
          </Alert>

          {(contextTitle || contextDescription) && (
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline">{reportTypeLabels[type]}</Badge>
                {bookingId && <Badge variant="secondary">Booking</Badge>}
              </div>
              {contextTitle && <p className="font-semibold text-foreground">{contextTitle}</p>}
              {contextDescription && <p className="mt-1 text-sm text-muted-foreground">{contextDescription}</p>}
            </div>
          )}

          {fieldError && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {fieldError}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-title">Tiêu đề</Label>
              <Input
                id="report-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setFieldError(null);
                }}
                placeholder="Tóm tắt vấn đề bạn muốn báo cáo"
                className={`rounded-xl ${titleOverLimit ? "border-destructive" : ""}`}
              />
              <p className={`text-xs ${titleOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {cleanTitle.length}/{TITLE_MAX_LENGTH} ký tự
              </p>
            </div>
            <div className="space-y-2">
              <Label>Lý do</Label>
              <Select
                value={reason}
                onValueChange={(value) => {
                  setReason(value);
                  setFieldError(null);
                }}
              >
                <SelectTrigger className={`rounded-xl ${reasonOverLimit ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Chọn lý do báo cáo" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions[type].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs ${reasonOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {cleanReason.length}/{REASON_MAX_LENGTH} ký tự
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-detail">Mô tả chi tiết</Label>
            <Textarea
              id="report-detail"
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value);
                setFieldError(null);
              }}
              placeholder="Mô tả điều đã xảy ra, thời gian, nội dung liên quan và kỳ vọng xử lý của bạn..."
              className={`min-h-32 rounded-xl ${detailOverLimit ? "border-destructive" : ""}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="text-muted-foreground">
                Vui lòng mô tả ngắn gọn, rõ ràng. Tối đa 1200 ký tự.
              </p>
              <p className={cleanDetail.length < DETAIL_MIN_LENGTH || detailOverLimit ? "text-destructive" : "text-muted-foreground"}>
                {cleanDetail.length}/{DETAIL_MAX_LENGTH} ký tự
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="report-files">Bằng chứng hình ảnh</Label>
              <p className="mt-1 text-xs text-muted-foreground">Tối đa 5 ảnh, mỗi ảnh không quá 5MB. Hỗ trợ PNG, JPG/JPEG, WEBP.</p>
            </div>
            <Input
              id="report-files"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => addFiles(event.target.files)}
              className="rounded-xl"
            />
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}

            {previews.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {previews.map((preview, index) => (
                  <div key={`${preview.file.name}-${index}`} className="group relative overflow-hidden rounded-xl border bg-muted">
                    <img src={preview.url} alt={preview.file.name} className="h-28 w-full object-cover" />
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <FileImage className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{preview.file.name}</span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-2 top-2 h-7 w-7 rounded-lg opacity-90"
                      onClick={() => removeFile(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={submitReport.isPending}>
            Hủy
          </Button>
          <Button className="gradient-primary rounded-xl border-0 text-primary-foreground" onClick={handleSubmit} disabled={submitReport.isPending || hasLengthError}>
            {submitReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
