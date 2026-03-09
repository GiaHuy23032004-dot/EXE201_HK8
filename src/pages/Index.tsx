import { MainLayout } from "@/components/layout/MainLayout";
import { SearchHero } from "@/components/marketplace/SearchHero";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { MentorCard } from "@/components/marketplace/MentorCard";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { mockCourses, mockMentors } from "@/data/mockData";
import { Music, Globe, Code, Palette, Dumbbell, ChefHat, Briefcase, Pencil, ArrowRight, TrendingUp, MapPin, Sparkles } from "lucide-react";
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
  { label: "Mentor đã xác minh", value: "2,500+" },
  { label: "Khóa học hoạt động", value: "15,000+" },
  { label: "Học viên hài lòng", value: "50,000+" },
  { label: "Đánh giá 5 sao", value: "12,000+" },
];

export default function HomePage() {
  const featured = mockCourses.filter((c) => c.promoted);
  const nearby = mockCourses.filter((c) => c.format === "offline");

  return (
    <MainLayout>
      <SearchHero />

      {/* Stats */}
      <section className="border-b bg-card py-8">
        <div className="container grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-12">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Danh mục phổ biến</h2>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
            {categoryIcons.map((cat) => (
              <CategoryChip key={cat.slug} {...cat} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-12 bg-muted/30">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Khóa học nổi bật</h2>
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
      <section className="py-12">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Lớp học gần bạn</h2>
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
      <section className="py-12 bg-muted/30">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Mentor nổi bật</h2>
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
            className="rounded-3xl gradient-primary p-8 md:p-16 text-center"
          >
            <h2 className="mb-4 text-2xl font-bold text-primary-foreground md:text-4xl">
              Bạn có kỹ năng muốn chia sẻ?
            </h2>
            <p className="mb-8 text-primary-foreground/80 md:text-lg">
              Trở thành Mentor trên EduMarket và bắt đầu kiếm thu nhập từ kiến thức của bạn
            </p>
            <Link to="/auth?role=mentor">
              <Button size="lg" variant="secondary" className="rounded-xl text-secondary-foreground font-semibold">
                Đăng ký làm Mentor ngay
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
