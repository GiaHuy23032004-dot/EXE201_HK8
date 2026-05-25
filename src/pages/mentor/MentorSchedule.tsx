import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { ScheduleHeader } from "@/components/mentor/schedule/ScheduleHeader";
import { ScheduleStats } from "@/components/mentor/schedule/ScheduleStats";
import {
  ScheduleFilters,
  type StatusFilter,
} from "@/components/mentor/schedule/ScheduleFilters";
import { WeeklyCalendar } from "@/components/mentor/schedule/WeeklyCalendar";
import { EmptyScheduleState } from "@/components/mentor/schedule/EmptyScheduleState";
import { ScheduleSlotDialog } from "@/components/mentor/schedule/ScheduleSlotDialog";
import {
  useDeleteSchedule,
  useMentorSchedules,
  type CourseSchedule,
} from "@/hooks/useMentorSchedule";
import {
  useMentorBookings,
  useMentorScheduleStats,
  useUpdateMentorBookingStatus,
} from "@/hooks/useMentorBookings";
import { useMentorCourses } from "@/hooks/use-courses";
import { useMentorStudentDetail } from "@/hooks/useMentorStudentDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getMondayOfWeek(date: Date) {
  const monday = new Date(date);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}

interface RecurringSlotCardProps {
  slot: CourseSchedule;
  onEdit: (slot: CourseSchedule) => void;
  onDelete: (slot: CourseSchedule) => void;
}

