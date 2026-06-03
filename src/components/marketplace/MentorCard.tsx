import { Link } from "react-router-dom";
import { Star, BadgeCheck, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { TrustBadges } from "@/components/marketplace/TrustBadges";
import type { PublicMentorTrustBadge } from "@/hooks/usePublicMentorVerification";

export interface MentorData {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  coursesCount: number;
  verified: boolean;
  badges?: PublicMentorTrustBadge[];
  bio: string;
}

export function MentorCard({ mentor }: { mentor: MentorData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Link
        to={`/mentor/${mentor.id}`}
        className="group flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card transition-all hover:shadow-card-hover hover:border-primary/20"
      >
        <div className="relative">
          <img src={mentor.avatar} alt={mentor.name} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-transparent group-hover:ring-primary/20 transition-all" />
          {(mentor.verified || (mentor.badges?.length ?? 0) > 0) && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-card-foreground truncate group-hover:text-primary transition-colors">{mentor.name}</h3>
          </div>
          <TrustBadges badges={mentor.badges ?? []} compact className="mb-2" />
          <p className="text-xs text-muted-foreground mb-2">{mentor.specialty}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-medium text-foreground">{mentor.rating}</span> ({mentor.reviewCount})
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
