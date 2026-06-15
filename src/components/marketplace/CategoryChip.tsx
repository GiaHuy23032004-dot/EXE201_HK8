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
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.15 }}>
      <Link
        to={`/search?category=${slug}`}
        className="group flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md shadow-black/10 transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <span className="text-center text-[11px] font-medium leading-tight text-foreground">{label}</span>
      </Link>
    </motion.div>
  );
}
