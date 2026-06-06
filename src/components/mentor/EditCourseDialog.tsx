import { useEffect, useState } from "react";
import { Loader2, Pencil, Image, MapPin, Video, DollarSign, Tag, AlignLeft, BookOpen, CalendarDays } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdateCourse, type Course, type UpdateCoursePayload } from "@/hooks/use-courses";
import { cn } from "@/lib/utils";
import { COURSE_CATEGORY_SELECT_OPTIONS, isValidCourseCategorySlug, normalizeCourseCategory } from "@/constants/courseCategories";

// ─── form state type ──────────────────────────────────────────────────────────
interface FormState {
  title:        string;
  description:  string;
  category:     string;
  start_date:   string;
  format:       "online" | "offline";
  price:        string;          // keep as string for controlled input
  location:     string;
  meeting_link: string;
  image_url:    string;
}

function courseToForm(c: Course): FormState {
  return {
    title:        c.title,
    description:  c.description  ?? "",
    category:     normalizeCourseCategory(c.category),
    start_date:   c.start_date ?? "",
    format:       c.format,
    price:        String(c.price),
    location:     c.location     ?? "",
    meeting_link: c.meeting_link ?? "",
    image_url:    c.image_url    ?? "",
  };
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── field wrapper ────────────────────────────────────────────────────────────
function Field({
  label, required, error, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
interface EditCourseDialogProps {
  course:   Course | null;
  mentorId: string;
  open:     boolean;
  onClose:  () => void;
}

export function EditCourseDialog({ course, mentorId, open, onClose }: EditCourseDialogProps) {
  const { toast }      = useToast();
  const updateCourse   = useUpdateCourse();
  const todayIso       = formatLocalDate();
  const startDateLocked = (course?.active_booking_count ?? 0) > 0;

  const [form,   setForm]   = useState<FormState>(course ? courseToForm(course) : courseToForm({} as Course));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Re-seed form whenever the dialog opens with a new course
  useEffect(() => {
    if (course && open) {
      setForm(courseToForm(course));
      setErrors({});
    }
  }, [course, open]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.title.trim())
      next.title = "Tên khóa học là bắt buộc.";

    if (!form.category || !isValidCourseCategorySlug(form.category))
      next.category = "Vui lòng chọn danh mục.";

    if (!startDateLocked && !form.start_date)
      next.start_date = "Ngày khai giảng là bắt buộc.";

    if (!startDateLocked && form.start_date && form.start_date < todayIso)
      next.start_date = "Ngày khai giảng không thể trước hôm nay.";

    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0)
      next.price = "Giá phải là số không âm.";

    if (form.format === "offline" && !form.location.trim())
      next.location = "Địa điểm là bắt buộc cho khóa học offline.";

    if (form.format === "online" && !form.meeting_link.trim())
      next.meeting_link = "Link học online là bắt buộc cho khóa học online.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !validate()) return;

    const payload: UpdateCoursePayload = {
      id:           course.id,
      mentor_id:    mentorId,
      title:        form.title.trim(),
      description:  form.description.trim() || null,
      category:     form.category,
      start_date:   startDateLocked ? course.start_date : form.start_date,
      format:       form.format,
      price:        Number(form.price),
      location:     form.format === "offline" ? form.location.trim() || null : null,
      meeting_link: form.format === "online"  ? form.meeting_link.trim() || null : null,
      image_url:    form.image_url.trim() || null,
    };

    try {
      await updateCourse.mutateAsync(payload);
      toast({ title: "✅ Đã cập nhật khóa học", description: payload.title });
      onClose();
    } catch (err: any) {
      toast({ title: "Lỗi cập nhật", description: err.message, variant: "destructive" });
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
              <Pencil className="h-4 w-4 text-primary-foreground" />
            </div>
            Chỉnh sửa khóa học
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">

          {/* Title */}
          <Field label="Tên khóa học" required error={errors.title}>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="VD: Guitar cơ bản cho người mới"
                className={cn("pl-9 rounded-xl", errors.title && "border-destructive")}
              />
            </div>
          </Field>

          {/* Description */}
          <Field label="Mô tả khóa học" error={errors.description}>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Mô tả nội dung, đối tượng học viên, kết quả đạt được..."
                rows={3}
                className="pl-9 rounded-xl resize-none"
              />
            </div>
          </Field>

          <Field label="Ngày khai giảng" required error={errors.start_date}>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                min={todayIso}
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                disabled={startDateLocked}
                className={cn("pl-9 rounded-xl", errors.start_date && "border-destructive")}
              />
            </div>
            {startDateLocked && (
              <p className="text-xs text-muted-foreground">
                Không thể đổi ngày khai giảng khi khóa học đã có lượt đặt lịch.
              </p>
            )}
          </Field>

          {/* Category + Format row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Danh mục" required error={errors.category}>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className={cn("rounded-xl", errors.category && "border-destructive")}>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Chọn danh mục" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORY_SELECT_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Hình thức" required>
              <div className="flex gap-2">
                {(["offline", "online"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => set("format", fmt)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all",
                      form.format === fmt
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {fmt === "online"
                      ? <Video  className="h-4 w-4" />
                      : <MapPin className="h-4 w-4" />}
                    {fmt === "online" ? "Online" : "Offline"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Price */}
          <Field label="Giá mỗi buổi (VNĐ)" required error={errors.price}>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="VD: 200000"
                className={cn("pl-9 rounded-xl", errors.price && "border-destructive")}
              />
            </div>
          </Field>

          {/* Location (offline only) */}
          {form.format === "offline" && (
            <Field label="Địa điểm dạy học" required error={errors.location}>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP.HCM"
                  className={cn("pl-9 rounded-xl", errors.location && "border-destructive")}
                />
              </div>
            </Field>
          )}

          {/* Meeting link (online only) */}
          {form.format === "online" && (
            <Field label="Link học online" required error={errors.meeting_link}>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={form.meeting_link}
                  onChange={(e) => set("meeting_link", e.target.value)}
                  placeholder="VD: https://meet.google.com/abc-xyz"
                  className={cn("pl-9 rounded-xl", errors.meeting_link && "border-destructive")}
                />
              </div>
            </Field>
          )}

          {/* Image URL */}
          <Field label="Ảnh bìa (URL)" error={errors.image_url}>
            <div className="relative">
              <Image className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.image_url}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://..."
                className="pl-9 rounded-xl"
              />
            </div>
            {form.image_url && (
              <div className="mt-2 overflow-hidden rounded-xl border">
                <img
                  src={form.image_url}
                  alt="preview"
                  className="h-32 w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </Field>

          {/* Read-only info strip */}
          <div className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm mb-1">Thông tin không thể chỉnh sửa</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Trạng thái: <span className="font-medium text-foreground">{course?.status}</span></span>
              <span>Học viên: <span className="font-medium text-foreground">{course?.students_count}</span></span>
              <span>Đánh giá: <span className="font-medium text-foreground">{course?.rating}</span></span>
              <span>Lượt review: <span className="font-medium text-foreground">{course?.review_count}</span></span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
              disabled={updateCourse.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={updateCourse.isPending}
              className="gradient-primary border-0 text-primary-foreground rounded-xl min-w-[120px]"
            >
              {updateCourse.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
