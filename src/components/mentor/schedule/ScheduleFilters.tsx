import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course } from "@/hooks/use-courses";
import type { BookingStatus } from "@/hooks/useMentorBookings";

export type StatusFilter = "all" | BookingStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "upcoming", label: "Sắp diễn ra" },
  { value: "completed", label: "Đã hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "declined", label: "Đã từ chối" },
];

interface ScheduleFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  courseFilter: string;
  onCourseFilter: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (value: StatusFilter) => void;
  weekStart: Date;
  onPrevWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  courses: Course[];
  learnerFilterLabel?: string | null;
  onClearLearnerFilter?: () => void;
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const format = (date: Date) => date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${format(start)} - ${format(end)}`;
}

export function ScheduleFilters({
  search,
  onSearch,
  courseFilter,
  onCourseFilter,
  statusFilter,
  onStatusFilter,
  weekStart,
  onPrevWeek,
  onCurrentWeek,
  onNextWeek,
  courses,
  learnerFilterLabel,
  onClearLearnerFilter,
}: ScheduleFiltersProps) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Tìm khóa học, học viên, SĐT, ghi chú..."
              className="rounded-xl pl-9"
            />
          </div>

          <Select value={courseFilter} onValueChange={onCourseFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Tất cả khóa học" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả khóa học</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => onStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {learnerFilterLabel && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Học viên:</span>
            <span className="font-semibold text-primary">{learnerFilterLabel}</span>
            {onClearLearnerFilter && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClearLearnerFilter}
                className="ml-auto h-7 w-7 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevWeek} className="h-9 w-9 rounded-xl">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNextWeek} className="h-9 w-9 rounded-xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-xl border bg-accent/50 px-4 py-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatWeekRange(weekStart)}
          </div>
          <Button variant="outline" size="sm" onClick={onCurrentWeek} className="ml-auto rounded-xl">
            Tuần này
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
