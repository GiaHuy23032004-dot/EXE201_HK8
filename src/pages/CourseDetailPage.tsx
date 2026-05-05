import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockMentors, mockReviews } from "@/data/mockData";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { Star, MapPin, Monitor, Clock, Users, BadgeCheck, Calendar, Share2, Heart, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const schedule = [
  { day: "Thứ 2", time: "09:00 - 11:00" },
  { day: "Thứ 4", time: "09:00 - 11:00" },
  { day: "Thứ 6", time: "14:00 - 16:00" },
  { day: "Thứ 7", time: "08:00 - 10:00" },
];

export default function CourseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isLearner = !user || user.role === "learner";
  const course = mockCourses.find((c) => c.id === id) || mockCourses[0];
  const mentor = mockMentors.find((m) => m.name === course.mentorName) || mockMentors[0];

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
                <img src={course.image} alt={course.title} className="w-full aspect-video object-cover" />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant={course.format === "online" ? "secondary" : "outline"}>
                  {course.format === "online" ? <><Monitor className="mr-1 h-3 w-3" />Online</> : <><MapPin className="mr-1 h-3 w-3" />Offline</>}
                </Badge>
              </div>

              <h1 className="mb-3 text-2xl font-bold text-foreground md:text-3xl">{course.title}</h1>

              <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{course.rating}</span> ({course.reviewCount} đánh giá)
                </span>
                {course.studentsCount && (
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{course.studentsCount} học viên</span>
                )}
                {course.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{course.location}</span>
                )}
              </div>

              <Separator className="my-6" />

              <h2 className="mb-3 text-lg font-semibold text-foreground">Mô tả khóa học</h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>Khóa học được thiết kế dành cho cả người mới bắt đầu và những ai muốn nâng cao kỹ năng. Với phương pháp giảng dạy thực hành kết hợp lý thuyết, bạn sẽ nắm vững kiến thức cơ bản trong thời gian ngắn nhất.</p>
                <p>Mentor sẽ hướng dẫn bạn từng bước, từ cơ bản đến nâng cao, với các bài tập thực hành sau mỗi buổi học.</p>
                <h3 className="text-foreground font-medium pt-2">Bạn sẽ học được gì?</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Nắm vững kiến thức nền tảng</li>
                  <li>Thực hành qua các bài tập thực tế</li>
                  <li>Nhận feedback cá nhân hóa từ mentor</li>
                  <li>Chứng chỉ hoàn thành khóa học</li>
                </ul>
              </div>

              <Separator className="my-6" />

              <h2 className="mb-3 text-lg font-semibold text-foreground">Lịch học</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {schedule.map((s) => (
                  <div key={s.day} className="rounded-xl border bg-muted/30 p-3 text-center">
                    <p className="text-sm font-medium text-foreground">{s.day}</p>
                    <p className="text-xs text-muted-foreground">{s.time}</p>
                  </div>
                ))}
              </div>

              {course.format === "offline" && (
                <>
                  <Separator className="my-6" />
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Vị trí lớp học</h2>
                  <div className="h-48 rounded-2xl bg-muted relative overflow-hidden">
                    <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                      <defs><pattern id="grid2" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" /></pattern></defs>
                      <rect width="100%" height="100%" fill="url(#grid2)" />
                    </svg>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="rounded-full gradient-primary p-3 shadow-lg">
                        <MapPin className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-lg bg-card px-3 py-2 shadow-card">
                      <p className="text-xs font-medium text-card-foreground">{course.location}</p>
                      <p className="text-xs text-muted-foreground">{course.distance} từ vị trí của bạn</p>
                    </div>
                  </div>
                </>
              )}

              <Separator className="my-6" />

              <h2 className="mb-4 text-lg font-semibold text-foreground">Đánh giá ({mockReviews.length})</h2>
              <div className="space-y-3">
                {mockReviews.map((r) => (
                  <ReviewBlock key={r.id} review={r} />
                ))}
              </div>
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

                <Link to={`/booking/${course.id}`}>
                  <Button className="w-full gradient-primary border-0 text-primary-foreground text-base py-6 rounded-xl mb-3">
                    Đặt lịch học ngay
                  </Button>
                </Link>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl">
                    <Heart className="mr-2 h-4 w-4" />Lưu
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl">
                    <Share2 className="mr-2 h-4 w-4" />Chia sẻ
                  </Button>
                </div>
              </div>

              {/* Mentor card */}
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <img src={mentor.avatar} alt={mentor.name} className="h-14 w-14 rounded-xl object-cover" />
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-card-foreground">{mentor.name}</p>
                      {mentor.verified && <BadgeCheck className="h-4 w-4 text-secondary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{mentor.specialty}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-sm font-bold text-foreground">{mentor.rating}</p>
                    <p className="text-xs text-muted-foreground">Đánh giá</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-sm font-bold text-foreground">{mentor.reviewCount}</p>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-sm font-bold text-foreground">{mentor.coursesCount}</p>
                    <p className="text-xs text-muted-foreground">Khóa học</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{mentor.bio}</p>
                <Link to={`/mentor/${mentor.id}`}>
                  <Button variant="outline" className="w-full rounded-xl">Xem hồ sơ Mentor</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
