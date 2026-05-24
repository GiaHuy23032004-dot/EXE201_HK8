import { Search, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Course } from "@/hooks/use-courses";
import type { BookingStatus } from "@/hooks/useMentorBookings";

export type StatusFilter = "all" | BookingStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "Tất cả trạng thái" },
  { value: "pending",   label: "Chờ xác nhận"       },
  { value: "upcoming",  label: "Sắp diễn ra"        },
  { value: "completed", label: "Đã hoàn thành"      },
  { value: "cancelled", label: "Đã hủy"             },
  { value: "declined",  label: "Đã từ chối"         },
];

interface Props {
  search:        string;
  onSearch:      (v: string) => void;
  courseFilter:  string;
  onCourse:      (v: string) => void;
  statusFilter:  StatusFilter;
  onStatus:      (v: StatusFilter) => void;
  weekStart:     Date;
  onPrevWeek:    () => void;
  onNextWeek:    () => void;
  onToday:       () => void;
  courses:       Course[];
}

function fmtWeekRange(start: Date) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function ScheduleFilters({
  search, onSearch, courseFilter, onCourse,
  statusFilter, onStatus, weekStart, onPrevWeek, onNextWeek, onToday, courses,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: search + course + status */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm khóa học, học viên..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <Select value={courseFilter} onValueChange={onCourse}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="Tất cả khóa học" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả khóa học</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => onStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: week navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevWeek} className="rounded-xl h-9 w-9">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNextWeek} className="rounded-xl h-9 w-9">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 shadow-card text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {fmtWeekRange(weekStart)}
        </div>
        <Button variant="outline" size="sm" onClick={onToday} className="rounded-xl ml-auto">
          Hôm nay
        </Button>
      </div>
    </div>
  );
}
