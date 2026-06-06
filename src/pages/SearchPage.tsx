import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { useLearnerSearchCourses } from "@/hooks/useLearnerCourses";
import { Search, SlidersHorizontal, MapPin, Monitor, X, LayoutGrid, List, Sparkles, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePublicMentorTrustBadgeMap } from "@/hooks/usePublicMentorVerification";
import { COURSE_CATEGORIES, normalizeCourseCategory } from "@/constants/courseCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { AI_CREDIT_COSTS } from "@/constants/aiCredits";
import { AiCreditUpgradeDialog } from "@/components/subscription/AiCreditUpgradeDialog";
import { isAiCreditRequiredPayload, readFunctionErrorPayload } from "@/lib/aiCreditErrors";

const SEARCH_AI_COST = AI_CREDIT_COSTS.search;

export default function SearchPage() {
  const { session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const {
    aiCreditsRemaining,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useSubscription();
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<"all" | "online" | "offline">("all");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();

  // Read query from URL
  useEffect(() => {
    const q = searchParams.get("q");
    const location = searchParams.get("location");
    const category = searchParams.get("category");
    setQuery(q ?? "");
    setLocationQuery(location ?? "");
    setSelectedCategory(category ? normalizeCourseCategory(category) : null);
  }, [searchParams]);

  // Fetch courses từ Supabase
  const { data: courses = [], isLoading } = useLearnerSearchCourses({
    query,
    location: locationQuery,
    category: selectedCategory,
    format,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
  });
  const { data: mentorTrustBadges = new Map() } = usePublicMentorTrustBadgeMap(
    courses.map((course) => course.mentor?.user_id || course.mentor_id),
  );

  // AI search suggestions
  const fetchAiSuggestions = useCallback(async (searchQuery: string) => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setAiSuggestions([]);
      toast({
        title: "Nhập từ khóa trước khi dùng AI",
        description: "Tính năng này dùng 1 AI credit.",
      });
      return;
    }

    if (!session) {
      toast({
        title: "Vui lòng đăng nhập để dùng AI",
        description: "Free có 3 AI credits dùng thử mỗi tháng.",
      });
      return;
    }

    if (aiCreditsRemaining < SEARCH_AI_COST) {
      setCreditDialogOpen(true);
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { query: cleanQuery, type: "search" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (isAiCreditRequiredPayload(payload)) {
          setCreditDialogOpen(true);
          return;
        }
        throw error;
      }

      if (isAiCreditRequiredPayload(data)) {
        setCreditDialogOpen(true);
        return;
      }

      if (data?.suggestions) {
        let raw = data.suggestions;
        if (typeof raw === "string") {
          try {
            raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const suggestions = parsed
                .map((item: unknown) => {
                  if (typeof item === "string") return item;
                  if (item && typeof item === "object" && "title" in item) {
                    const title = (item as { title?: unknown }).title;
                    return typeof title === "string" ? title : "";
                  }
                  return "";
                })
                .filter(Boolean)
                .slice(0, 5);
              setAiSuggestions(suggestions);
              setShowAiPanel(suggestions.length > 0);
              return;
            }
          } catch (parseError) {
            console.error("Parse AI suggestions error:", parseError);
          }
        }
      }

      toast({
        title: "AI chưa có gợi ý phù hợp",
        description: "Bạn có thể thử từ khóa cụ thể hơn.",
      });
    } catch (error) {
      console.error("AI search error:", error);
      toast({
        title: "Không thể dùng AI lúc này",
        description: "Vui lòng thử lại sau. Nếu AI đã bị lỗi, credit sẽ được hoàn qua hệ thống.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
      await refetchSubscription();
    }
  }, [aiCreditsRemaining, refetchSubscription, session, toast]);

  // Map Supabase course sang CourseCard format
  const mappedCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    mentorName: c.mentor?.name || "Mentor",
    mentorAvatar: c.mentor?.avatar_url || "",
    price: c.price,
    rating: c.rating,
    reviewCount: c.review_count,
    image: c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop",
    category: c.category,
    format: c.format,
    location: c.location || undefined,
    promoted: c.is_promoted,
    studentsCount: c.students_count,
    mentorBadges: mentorTrustBadges.get(c.mentor?.user_id || c.mentor_id) ?? [],
  }));

  return (
    <MainLayout>
      {/* Search bar */}
      <div className="sticky top-16 z-40 border-b glass">
        <div className="container flex items-center gap-2 py-3">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 transition-all focus-within:border-primary focus-within:shadow-glow/30">
              <Search className="h-4 w-4 text-primary" />
              <input
                type="text"
                placeholder="Tìm kiếm khóa học..."
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {query && !aiLoading && (
                <button onClick={() => { setQuery(""); setAiSuggestions([]); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {showAiPanel && aiSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border bg-card p-2 shadow-elevated"
                >
                  <div className="mb-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">AI gợi ý</span>
                  </div>
                  {aiSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(s); setShowAiPanel(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <Sparkles className="h-3 w-3 text-primary/60" />
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAiPanel(false)}
                    className="mt-1 w-full rounded-lg px-3 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Đóng
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
          <Link to={locationQuery ? `/map?location=${encodeURIComponent(locationQuery)}` : "/map"}>
            <Button variant="outline" size="sm">
              <MapPin className="mr-2 h-4 w-4" />
              Bản đồ
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAiSuggestions(query)}
            disabled={aiLoading || subscriptionLoading}
            className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          >
            {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            {aiLoading ? "Đang gợi ý..." : `AI gợi ý · ${SEARCH_AI_COST} credit`}
          </Button>
          <Badge variant="outline" className="hidden rounded-full border-primary/20 bg-background px-3 py-1.5 text-primary md:inline-flex">
            {isLoggedIn ? `Bạn còn ${aiCreditsRemaining} AI credits` : "Đăng nhập để dùng AI"}
          </Badge>
        </div>

        {/* Category pills */}
        <div className="container flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              !selectedCategory ? "gradient-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            Tất cả
          </button>
          {COURSE_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                selectedCategory === cat.slug ? "gradient-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:border-primary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {locationQuery && (
          <div className="container flex pb-3">
            <Badge variant="outline" className="gap-2 rounded-full border-primary/20 bg-primary/5 px-3 py-1.5 text-primary">
              <MapPin className="h-3.5 w-3.5" />
              Khu vực: {locationQuery}
              <button
                type="button"
                onClick={() => setLocationQuery("")}
                className="rounded-full p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
                aria-label="Xóa khu vực tìm kiếm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b bg-muted/20"
          >
            <div className="container grid gap-6 py-6 md:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Hình thức</p>
                <div className="flex gap-2">
                  {(["all", "online", "offline"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                        format === f ? "border-primary bg-accent text-accent-foreground shadow-sm" : "bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {f === "all" ? "Tất cả" : f === "online" ? "Online" : "Offline"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Giá: {priceRange[0].toLocaleString("vi-VN")}đ - {priceRange[1].toLocaleString("vi-VN")}đ
                </p>
                <Slider value={priceRange} onValueChange={setPriceRange} max={1000000} step={50000} className="mt-3" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => { setFormat("all"); setPriceRange([0, 1000000]); setSelectedCategory(null); }}>
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Đang tải...</span>
            ) : (
              <><span className="font-semibold text-foreground">{mappedCourses.length}</span> kết quả
              {query && <> cho "<span className="text-primary font-medium">{query}</span>"</>}</>
            )}
          </p>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid gap-4"}>
            {mappedCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}

        {!isLoading && mappedCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Không tìm thấy kết quả</p>
            <p className="text-sm text-muted-foreground">Thử thay đổi từ khóa hoặc bộ lọc</p>
          </div>
        )}
      </div>

      <AiCreditUpgradeDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen} />
    </MainLayout>
  );
}
