import { CalendarDays } from "lucide-react";

export function ScheduleHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground gradient-primary shadow-glow">
          <CalendarDays className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Lịch dạy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý lịch học, lịch đặt và thời gian giảng dạy của bạn.
        </p>
      </div>
    </div>
  );
}
