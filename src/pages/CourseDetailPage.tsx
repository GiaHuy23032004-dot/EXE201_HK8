import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCourse } from "@/hooks/use-courses";
import { useCourseReviews } from "@/hooks/use-reviews";
import { useIsSaved, useToggleSaveCourse } from "@/hooks/use-saved-courses";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { Star, MapPin, Monitor, Clock, Users, BadgeCheck, Calendar, Share2, Heart, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function CourseDetailPage() {
  const { id } = useParams();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const isLearner = !user || user.role === "learner";

  const { data: course, isLoading } = useCourse(id);
  const { data: reviews = [] } = useCourseReviews(id);
  const { data: isSaved = false } = useIsSaved(session?.user?.id, id);
  const toggleSave = useToggleSaveCourse();

  const handleSave = () => {
    if (!session?.user?.id) {
      toast({ title: "Vui lòng đăng nhập để lưu khóa học", variant: "destructive" });
      return;
    }
    toggleSave.mutate(
      { userId: session.user.id, courseId: id!, isSaved },
      { onSuccess: () => toast({ title: isSaved ? "Đã bỏ lưu" : "Đã lưu khóa học" }) }
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

  if (!course) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy khóa học.</p>
          <Link to="/search"><Button className="mt-4">Tìm khóa học khác</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const mentor = (course as any).mentor;
  const schedules = (course as any).course_schedules ?? [];

  // Map reviews sang ReviewBlock format
  const mappedReviews = reviews.map((r) => ({
    id: r.id,
    userName: r.learner?.name || "Học viên",
    userAvatar: r.learner?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: r.rating,
    comment: r.comment || "",
    date: new Date(r.created_at).toLocaleDateString("vi-VN"),
  }));

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">Trang chủ</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/search" className="hover:text-primary">Tìm kiếm</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{course.title}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="overflow-hidden rounded-2xl mb-6">
                <img
                  src={course.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant={course.format === "online" ? "secondary" : "outline"}>
                  {course.format === "online"
                    ? <><Monitor className="mr-1 h-3 w-3" />Online</>
                    : <><MapPin className="mr-1 h-3 w-3" />Offline</>}
                </Badge>
              </div>

              <h1 className="mb-3 text-2xl font-bold text-foreground md:text-3xl">{course.title}</h1>

              <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{course.rating}</span> ({course.review_count} đánh giá)
                </span>
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{course.students_count} học viên</span>
                {course.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{course.location}</span>}
              </div>

              <Separator className="my-6" />

              <h2 className="mb-3 text-lg font-semibold text-foreground">Mô tả khóa học</h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>{course.description || "Khóa học chất lượng cao với phương pháp giảng dạy thực hành kết hợp lý thuyết."}</p>
                <h3 className="text-foreground font-medium pt-2">Bạn sẽ học được gì?</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Nắm vững kiến thức nền tảng</li>
                  <li>Thực hành qua các bài tập thực tế</li>
                  <li>Nhận feedback cá nhân hóa từ mentor</li>
                  <li>Chứng chỉ hoàn thành khóa học</li>
                </ul>
              </div>

              {schedules.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Lịch học</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {schedules.map((s: any) => (
                      <div key={s.id} className="rounded-xl border bg-muted/30 p-3 text-center">
                        <p className="text-sm font-medium text-foreground">{s.day_of_week}</p>
                        <p className="text-xs text-muted-foreground">{s.start_time} - {s.end_time}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {course.format === "offline" && course.location && (
                <>
                  <Separator className="my-6" />
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Vị trí lớp học</h2>
                  <div className="h-48 rounded-2xl bg-muted relative overflow-hidden">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="rounded-full gradient-primary p-3 shadow-lg">
                        <MapPin className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-lg bg-card px-3 py-2 shadow-card">
                      <p className="text-xs font-medium text-card-foreground">{course.location}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator className="my-6" />
              <h2 className="mb-4 text-lg font-semibold text-foreground">Đánh giá ({mappedReviews.length})</h2>
              {mappedReviews.length > 0 ? (
                <div className="space-y-3">
                  {mappedReviews.map((r) => <ReviewBlock key={r.id} review={r} />)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có đánh giá nào.</p>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Price card */}
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">{course.price.toLocaleString("vi-VN")}đ</span>
                  <span className="text-sm text-muted-foreground">/buổi</span>
                </div>

                {isLearner ? (
                  <>
                    <Link to={`/booking/${course.id}`}>
                      <Button className="w-full gradient-primary border-0 text-primary-foreground text-base py-6 rounded-xl mb-3">
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
                        <Share2 className="mr-2 h-4 w-4" />Chia sẻ
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground text-center">
                    Bạn đang xem với vai trò Mentor — chỉ học viên mới có thể đặt lịch học.
                  </div>
                )}
              </div>

              {/* Mentor card */}
              {mentor && (
                <div className="rounded-2xl border bg-card p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={mentor.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"}
                      alt={mentor.name}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-card-foreground">{mentor.name}</p>
                        <BadgeCheck className="h-4 w-4 text-secondary" />
                      </div>
                      <p className="text-xs text-muted-foreground">{course.category}</p>
                    </div>
                  </div>
                  {mentor.bio && <p className="text-sm text-muted-foreground mb-4">{mentor.bio}</p>}
                  <Link to={`/mentor/${mentor.user_id}`}>
                    <Button variant="outline" className="w-full rounded-xl">Xem hồ sơ Mentor</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
