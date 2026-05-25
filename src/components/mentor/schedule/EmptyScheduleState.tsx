import { CalendarX2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyScheduleStateProps {
  type: "bookings" | "schedules" | "before-start";
  onAddSchedule?: () => void;
  startDate?: string | null;
  courseSpecific?: boolean;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN");
}

export function EmptyScheduleState({
  type,
  onAddSchedule,
  startDate,
  courseSpecific,
}: EmptyScheduleStateProps) {
  if (type === "before-start") {
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-14 text-center">
        <CalendarX2 className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold text-foreground">Khóa học chưa khai giảng trong tuần này</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ngày khai giảng: {formatDate(startDate)}
        </p>
      </div>
    );
  }

  if (type === "bookings") {
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-14 text-center">
        <CalendarX2 className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold text-foreground">
          {courseSpecific
            ? "Chưa có buổi học nào cho khóa học này trong tuần đã chọn."
            : "Chưa có buổi học nào trong tuần này"}
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Các buổi học sẽ xuất hiện ở đây khi học viên đặt lịch.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-10 text-center">
      <CalendarX2 className="mb-3 h-9 w-9 text-muted-foreground" />
      <p className="font-semibold text-foreground">Chưa có lịch dạy cố định</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Thêm lịch dạy để học viên biết bạn có thể giảng dạy vào thời gian nào.
      </p>
      {onAddSchedule && (
        <Button
          size="sm"
          onClick={onAddSchedule}
          className="mt-4 rounded-xl border-0 text-primary-foreground gradient-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm lịch dạy
        </Button>
      )}
    </div>
  );
}
