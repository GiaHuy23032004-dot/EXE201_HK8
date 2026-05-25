import { useEffect, useState } from "react";
import { FileUp, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PROOF_TYPE_EXAMPLES,
  PROOF_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  SUPPORTED_PROOF_TYPES,
  isValidUrl,
  type MentorVerificationProof,
  type ProofFormValues,
  type ProofType,
  type SocialPlatform,
} from "@/hooks/useMentorVerificationProofs";

interface ProofFormDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: MentorVerificationProof | null;
  isBusy?: boolean;
  onSubmit: (values: ProofFormValues, editing?: MentorVerificationProof | null) => void;
}

type FormErrorKey = keyof ProofFormValues | "file";
type FormErrors = Partial<Record<FormErrorKey, string>>;

const SOCIAL_PLATFORMS = Object.keys(SOCIAL_PLATFORM_LABELS) as SocialPlatform[];
const IMAGE_AND_PDF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024;

const EMPTY_FORM: ProofFormValues = {
  proof_type: "",
  platform: "",
  title: "",
  issuer: "",
  issued_year: "",
  url: "",
  description: "",
  file: null,
};

function proofToForm(proof: MentorVerificationProof): ProofFormValues {
  const metadata = proof.metadata ?? {};
  return {
    proof_type: SUPPORTED_PROOF_TYPES.includes(proof.proof_type as ProofType)
      ? (proof.proof_type as ProofType)
      : "",
    platform: (metadata.platform as SocialPlatform | undefined) ?? "",
    title: metadata.title ?? proof.title ?? "",
    issuer: metadata.issuer ?? "",
    issued_year: metadata.issued_year ? String(metadata.issued_year) : "",
    url: metadata.url ?? proof.url ?? "",
    description: metadata.description ?? proof.description ?? "",
    file: null,
  };
}

function validateFile(file: File, type: ProofType) {
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
    return "Chỉ hỗ trợ PNG, JPG, JPEG, WEBP hoặc PDF.";
  }

  if (file.size > MAX_PROOF_FILE_SIZE) {
    return "Tệp bằng chứng không được vượt quá 5MB.";
  }

  return null;
}

function validateForm(values: ProofFormValues, editing?: MentorVerificationProof | null) {
  const errors: FormErrors = {};
  const existingFile = editing?.file_path;

  if (!values.proof_type) {
    errors.proof_type = "Vui lòng chọn loại bằng chứng.";
    return errors;
  }

  if (values.proof_type === "social") {
    if (!values.url.trim()) {
      errors.url = "URL là bắt buộc.";
    } else if (!isValidUrl(values.url)) {
      errors.url = "URL không hợp lệ.";
    }
    return errors;
  }

  if (values.proof_type === "certificate") {
    if (!values.title.trim()) errors.title = "Vui lòng nhập tên chứng chỉ / bằng cấp.";
    if (!values.url.trim() && !values.file && !existingFile) {
      errors.file = "Vui lòng thêm URL hoặc tải lên tệp chứng chỉ / bằng cấp.";
    }
    if (values.url.trim() && !isValidUrl(values.url)) errors.url = "URL xác thực không hợp lệ.";
    if (values.issued_year.trim() && Number.isNaN(Number(values.issued_year))) {
      errors.issued_year = "Năm cấp phải là số.";
    }
    return errors;
  }

  if (values.url.trim() && !isValidUrl(values.url)) errors.url = "URL không hợp lệ.";
  if (!values.url.trim() && !values.file && !existingFile) {
    errors.file = "Vui lòng thêm URL hoặc tải lên tệp bằng chứng.";
  }

  return errors;
}

