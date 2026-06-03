import { Link } from "react-router-dom";
import { Star, MapPin, Monitor, Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { TrustBadges } from "@/components/marketplace/TrustBadges";
import type { PublicMentorTrustBadge } from "@/hooks/usePublicMentorVerification";

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

export function CourseCard({ course }: { course: CourseData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={`/course/${course.id}`}
        className="group block overflow-hidden rounded-2xl border bg-white shadow-card transition-all hover:shadow-card-hover"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={course.image}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          {course.promoted && (
            <div className="absolute left-3 top-3">
              <Badge className="gradient-warm border-0 text-white gap-1 shadow-lg">
                <Sparkles className="h-3 w-3" />
                Nổi bật
              </Badge>
            </div>
          )}
          <div className="absolute right-3 top-3">
            <Badge
              variant="secondary"
              className={`backdrop-blur-md border-0 shadow-sm ${
                course.format === "online"
                  ? "bg-blue-600/90 text-white"
                  : "bg-teal-600/90 text-white"
              }`}
            >
              {course.format === "online" ? (
                <><Monitor className="mr-1 h-3 w-3" />Online</>
              ) : (
                <><MapPin className="mr-1 h-3 w-3" />Offline</>
              )}
            </Badge>
          </div>
          {/* Price badge */}
          <div className="absolute bottom-3 right-3">
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold text-foreground shadow-lg backdrop-blur-sm">
              {course.price.toLocaleString("vi-VN")}đ
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <img src={course.mentorAvatar} alt={course.mentorName} className="h-6 w-6 rounded-full object-cover ring-2 ring-primary/20" />
            <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{course.mentorName}</span>
          </div>
          <TrustBadges badges={course.mentorBadges ?? []} compact className="mb-2" />

          <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-medium text-foreground">{course.rating}</span>
              ({course.reviewCount})
            </span>
            {course.distance && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{course.distance}
              </span>
            )}
            {course.studentsCount && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{course.studentsCount}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
