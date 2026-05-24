import { useState, useMemo } from "react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorScheduleBookings, useUpdateScheduleBookingStatus } from "@/hooks/useMentorBookings";
import { useMentorSchedules, useDeleteSchedule, type CourseSchedule } from "@/hooks/useMentorSchedule";
import { useMentorCourses } from "@/hooks/use-courses";
import { ScheduleStats }      from "@/components/mentor/schedule/ScheduleStats";
import { ScheduleFilters, type StatusFilter } from "@/components/mentor/schedule/ScheduleFilters";
import { WeeklyCalendar }     from "@/components/mentor/schedule/WeeklyCalendar";
import { EmptyScheduleState } from "@/components/mentor/schedule/EmptyScheduleState";
import { ScheduleSlotDialog } from "@/components/mentor/schedule/ScheduleSlotDialog";
import { STATUS_CFG }         from "@/components/mentor/schedule/BookingSessionCard";
import {
  Plus, Pencil, Trash2, MapPin, Video, Loader2, AlertTriangle, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(d: Date) {
  const day = new Date(d);
  const diff = (day.getDay() + 6) % 7; // Mon = 0
  day.setDate(day.getDate() - diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

// ─── recurring slot card ──────────────────────────────────────────────────────

interface SlotCardProps {
  slot:     CourseSchedule;
  onEdit:   (s: CourseSchedule) => void;
  onDelete: (s: CourseSchedule) => void;
}

function RecurringSlotCard({ slot: s, onEdit, onDelete }: SlotCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <CalendarDays className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{s.course?.title ?? "—"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{s.day_of_week}</span>
          <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
          {s.course?.format === "online"
            ? <span className="flex items-center gap-1"><Video  className="h-3 w-3" />Online</span>
            : <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Offline</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="outline" size="sm"
          onClick={() => onEdit(s)}
          className="h-8 w-8 p-0 rounded-xl gradient-primary border-0 text-primary-foreground"
          title="Chỉnh sửa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => onDelete(s)}
          className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          title="Xóa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function MentorSchedule() {
  const { session } = useAuth();
  const { toast }   = useToast();
  const mentorId    = session?.user?.id ?? "";

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: bookings  = [], isLoading: bLoading } = useMentorScheduleBookings(mentorId || undefined);
  const { data: schedules = [], isLoading: sLoading } = useMentorSchedules(mentorId || undefined);
  const { data: courses   = [] }                      = useMentorCourses(mentorId || undefined);
  const updateStatus  = useUpdateScheduleBookingStatus();
  const deleteSchedule = useDeleteSchedule();

  // ── local state ───────────────────────────────────────────────────────────
  const [weekStart,     setWeekStart]     = useState(() => getMondayOfWeek(new Date()));
  const [search,        setSearch]        = useState("");
  const [courseFilter,  setCourseFilter]  = useState("all");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot,   setEditingSlot]   = useState<CourseSchedule | null>(null);
  const [deleteSlot,    setDeleteSlot]    = useState<CourseSchedule | null>(null);

  // ── week range ────────────────────────────────────────────────────────────
  const weekEnd = addDays(weekStart, 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso   = weekEnd.toISOString().slice(0, 10);

  // ── filtered bookings ─────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const inWeek      = b.booking_date >= weekStartIso && b.booking_date <= weekEndIso;
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchCourse = courseFilter === "all" || b.course_id === courseFilter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (b.course?.title ?? "").toLowerCase().includes(q) ||
        (b.learner?.name ?? "").toLowerCase().includes(q);
      return inWeek && matchStatus && matchCourse && matchSearch;
    });
  }, [bookings, weekStartIso, weekEndIso, statusFilter, courseFilter, search]);

  // ── booking actions ───────────────────────────────────────────────────────
  const handleConfirm = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "upcoming", mentorId });
      toast({ title: "✅ Đã xác nhận buổi học" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "declined", mentorId });
      toast({ title: "Đã từ chối buổi học" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "completed", mentorId });
      toast({ title: "✅ Đã đánh dấu hoàn thành" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    }
  };

  // ── schedule slot actions ─────────────────────────────────────────────────
  const handleDeleteSlot = async () => {
    if (!deleteSlot) return;
    try {
      await deleteSchedule.mutateAsync({ id: deleteSlot.id, mentor_id: mentorId });
      toast({ title: "Đã xóa lịch dạy" });
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setDeleteSlot(null);
    }
  };

  const openCreate = () => { setEditingSlot(null); setSlotDialogOpen(true); };
  const openEdit   = (s: CourseSchedule) => { setEditingSlot(s); setSlotDialogOpen(true); };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <MentorLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lịch dạy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý lịch học, lịch đặt và thời gian giảng dạy của bạn.
          </p>
        </div>

        {/* Stats */}
        {bLoading
          ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          : <ScheduleStats bookings={bookings} />}

        {/* Filters */}
        <ScheduleFilters
          search={search}           onSearch={setSearch}
          courseFilter={courseFilter} onCourse={setCourseFilter}
          statusFilter={statusFilter} onStatus={setStatusFilter}
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart((w) => addDays(w, -7))}
          onNextWeek={() => setWeekStart((w) => addDays(w,  7))}
          onToday={() => setWeekStart(getMondayOfWeek(new Date()))}
          courses={courses}
        />

        {/* Main two-column layout */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Left: weekly calendar (2/3 width) ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Lịch tuần</h2>
              <span className="text-xs text-muted-foreground">{filteredBookings.length} buổi học</span>
            </div>

            {bLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : filteredBookings.length === 0 ? (
              <EmptyScheduleState type="bookings" />
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[700px]">
                  <WeeklyCalendar
                    weekStart={weekStart}
                    bookings={filteredBookings}
                    onConfirm={handleConfirm}
                    onDecline={handleDecline}
                    onComplete={handleComplete}
                    isPending={updateStatus.isPending}
                  />
                </div>
              </div>
            )}

            {/* Booking list below calendar for mobile / overflow */}
            {!bLoading && filteredBookings.length > 0 && (
              <div className="space-y-3 lg:hidden">
                <h3 className="text-sm font-semibold text-foreground">Danh sách buổi học</h3>
                {filteredBookings.map((b) => {
                  const cfg = STATUS_CFG[b.status];
                  return (
                    <div key={b.id} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.learner?.name ?? "Học viên"}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.course?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.booking_date).toLocaleDateString("vi-VN")} • {b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px]", cfg.cls)}>{cfg.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: recurring schedules (1/3 width) ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Lịch cố định</h2>
              <Button
                size="sm"
                onClick={openCreate}
                className="gradient-primary border-0 text-primary-foreground rounded-xl h-8 px-3 text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Thêm lịch
              </Button>
            </div>

            {sLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
              </div>
            ) : schedules.length === 0 ? (
              <EmptyScheduleState type="schedules" onAddSchedule={openCreate} />
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <RecurringSlotCard
                    key={s.id}
                    slot={s}
                    onEdit={openEdit}
                    onDelete={setDeleteSlot}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Schedule slot dialog (create / edit) ── */}
      <ScheduleSlotDialog
        open={slotDialogOpen}
        onClose={() => setSlotDialogOpen(false)}
        mentorId={mentorId}
        courses={courses}
        editing={editingSlot}
      />

      {/* ── Delete slot confirmation ── */}
      <AlertDialog open={!!deleteSlot} onOpenChange={(o) => !o && setDeleteSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Xóa lịch dạy?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa lịch{" "}
              <span className="font-semibold text-foreground">
                {deleteSlot?.day_of_week} {deleteSlot?.start_time?.slice(0,5)}–{deleteSlot?.end_time?.slice(0,5)}
              </span>{" "}
              của khóa học <span className="font-semibold text-foreground">"{deleteSlot?.course?.title}"</span>.
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlot}
              disabled={deleteSchedule.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Xóa lịch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MentorLayout>
  );
}
