import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Flag,
  Heart,
  Loader2,
  MapPin,
  Monitor,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { TrustBadges } from "@/components/marketplace/TrustBadges";
import { ReportModal } from "@/components/reports/ReportModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import {
  useLearnerCourseDetail,
  useLearnerIsSaved,
  useLearnerToggleSaveCourse,
  type LearnerCourse,
} from "@/hooks/useLearnerCourses";
import { useCourseReviews } from "@/hooks/useLearnerReviews";
import { usePublicMentorVerification } from "@/hooks/usePublicMentorVerification";
import { useToast } from "@/hooks/use-toast";
import { getCourseCategoryLabel } from "@/constants/courseCategories";

type CourseDetailMentor = NonNullable<LearnerCourse["mentor"]> & {
  bio?: string | null;
  phone?: string | null;
};

type CourseDetail = LearnerCourse & {
  mentor?: CourseDetailMentor;
  course_schedules?: NonNullable<LearnerCourse["course_schedules"]>;
};

const fallbackCourseImage =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop";
const fallbackAvatar =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face";

export default function CourseDetailPage() {
  const { id } = useParams();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const isLearner = !user || user.role === "learner";
  const [reportOpen, setReportOpen] = useState(false);
  const [commentReport, setCommentReport] = useState<{
    id: string;
    learnerId: string;
    userName: string;
    comment: string;
  } | null>(null);

  const { data: course, isLoading } = useLearnerCourseDetail(id);
  const courseDetail = course as CourseDetail | undefined;
  const mentor = courseDetail?.mentor;
  const schedules = courseDetail?.course_schedules ?? [];
  const mentorId = mentor?.user_id;

  const { data: reviews = [] } = useCourseReviews(id);
  const { data: isSaved = false } = useLearnerIsSaved(session?.user?.id, id);
  const toggleSave = useLearnerToggleSaveCourse();
  const { data: mentorVerification } = usePublicMentorVerification(mentorId);
  const isVerifiedMentor = mentorVerification?.verified === true;
  const mentorBadges = mentorVerification?.badges ?? [];
  const categoryLabel = getCourseCategoryLabel(courseDetail?.category);

  const handleSave = () => {
    if (!session?.user?.id) {
      toast({ title: "Vui lòng đăng nhập để lưu khóa học", variant: "destructive" });
      return;
    }

    toggleSave.mutate(
      { userId: session.user.id, courseId: id!, isSaved },
      { onSuccess: () => toast({ title: isSaved ? "Đã bỏ lưu" : "Đã lưu khóa học" }) },
    );
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

  if (!courseDetail) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy khóa học.</p>
          <Link to="/search">
            <Button className="mt-4">Tìm khóa học khác</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const mappedReviews = reviews.map((review) => ({
    id: review.id,
    userName: review.learner?.name || "Học viên",
    userAvatar: review.learner?.avatar_url || fallbackAvatar,
    rating: review.rating,
    comment: review.comment || "",
    date: new Date(review.created_at).toLocaleDateString("vi-VN"),
    learnerId: review.learner_id,
    reviewId: review.id,
  }));

  return (
    <MainLayout>
      <div className="container py-6">
        <div className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            Trang chủ
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/search" className="hover:text-primary">
            Tìm kiếm
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{courseDetail.title}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-6 overflow-hidden rounded-2xl">
                <img
                  src={courseDetail.image_url || fallbackCourseImage}
                  alt={courseDetail.title}
                  className="aspect-video w-full object-cover"
                />
              </div>

              <div className="mb-3 flex items-center gap-2">
                <Badge variant="secondary">{categoryLabel}</Badge>
                <Badge
                  className={
                    courseDetail.format === "online"
                      ? "rounded-full border-0 bg-blue-100 text-blue-700"
                      : "rounded-full border-0 bg-teal-100 text-teal-700"
                  }
                >
                  {courseDetail.format === "online" ? (
                    <>
                      <Monitor className="mr-1 h-3 w-3" />
                      Online
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-1 h-3 w-3" />
                      Offline
                    </>
                  )}
                </Badge>
              </div>

              <h1 className="mb-3 text-2xl font-bold text-foreground md:text-3xl">{courseDetail.title}</h1>

              <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{courseDetail.rating}</span> ({courseDetail.review_count} đánh giá)
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {courseDetail.students_count} học viên
                </span>
                {courseDetail.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {courseDetail.location}
                  </span>
                )}
              </div>

              <Separator className="my-6" />

              <h2 className="mb-3 text-lg font-semibold text-foreground">Mô tả khóa học</h2>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  {courseDetail.description ||
                    "Khóa học chất lượng cao với phương pháp giảng dạy thực hành kết hợp lý thuyết."}
                </p>
                <h3 className="pt-2 font-medium text-foreground">Bạn sẽ học được gì?</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Nắm vững kiến thức nền tảng</li>
                  <li>Thực hành qua các bài tập thực tế</li>
                  <li>Nhận feedback cá nhân hóa từ mentor</li>
                  <li>Chứng chỉ hoàn thành khóa học</li>
                </ul>
              </div>

              <div
                className={`mt-6 rounded-2xl border p-4 ${
                  courseDetail.format === "online"
                    ? "border-blue-100 bg-blue-50/70"
                    : "border-teal-100 bg-teal-50/70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      courseDetail.format === "online"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-teal-100 text-teal-700"
                    }`}
                  >
                    {courseDetail.format === "online" ? (
                      <Monitor className="h-5 w-5" />
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Hình thức học: {courseDetail.format === "online" ? "Online" : "Offline"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {courseDetail.format === "online"
                        ? "Học trực tuyến qua nền tảng hoặc link học do mentor cung cấp sau khi thanh toán."
                        : "Học trực tiếp tại địa điểm mentor cung cấp."}
                    </p>
                    {courseDetail.format === "offline" && courseDetail.location && (
                      <p className="mt-2 flex items-center gap-1 text-sm font-medium text-foreground">
                        <MapPin className="h-4 w-4 text-teal-600" />
                        {courseDetail.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {schedules.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Lịch học</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-xl border bg-muted/30 p-3 text-center">
                        <p className="text-sm font-medium text-foreground">{schedule.day_of_week}</p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.start_time} - {schedule.end_time}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {courseDetail.format === "offline" && courseDetail.location && (
                <>
                  <Separator className="my-6" />
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Vị trí lớp học</h2>
                  <div className="relative h-48 overflow-hidden rounded-2xl bg-muted">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="rounded-full gradient-primary p-3 shadow-lg">
                        <MapPin className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-lg bg-card px-3 py-2 shadow-card">
                      <p className="text-xs font-medium text-card-foreground">{courseDetail.location}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator className="my-6" />
              <h2 className="mb-4 text-lg font-semibold text-foreground">Đánh giá ({mappedReviews.length})</h2>
              {mappedReviews.length > 0 ? (
                <div className="space-y-3">
                  {mappedReviews.map((review) => (
                    <ReviewBlock
                      key={review.id}
                      review={review}
                      onReport={() =>
                        setCommentReport({
                          id: review.reviewId,
                          learnerId: review.learnerId,
                          userName: review.userName,
                          comment: review.comment,
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có đánh giá nào.</p>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">
                    {courseDetail.price.toLocaleString("vi-VN")}đ
                  </span>
                  <span className="text-sm text-muted-foreground">/buổi</span>
                </div>
                {isLearner ? (
                  <>
                    <Link to={`/booking/${courseDetail.id}`}>
                      <Button className="mb-3 w-full rounded-xl border-0 gradient-primary py-6 text-base text-primary-foreground">
                        Đặt lịch học ngay
                      </Button>
                    </Link>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className={`flex-1 rounded-xl ${isSaved ? "border-primary text-primary" : ""}`}
                        onClick={handleSave}
                        disabled={toggleSave.isPending}
                      >
                        <Heart className={`mr-2 h-4 w-4 ${isSaved ? "fill-primary" : ""}`} />
                        {isSaved ? "Đã lưu" : "Lưu"}
                      </Button>
                      <Button variant="outline" className="flex-1 rounded-xl">
                        <Share2 className="mr-2 h-4 w-4" />
                        Chia sẻ
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      className="mt-3 w-full rounded-xl text-muted-foreground hover:text-destructive"
                      onClick={() => setReportOpen(true)}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Báo cáo khóa học
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                    Bạn đang xem với vai trò Mentor. Chỉ học viên mới có thể đặt lịch học.
                  </div>
                )}
              </div>

              {mentor && (
                <div className="rounded-2xl border bg-card p-6 shadow-card">
                  <div className="mb-4 flex items-center gap-3">
                    <img
                      src={mentor.avatar_url || fallbackAvatar}
                      alt={mentor.name || "Mentor"}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-card-foreground">{mentor.name || "Mentor"}</p>
                      <TrustBadges badges={mentorBadges} compact className="mt-1" />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">{categoryLabel}</p>
                        <Badge
                          variant="outline"
                          className={
                            isVerifiedMentor
                              ? "rounded-full border-success/20 bg-success/10 text-[10px] text-success"
                              : "rounded-full border-border bg-muted text-[10px] text-muted-foreground"
                          }
                        >
                          {isVerifiedMentor ? "Đã xác minh" : "Chưa xác minh"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {mentor.bio && <p className="mb-4 text-sm text-muted-foreground">{mentor.bio}</p>}
                  <Link to={`/mentor/${mentor.user_id}`}>
                    <Button variant="outline" className="w-full rounded-xl">
                      Xem hồ sơ Mentor
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        type="course"
        courseId={courseDetail.id}
        reportedUserId={courseDetail.mentor_id}
        contextTitle={courseDetail.title}
        contextDescription={`Mentor: ${mentor?.name || "Mentor"} · ${categoryLabel}`}
      />
      {commentReport && (
        <ReportModal
          open={!!commentReport}
          onOpenChange={(open) => !open && setCommentReport(null)}
          type="comment"
          courseId={courseDetail.id}
          reportedUserId={commentReport.learnerId}
          commentId={commentReport.id}
          contextTitle={`Bình luận của ${commentReport.userName}`}
          contextDescription={commentReport.comment}
        />
      )}
    </MainLayout>
  );
}
