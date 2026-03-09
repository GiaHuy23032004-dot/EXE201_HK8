import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function SearchHero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <section className="gradient-hero py-16 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="mb-4 text-3xl font-extrabold leading-tight text-foreground md:text-5xl">
            Tìm kiếm <span className="text-gradient">khóa học</span> phù hợp gần bạn
          </h1>
          <p className="mb-8 text-muted-foreground md:text-lg">
            Kết nối với hàng nghìn mentor chất lượng. Học mọi thứ từ âm nhạc, ngoại ngữ đến lập trình.
          </p>

          <form onSubmit={handleSearch} className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border bg-card p-2 shadow-elevated">
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Bạn muốn học gì? (Guitar, Tiếng Anh, Yoga...)"
                className="flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="hidden items-center gap-2 border-l pl-2 sm:flex">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">TP.HCM</span>
            </div>
            <Button type="submit" className="gradient-primary border-0 text-primary-foreground rounded-xl px-6">
              Tìm kiếm
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Phổ biến:</span>
            {["Guitar", "Tiếng Anh", "Yoga", "Lập trình", "Nấu ăn"].map((tag) => (
              <button
                key={tag}
                onClick={() => { setQuery(tag); navigate(`/search?q=${encodeURIComponent(tag)}`); }}
                className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
