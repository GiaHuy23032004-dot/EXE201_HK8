import { Link } from "react-router-dom";
import { Star, MapPin, Monitor, Users, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

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
}

export function CourseCard({ course }: { course: CourseData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={`/course/${course.id}`}
        className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={course.image}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {course.promoted && (
            <div className="absolute left-3 top-3">
              <Badge className="gradient-primary border-0 text-primary-foreground gap-1">
                <Sparkles className="h-3 w-3" />
                Nổi bật
              </Badge>
            </div>
          )}
          <div className="absolute right-3 top-3">
            <Badge variant={course.format === "online" ? "secondary" : "outline"} className={course.format === "online" ? "bg-secondary text-secondary-foreground" : "bg-card/90 backdrop-blur-sm"}>
              {course.format === "online" ? (
                <><Monitor className="mr-1 h-3 w-3" />Online</>
              ) : (
                <><MapPin className="mr-1 h-3 w-3" />Offline</>
              )}
            </Badge>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <img src={course.mentorAvatar} alt={course.mentorName} className="h-6 w-6 rounded-full object-cover" />
            <span className="text-xs text-muted-foreground">{course.mentorName}</span>
          </div>

          <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {course.rating}
              <span className="text-muted-foreground">({course.reviewCount})</span>
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

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">
              {course.price.toLocaleString("vi-VN")}đ
            </span>
            <span className="text-xs text-muted-foreground">/buổi</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
