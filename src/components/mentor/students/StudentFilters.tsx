import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MentorStudentCourse, StudentLearningStatus } from "@/hooks/useMentorStudents";

export type StudentStatusFilter = "all" | StudentLearningStatus;
export type StudentSortOption = "newest" | "name" | "bookings" | "spent" | "next";

interface StudentFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  courseFilter: string;
  onCourseFilter: (value: string) => void;
  statusFilter: StudentStatusFilter;
  onStatusFilter: (value: StudentStatusFilter) => void;
  sort: StudentSortOption;
  onSort: (value: StudentSortOption) => void;
  courses: MentorStudentCourse[];
}

const STATUS_OPTIONS: { value: StudentStatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "learning", label: "Đang học" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "completed", label: "Đã học" },
  { value: "cancelled", label: "Đã hủy" },
];

const SORT_OPTIONS: { value: StudentSortOption; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "name", label: "Tên A-Z" },
  { value: "bookings", label: "Nhiều buổi học nhất" },
  { value: "spent", label: "Chi tiêu cao nhất" },
  { value: "next", label: "Sắp học gần nhất" },
];

export function StudentFilters({
  search,
  onSearch,
  courseFilter,
  onCourseFilter,
  statusFilter,
  onStatusFilter,
  sort,
  onSort,
  courses,
}: StudentFiltersProps) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_210px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm tên, email, SĐT hoặc khóa học..."
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

        <Select value={statusFilter} onValueChange={(value) => onStatusFilter(value as StudentStatusFilter)}>
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

        <Select value={sort} onValueChange={(value) => onSort(value as StudentSortOption)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
