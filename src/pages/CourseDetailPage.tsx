import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Calendar, Check, ChevronRight, Clock, Flag, Heart,
  Loader2, MapPin, Monitor, Share2, Sparkles, Star, Users,
  ChevronDown, ChevronUp, GraduationCap, Video,
} from "lucide-react";
import { AiCourseAdvisor } from "@/components/ai/AiCourseAdvisor";
import { MainLayout } from "@/components/layout/MainLayout";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { TrustBadges } from "@/components/marketplace/TrustBadges";
import { ReportModal } from "@/components/reports/ReportModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getCourseCategoryLabel, getCourseCategoryGradient } from "@/constants/courseCategories";

type CourseDetailMentor = NonNullable<LearnerCourse["mentor"]> & {
  bio?: string | null;
  phone?: string | null;
};
type CourseDetail = LearnerCourse & {
  mentor?: CourseDetailMentor;
  course_schedules?: NonNullable<LearnerCourse["course_schedules"]>;
};

const fallbackAvatar =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face";

// ── Image with gradient fallback ─────────────────────────────────────────────
function CourseImage({ src, alt, category }: { src: string | null; alt: string; category: string }) {
  const [error, setError] = useState(false);
  const gradient = getCourseCategoryGradient(category);
  if (error || !src) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}>
        <BookOpen className="h-16 w-16 text-white/60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      onError={() => setError(true)}
    />
  );
}

