import { useMemo, useState } from "react";
import { AlertTriangle, UsersRound } from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { StudentStats } from "@/components/mentor/students/StudentStats";
import {
  StudentFilters,
  type StudentSortOption,
  type StudentStatusFilter,
} from "@/components/mentor/students/StudentFilters";
import { StudentCard } from "@/components/mentor/students/StudentCard";
import { StudentDetailDialog } from "@/components/mentor/students/StudentDetailDialog";
import { EmptyStudentsState } from "@/components/mentor/students/EmptyStudentsState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildMentorStudentStats,
  useMentorStudents,
  type MentorStudent,
  type MentorStudentCourse,
} from "@/hooks/useMentorStudents";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải danh sách học viên.";
}

function getStudentName(student: MentorStudent) {
  return student.profile?.name || student.profile?.email || "Học viên";
}

function getLatestBookingValue(student: MentorStudent) {
  const booking = student.bookings[0];
  return booking ? `${booking.booking_date}T${booking.start_time}` : "";
}

function getNextBookingValue(student: MentorStudent) {
  const booking = student.next_booking;
  return booking ? `${booking.booking_date}T${booking.start_time}` : "9999-12-31T23:59";
}

export default function MentorStudents() {
  const { session } = useAuth();
  const mentorId = session?.user?.id;

  const { data: students = [], isLoading, isError, error } = useMentorStudents(mentorId);

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("all");
  const [sort, setSort] = useState<StudentSortOption>("newest");
  const [detailStudent, setDetailStudent] = useState<MentorStudent | null>(null);

  const courses = useMemo(() => {
    const byId = new Map<string, MentorStudentCourse>();
    for (const student of students) {
      for (const course of student.courses_enrolled) {
        byId.set(course.id, course);
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title, "vi"));
  }, [students]);

  const stats = useMemo(() => buildMentorStudentStats(students), [students]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students
      .filter((student) => {
        const matchesSearch =
          !term ||
          (student.profile?.name ?? "").toLowerCase().includes(term) ||
          (student.profile?.email ?? "").toLowerCase().includes(term) ||
          (student.profile?.phone ?? "").toLowerCase().includes(term) ||
          student.bookings.some((booking) => (booking.phone ?? "").toLowerCase().includes(term)) ||
          student.courses_enrolled.some((course) => course.title.toLowerCase().includes(term));

        const matchesCourse =
          courseFilter === "all" || student.courses_enrolled.some((course) => course.id === courseFilter);

        const matchesStatus = statusFilter === "all" || student.latest_status === statusFilter;

        return matchesSearch && matchesCourse && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === "name") {
          return getStudentName(a).localeCompare(getStudentName(b), "vi");
        }
        if (sort === "bookings") {
          return b.total_bookings - a.total_bookings;
        }
        if (sort === "spent") {
          return b.total_spent - a.total_spent;
        }
        if (sort === "next") {
          return getNextBookingValue(a).localeCompare(getNextBookingValue(b));
        }
        return getLatestBookingValue(b).localeCompare(getLatestBookingValue(a));
      });
  }, [courseFilter, search, sort, statusFilter, students]);

  const hasFilters = search.trim() !== "" || courseFilter !== "all" || statusFilter !== "all";

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <UsersRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Quản lý học viên</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Theo dõi học viên đã đặt lịch học với bạn.
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-20 rounded-2xl" />
            <div className="grid gap-5 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-80 rounded-2xl" />
              ))}
            </div>
          </>
        ) : isError ? (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {getErrorMessage(error)}
            </CardContent>
          </Card>
        ) : (
          <>
            <StudentStats stats={stats} />

            <StudentFilters
              search={search}
              onSearch={setSearch}
              courseFilter={courseFilter}
              onCourseFilter={setCourseFilter}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              sort={sort}
              onSort={setSort}
              courses={courses}
            />

            {filteredStudents.length === 0 ? (
              <EmptyStudentsState filtered={students.length > 0 || hasFilters} />
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {filteredStudents.map((student) => (
                  <StudentCard
                    key={student.learner_id}
                    student={student}
                    onViewDetail={setDetailStudent}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <StudentDetailDialog
        open={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        mentorId={mentorId ?? ""}
        student={detailStudent}
      />
    </MentorLayout>
  );
}