export function ProofFormDialog({ open, onClose, editing, isBusy, onSubmit }: ProofFormDialogProps) {
  const [form, setForm] = useState<ProofFormValues>(EMPTY_FORM);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    setForm(editing ? proofToForm(editing) : EMPTY_FORM);
    setFileName("");
    setErrors({});
  }, [editing, open]);

  const set = <Key extends keyof ProofFormValues>(key: Key, value: ProofFormValues[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleTypeChange = (value: ProofType) => {
    setForm((current) => ({
      ...current,
      proof_type: value,
      platform: value === "social" ? current.platform : "",
      title: value === "social" ? "" : current.title,
      issuer: value === "certificate" ? current.issuer : "",
      issued_year: value === "certificate" ? current.issued_year : "",
      file: value === "social" ? null : current.file,
    }));
    if (value === "social") setFileName("");
    setErrors({});
  };

  const handleFileChange = (file: File | null) => {
    if (!file || !form.proof_type || form.proof_type === "social") return;
    const fileError = validateFile(file, form.proof_type);
    if (fileError) {
      set("file", null);
      setFileName("");
      setErrors((current) => ({ ...current, file: fileError }));
      return;
    }

    set("file", file);
    setFileName(file.name);
    setErrors((current) => ({ ...current, file: undefined }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm(form, editing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(form, editing);
  };

  const selectedType = form.proof_type || null;
  const showFileUpload = selectedType === "certificate" || selectedType === "portfolio" || selectedType === "teaching_evidence";
  const fileHelper = "PNG, JPG, JPEG, WEBP hoặc PDF tối đa 5MB";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground gradient-primary">
              <Plus className="h-4 w-4" />
            </span>
            {editing ? "Chỉnh sửa bằng chứng" : "Thêm bằng chứng"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Loại bằng chứng</Label>
            <Select value={form.proof_type} onValueChange={(value) => handleTypeChange(value as ProofType)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Chọn loại bằng chứng" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_PROOF_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PROOF_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.proof_type ? (
              <p className="text-xs text-destructive">{errors.proof_type}</p>
            ) : selectedType ? (
              <p className="text-xs text-muted-foreground">{PROOF_TYPE_EXAMPLES[selectedType]}</p>
            ) : null}
          </div>

          {selectedType === "social" && (
            <>
              <div className="space-y-2">
                <Label>Nền tảng (không bắt buộc)</Label>
                <Select value={form.platform} onValueChange={(value) => set("platform", value as SocialPlatform)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Chọn nền tảng" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {SOCIAL_PLATFORM_LABELS[platform]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.platform && <p className="text-xs text-destructive">{errors.platform}</p>}
              </div>

              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(event) => set("url", event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
                {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
              </div>
            </>
          )}

          {selectedType === "certificate" && (
            <>
              <div className="space-y-2">
                <Label>Tên chứng chỉ / bằng cấp</Label>
                <Input
                  value={form.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="VD: IELTS 8.0, Chứng chỉ giảng dạy..."
                  className="rounded-xl"
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Đơn vị cấp</Label>
                  <Input
                    value={form.issuer}
                    onChange={(event) => set("issuer", event.target.value)}
                    placeholder="VD: British Council"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Năm cấp</Label>
                  <Input
                    type="number"
                    value={form.issued_year}
                    onChange={(event) => set("issued_year", event.target.value)}
                    placeholder="2024"
                    className="rounded-xl"
                  />
                  {errors.issued_year && <p className="text-xs text-destructive">{errors.issued_year}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL xác thực (không bắt buộc)</Label>
                <Input
                  value={form.url}
                  onChange={(event) => set("url", event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
                {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
              </div>
            </>
          )}

          {(selectedType === "portfolio" || selectedType === "teaching_evidence") && (
            <>
              <div className="space-y-2">
                <Label>{selectedType === "portfolio" ? "Tiêu đề portfolio / sản phẩm" : "Tiêu đề minh chứng"}</Label>
                <Input
                  value={form.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder={selectedType === "portfolio" ? "VD: Bộ dự án GitHub, video biểu diễn..." : "VD: Video buổi dạy thử, phản hồi học viên..."}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(event) => set("url", event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
                {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
              </div>
            </>
          )}

          {showFileUpload && (
            <div className="space-y-2">
              <Label>
                {selectedType === "certificate"
                  ? "Tệp chứng chỉ / bằng cấp"
                  : selectedType === "portfolio"
                  ? "Tệp portfolio"
                  : "Tệp minh chứng giảng dạy"}
              </Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40">
                <FileUp className="h-5 w-5 text-primary" />
                <span className="truncate">{fileName || editing?.file_path || fileHelper}</span>
                <input
                  type="file"
                  accept={IMAGE_AND_PDF_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    handleFileChange(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </label>
              {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
            </div>
          )}

          {selectedType && (
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                rows={3}
                placeholder="Giải thích ngắn gọn vì sao bằng chứng này thể hiện chuyên môn của bạn..."
                className="rounded-xl"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="rounded-xl">
              Hủy
            </Button>
            <Button type="submit" disabled={isBusy} className="rounded-xl border-0 text-primary-foreground gradient-primary">
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Lưu thay đổi" : "Thêm bằng chứng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
