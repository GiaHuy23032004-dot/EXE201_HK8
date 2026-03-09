import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface CategoryChipProps {
  icon: LucideIcon;
  label: string;
  slug: string;
  color?: string;
}

export function CategoryChip({ icon: Icon, label, slug }: CategoryChipProps) {
  return (
    <Link
      to={`/search?category=${slug}`}
      className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 shadow-card transition-all hover:shadow-card-hover hover:border-primary/30 group"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent transition-colors group-hover:gradient-primary">
        <Icon className="h-6 w-6 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
      </div>
      <span className="text-xs font-medium text-card-foreground">{label}</span>
    </Link>
  );
}
