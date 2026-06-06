import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { getCourseCategoryGradient } from "@/constants/courseCategories";

interface CategoryChipProps {
  icon: LucideIcon;
  label: string;
  slug: string;
}

export function CategoryChip({ icon: Icon, label, slug }: CategoryChipProps) {
  const gradient = getCourseCategoryGradient(slug);

  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.95 }}>
      <Link
        to={`/search?category=${slug}`}
        className="group flex flex-col items-center gap-2.5 rounded-2xl border bg-white p-4 shadow-card transition-all hover:shadow-card-hover"
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-primary/10 transition-transform group-hover:scale-110`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <span className="text-xs font-medium text-card-foreground">{label}</span>
      </Link>
    </motion.div>
  );
}
