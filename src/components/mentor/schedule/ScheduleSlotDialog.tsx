import { useEffect, useState } from "react";
import { Loader2, Calendar, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Label }    from "@/components/ui/label";
import { Input }    from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSchedule, useUpdateSchedule,
  type CourseSchedule, type CreateSchedulePayload, type UpdateSchedulePayload,
} from "@/hooks/useMentorSchedule";
import type { Course } from "@/hooks/use-courses";
import { cn } from "@/lib/utils";

const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface FormState {
  course_id:   string;
  day_of_week: string;
  start_time:  string;
  end_time:    string;
}

const EMPTY: FormState = { course_id: "", day_of_week: "", start_time: "", end_time: "" };

function slotToForm(s: CourseSchedule): FormState {
  return {
    course_id:   s.course_id,
    day_of_week: s.day_of_week,
    start_time:  s.start_time.slice(0, 5),
    end_time:    s.end_time.slice(0, 5),
  };
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  mentorId:  string;
  courses:   Course[];
  editing:   CourseSchedule | null; // null = create mode
}

export function ScheduleSlotDialog({ open, onClose, mentorId, courses, editing }: Props) {
  const { toast }  = useToast();
  const createSlot = useCreateSchedule();
  const updateSlot = useUpdateSchedule();

  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(editing ? slotToForm(editing) : EMPTY);
      setErrors({});
    }
  }, [open, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.course_id)   e.course_id   = "Vui lòng chọn khóa học.";
    if (!form.day_of_week) e.day_of_week = "Vui lòng chọn ngày trong tuần.";
    if (!form.start_time)  e.start_time  = "Vui lòng nhập giờ bắt đầu.";
    if (!form.end_time)    e.end_time    = "Vui lòng nhập giờ kết thúc.";
    if (form.start_time && form.end_time && form.end_time <= form.start_time)
      e.end_time = "Giờ kết thúc phải sau giờ bắt đầu.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    try {
      if (editing) {
        const payload: UpdateSchedulePayload = {
          id:          editing.id,
          mentor_id:   mentorId,
          day_of_week: form.day_of_week,
          start_time:  form.start_time,
          end_time:    form.end_time,
        };
        await updateSlot.mutateAsync(payload);
        toast({ title: "✅ Đã cập nhật lịch dạy" });
      } else {
        const payload: CreateSchedulePayload = {
          mentor_id:   mentorId,
          course_id:   form.course_id,
          day_of_week: form.day_of_week,
          start_time:  form.start_time,
          end_time:    form.end_time,
        };
        await createSlot.mutateAsync(payload);
        toast({ title: "✅ Đã thêm lịch dạy" });
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    }
  };

  const isBusy = createSlot.isPending || updateSlot.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </div>
            {editing ? "Chỉnh sửa lịch dạy" : "Thêm lịch dạy mới"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Course — disabled in edit mode */}
          <div className="space-y-1.5">
            <Label>Khóa học <span className="text-destructive">*</span></Label>
            <Select
              value={form.course_id}
              onValueChange={(v) => set("course_id", v)}
              disabled={!!editing}
            >
              <SelectTrigger className={cn("rounded-xl", errors.course_id && "border-destructive")}>
                <SelectValue placeholder="Chọn khóa học" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.course_id && <p className="text-xs text-destructive">{errors.course_id}</p>}
          </div>

          {/* Day of week */}
          <div className="space-y-1.5">
            <Label>Ngày trong tuần <span className="text-destructive">*</span></Label>
            <Select value={form.day_of_week} onValueChange={(v) => set("day_of_week", v)}>
              <SelectTrigger className={cn("rounded-xl", errors.day_of_week && "border-destructive")}>
                <SelectValue placeholder="Chọn ngày" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.day_of_week && <p className="text-xs text-destructive">{errors.day_of_week}</p>}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Giờ bắt đầu <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                  className={cn("pl-9 rounded-xl", errors.start_time && "border-destructive")}
                />
              </div>
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Giờ kết thúc <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                  className={cn("pl-9 rounded-xl", errors.end_time && "border-destructive")}
                />
              </div>
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBusy} className="rounded-xl">
              Hủy
            </Button>
            <Button type="submit" disabled={isBusy} className="gradient-primary border-0 text-primary-foreground rounded-xl min-w-[100px]">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Lưu thay đổi" : "Thêm lịch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
