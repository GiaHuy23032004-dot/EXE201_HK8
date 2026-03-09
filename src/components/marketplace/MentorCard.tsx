import { Link } from "react-router-dom";
import { Star, BadgeCheck, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export interface MentorData {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  coursesCount: number;
  verified: boolean;
  bio: string;
}

export function MentorCard({ mentor }: { mentor: MentorData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={`/mentor/${mentor.id}`}
        className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
      >
        <img src={mentor.avatar} alt={mentor.name} className="h-16 w-16 rounded-xl object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-card-foreground truncate">{mentor.name}</h3>
            {mentor.verified && (
              <BadgeCheck className="h-4 w-4 text-secondary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{mentor.specialty}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {mentor.rating} ({mentor.reviewCount})
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {mentor.coursesCount} khóa học
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