function RecurringSlotCard({ slot, onEdit, onDelete }: RecurringSlotCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <CalendarDays className="h-5 w-5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {slot.course?.title ?? "Khóa học"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{slot.day_of_week}</span>
          <span>
            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
          </span>
          {slot.course?.format === "online" ? (
            <span className="flex min-w-0 items-center gap-1">
              <Video className="h-3 w-3" />
              <span className="truncate">{slot.course.meeting_link ?? "Online"}</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{slot.course?.location ?? "Offline"}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onEdit(slot)}
          className="h-8 w-8 rounded-xl border-0 text-primary-foreground gradient-primary"
          title="Chỉnh sửa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onDelete(slot)}
          className="h-8 w-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Xóa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function MentorSchedule() {
  const { session } = useAuth();
  const { toast } = useToast();
  const mentorId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const courseIdParam = searchParams.get("courseId");
  const learnerIdParam = searchParams.get("learnerId");

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilterState] = useState(courseIdParam ?? "all");
  const [learnerFilter, setLearnerFilterState] = useState(learnerIdParam ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<CourseSchedule | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<CourseSchedule | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const selectedCourseId = courseFilter !== "all" ? courseFilter : undefined;
  const selectedLearnerId = learnerFilter !== "all" ? learnerFilter : undefined;

  useEffect(() => {
    setCourseFilterState(courseIdParam ?? "all");
  }, [courseIdParam]);

  useEffect(() => {
    setLearnerFilterState(learnerIdParam ?? "all");
  }, [learnerIdParam]);

  const handleCourseFilter = (value: string) => {
    setCourseFilterState(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "all") {
        next.delete("courseId");
      } else {
        next.set("courseId", value);
      }
      return next;
    }, { replace: true });
  };

  const clearLearnerFilter = () => {
    setLearnerFilterState("all");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("learnerId");
      return next;
    }, { replace: true });
  };

  const bookingFilters = useMemo(
    () => ({
      search,
      courseId: courseFilter,
      learnerId: learnerFilter,
      status: statusFilter,
    }),
    [courseFilter, learnerFilter, search, statusFilter],
  );
  const statsFilters = useMemo(
    () => ({
      courseId: courseFilter,
      learnerId: learnerFilter,
    }),
    [courseFilter, learnerFilter],
  );

  const {
    data: allWeekBookings = [],
    isLoading: allBookingsLoading,
    isError: allBookingsError,
    error: allBookingsErrorValue,
  } = useMentorScheduleStats(mentorId, weekStart, statsFilters);

  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    error: bookingsErrorValue,
  } = useMentorBookings(mentorId, weekStart, bookingFilters);

  const {
    data: schedules = [],
    isLoading: schedulesLoading,
    isError: schedulesError,
    error: schedulesErrorValue,
  } = useMentorSchedules(mentorId, selectedCourseId);

  const { data: courses = [], isLoading: coursesLoading } = useMentorCourses(mentorId);
  const { data: selectedLearner } = useMentorStudentDetail(
    mentorId,
    selectedLearnerId,
    !!selectedLearnerId,
  );
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedLearnerLabel =
    selectedLearner?.profile?.name ||
    selectedLearner?.profile?.email ||
    (selectedLearnerId ? `Học viên ${selectedLearnerId.slice(0, 8)}` : null);
  const selectedWeekEnd = formatLocalDate(addDays(weekStart, 6));
  const selectedWeekBeforeStart = Boolean(
    selectedCourse?.start_date && selectedWeekEnd < selectedCourse.start_date,
  );
  const schedulesByCourse = useMemo(() => {
    const groups = new Map<string, CourseSchedule[]>();

    schedules.forEach((slot) => {
      const key = slot.course_id;
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    });

    return Array.from(groups.entries()).map(([courseId, slots]) => ({
      courseId,
      course: slots[0]?.course,
      slots,
    }));
  }, [schedules]);
  const updateBookingStatus = useUpdateMentorBookingStatus();
  const deleteSchedule = useDeleteSchedule();

  const openCreateDialog = () => {
    setEditingSlot(null);
    setSlotDialogOpen(true);
  };

  const openEditDialog = (slot: CourseSchedule) => {
    setEditingSlot(slot);
    setSlotDialogOpen(true);
  };

  const handleBookingStatus = async (
    id: string,
    status: "upcoming" | "completed" | "declined",
    expectedStatus: "pending" | "upcoming",
    successTitle: string,
  ) => {
    if (!mentorId) return;
    setBusyBookingId(id);

    try {
      await updateBookingStatus.mutateAsync({ id, mentorId, status, expectedStatus });
      toast({ title: successTitle });
    } catch (error: unknown) {
      toast({
        title: "Không thể cập nhật buổi học",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleDeleteSlot = async () => {
    if (!deleteSlot || !mentorId) return;

    try {
      await deleteSchedule.mutateAsync({ id: deleteSlot.id, mentor_id: mentorId });
      toast({ title: "Đã xóa lịch dạy" });
      setDeleteSlot(null);
    } catch (error: unknown) {
      toast({
        title: "Không thể xóa lịch dạy",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const bookingErrorMessage =
    bookingsErrorValue instanceof Error ? bookingsErrorValue.message : "Không thể tải lịch đặt.";
  const allBookingErrorMessage =
    allBookingsErrorValue instanceof Error ? allBookingsErrorValue.message : "Không thể tải thống kê.";
  const scheduleErrorMessage =
    schedulesErrorValue instanceof Error ? schedulesErrorValue.message : "Không thể tải lịch cố định.";

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <ScheduleHeader />

        {allBookingsLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : allBookingsError ? (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {allBookingErrorMessage}
            </CardContent>
          </Card>
        ) : (
          <ScheduleStats bookings={allWeekBookings} weekStart={weekStart} />
        )}

        <ScheduleFilters
          search={search}
          onSearch={setSearch}
          courseFilter={courseFilter}
          onCourseFilter={handleCourseFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart((current) => addDays(current, -7))}
          onCurrentWeek={() => setWeekStart(getMondayOfWeek(new Date()))}
          onNextWeek={() => setWeekStart((current) => addDays(current, 7))}
          courses={courses}
          learnerFilterLabel={selectedLearnerLabel}
          onClearLearnerFilter={selectedLearnerId ? clearLearnerFilter : undefined}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="min-w-0 rounded-2xl shadow-card">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Lịch tuần</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bookings.length} buổi học trong bộ lọc hiện tại
                </p>
              </div>
              <Badge variant="outline" className="rounded-full bg-accent/60 text-xs">
                Thứ 2 - Chủ nhật
              </Badge>
            </CardHeader>
            <CardContent>
              {bookingsError ? (
                <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  {bookingErrorMessage}
                </div>
              ) : bookingsLoading ? (
                <div className="grid min-w-[980px] grid-cols-7 gap-3 overflow-hidden">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="space-y-3">
                      <Skeleton className="h-20 rounded-2xl" />
                      <Skeleton className="h-40 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : bookings.length === 0 ? (
                <EmptyScheduleState type="bookings" courseSpecific={!!selectedCourseId} />
              ) : (
                <div className="overflow-x-auto pb-2">
                  <WeeklyCalendar
                    weekStart={weekStart}
                    bookings={bookings}
                    onConfirm={(id) =>
                      handleBookingStatus(id, "upcoming", "pending", "Đã xác nhận buổi học")
                    }
                    onDecline={(id) =>
                      handleBookingStatus(id, "declined", "pending", "Đã từ chối buổi học")
                    }
                    onComplete={(id) =>
                      handleBookingStatus(id, "completed", "upcoming", "Đã đánh dấu hoàn thành")
                    }
                    busyBookingId={busyBookingId}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Lịch cố định của khóa học</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đây là lịch cố định để học viên có thể đặt lịch. Buổi học thực tế sẽ xuất hiện trong Lịch tuần sau khi có booking.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={openCreateDialog}
                disabled={coursesLoading || courses.length === 0}
                className="rounded-xl border-0 text-primary-foreground gradient-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Thêm lịch dạy
              </Button>
            </CardHeader>
            <CardContent>
              {schedulesError ? (
                <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  {scheduleErrorMessage}
                </div>
              ) : schedulesLoading || coursesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-2xl" />
                  ))}
                </div>
              ) : selectedWeekBeforeStart ? (
                <EmptyScheduleState type="before-start" startDate={selectedCourse?.start_date} />
              ) : schedules.length === 0 ? (
                <EmptyScheduleState type="schedules" onAddSchedule={openCreateDialog} />
              ) : (
                <div className="space-y-4">
                  {schedulesByCourse.map((group) => (
                    <div key={group.courseId} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {group.course?.title ?? "Khóa học"}
                        </p>
                        {group.course && (
                          <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                            {group.course.format === "online" ? "Online" : "Offline"}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-3">
                        {group.slots.map((slot) => (
                          <RecurringSlotCard
                            key={slot.id}
                            slot={slot}
                            onEdit={openEditDialog}
                            onDelete={setDeleteSlot}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!coursesLoading && courses.length === 0 && (
                <div
                  className={cn(
                    "mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground",
                    schedules.length === 0 && "mt-0",
                  )}
                >
                  Bạn cần tạo khóa học trước khi thêm lịch dạy cố định.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ScheduleSlotDialog
        open={slotDialogOpen}
        onClose={() => setSlotDialogOpen(false)}
        mentorId={mentorId ?? ""}
        courses={courses}
        editing={editingSlot}
        initialCourseId={selectedCourseId}
      />

      <AlertDialog open={!!deleteSlot} onOpenChange={(open) => !open && setDeleteSlot(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Xóa lịch dạy?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa lịch{" "}
              <span className="font-semibold text-foreground">
                {deleteSlot?.day_of_week} {deleteSlot?.start_time.slice(0, 5)} -{" "}
                {deleteSlot?.end_time.slice(0, 5)}
              </span>{" "}
              của khóa học{" "}
              <span className="font-semibold text-foreground">{deleteSlot?.course?.title}</span>.
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSlot();
              }}
              disabled={deleteSchedule.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa lịch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MentorLayout>
  );
}
