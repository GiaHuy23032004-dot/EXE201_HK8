import { useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { SearchHero } from "@/components/marketplace/SearchHero";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { MentorCard } from "@/components/marketplace/MentorCard";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { useCourses, type Course } from "@/hooks/use-courses";
import { useQuery } from "@tanstack/react-query";
import { Music, Globe, Code, Palette, Dumbbell, ChefHat, Briefcase, Pencil, ArrowRight, TrendingUp, MapPin, Sparkles, Brain, Zap, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { usePublicMentorVerificationMap } from "@/hooks/usePublicMentorVerification";

const categoryIcons = [
  { icon: Music, label: "Âm nhạc", slug: "music" },
  { icon: Globe, label: "Ngoại ngữ", slug: "language" },
  { icon: Code, label: "Lập trình", slug: "coding" },
  { icon: Palette, label: "Nghệ thuật", slug: "art" },
  { icon: Dumbbell, label: "Thể dục", slug: "fitness" },
  { icon: ChefHat, label: "Nấu ăn", slug: "cooking" },
  { icon: Briefcase, label: "Kinh doanh", slug: "business" },
  { icon: Pencil, label: "Thiết kế", slug: "design" },
];

interface HomeMentor {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
}

// Helper map course từ Supabase sang CourseCard props
function mapCourse(c: Course) {
  return {
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
  };
}

export default function HomePage() {
  const { data: allCourses = [], isLoading } = useCourses();

  const featured = allCourses.filter((c) => c.is_promoted).slice(0, 4);
  const nearby = allCourses.filter((c) => c.format === "offline").slice(0, 4);
  const recommended = allCourses.slice(0, 4);

  // Fetch mentors từ Supabase
  const { data: mentors = [] } = useQuery<HomeMentor[]>({
    queryKey: ["mentors-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, bio, role")
        .eq("role", "mentor")
        .limit(6);
      if (error) throw error;
      return (data ?? []) as HomeMentor[];
    },
  });
  const { data: approvedMentorIds = new Set<string>() } = usePublicMentorVerificationMap(
    mentors.map((mentor) => mentor.user_id),
  );

  // Map mentors sang MentorCard props
  const mappedMentors = mentors.map((m) => ({
    id: m.user_id,
    name: m.name || "Mentor",
    avatar: m.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    specialty: "Giảng viên",
    rating: 4.8,
    reviewCount: 0,
    coursesCount: 0,
    verified: approvedMentorIds.has(m.user_id),
    bio: m.bio || "",
  }));

  return (
    <MainLayout>
      <SearchHero />

      {/* Categories */}
      <section className="bg-background py-14 pt-16">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Danh mục phổ biến</h2>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
            {categoryIcons.map((cat, i) => (
              <motion.div key={cat.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <CategoryChip {...cat} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="relative overflow-hidden section-teal py-14">
        <div className="absolute inset-0 gradient-hero-mesh opacity-40" />
        <div className="container relative">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary shadow-lg">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Gợi ý cho bạn</h2>
                <p className="text-xs text-muted-foreground">Các khóa học phổ biến nhất</p>
              </div>
            </div>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem thêm <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/50 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.map((c) => <CourseCard key={c.id} course={mapCourse(c)} />)}
            </div>
          )}
        </div>
      </section>

      {/* Featured Courses */}
      {featured.length > 0 && (
        <section className="bg-background py-14">
          <div className="container">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-warm shadow-lg">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Khóa học nổi bật</h2>
              </div>
              <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Xem thêm <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((c) => <CourseCard key={c.id} course={mapCourse(c)} />)}
            </div>
          </div>
        </section>
      )}

      {/* Nearby */}
      {nearby.length > 0 && (
        <section className="section-warm py-14">
          <div className="container">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
                  <MapPin className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Lớp học gần bạn</h2>
                  <p className="text-xs text-muted-foreground">TP.HCM • bán kính 5km</p>
                </div>
              </div>
              <Link to="/map" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Xem bản đồ <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map((c) => <CourseCard key={c.id} course={mapCourse(c)} />)}
            </div>
          </div>
        </section>
      )}

      {/* Trending Mentors */}
      {mappedMentors.length > 0 && (
        <section className="section-purple py-14">
          <div className="container">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Mentor nổi bật</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mappedMentors.map((m) => <MentorCard key={m.id} mentor={m} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-background py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-16 text-center"
          >
            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/20 px-4 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm">
                <Zap className="h-3.5 w-3.5" />Miễn phí đăng ký
              </div>
              <h2 className="mb-4 text-2xl font-bold text-primary-foreground md:text-4xl">Bạn có kỹ năng muốn chia sẻ?</h2>
              <p className="mb-8 text-primary-foreground/80 md:text-lg max-w-xl mx-auto">
                Trở thành Mentor trên VET và bắt đầu kiếm thu nhập từ kiến thức của bạn.
              </p>
              <Link to="/auth?role=mentor">
                <Button size="lg" variant="secondary" className="rounded-xl font-semibold shadow-elevated bg-background text-foreground hover:bg-background/90">
                  Đăng ký làm Mentor ngay
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
