import { Link } from "react-router-dom";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MentorStudent, StudentLearningStatus } from "@/hooks/useMentorStudents";

interface StudentCardProps {
  student: MentorStudent;
  onViewDetail: (student: MentorStudent) => void;
}

const STATUS_CFG: Record<StudentLearningStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ xác nhận", cls: "bg-warning/10 text-warning border-warning/20" },
  learning: { label: "Đang học", cls: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Đã học", cls: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Đã hủy", cls: "bg-muted text-muted-foreground border-border" },
};

function formatDate(date: string | null) {
  if (!date) return "Chưa có";
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN");
}

function formatPrice(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getStudentName(student: MentorStudent) {
  return student.profile?.name || student.profile?.email || "Học viên";
}

export function StudentCard({ student, onViewDetail }: StudentCardProps) {
  const status = STATUS_CFG[student.latest_status];
  const name = getStudentName(student);
  const initial = name.trim().charAt(0).toUpperCase() || "H";
  const phone = student.profile?.phone || student.bookings.find((booking) => booking.phone)?.phone;
  const nextBooking = student.next_booking;

  return (
    <Card className="rounded-2xl shadow-card transition-shadow hover:shadow-card-hover">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={student.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">{initial}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">{name}</h3>
              <Badge variant="outline" className={cn("text-[11px] font-semibold", status.cls)}>
                {status.label}
              </Badge>
            </div>

            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {student.profile?.email && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{student.profile.email}</span>
                </p>
              )}
              {phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{phone}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {student.courses_enrolled.slice(0, 3).map((course) => (
            <Badge key={course.id} variant="secondary" className="rounded-full text-[11px]">
              {course.title}
            </Badge>
          ))}
          {student.courses_enrolled.length > 3 && (
            <Badge variant="outline" className="rounded-full text-[11px]">
              +{student.courses_enrolled.length - 3} khóa học
            </Badge>
          )}
          {student.courses_enrolled.length === 0 && (
            <Badge variant="outline" className="rounded-full text-[11px]">
              Chưa rõ khóa học
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-muted-foreground">Tổng buổi</p>
            <p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              {student.total_bookings}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-muted-foreground">Đã học</p>
            <p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {student.completed_bookings}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-muted-foreground">Buổi tới</p>
            <p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
              <Clock3 className="h-3.5 w-3.5 text-primary" />
              {nextBooking
                ? `${formatDate(nextBooking.booking_date)} · ${nextBooking.start_time.slice(0, 5)}`
                : "Chưa có"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-muted-foreground">Chi tiêu</p>
            <p className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
              <Banknote className="h-3.5 w-3.5 text-success" />
              {formatPrice(student.total_spent)}
            </p>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Lần học gần nhất: <span className="font-medium text-foreground">{formatDate(student.last_booking_date)}</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            onClick={() => onViewDetail(student)}
            className="rounded-xl border-0 text-primary-foreground gradient-primary sm:col-span-1"
          >
            Xem chi tiết
          </Button>
          <Link to={`/mentor/schedule?learnerId=${student.learner_id}`} className="sm:col-span-1">
            <Button type="button" variant="outline" className="w-full rounded-xl">
              Xem lịch học
            </Button>
          </Link>
          {phone ? (
            <a href={`tel:${phone}`} className="sm:col-span-1">
              <Button type="button" variant="outline" className="w-full rounded-xl">
                <Phone className="mr-2 h-4 w-4" />
                Liên hệ
              </Button>
            </a>
          ) : (
            <Button type="button" variant="outline" disabled className="rounded-xl sm:col-span-1">
              <UserRound className="mr-2 h-4 w-4" />
              Liên hệ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
