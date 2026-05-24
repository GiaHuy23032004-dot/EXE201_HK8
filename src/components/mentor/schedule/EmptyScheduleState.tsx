import { CalendarX2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  type: "bookings" | "schedules";
  onAddSchedule?: () => void;
}

export function EmptyScheduleState({ type, onAddSchedule }: Props) {
  if (type === "bookings") {
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-14 text-center">
        <CalendarX2 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-semibold text-foreground">Chưa có buổi học nào trong tuần này</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          Bạn có thể thêm lịch dạy cố định để học viên dễ đặt lịch hơn.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-10 text-center">
      <CalendarX2 className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="font-semibold text-foreground">Chưa có lịch dạy cố định</p>
      <p className="mt-1 text-sm text-muted-foreground">Thêm lịch để học viên biết bạn dạy vào những ngày nào.</p>
      {onAddSchedule && (
        <Button
          size="sm"
          onClick={onAddSchedule}
          className="mt-4 gradient-primary border-0 text-primary-foreground rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm lịch dạy
        </Button>
      )}
    </div>
  );
}