// ── Collapsible AI Advisor wrapper ─────────────────────────────────────────────
function AIAdvisorCard({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Không chắc khóa này phù hợp?</p>
            <p className="text-xs text-slate-500">Hỏi AI Advisor · dùng 1 AI credit</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-2 pb-2">
          <AiCourseAdvisor courseId={courseId} courseTitle={courseTitle} showBookingButton />
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, id }: { icon: React.ElementType; title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50">
          <Icon className="h-4 w-4 text-cyan-600" />
        </div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { id } = useParams();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const isLearner = !user || user.role === "learner";
  const [reportOpen, setReportOpen] = useState(false);
  const [commentReport, setCommentReport] = useState<{
    id: string; learnerId: string; userName: string; comment: string;
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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-8">
          {/* Skeleton */}
          <div className="mb-4 h-4 w-64 animate-pulse rounded-full bg-slate-200" />
          <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <div className="aspect-video w-full animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-6 w-3/4 animate-pulse rounded-full bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-200" />
              <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!courseDetail) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-slate-500">Không tìm thấy khóa học.</p>
          <Link to="/search"><Button className="mt-4">Tìm khóa học khác</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const mappedReviews = reviews.map((r) => ({
    id: r.id,
    userName: r.learner?.name || "Học viên",
    userAvatar: r.learner?.avatar_url || fallbackAvatar,
    rating: r.rating,
    comment: r.comment || "",
    date: new Date(r.created_at).toLocaleDateString("vi-VN"),
    learnerId: r.learner_id,
    reviewId: r.id,
  }));

  const nearestSchedule = schedules[0];

  return (
    <MainLayout>
      <div className="bg-gradient-to-b from-slate-50/60 to-white">
        <div className="container py-6">

          {/* ── Breadcrumb ── */}
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-400">
            <Link to="/" className="hover:text-cyan-600 transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/search" className="hover:text-cyan-600 transition-colors">Tìm kiếm</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="max-w-[200px] truncate text-slate-600">{courseDetail.title}</span>
          </nav>

          {/* ── Main 2-col layout ── */}
          <div className="grid gap-7 lg:grid-cols-[1fr_360px]">

            {/* ══ LEFT COLUMN ══════════════════════════════════════════════════ */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">

              {/* Hero image */}
              <div className="group overflow-hidden rounded-2xl shadow-sm" style={{ aspectRatio: "16/9" }}>
                <CourseImage
                  src={courseDetail.image_url}
                  alt={courseDetail.title}
                  category={courseDetail.category}
                />
              </div>

              {/* Course header */}
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
                {/* Badges */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-xs font-medium text-slate-600">
                    {categoryLabel}
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
                    courseDetail.format === "online"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-teal-100 text-teal-700"
                  }`}>
                    {courseDetail.format === "online"
                      ? <><Video className="h-3 w-3" />Online</>
                      : <><MapPin className="h-3 w-3" />Offline</>}
                  </span>
                  {courseDetail.is_promoted && (
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 text-xs font-semibold text-white">
                      <Sparkles className="h-3 w-3" />Nổi bật
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl">
                  {courseDetail.title}
                </h1>

                {/* Metadata row */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-slate-800">{courseDetail.rating}</span>
                    <span>({courseDetail.review_count} đánh giá)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {courseDetail.students_count.toLocaleString()} học viên
                  </span>
                  {courseDetail.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {courseDetail.location}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Mô tả khóa học ── */}
              <Section icon={BookOpen} title="Mô tả khóa học" id="section-overview">
                <p className="text-sm leading-relaxed text-slate-600">
                  {courseDetail.description ||
                    "Khóa học chất lượng cao với phương pháp giảng dạy thực hành kết hợp lý thuyết. Phù hợp cho người mới bắt đầu muốn xây dựng nền tảng vững chắc."}
                </p>
              </Section>

              {/* ── Bạn sẽ học được gì ── */}
              <Section icon={GraduationCap} title="Bạn sẽ học được gì?">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    "Nắm vững kiến thức nền tảng",
                    "Thực hành qua các bài tập thực tế",
                    "Nhận feedback cá nhân hóa từ mentor",
                    "Chứng chỉ hoàn thành khóa học",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100">
                        <Check className="h-3 w-3 text-cyan-600" />
                      </div>
                      <span className="text-sm text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── Hình thức học ── */}
              <Section
                icon={courseDetail.format === "online" ? Video : MapPin}
                title="Hình thức học"
                id="section-format"
              >
                <div className={`flex items-start gap-4 rounded-2xl p-4 ${
                  courseDetail.format === "online" ? "bg-blue-50" : "bg-teal-50"
                }`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                    courseDetail.format === "online"
                      ? "bg-blue-500 text-white"
                      : "bg-teal-500 text-white"
                  }`}>
                    {courseDetail.format === "online"
                      ? <Video className="h-5 w-5" />
                      : <MapPin className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {courseDetail.format === "online" ? "Học trực tuyến (Online)" : "Học trực tiếp (Offline)"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {courseDetail.format === "online"
                        ? "Học qua nền tảng hoặc link zoom/meet do mentor cung cấp sau khi xác nhận đặt lịch."
                        : "Học trực tiếp tại địa điểm do mentor cung cấp. Được tương tác và thực hành trực tiếp."}
                    </p>
                    {courseDetail.format === "offline" && courseDetail.location && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                        <MapPin className="h-4 w-4" />
                        {courseDetail.location}
                      </p>
                    )}
                  </div>
                </div>
              </Section>

              {/* ── Lịch học ── */}
              {schedules.length > 0 && (
                <Section icon={Calendar} title="Lịch học" id="section-schedule">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {schedules.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 transition-all hover:border-cyan-400 hover:bg-cyan-50 cursor-default"
                      >
                        <p className="text-xs font-bold text-slate-700">{s.day_of_week}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          {s.start_time} – {s.end_time}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Vị trí lớp học ── */}
              {courseDetail.format === "offline" && courseDetail.location && (
                <Section icon={MapPin} title="Vị trí lớp học" id="section-location">
                  {/* Map placeholder with pattern */}
                  <div className="relative overflow-hidden rounded-2xl" style={{ height: "200px" }}>
                    {/* Grid pattern background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-teal-100"
                      style={{
                        backgroundImage: "linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                      }}
                    />
                    {/* Roads simulation */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-400" />
                      <div className="absolute bottom-0 left-1/3 top-0 w-px bg-slate-400" />
                      <div className="absolute bottom-0 right-1/4 top-0 w-px bg-slate-400" />
                      <div className="absolute left-0 right-0 top-1/3 h-px bg-slate-400" />
                    </div>
                    {/* Pin */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-200">
                        <MapPin className="h-5 w-5 text-white" />
                      </div>
                      <div className="mx-auto mt-0.5 h-2 w-2 rounded-full bg-cyan-500/40" />
                    </div>
                    {/* Address label */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                      <div className="flex items-center gap-1.5 rounded-full border border-white bg-white px-3 py-1.5 shadow-lg">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />
                        <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{courseDetail.location}</span>
                      </div>
                    </div>
                    {/* Map link */}
                    <Link
                      to={`/map?location=${encodeURIComponent(courseDetail.location)}`}
                      className="absolute right-3 top-3 rounded-full border border-white bg-white/90 px-3 py-1 text-xs font-medium text-cyan-700 shadow hover:bg-white transition-colors"
                    >
                      Xem trên bản đồ →
                    </Link>
                  </div>
                </Section>
              )}

              {/* ── Đánh giá ── */}
              <Section icon={Star} title={`Đánh giá (${mappedReviews.length})`} id="section-reviews">
                {mappedReviews.length > 0 ? (
                  <div className="space-y-3">
                    {mappedReviews.map((r) => (
                      <ReviewBlock
                        key={r.id}
                        review={r}
                        onReport={() => setCommentReport({ id: r.reviewId, learnerId: r.learnerId, userName: r.userName, comment: r.comment })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
                      <Star className="h-7 w-7 text-amber-400" />
                    </div>
                    <p className="font-semibold text-slate-700">Chưa có đánh giá nào</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-400">
                      Hãy trở thành một trong những học viên đầu tiên trải nghiệm và đánh giá khóa học này.
                    </p>
                  </div>
                )}
              </Section>

            </motion.div>

            {/* ══ RIGHT SIDEBAR ════════════════════════════════════════════════ */}
            <div className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">

              {/* ── Booking Card ── */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                <div className="px-6 pt-6">
                  {/* Price */}
                  <div className="mb-1 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-cyan-600">
                      {courseDetail.price.toLocaleString("vi-VN")}đ
                    </span>
                    <span className="text-sm text-slate-400">/buổi</span>
                  </div>

                  {/* Quick info strip */}
                  <div className="mb-5 mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {courseDetail.format === "online"
                        ? <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        : <MapPin className="h-3.5 w-3.5 text-teal-500 shrink-0" />}
                      <span>Hình thức: {courseDetail.format === "online" ? "Online" : "Offline"}</span>
                    </div>
                    {courseDetail.location && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">{courseDetail.location}</span>
                      </div>
                    )}
                    {nearestSchedule && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                        <span>Lịch gần nhất: {nearestSchedule.day_of_week}, {nearestSchedule.start_time} – {nearestSchedule.end_time}</span>
                      </div>
                    )}
                  </div>

                  {isLearner ? (
                    <div className="space-y-3">
                      {/* Primary CTA */}
                      <Link to={`/booking/${courseDetail.id}`}>
                        <Button className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-cyan-500 to-teal-600 text-sm font-bold text-white shadow-lg shadow-cyan-200/60 transition-all hover:brightness-110 hover:-translate-y-0.5">
                          Đặt lịch học ngay
                        </Button>
                      </Link>

                      {/* Secondary actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className={`rounded-xl text-sm ${isSaved ? "border-cyan-400 text-cyan-600" : "border-slate-200 text-slate-600"}`}
                          onClick={handleSave}
                          disabled={toggleSave.isPending}
                        >
                          <Heart className={`mr-1.5 h-4 w-4 ${isSaved ? "fill-cyan-500 text-cyan-500" : ""}`} />
                          {isSaved ? "Đã lưu" : "Lưu"}
                        </Button>
                        <Button variant="outline" className="rounded-xl border-slate-200 text-sm text-slate-600">
                          <Share2 className="mr-1.5 h-4 w-4" />
                          Chia sẻ
                        </Button>
                      </div>

                      {/* Report */}
                      <button
                        onClick={() => setReportOpen(true)}
                        className="flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-500"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Báo cáo khóa học
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
                      Bạn đang xem với vai trò Mentor. Chỉ học viên mới có thể đặt lịch học.
                    </div>
                  )}
                </div>
                <div className="px-6 pb-5" />
              </div>

              {/* ── AI Advisor (collapsible) ── */}
              {isLearner && (
                <AIAdvisorCard courseId={courseDetail.id} courseTitle={courseDetail.title} />
              )}

              {/* ── Mentor Card ── */}
              {mentor && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-5 py-5">
                    <div className="mb-4 flex items-center gap-3.5">
                      <img
                        src={mentor.avatar_url || fallbackAvatar}
                        alt={mentor.name || "Mentor"}
                        className="h-14 w-14 rounded-2xl object-cover ring-2 ring-slate-100"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar; }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{mentor.name || "Mentor"}</p>
                        <p className="truncate text-xs text-slate-500">{categoryLabel}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <TrustBadges badges={mentorBadges} compact />
                          <Badge
                            variant="outline"
                            className={`rounded-full text-[10px] ${
                              isVerifiedMentor
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            {isVerifiedMentor ? "Đã xác minh" : "Chưa xác minh"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {mentor.bio && (
                      <p className="mb-4 line-clamp-3 text-xs leading-relaxed text-slate-500">{mentor.bio}</p>
                    )}
                    <Link to={`/mentor/${mentor.user_id}`}>
                      <Button variant="outline" className="w-full rounded-xl border-slate-200 text-sm text-slate-700 hover:border-cyan-400 hover:text-cyan-600">
                        Xem hồ sơ Mentor
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

            </div>
            {/* ══ END SIDEBAR ══════════════════════════════════════════════════ */}

          </div>
        </div>
      </div>

      {/* Report Modals (logic unchanged) */}
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
