import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { mockCourses, categories } from "@/data/mockData";
import { Search, SlidersHorizontal, MapPin, Monitor, X, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [distance, setDistance] = useState(5);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = mockCourses.filter((c) => {
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (format !== "all" && c.format !== format) return false;
    if (c.price < priceRange[0] || c.price > priceRange[1]) return false;
    if (query && !c.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <MainLayout>
      {/* Search bar */}
      <div className="sticky top-16 z-40 border-b bg-card/95 backdrop-blur-lg">
        <div className="container flex items-center gap-2 py-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "gradient-primary border-0 text-primary-foreground" : ""}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Bộ lọc
          </Button>
          <Link to="/map">
            <Button variant="outline" size="sm">
              <MapPin className="mr-2 h-4 w-4" />
              Bản đồ
            </Button>
          </Link>
        </div>

        {/* Category pills */}
        <div className="container flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              !selectedCategory ? "gradient-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.slug ? "gradient-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:border-primary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b bg-muted/30"
          >
            <div className="container grid gap-6 py-6 md:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Hình thức</p>
                <div className="flex gap-2">
                  {(["all", "online", "offline"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${
                        format === f ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {f === "all" ? "Tất cả" : f === "online" ? "Online" : "Offline"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Khoảng cách: {distance}km</p>
                <Slider value={[distance]} onValueChange={(v) => setDistance(v[0])} max={10} step={1} className="mt-3" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Giá: {priceRange[0].toLocaleString("vi-VN")}đ - {priceRange[1].toLocaleString("vi-VN")}đ
                </p>
                <Slider value={priceRange} onValueChange={setPriceRange} max={1000000} step={50000} className="mt-3" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> kết quả
            {query && <> cho "<span className="text-primary">{query}</span>"</>}
          </p>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid gap-4"}>
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-4 h-12 w-12 text-muted" />
            <p className="text-lg font-semibold text-foreground">Không tìm thấy kết quả</p>
            <p className="text-sm text-muted-foreground">Thử thay đổi từ khóa hoặc bộ lọc</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
