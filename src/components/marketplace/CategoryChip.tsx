import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface CategoryChipProps {
  icon: LucideIcon;
  label: string;
  slug: string;
}

const colorMap: Record<string, string> = {
  music: "from-pink-500 to-rose-500",
  language: "from-blue-500 to-cyan-500",
  coding: "from-violet-500 to-purple-500",
  art: "from-amber-500 to-orange-500",
  fitness: "from-green-500 to-emerald-500",
  cooking: "from-red-500 to-pink-500",
  business: "from-slate-600 to-slate-800",
  design: "from-fuchsia-500 to-purple-500",
};

export function CategoryChip({ icon: Icon, label, slug }: CategoryChipProps) {
  const gradient = colorMap[slug] || "from-primary to-secondary";

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
