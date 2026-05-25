import { useState } from "react";
import {
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMentorStudentDetail } from "@/hooks/useMentorStudentDetail";
import {
  useUpdateMentorStudentBookingStatus,
  type MentorStudent,
  type MentorStudentBooking,
} from "@/hooks/useMentorStudents";
import { StudentBookingHistory } from "@/components/mentor/students/StudentBookingHistory";

interface StudentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  mentorId: string;
  student: MentorStudent | null;
}

function formatPrice(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}

function getStudentName(student: MentorStudent) {
  return student.profile?.name || student.profile?.email || "Học viên";
}

export function StudentDetailDialog({ open, onClose, mentorId, student }: StudentDetailDialogProps) {
  const { toast } = useToast();
  const updateBookingStatus = useUpdateMentorStudentBookingStatus();
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useMentorStudentDetail(mentorId, student?.learner_id, open && !!student);

  const current = detail ?? student;

  const handleBookingStatus = async (
    booking: MentorStudentBooking,
    status: "upcoming" | "completed" | "declined",
    expectedStatus: "pending" | "upcoming",
    successTitle: string,
  ) => {
    setBusyBookingId(booking.id);
    try {
      await updateBookingStatus.mutateAsync({
        id: booking.id,
        mentorId,
        learnerId: booking.learner_id,
        status,
        expectedStatus,
      });
      toast({ title: successTitle });
    } catch (mutationError: unknown) {
      toast({
        title: "Không thể cập nhật buổi học",
        description: getErrorMessage(mutationError),
        variant: "destructive",
      });
    } finally {
      setBusyBookingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground gradient-primary">
              <UserRound className="h-4 w-4" />
            </span>
            Chi tiết học viên
          </DialogTitle>
        </DialogHeader>

        {isLoading && !current ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(error)}
          </div>
        ) : current ? (
          <div className="space-y-5">
            <section className="rounded-2xl border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={current.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getStudentName(current).charAt(0).toUpperCase() || "H"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{getStudentName(current)}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {current.profile?.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        {current.profile.email}
                      </span>
                    )}
                    {(current.profile?.phone || current.bookings.find((booking) => booking.phone)?.phone) && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        {current.profile?.phone || current.bookings.find((booking) => booking.phone)?.phone}
                      </span>
                    )}
                  </div>
                  {current.profile?.bio && (
                    <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                      {current.profile.bio}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { label: "Tổng buổi", value: current.total_bookings, icon: CalendarDays },
                { label: "Đã học", value: current.completed_bookings, icon: CheckCircle2 },
                { label: "Sắp học", value: current.upcoming_bookings, icon: Clock3 },
                { label: "Chi tiêu", value: formatPrice(current.total_spent), icon: Banknote },
                { label: "Khóa học", value: current.courses_enrolled.length, icon: BookOpen },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border bg-card p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-3 text-base font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">Lịch sử đặt học</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tất cả buổi học giữa học viên này và bạn.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {current.courses_enrolled.slice(0, 3).map((course) => (
                    <Badge key={course.id} variant="secondary" className="rounded-full text-[11px]">
                      {course.title}
                    </Badge>
                  ))}
                </div>
              </div>

              <StudentBookingHistory
                bookings={current.bookings}
                busyBookingId={busyBookingId}
                onConfirm={(booking) =>
                  handleBookingStatus(booking, "upcoming", "pending", "Đã xác nhận buổi học")
                }
                onDecline={(booking) =>
                  handleBookingStatus(booking, "declined", "pending", "Đã từ chối buổi học")
                }
                onComplete={(booking) =>
                  handleBookingStatus(booking, "completed", "upcoming", "Đã đánh dấu hoàn thành")
                }
              />
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
