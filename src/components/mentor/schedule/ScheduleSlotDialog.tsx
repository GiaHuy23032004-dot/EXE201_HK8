import { useEffect, useState } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSchedule,
  useUpdateSchedule,
  type CourseSchedule,
} from "@/hooks/useMentorSchedule";
import type { Course } from "@/hooks/use-courses";
import { cn } from "@/lib/utils";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface ScheduleSlotDialogProps {
  open: boolean;
  onClose: () => void;
  mentorId: string;
  courses: Course[];
  editing: CourseSchedule | null;
  initialCourseId?: string;
}

interface FormState {
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

const EMPTY_FORM: FormState = {
  course_id: "",
  day_of_week: "",
  start_time: "09:00",
  end_time: "10:00",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}

function slotToForm(slot: CourseSchedule): FormState {
  return {
    course_id: slot.course_id,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time.slice(0, 5),
    end_time: slot.end_time.slice(0, 5),
  };
}

export function ScheduleSlotDialog({
  open,
  onClose,
  mentorId,
  courses,
  editing,
  initialCourseId,
}: ScheduleSlotDialogProps) {
  const { toast } = useToast();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm(editing ? slotToForm(editing) : { ...EMPTY_FORM, course_id: initialCourseId ?? "" });
    setErrors({});
  }, [editing, initialCourseId, open]);

  const set = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!editing && !form.course_id) nextErrors.course_id = "Vui lòng chọn khóa học.";
    if (!form.day_of_week) nextErrors.day_of_week = "Vui lòng chọn ngày trong tuần.";
    if (!form.start_time) nextErrors.start_time = "Vui lòng nhập giờ bắt đầu.";
    if (!form.end_time) nextErrors.end_time = "Vui lòng nhập giờ kết thúc.";
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      nextErrors.end_time = "Giờ kết thúc phải sau giờ bắt đầu.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      if (editing) {
        await updateSchedule.mutateAsync({
          id: editing.id,
          mentor_id: mentorId,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
        });
        toast({ title: "Đã cập nhật lịch dạy" });
      } else {
        await createSchedule.mutateAsync({
          mentor_id: mentorId,
          course_id: form.course_id,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
        });
        toast({ title: "Đã thêm lịch dạy" });
      }
      onClose();
    } catch (error: unknown) {
      toast({
        title: "Không thể lưu lịch dạy",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const isBusy = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground gradient-primary">
              <Calendar className="h-4 w-4" />
            </span>
            {editing ? "Chỉnh sửa lịch dạy" : "Thêm lịch dạy"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>
              Khóa học <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.course_id}
              onValueChange={(value) => set("course_id", value)}
              disabled={!!editing || isBusy}
            >
              <SelectTrigger className={cn("rounded-xl", errors.course_id && "border-destructive")}>
                <SelectValue placeholder="Chọn khóa học" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.course_id && <p className="text-xs text-destructive">{errors.course_id}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>
              Ngày trong tuần <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.day_of_week}
              onValueChange={(value) => set("day_of_week", value)}
              disabled={isBusy}
            >
              <SelectTrigger className={cn("rounded-xl", errors.day_of_week && "border-destructive")}>
                <SelectValue placeholder="Chọn ngày" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.day_of_week && <p className="text-xs text-destructive">{errors.day_of_week}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Giờ bắt đầu <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => set("start_time", event.target.value)}
                  disabled={isBusy}
                  className={cn("rounded-xl pl-9", errors.start_time && "border-destructive")}
                />
              </div>
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>
                Giờ kết thúc <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => set("end_time", event.target.value)}
                  disabled={isBusy}
                  className={cn("rounded-xl pl-9", errors.end_time && "border-destructive")}
                />
              </div>
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="rounded-xl">
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isBusy}
              className="min-w-[112px] rounded-xl border-0 text-primary-foreground gradient-primary"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Lưu thay đổi" : "Thêm lịch dạy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
