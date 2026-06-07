import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLearnerBookings, useCancelLearnerBooking } from "@/hooks/useLearnerBookings";
import { useLearnerSavedCourses } from "@/hooks/useLearnerCourses";
import { useLearnerReviews, useCreateLearnerReview } from "@/hooks/useLearnerReviews";
import { useLearnerTransactions } from "@/hooks/useLearnerPayments";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, Star, GraduationCap, Heart, Search, BookOpen, Loader2, Receipt, CheckCircle2, RotateCcw, FileText, Flag, Crown, Route, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ReportModal } from "@/components/reports/ReportModal";
import {
  formatVnd,
  inferPaymentOptionFromBooking,
} from "@/lib/learnerPayment";

const statusMap: Record<string, { label: string; color: string }> = {
  pending:   { label: "Chờ xác nhận", color: "bg-warning/10 text-warning border-warning/20" },
  upcoming:  { label: "Sắp tới",      color: "bg-secondary/10 text-secondary border-secondary/20" },
  completed: { label: "Hoàn thành",   color: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Đã hủy",       color: "bg-muted text-muted-foreground border-muted" },
  declined:  { label: "Bị từ chối",   color: "bg-destructive/10 text-destructive border-destructive/20" },
};

type ReviewTarget = {
  bookingId: string;
  courseId: string;
  courseTitle: string;
};

type LearnerReportTarget = {
  type: "payment";
  courseId: string | null;
  reportedUserId: string;
  bookingId: string;
  transactionId?: string | null;
  contextTitle: string;
  contextDescription?: string;
};

export default function LearnerDashboard() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const userId = session?.user?.id;

  const { data: bookings = [], isLoading: bookingsLoading } = useLearnerBookings(userId);
  const { data: savedData = [], isLoading: savedLoading } = useLearnerSavedCourses(userId);
  const { data: reviews = [] } = useLearnerReviews(userId);
  const { data: transactions = [], isLoading: txnsLoading } = useLearnerTransactions(userId);
  const cancelBooking = useCancelLearnerBooking();
  const createReview = useCreateLearnerReview();

  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reportTarget, setReportTarget] = useState<LearnerReportTarget | null>(null);

  const pending   = bookings.filter((b) => b.status === "pending");
  const upcoming  = bookings.filter((b) => b.status === "upcoming");
  const completed = bookings.filter((b) => b.status === "completed");

  const handleCancel = async (bookingId: string) => {
    if (!userId) return;
    try {
      await cancelBooking.mutateAsync({ id: bookingId, learnerId: userId });
      toast({ title: "Đã hủy đặt lịch" });
    } catch {
      toast({ title: "Không thể hủy", variant: "destructive" });
    }  };

  const openReviewDialog = (booking: typeof bookings[0]) => {
    setReviewTarget({
      bookingId: booking.id,
      courseId: booking.course_id,
      courseTitle: booking.course?.title ?? "",
    });
    setReviewRating(0);
    setReviewHover(0);
    setReviewComment("");
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || !userId || reviewRating === 0) return;
    try {
      await createReview.mutateAsync({
        course_id: reviewTarget.courseId,
        booking_id: reviewTarget.bookingId,
        learner_id: userId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ["learner-reviews", userId] });
      qc.invalidateQueries({ queryKey: ["reviews", reviewTarget.courseId] });
      toast({ title: "Đã gửi đánh giá", description: `Cảm ơn bạn đã đánh giá "${reviewTarget.courseTitle}"` });
      setReviewTarget(null);
    } catch (err: any) {
      toast({ title: "Không thể gửi đánh giá", description: err.message, variant: "destructive" });
    }
  };

  const openBookingReport = (booking: typeof bookings[0]) => {
    setReportTarget({
      type: "payment",
      courseId: booking.course_id,
      reportedUserId: booking.mentor_id,
      bookingId: booking.id,
      contextTitle: booking.course?.title || "Buổi học đã đặt",
      contextDescription: `${new Date(booking.booking_date).toLocaleDateString("vi-VN")} · ${booking.start_time} - ${booking.end_time}`,
    });
  };

  const getBookingPaymentDisplay = (booking: typeof bookings[0]) => {
    const transaction = (transactions as any[]).find((txn) => txn.booking_id === booking.id);
    const paymentOption = inferPaymentOptionFromBooking({
      courseFormat: booking.course?.format,
      paymentMethod: booking.payment_method,
      totalPrice: booking.total_price,
      transactionAmount: transaction?.amount,
    });
    const isPaid = transaction?.status === "success";

    if (paymentOption === "platform_full") {
      return {
        label: isPaid ? "Đã thanh toán" : "Chờ thanh toán",
        detail: "Cần thanh toán 100% qua nền tảng",
        color: isPaid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20",
        actionLabel: isPaid ? null : "Thanh toán",
      };
    }

    if (paymentOption === "platform_deposit") {
      const remaining = Math.max(0, booking.total_price - (transaction?.amount ?? 0));
      return {
        label: isPaid ? "Đã đặt cọc" : "Chờ đặt cọc",
        detail: isPaid ? `Còn lại trả tại lớp: ${formatVnd(remaining)}` : "Thanh toán đặt cọc để giữ chỗ",
        color: isPaid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20",
        actionLabel: isPaid ? null : "Thanh toán đặt cọc",
      };
    }

    return {
      label: booking.status === "pending" ? "Chờ mentor xác nhận" : "Thanh toán tại lớp",
      detail: "Thanh toán tại lớp",
      color: "bg-muted text-muted-foreground border-border",
      actionLabel: null,
    };
  };

  function BookingItem({ booking }: { booking: typeof bookings[0] }) {
    const s = statusMap[booking.status] ?? statusMap.pending;
    const existingReview = reviews.some((review: any) => review.booking_id === booking.id);
    const paymentDisplay = getBookingPaymentDisplay(booking);
    return (
      <div className="flex gap-4 rounded-2xl border bg-card p-4 shadow-card">
        <img
          src={booking.course?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"}
          alt={booking.course?.title}
          className="h-20 w-20 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-card-foreground line-clamp-1">{booking.course?.title}</h3>
            <div className="flex flex-col items-end gap-1">
              <Badge className={`${s.color} text-xs whitespace-nowrap`}>{s.label}</Badge>
              <Badge variant="outline" className={`${paymentDisplay.color} text-xs whitespace-nowrap`}>
                {paymentDisplay.label}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Mentor: {booking.mentor?.name || "Mentor"}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(booking.booking_date).toLocaleDateString("vi-VN")}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.start_time} - {booking.end_time}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{paymentDisplay.detail}</p>
          {paymentDisplay.actionLabel && (
            <Link to={`/checkout/${booking.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 rounded-lg text-xs"
              >
                <Receipt className="mr-1 h-3 w-3" />
                {paymentDisplay.actionLabel}
              </Button>
            </Link>
          )}
          {booking.status === "completed" && !existingReview && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs rounded-lg"
              onClick={() => openReviewDialog(booking)}
            >
              <Star className="mr-1 h-3 w-3" />Đánh giá khóa học
            </Button>
          )}
          {booking.status === "completed" && existingReview && (
            <Badge variant="outline" className="mt-2 w-fit text-xs">
              Đã đánh giá
            </Badge>
          )}
          {booking.status === "upcoming" && (
            <Button
              variant="outline" size="sm"
              className="mt-2 h-7 text-xs rounded-lg text-destructive hover:text-destructive"
              onClick={() => handleCancel(booking.id)}
              disabled={cancelBooking.isPending}
            >
              Hủy đặt lịch
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs rounded-lg text-muted-foreground hover:text-destructive"
            onClick={() => openBookingReport(booking)}
          >
            <Flag className="mr-1 h-3 w-3" />
            Báo cáo buổi học
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Chào {user?.name?.split(" ").pop() || "bạn"} 👋
              </h1>
              <p className="text-muted-foreground text-sm">Trang học viên – quản lý lịch học & tiến trình</p>
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/learner/roadmap">
                <Button variant="outline" className="rounded-xl">
                  <Route className="mr-2 h-4 w-4" />
                  Lộ trình AI
                </Button>
              </Link>
              <Link to="/learner/learning-profile">
                <Button variant="outline" className="rounded-xl">
                  <Brain className="mr-2 h-4 w-4" />
                  Hồ sơ học tập
                </Button>
              </Link>
              <Link to="/learner/subscription">
                <Button variant="outline" className="rounded-xl">
                  <Crown className="mr-2 h-4 w-4" />
                  Gói của tôi
                </Button>
              </Link>
              <Link to="/learner/reports">
                <Button variant="outline" className="rounded-xl">
                  <Flag className="mr-2 h-4 w-4" />
                  Báo cáo của tôi
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Chờ xác nhận", value: pending.length,   color: "text-warning" },
            { label: "Sắp diễn ra",  value: upcoming.length,  color: "text-secondary" },
            { label: "Đã hoàn thành",value: completed.length, color: "text-success" },
            { label: "Đánh giá đã viết", value: reviews.length, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-card text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="upcoming"  className="flex-1">Sắp tới ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="pending"   className="flex-1">Chờ duyệt ({pending.length})</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Hoàn thành ({completed.length})</TabsTrigger>
            <TabsTrigger value="saved"     className="flex-1">Đã lưu</TabsTrigger>
            <TabsTrigger value="reviews"   className="flex-1">Đánh giá</TabsTrigger>
            <TabsTrigger value="payments"  className="flex-1">💳 Thanh toán</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {bookingsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : upcoming.length > 0 ? upcoming.map((b) => <BookingItem key={b.id} booking={b} />)
              : (
                <div className="flex flex-col items-center py-16 text-center">
                  <Calendar className="h-12 w-12 text-muted mb-3" />
                  <p className="font-semibold text-foreground">Chưa có lịch học nào</p>
                  <Link to="/search">
                    <Button className="mt-4 gradient-primary border-0 text-primary-foreground">
                      <Search className="mr-2 h-4 w-4" />Tìm khóa học
                    </Button>
                  </Link>
                </div>
              )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {pending.length > 0 ? pending.map((b) => <BookingItem key={b.id} booking={b} />)
              : <p className="text-center text-muted-foreground py-8">Không có đặt lịch nào đang chờ</p>}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completed.length > 0 ? completed.map((b) => <BookingItem key={b.id} booking={b} />)
              : <p className="text-center text-muted-foreground py-8">Chưa có buổi học nào hoàn thành</p>}
          </TabsContent>

          <TabsContent value="saved" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Các khóa học bạn đã lưu để xem sau</p>
            {savedLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : savedData.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedData.map((s: any) => (
                    <Link to={`/course/${s.course?.id}`} key={s.id}>
                      <div className="flex gap-3 rounded-2xl border bg-card p-3 shadow-card hover:border-primary transition-colors">
                        <img src={s.course?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"} alt={s.course?.title} className="h-16 w-16 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-card-foreground line-clamp-1">{s.course?.title}</p>
                          <p className="text-xs text-muted-foreground">{s.course?.mentor?.name}</p>
                          <p className="text-sm font-bold text-primary mt-1">{s.course?.price?.toLocaleString("vi-VN")}đ</p>
                        </div>
                        <Heart className="h-4 w-4 text-destructive fill-destructive shrink-0 mt-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">Chưa lưu khóa học nào</p>}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Các đánh giá bạn đã viết</p>
            {reviews.length > 0 ? reviews.map((r: any) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`} />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("vi-VN")}</span>
                </div>
                {r.course && <p className="text-xs text-muted-foreground mb-1">{r.course.title}</p>}
                <p className="text-sm text-foreground">{r.comment}</p>
              </div>
            )) : <p className="text-center text-muted-foreground py-8">Chưa có đánh giá nào</p>}
          </TabsContent>

          {/* PAYMENTS TAB */}
          <TabsContent value="payments" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Lịch sử các giao dịch thanh toán của bạn</p>
            {txnsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {(transactions as any[]).map((t) => (
                  <div key={t.id} className="rounded-2xl border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <img
                        src={t.course?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&h=100&fit=crop"}
                        alt={t.course?.title}
                        className="h-14 w-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-card-foreground line-clamp-1">{t.course?.title || "Khóa học"}</p>
                        <p className="text-xs font-medium text-primary">
                          {t.txn_type === "offline" ? "Đặt cọc giữ chỗ" : "Thanh toán khóa học"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.reference_code || t.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("vi-VN")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatVnd(t.amount)}</p>
                        <Badge className={`mt-1 text-[10px] border-0 ${
                          t.status === "success" ? "bg-success/10 text-success" :
                          t.status === "refunded" ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {t.status === "success" ? <><CheckCircle2 className="h-3 w-3 mr-1" />Thành công</> :
                           t.status === "refunded" ? <><RotateCcw className="h-3 w-3 mr-1" />Đã hoàn</> :
                           "Đang xử lý"}
                        </Badge>
                      </div>
                    </div>
                    {t.booking_id && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Link to={`/receipt/${t.booking_id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1">
                            <FileText className="h-3 w-3" />Xem biên lai
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs rounded-lg text-muted-foreground hover:text-destructive"
                          onClick={() => setReportTarget({
                            type: "payment",
                            courseId: t.course_id,
                            reportedUserId: t.mentor_id,
                            bookingId: t.booking_id,
                            transactionId: t.id,
                            contextTitle: t.course?.title || "Giao dịch thanh toán",
                            contextDescription: `Mã giao dịch: ${t.reference_code || t.id.slice(0, 8).toUpperCase()}`,
                          })}
                        >
                          <Flag className="mr-1 h-3 w-3" />
                          Báo cáo thanh toán
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <Receipt className="h-12 w-12 text-muted mb-3" />
                <p className="font-semibold text-foreground">Chưa có giao dịch nào</p>
                <p className="text-xs text-muted-foreground mt-1">Các giao dịch thanh toán online sẽ hiển thị ở đây</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <div className="mt-8 rounded-2xl gradient-hero-mesh border p-6 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-semibold text-foreground">Khám phá thêm khóa học</p>
          <p className="text-xs text-muted-foreground mt-1">Hơn 15,000 khóa học đang chờ bạn</p>
          <Link to="/search">
            <Button className="mt-4 gradient-primary border-0 text-primary-foreground">Tìm kiếm ngay</Button>
          </Link>
        </div>
      </div>

      {reportTarget && (
        <ReportModal
          open={!!reportTarget}
          onOpenChange={(open) => !open && setReportTarget(null)}
          type={reportTarget.type}
          courseId={reportTarget.courseId}
          reportedUserId={reportTarget.reportedUserId}
          bookingId={reportTarget.bookingId}
          transactionId={reportTarget.transactionId}
          contextTitle={reportTarget.contextTitle}
          contextDescription={reportTarget.contextDescription}
        />
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-warning" />
              Đánh giá khóa học
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{reviewTarget.courseTitle}</p>

              {/* Star rating */}
              <div>
                <Label className="text-sm font-medium">Xếp hạng</Label>
                <div className="flex items-center gap-1 mt-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const val = i + 1;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReviewRating(val)}
                        onMouseEnter={() => setReviewHover(val)}
                        onMouseLeave={() => setReviewHover(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            val <= (reviewHover || reviewRating)
                              ? "fill-warning text-warning"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    );
                  })}
                  {reviewRating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Xuất sắc"][reviewRating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <Label className="text-sm font-medium">Nhận xét (tùy chọn)</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về khóa học này..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Hủy</Button>
            <Button
              className="gradient-primary border-0 text-primary-foreground"
              disabled={reviewRating === 0 || createReview.isPending}
              onClick={handleSubmitReview}
            >
              {createReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Gửi đánh giá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
