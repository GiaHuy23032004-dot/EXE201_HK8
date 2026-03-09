import { Star } from "lucide-react";

interface ReviewData {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export function ReviewBlock({ review }: { review: ReviewData }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <img src={review.userAvatar} alt={review.userName} className="h-10 w-10 rounded-full object-cover" />
        <div>
          <p className="text-sm font-medium text-card-foreground">{review.userName}</p>
          <p className="text-xs text-muted-foreground">{review.date}</p>
        </div>
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
