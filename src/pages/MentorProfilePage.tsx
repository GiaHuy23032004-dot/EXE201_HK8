import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { ReviewBlock } from "@/components/marketplace/ReviewBlock";
import { useMentorCourses } from "@/hooks/use-courses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, BadgeCheck, BookOpen, Users, Award, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

export default function MentorProfilePage() {
  const { id } = useParams();

  // Fetch mentor profile
  const { data: mentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["mentor-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch mentor courses
  const { data: courses = [], isLoading: coursesLoading } = useMentorCourses(id);

  // Fetch reviews cho tất cả courses của mentor
  const { data: reviews = [] } = useQuery({
    queryKey: ["mentor-reviews", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`*, learner:profiles!reviews_learner_id_fkey(name, avatar_url), course:courses(title)`)
        .in("course_id", courses.map((c) => c.id))
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data ?? [];
    },
    enabled: courses.length > 0,
  });

  if (mentorLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!mentor) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy mentor.</p>
        </div>
      </MainLayout>
    );
  }

  const mappedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    mentorName: mentor.name || "Mentor",
    mentorAvatar: mentor.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
  }));

  const mappedReviews = reviews.map((r: any) => ({
    id: r.id,
    userName: r.learner?.name || "Học viên",
    userAvatar: r.learner?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: r.rating,
    comment: r.comment || "",
    date: new Date(r.created_at).toLocaleDateString("vi-VN"),
  }));

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Profile header */}
          <div className="rounded-2xl border bg-card p-6 shadow-card mb-8">
            <div className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-6">
              <img
                src={mentor.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"}
                alt={mentor.name || "Mentor"}
                className="h-24 w-24 rounded-2xl object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{mentor.name}</h1>
                  <BadgeCheck className="h-5 w-5 text-secondary" />
                </div>
                <p className="text-muted-foreground mb-3">{mentor.role === "mentor" ? "Mentor" : "Giảng viên"}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-warning text-warning" />{avgRating} ({reviews.length} đánh giá)
                  </span>
                  <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{courses.length} khóa học</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {courses.reduce((s, c) => s + c.students_count, 0)} học viên
                  </span>
                </div>
              </div>
              <Badge className="bg-success/10 text-success border-0 gap-1">
                <Award className="h-3 w-3" />Đã xác minh
              </Badge>
            </div>

            <Separator className="my-6" />

            <div>
              <h3 className="font-semibold text-foreground mb-2">Giới thiệu</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mentor.bio || "Mentor chuyên nghiệp với nhiều năm kinh nghiệm giảng dạy."}
              </p>
            </div>
          </div>

          {/* Courses */}
          <h2 className="text-xl font-bold text-foreground mb-4">Khóa học của {mentor.name}</h2>
          {coursesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : mappedCourses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              {mappedCourses.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          ) : (
            <p className="text-muted-foreground mb-8">Mentor chưa có khóa học nào.</p>
          )}

          {/* Reviews */}
          <h2 className="text-xl font-bold text-foreground mb-4">Đánh giá từ học viên</h2>
          {mappedReviews.length > 0 ? (
            <div className="space-y-3">
              {mappedReviews.map((r) => <ReviewBlock key={r.id} review={r} />)}
            </div>
          ) : (
            <p className="text-muted-foreground">Chưa có đánh giá nào.</p>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}
