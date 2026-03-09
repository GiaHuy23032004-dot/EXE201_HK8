import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { SearchHero } from "@/components/marketplace/SearchHero";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { MentorCard } from "@/components/marketplace/MentorCard";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { mockCourses, mockMentors } from "@/data/mockData";
import { Music, Globe, Code, Palette, Dumbbell, ChefHat, Briefcase, Pencil, ArrowRight, TrendingUp, MapPin, Sparkles, Brain, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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

const stats = [
  { label: "Mentor đã xác minh", value: "2,500+", icon: "👨‍🏫" },
  { label: "Khóa học hoạt động", value: "15,000+", icon: "📚" },
  { label: "Học viên hài lòng", value: "50,000+", icon: "🎓" },
  { label: "Đánh giá 5 sao", value: "12,000+", icon: "⭐" },
];

export default function HomePage() {
  const featured = mockCourses.filter((c) => c.promoted);
  const nearby = mockCourses.filter((c) => c.format === "offline");
  const [aiRecommendations, setAiRecommendations] = useState(mockCourses.slice(0, 4));

  // Simulate AI-based shuffling
  useEffect(() => {
    const shuffled = [...mockCourses].sort(() => Math.random() - 0.5).slice(0, 4);
    setAiRecommendations(shuffled);
  }, []);

  return (
    <MainLayout>
      <SearchHero />

      {/* Stats */}
      <section className="relative border-b bg-card py-10">
        <div className="container grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mb-1 text-2xl">{s.icon}</div>
              <p className="text-2xl font-bold text-gradient">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-14">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Danh mục phổ biến</h2>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
            {categoryIcons.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <CategoryChip {...cat} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="py-14 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-mesh opacity-50" />
        <div className="container relative">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary shadow-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">AI gợi ý cho bạn</h2>
                <p className="text-xs text-muted-foreground">Dựa trên sở thích và vị trí của bạn</p>
              </div>
            </div>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem thêm <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {aiRecommendations.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-14">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-warm shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Khóa học nổi bật</h2>
            </div>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem thêm <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Nearby */}
      <section className="py-14 bg-muted/30">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
                <MapPin className="h-5 w-5 text-white" />
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
            {nearby.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Trending Mentors */}
      <section className="py-14">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Mentor nổi bật</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mockMentors.slice(0, 6).map((m) => (
              <MentorCard key={m.id} mentor={m} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-16 text-center"
          >
            {/* Decorative circles */}
            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-2xl" />

            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <Zap className="h-3.5 w-3.5" />
                Miễn phí đăng ký
              </div>
              <h2 className="mb-4 text-2xl font-bold text-primary-foreground md:text-4xl">
                Bạn có kỹ năng muốn chia sẻ?
              </h2>
              <p className="mb-8 text-primary-foreground/80 md:text-lg max-w-xl mx-auto">
                Trở thành Mentor trên EduMarket và bắt đầu kiếm thu nhập từ kiến thức của bạn. Hơn 2,500 mentor đã tin tưởng chúng tôi.
              </p>
              <Link to="/auth?role=mentor">
                <Button size="lg" variant="secondary" className="rounded-xl font-semibold shadow-elevated bg-white text-foreground hover:bg-white/90">
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
