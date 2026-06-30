import { Link } from "react-router-dom";
import { Star, MapPin, Monitor, Users, Sparkles, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { TrustBadges } from "@/components/marketplace/TrustBadges";
import type { PublicMentorTrustBadge } from "@/hooks/usePublicMentorVerification";
import { getCourseCategoryShortLabel, getCourseCategoryGradient } from "@/constants/courseCategories";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";

export interface CourseData {
  id: string;
  title: string;
  mentorName: string;
  mentorAvatar: string;
  price: number;
  rating: number;
  reviewCount: number;
  image: string;
  category: string;
  format: "online" | "offline";
  location?: string;
  distance?: string;
  promoted?: boolean;
  studentsCount?: number;
  mentorBadges?: PublicMentorTrustBadge[];
}

// Gradient fallback theo category khi ảnh lỗi
function CategoryImageFallback({ category }: { category: string }) {
  const gradient = getCourseCategoryGradient(category);
  return (
    <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <BookOpen className="h-12 w-12 text-white/70" />
    </div>
  );
}

export function CourseCard({ course }: { course: CourseData }) {
  const { trackEvent } = useAnalyticsTracker();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Link
        to={`/course/${course.id}`}
        onClick={() => void trackEvent("course_detail_click", {
          courseId: course.id,
          source: "course_card",
          metadata: {
            title: course.title,
            category: course.category,
            format: course.format,
          },
        })}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/20"
      >
        {/* Image area — fixed 16:9 */}
        <div className="relative w-full overflow-hidden" style={{ paddingTop: "56.25%" }}>
          <div className="absolute inset-0">
            <img
              src={course.image}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div className="hidden h-full w-full">
              <CategoryImageFallback category={course.category} />
            </div>
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          {/* Badges top */}
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {course.promoted && (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                <Sparkles className="h-3 w-3" />
                Nổi bật
              </span>
            )}
          </div>
          <div className="absolute right-2.5 top-2.5">
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur-sm ${
                course.format === "online"
                  ? "bg-blue-600/90"
                  : "bg-teal-600/90"
              }`}
            >
              {course.format === "online" ? (
                <><Monitor className="h-3 w-3" />Online</>
              ) : (
                <><MapPin className="h-3 w-3" />Offline</>
              )}
            </span>
          </div>

          {/* Price bottom-right */}
          <div className="absolute bottom-2.5 right-2.5">
            <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-foreground shadow-lg backdrop-blur-sm">
              {course.price.toLocaleString("vi-VN")}đ
            </span>
          </div>
        </div>

        {/* Card body — grows to fill */}
        <div className="flex flex-1 flex-col p-3.5">
          {/* Mentor row */}
          <div className="mb-2 flex items-center gap-2">
            <img
              src={course.mentorAvatar}
              alt={course.mentorName}
              className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-primary/15"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://ui-avatars.com/api/?name=" + encodeURIComponent(course.mentorName) + "&size=24&background=random";
              }}
            />
            <span className="truncate text-xs font-medium text-muted-foreground">{course.mentorName}</span>
          </div>

          {/* Trust badges (compact) */}
          {(course.mentorBadges?.length ?? 0) > 0 && (
            <TrustBadges badges={course.mentorBadges ?? []} compact className="mb-2" />
          )}

          {/* Category badge */}
          <span className="mb-2 inline-block w-fit rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {getCourseCategoryShortLabel(course.category)}
          </span>

          {/* Title — fixed 2 lines */}
          <h3 className="mb-3 line-clamp-2 flex-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>

          {/* Footer stats */}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground">{course.rating}</span>
              <span>({course.reviewCount})</span>
            </span>
            {course.distance && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{course.distance}
              </span>
            )}
            {course.studentsCount != null && course.studentsCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{course.studentsCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
