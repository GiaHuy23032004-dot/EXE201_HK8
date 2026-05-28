import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLearnerCourseDetail } from "@/hooks/useLearnerCourses";
import { useCreateLearnerBooking } from "@/hooks/useLearnerBookings";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, Phone, CreditCard, Wallet, ChevronLeft, CheckCircle2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const DAY_INDEX: Record<string, number> = {
  "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4,
  "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0,
};

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextBookingDate(dayOfWeek: string, startDate?: string | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstAvailable = startDate ? new Date(`${startDate}T00:00:00`) : today;
  const base = firstAvailable > today ? firstAvailable : today;
  const targetDay = DAY_INDEX[dayOfWeek];
  if (targetDay === undefined) return formatLocalDate(base);
  const next = new Date(base);
  const diff = (targetDay - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diff);
  return formatLocalDate(next);
}

export default function BookingPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();

  const { data: course, isLoading } = useLearnerCourseDetail(id);
  const createBooking = useCreateLearnerBooking();

  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [phone, setPhone]     = useState("");
  const [payment, setPayment] = useState<"later" | "platform">("later");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const schedules = (course as any)?.course_schedules ?? [];

  const handleConfirm = async () => {
    if (!session?.user?.id || !course || !selectedSchedule) return;
    const bookingDate = getNextBookingDate(
      selectedSchedule.day_of_week,
      (course as any).start_date
    );
    try {
      const booking = await createBooking.mutateAsync({
        course_id: course.id,
        learner_id: session.user.id,
        mentor_id: course.mentor_id,
        schedule_id: selectedSchedule.id,
        booking_date: bookingDate,
        start_time: selectedSchedule.start_time,
        end_time: selectedSchedule.end_time,
        phone,
        payment_method: payment,
        total_price: course.price,
      });
      setBookingId(booking.id);
      setConfirmed(true);
    } catch (err: any) {
      toast({ title: "Đặt lịch thất bại", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!course) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy khóa học.</p>
        </div>
      </MainLayout>
    );
  }

  const mentor = (course as any).mentor;
  const selectedBookingDate = selectedSchedule
    ? getNextBookingDate(selectedSchedule.day_of_week, (course as any).start_date)
    : null;

  return (
    <MainLayout>
      <div className="container max-w-3xl py-6">
        <Link to={`/course/${course.id}`} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" />Quay lại khóa học
        </Link>

        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-20 text-center">
              <div className="mb-6 rounded-full bg-success/10 p-6">
                <CheckCircle2 className="h-16 w-16 text-success" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">Đặt lịch thành công!</h2>
              <p className="mb-6 text-muted-foreground">Mentor sẽ xác nhận đặt lịch của bạn trong thời gian sớm nhất.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/learner/dashboard">
                  <Button className="gradient-primary border-0 text-primary-foreground rounded-xl">Xem lịch đã đặt</Button>
                </Link>
                {bookingId && (
                  <Link to={`/receipt/${bookingId}`}>
                    <Button variant="outline" className="rounded-xl gap-2">
                      <FileText className="h-4 w-4" />Xem biên lai
                    </Button>
                  </Link>
                )}
                <Link to="/">
                  <Button variant="outline" className="rounded-xl">Về trang chủ</Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="mb-6 text-2xl font-bold text-foreground">Đặt lịch học</h1>

              {/* Course summary */}
              <div className="mb-6 flex gap-4 rounded-2xl border bg-card p-4">
                <img
                  src={course.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"}
                  alt={course.title}
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-semibold text-card-foreground">{course.title}</h3>
                  <p className="text-sm text-muted-foreground">Mentor: {mentor?.name || "Mentor"}</p>
                  <p className="mt-1 text-lg font-bold text-primary">{course.price.toLocaleString("vi-VN")}đ/buổi</p>
                </div>
              </div>

              {/* Time slot */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Calendar className="h-5 w-5 text-primary" />Chọn lịch học
                </h2>
                {schedules.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {schedules.map((slot: any) => (
                      <button key={slot.id} onClick={() => setSelectedSchedule(slot)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          selectedSchedule?.id === slot.id
                            ? "border-primary bg-accent shadow-card"
                            : "bg-card hover:border-primary/30"
                        }`}>
                        <p className="text-sm font-medium text-foreground">{slot.day_of_week}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />{slot.start_time} - {slot.end_time}
                        </p>
                        {selectedSchedule?.id === slot.id && selectedBookingDate && (
                          <p className="text-xs text-primary mt-1 font-medium">
                            📅 {new Date(`${selectedBookingDate}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Mentor chưa cập nhật lịch dạy.</p>
                )}
              </div>

              {/* Contact */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Phone className="h-5 w-5 text-primary" />Số điện thoại liên hệ
                </h2>
                <Input placeholder="0912 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
              </div>

              {/* Payment */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />Phương thức thanh toán
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPayment("later")}
                    className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${payment === "later" ? "border-primary bg-accent" : "bg-card hover:border-primary/30"}`}>
                    <Wallet className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Trả sau</p>
                      <p className="text-xs text-muted-foreground">Thanh toán trực tiếp với mentor</p>
                    </div>
                  </button>
                  <button onClick={() => setPayment("platform")}
                    className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${payment === "platform" ? "border-primary bg-accent" : "bg-card hover:border-primary/30"}`}>
                    <CreditCard className="h-5 w-5 text-secondary" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Qua nền tảng</p>
                      <p className="text-xs text-muted-foreground">Thanh toán online an toàn</p>
                    </div>
                  </button>
                </div>
                {payment === "platform" && (
                  <p className="mt-2 text-xs text-muted-foreground rounded-xl bg-muted/40 p-3">
                    💡 Tiền được giữ bởi hệ thống và chuyển cho mentor sau khi buổi học hoàn thành.
                  </p>
                )}
              </div>

              <Separator className="my-6" />

              {/* Summary */}
              <div className="mb-6 rounded-2xl border bg-muted/30 p-6">
                <h3 className="mb-4 font-semibold text-foreground">Tóm tắt đặt lịch</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Khóa học</span><span className="text-foreground">{course.title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mentor</span><span className="text-foreground">{mentor?.name || "Mentor"}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lịch học</span>
                    <span className="text-foreground text-right">
                      {selectedSchedule && selectedBookingDate
                        ? `${selectedSchedule.day_of_week} • ${selectedSchedule.start_time} • ${new Date(`${selectedBookingDate}T00:00:00`).toLocaleDateString("vi-VN")}`
                        : "Chưa chọn"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thanh toán</span>
                    <span className="text-foreground">{payment === "platform" ? "Qua nền tảng" : "Trả sau"}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-bold">
                    <span>Tổng cộng</span>
                    <span className="text-primary">{course.price.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={!selectedSchedule || !phone || createBooking.isPending}
                className="w-full gradient-primary border-0 text-primary-foreground py-6 rounded-xl text-base"
              >
                {createBooking.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang xử lý...</>
                  : "Xác nhận đặt lịch"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
