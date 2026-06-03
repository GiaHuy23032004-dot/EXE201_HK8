import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLearnerCourseDetail } from "@/hooks/useLearnerCourses";
import { useCreateLearnerBooking } from "@/hooks/useLearnerBookings";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  calculateDepositBreakdown,
  defaultLearnerPaymentOption,
  formatVnd,
  getPaymentOptionLabel,
  getPlatformPaymentAmount,
  isPlatformPaymentOption,
  mapPaymentOptionToBookingMethod,
  type LearnerPaymentOption,
} from "@/lib/learnerPayment";

const DAY_INDEX: Record<string, number> = {
  "Thứ 2": 1,
  "Thứ 3": 2,
  "Thứ 4": 3,
  "Thứ 5": 4,
  "Thứ 6": 5,
  "Thứ 7": 6,
  "Chủ nhật": 0,
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

function PaymentOptionCard({
  selected,
  disabled,
  icon,
  title,
  subtitle,
  description,
  badge,
  warning,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  warning?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-card"
          : "border-border bg-card hover:border-primary/30"
      } ${disabled ? "cursor-default opacity-95" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            {badge && <Badge className="rounded-full bg-secondary/10 text-secondary border-0">{badge}</Badge>}
            {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
          {warning && (
            <p className="mt-2 flex items-start gap-1 rounded-xl bg-warning/10 p-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();

  const { data: course, isLoading } = useLearnerCourseDetail(id);
  const createBooking = useCreateLearnerBooking();

  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [phone, setPhone] = useState("");
  const [paymentOption, setPaymentOption] = useState<LearnerPaymentOption>("platform_deposit");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const courseFormat = course?.format === "online" ? "online" : "offline";
  const schedules = (course as any)?.course_schedules ?? [];
  const mentor = (course as any)?.mentor;
  const totalPrice = course?.price ?? 0;
  const { depositAmount, remainingAmount } = useMemo(() => calculateDepositBreakdown(totalPrice), [totalPrice]);
  const platformAmount = getPlatformPaymentAmount(paymentOption, totalPrice);
  const selectedBookingDate = selectedSchedule
    ? getNextBookingDate(selectedSchedule.day_of_week, (course as any).start_date)
    : null;

  useEffect(() => {
    if (!course) return;
    setPaymentOption(defaultLearnerPaymentOption(course.format));
  }, [course?.id, course?.format]);

  const handleConfirm = async () => {
    if (!session?.user?.id || !course || !selectedSchedule) return;

    if (courseFormat === "online" && paymentOption !== "platform_full") {
      setPaymentOption("platform_full");
      toast({ title: "Lớp online bắt buộc thanh toán qua nền tảng." });
      return;
    }

    const bookingDate = getNextBookingDate(selectedSchedule.day_of_week, (course as any).start_date);

    try {
      // Backend integration note:
      // backend should create booking first; for platform_full/platform_deposit,
      // create a pending payment session and let the future provider webhook confirm it.
      // For pay_at_class, backend only creates a pending mentor-confirmation request.
      const booking = await createBooking.mutateAsync({
        course_id: course.id,
        learner_id: session.user.id,
        mentor_id: course.mentor_id,
        schedule_id: selectedSchedule.id,
        booking_date: bookingDate,
        start_time: selectedSchedule.start_time,
        end_time: selectedSchedule.end_time,
        phone,
        payment_method: mapPaymentOptionToBookingMethod(paymentOption),
        payment_option: paymentOption,
        platform_amount: platformAmount,
        total_price: totalPrice,
      });

      setBookingId(booking.id);

      if (isPlatformPaymentOption(paymentOption)) {
        navigate(`/checkout/${booking.id}`);
        return;
      }

      setConfirmed(true);
      toast({
        title: "Yêu cầu đặt lịch đã được gửi",
        description: "Mentor sẽ xác nhận lịch học của bạn.",
      });
    } catch (err: any) {
      toast({ title: "Đặt lịch thất bại", description: err.message, variant: "destructive" });
    }
  };

  const ctaText =
    courseFormat === "online"
      ? "Tiếp tục thanh toán"
      : paymentOption === "platform_deposit"
        ? "Đặt cọc giữ chỗ"
        : "Gửi yêu cầu đặt lịch";

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

  return (
    <MainLayout>
      <div className="container max-w-3xl py-6">
        <Link to={`/course/${course.id}`} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" />Quay lại khóa học
        </Link>

        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-20 text-center"
            >
              <div className="mb-6 rounded-full bg-success/10 p-6">
                <CheckCircle2 className="h-16 w-16 text-success" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">Yêu cầu đặt lịch đã được gửi!</h2>
              <p className="mb-6 max-w-md text-muted-foreground">
                Mentor sẽ xác nhận lịch học của bạn. Bạn sẽ thanh toán trực tiếp với mentor khi đến lớp.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/learner/dashboard">
                  <Button className="rounded-xl border-0 gradient-primary text-primary-foreground">Xem lịch đã đặt</Button>
                </Link>
                {bookingId && (
                  <Link to={`/receipt/${bookingId}`}>
                    <Button variant="outline" className="gap-2 rounded-xl">
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

              <Card className="mb-6 rounded-2xl shadow-card">
                <CardContent className="flex gap-4 p-4">
                  <img
                    src={course.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"}
                    alt={course.title}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          courseFormat === "online"
                            ? "rounded-full border-0 bg-blue-100 text-blue-700"
                            : "rounded-full border-0 bg-teal-100 text-teal-700"
                        }
                      >
                        {courseFormat === "online" ? (
                          <><Monitor className="mr-1 h-3 w-3" />Online</>
                        ) : (
                          <><MapPin className="mr-1 h-3 w-3" />Offline</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="rounded-full">{course.category}</Badge>
                    </div>
                    <h3 className="line-clamp-2 font-semibold text-card-foreground">{course.title}</h3>
                    <p className="text-sm text-muted-foreground">Mentor: {mentor?.name || "Mentor"}</p>
                    <p className="mt-1 text-lg font-bold text-primary">{formatVnd(totalPrice)}/buổi</p>
                  </div>
                </CardContent>
              </Card>

              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Calendar className="h-5 w-5 text-primary" />Chọn lịch học
                </h2>
                {schedules.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {schedules.map((slot: any) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSchedule(slot)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          selectedSchedule?.id === slot.id
                            ? "border-primary bg-accent shadow-card"
                            : "bg-card hover:border-primary/30"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{slot.day_of_week}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{slot.start_time} - {slot.end_time}
                        </p>
                        {selectedSchedule?.id === slot.id && selectedBookingDate && (
                          <p className="mt-1 text-xs font-medium text-primary">
                            {new Date(`${selectedBookingDate}T00:00:00`).toLocaleDateString("vi-VN", {
                              weekday: "long",
                              day: "numeric",
                              month: "numeric",
                            })}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Mentor chưa cập nhật lịch dạy.</p>
                )}
              </div>

              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Phone className="h-5 w-5 text-primary" />Số điện thoại liên hệ
                </h2>
                <Input
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />Phương thức thanh toán
                </h2>
                {courseFormat === "online" ? (
                  <div className="space-y-3">
                    <PaymentOptionCard
                      selected
                      disabled
                      icon={<ShieldCheck className="h-5 w-5" />}
                      title="Thanh toán qua nền tảng"
                      subtitle="Bắt buộc cho lớp học online"
                      description="VET sẽ xác nhận lịch học sau khi thanh toán thành công."
                    />
                    <Alert className="rounded-2xl border-blue-200 bg-blue-50 text-blue-800">
                      <ShieldCheck className="h-4 w-4" />
                      <AlertDescription>
                        Bắt buộc cho lớp học online. VET giữ vai trò trung gian để bảo vệ người học và mentor.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PaymentOptionCard
                      selected={paymentOption === "platform_deposit"}
                      icon={<ShieldCheck className="h-5 w-5" />}
                      title="Đặt cọc giữ chỗ"
                      subtitle="Thanh toán một phần qua nền tảng"
                      description="Phần còn lại thanh toán trực tiếp với mentor khi đến lớp."
                      badge="Khuyên dùng"
                      onClick={() => setPaymentOption("platform_deposit")}
                    />
                    <PaymentOptionCard
                      selected={paymentOption === "pay_at_class"}
                      icon={<Banknote className="h-5 w-5" />}
                      title="Trả tại lớp"
                      subtitle="Thanh toán trực tiếp với mentor"
                      description="Không cần thanh toán trước. Mentor có thể xác nhận hoặc từ chối lịch học."
                      warning="VET không thể đảm bảo giữ chỗ nếu bạn chưa đặt cọc."
                      onClick={() => setPaymentOption("pay_at_class")}
                    />
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              <div className="mb-6 rounded-2xl border bg-muted/30 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Receipt className="h-4 w-4 text-primary" />
                  Tóm tắt đặt lịch
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Khóa học</span>
                    <span className="max-w-[60%] text-right text-foreground">{course.title}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Mentor</span>
                    <span className="text-foreground">{mentor?.name || "Mentor"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Lịch học</span>
                    <span className="max-w-[60%] text-right text-foreground">
                      {selectedSchedule && selectedBookingDate
                        ? `${selectedSchedule.day_of_week} • ${selectedSchedule.start_time} • ${new Date(`${selectedBookingDate}T00:00:00`).toLocaleDateString("vi-VN")}`
                        : "Chưa chọn"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hình thức</span>
                    <span className="text-foreground">{courseFormat === "online" ? "Online" : "Offline"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thanh toán</span>
                    <span className="text-foreground">{getPaymentOptionLabel(paymentOption)}</span>
                  </div>
                  <Separator className="my-2" />

                  {courseFormat === "online" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cần thanh toán</span>
                        <span className="text-foreground">100% học phí</span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span>Tổng cộng</span>
                        <span className="text-primary">{formatVnd(totalPrice)}</span>
                      </div>
                    </>
                  )}

                  {courseFormat === "offline" && paymentOption === "platform_deposit" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tổng học phí</span>
                        <span className="text-foreground">{formatVnd(totalPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Đặt cọc qua nền tảng</span>
                        <span className="font-semibold text-primary">{formatVnd(depositAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Còn lại trả tại lớp</span>
                        <span className="text-foreground">{formatVnd(remainingAmount)}</span>
                      </div>
                    </>
                  )}

                  {courseFormat === "offline" && paymentOption === "pay_at_class" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cần thanh toán ngay</span>
                        <span className="font-semibold text-foreground">{formatVnd(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tổng học phí</span>
                        <span className="text-primary">{formatVnd(totalPrice)}</span>
                      </div>
                      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                        Bạn sẽ thanh toán trực tiếp với mentor khi đến lớp.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={!selectedSchedule || !phone || createBooking.isPending}
                className="w-full rounded-xl border-0 gradient-primary py-6 text-base text-primary-foreground"
              >
                {createBooking.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang xử lý...</>
                ) : (
                  ctaText
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
