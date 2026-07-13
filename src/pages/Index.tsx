import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { SearchHero } from "@/components/marketplace/SearchHero";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { MentorCard } from "@/components/marketplace/MentorCard";
import { CategoryChip } from "@/components/marketplace/CategoryChip";
import { useLearnerSearchCourses, type LearnerCourse } from "@/hooks/useLearnerCourses";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, TrendingUp, Sparkles, Brain, Zap,
  Globe, Dumbbell, Coffee, Mic2, MapPin, Monitor,
  Users, Music2, ChefHat, type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { usePublicMentorTrustBadgeMap, type PublicMentorTrustBadge } from "@/hooks/usePublicMentorVerification";
import { COURSE_CATEGORIES, GENERAL_CATEGORIES, VOCATIONAL_CATEGORIES, type CourseCategorySlug } from "@/constants/courseCategories";

const CATEGORY_ICON_BY_SLUG: Record<CourseCategorySlug, LucideIcon> = {
  "music-arts":       Music2,
  "mind-sports":      Brain,
  "career-english":   Globe,
  "modern-sports":    Dumbbell,
  "barista-beverage": Coffee,
  "content-speaking": Mic2,
  "ai-productivity":  Sparkles,
  "lifestyle":        ChefHat,
};

const categoryIcons = COURSE_CATEGORIES.map((cat) => ({
  ...cat,
  icon: CATEGORY_ICON_BY_SLUG[cat.slug],
}));

interface HomeMentor {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
}

function mapCourse(c: LearnerCourse, badgeMap = new Map<string, PublicMentorTrustBadge[]>()) {
  const mentorId = c.mentor?.user_id || c.mentor_id;
  return {
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
    mentorBadges: badgeMap.get(mentorId) ?? [],
  };
}

// ── Tab types ──────────────────────────────────────────────────────────────
type CourseTab = "recommended" | "featured" | "nearby" | "online" | "offline";
const TABS: { id: CourseTab; label: string; icon: LucideIcon }[] = [
  { id: "recommended", label: "Gợi ý cho bạn", icon: Brain },
  { id: "featured",    label: "Nổi bật",        icon: Sparkles },
  { id: "nearby",      label: "Gần bạn",         icon: MapPin },
  { id: "online",      label: "Online",           icon: Monitor },
  { id: "offline",     label: "Offline",          icon: Users },
];

// Skeleton card placeholder
function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm animate-pulse">
      <div className="aspect-video bg-muted/60" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-24 bg-muted/60 rounded-full" />
        <div className="h-4 w-full bg-muted/60 rounded-full" />
        <div className="h-4 w-3/4 bg-muted/60 rounded-full" />
        <div className="h-3 w-20 bg-muted/60 rounded-full" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<CourseTab>("recommended");
  const { data: allCourses = [], isLoading } = useLearnerSearchCourses();

  const tabCourses: Record<CourseTab, typeof allCourses> = {
    recommended: allCourses.slice(0, 8),
    featured:    allCourses.filter((c) => c.is_promoted).slice(0, 8),
    nearby:      allCourses.filter((c) => c.format === "offline").slice(0, 8),
    online:      allCourses.filter((c) => c.format === "online").slice(0, 8),
    offline:     allCourses.filter((c) => c.format === "offline").slice(0, 8),
  };

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

  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap([
    ...mentors.map((m) => m.user_id),
    ...allCourses.map((c) => c.mentor?.user_id || c.mentor_id),
  ]);

  const approvedMentorIds = new Set(
    Array.from(mentorTrustBadges.entries())
      .filter(([, badges]) => badges.some((b) => b.badge_type === "vet_verified"))
      .map(([id]) => id),
  );

  const mappedMentors = mentors.map((m) => ({
    id: m.user_id,
    name: m.name || "Mentor",
    avatar: m.avatar_url || "",
    specialty: "Giảng viên",
    rating: 4.8,
    reviewCount: 0,
    coursesCount: 0,
    verified: approvedMentorIds.has(m.user_id),
    badges: mentorTrustBadges.get(m.user_id) ?? [],
    bio: m.bio || "",
  }));

  const visibleCourses = tabCourses[activeTab].slice(0, 4);

  return (
    <MainLayout>
      {/* ── Hero ── */}
      <SearchHero />

      {/* ── Danh mục phổ biến — 2 nhóm ── */}
      <section className="bg-white py-10">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Danh mục khóa học</h2>
            <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Khóa học phổ thông — chỉ hiện Thể thao & Tiếng Anh */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                🎯 Khóa học phổ thông
              </span>
              <span className="text-xs text-muted-foreground">Thể thao, ngôn ngữ và phát triển cá nhân</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 max-w-sm">
              {COURSE_CATEGORIES.filter((cat) => cat.slug === "modern-sports" || cat.slug === "career-english").map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <CategoryChip {...cat} icon={CATEGORY_ICON_BY_SLUG[cat.slug]} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Khóa học dạy nghề — Barber */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                💼 Khóa học dạy nghề
              </span>
              <span className="text-xs text-muted-foreground">Kỹ năng nghề nghiệp, tăng thu nhập</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 max-w-sm">
              {COURSE_CATEGORIES.filter((cat) => cat.slug === "barista-beverage").map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <CategoryChip {...cat} icon={CATEGORY_ICON_BY_SLUG[cat.slug]} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Khám phá khóa học (tabs) ── */}
      <section className="bg-gradient-to-b from-sky-50/60 to-white py-10">
        <div className="container">
          {/* Header */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-foreground">Khám phá khóa học</h2>
            <Link
              to="/search"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Xem thêm <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                  activeTab === id
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-primary/20"
                    : "border border-border/60 bg-white text-muted-foreground hover:border-primary/30 hover:text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Course grid */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <CourseCardSkeleton key={i} />)}
            </div>
          ) : visibleCourses.length > 0 ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {visibleCourses.map((c) => (
                <CourseCard key={c.id} course={mapCourse(c, mentorTrustBadges)} />
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-14 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Chưa có khóa học trong mục này</p>
              <Link to="/search" className="mt-3 text-sm text-primary hover:underline">
                Khám phá tất cả →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Mentor nổi bật ── */}
      {mappedMentors.length > 0 && (
        <section className="bg-white py-10">
          <div className="container">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                  <TrendingUp className="h-4.5 w-4.5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Mentor nổi bật</h2>
              </div>
              <Link
                to="/search"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Xem tất cả <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mappedMentors.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <MentorCard mentor={m} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="bg-gradient-to-b from-white to-sky-50/40 py-10">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 px-8 py-12 text-center shadow-xl"
          >
            {/* Decorative blobs */}
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            {/* Dots pattern */}
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />

            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                <Zap className="h-3.5 w-3.5" />
                Miễn phí đăng ký
              </div>
              <h2 className="mb-3 text-2xl font-extrabold text-white md:text-3xl">
                Bạn có kỹ năng muốn chia sẻ?
              </h2>
              <p className="mb-6 text-sm text-white/85 md:text-base max-w-md mx-auto">
                Trở thành Mentor trên VET và bắt đầu kiếm thu nhập từ kiến thức của bạn.
              </p>
              <Link to="/auth?role=mentor">
                <Button
                  size="lg"
                  className="rounded-xl bg-white font-semibold text-blue-600 shadow-lg hover:bg-white/95 hover:-translate-y-0.5 transition-all border-0 px-8"
                >
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
