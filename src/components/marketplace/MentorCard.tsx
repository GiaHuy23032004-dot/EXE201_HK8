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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        to={`/mentor/${mentor.id}`}
        className="group flex items-center gap-3.5 rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <img
            src={mentor.avatar}
            alt={mentor.name}
            className="h-14 w-14 rounded-xl object-cover ring-2 ring-transparent transition-all group-hover:ring-primary/20"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "https://ui-avatars.com/api/?name=" + encodeURIComponent(mentor.name) + "&size=56&background=random";
            }}
          />
          {(mentor.verified || (mentor.badges?.length ?? 0) > 0) && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {mentor.name}
          </h3>
          <p className="mb-1.5 truncate text-xs text-muted-foreground">{mentor.specialty}</p>

          {(mentor.badges?.length ?? 0) > 0 && (
            <TrustBadges badges={mentor.badges ?? []} compact className="mb-1.5" />
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground">{mentor.rating}</span>
              {mentor.reviewCount > 0 && <span>({mentor.reviewCount})</span>}
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
