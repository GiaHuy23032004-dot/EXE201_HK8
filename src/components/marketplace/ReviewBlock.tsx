import { Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewData {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export function ReviewBlock({ review, onReport }: { review: ReviewData; onReport?: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={review.userAvatar} alt={review.userName} className="h-10 w-10 rounded-full object-cover" />
          <div>
            <p className="text-sm font-medium text-card-foreground">{review.userName}</p>
            <p className="text-xs text-muted-foreground">{review.date}</p>
          </div>
        </div>
        {onReport && (
          <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-muted-foreground hover:text-destructive" onClick={onReport}>
            <Flag className="mr-1 h-3 w-3" />
            Báo cáo
          </Button>
        )}
      </div>
      <div className="mb-2 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < review.rating ? "fill-warning text-warning" : "text-muted"}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
    </div>
  );
}
