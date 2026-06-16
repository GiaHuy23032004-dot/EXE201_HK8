import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const aiSuggestions = [
  "Cờ vua chiến thuật cho người mới",
  "Tiếng Anh công việc cho nhân viên văn phòng",
  "Pickleball cơ bản gần Quận 1",
  "Pha chế cà phê tại nhà",
  "Kỹ năng MC và thuyết trình",
  "AI tăng năng suất làm việc",
];

const popularTags = ["Cờ vua", "Tiếng Anh công việc", "Pickleball", "Barista", "AI công việc"];

export function SearchHero() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiText, setAiText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % aiSuggestions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
    if (!aiText) {
      setAiTyping(true);
      const text = "🤖 Gợi ý: Bạn có thể thử tìm \"Tiếng Anh công việc\" hoặc \"AI tăng năng suất\"";
      let i = 0;
      const timer = setInterval(() => {
        setAiText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) { clearInterval(timer); setAiTyping(false); }
      }, 18);
    }
  };

  return (
    <section className="relative py-14 md:py-20">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-cyan-50 overflow-hidden" />
      {/* Blobs — clipped separately so they don't affect dropdown */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute -right-20 -bottom-10 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-teal-200/20 blur-2xl" />
      </div>

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-2xl text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Nền tảng #1 kết nối người học &amp; mentor
          </motion.div>

          {/* Heading */}
          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            Khám phá{" "}
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              khóa học
            </span>
            <br />
            phù hợp gần bạn
          </h1>

          {/* Subtitle */}
          <p className="mb-8 text-sm text-muted-foreground md:text-base max-w-lg mx-auto">
            Kết nối với hàng nghìn mentor chất lượng trong 6 nhóm kỹ năng thực tế: tư duy chiến thuật, tiếng Anh, thể thao, đồ uống, thuyết trình và AI.
          </p>

          {/* Search bar */}
          <div className="relative mx-auto max-w-xl">
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 rounded-2xl border border-border/70 bg-white p-2 shadow-lg shadow-black/5 transition-shadow focus-within:shadow-xl focus-within:shadow-primary/10 focus-within:border-primary/30"
            >
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="h-4 w-4 shrink-0 text-primary" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={aiSuggestions[placeholderIndex]}
                  className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
              </div>
              {/* Location */}
              <div className="hidden items-center gap-1.5 border-l border-border/60 pl-3 pr-1 sm:flex">
                <MapPin className="h-4 w-4 text-primary/60" />
                <span className="text-xs text-muted-foreground">TP.HCM</span>
              </div>
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 border-0 px-5 py-2 text-white shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-transform"
              >
                Tìm kiếm
              </Button>
            </form>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-0 right-0 top-full z-[200] mt-2 rounded-2xl border bg-white p-3 shadow-xl"
                >
                  {aiText && (
                    <div className="mb-3 rounded-xl bg-sky-50 p-3 text-left text-xs text-sky-800">
                      {aiText}
                      {aiTyping && <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-primary" />}
                    </div>
                  )}
                  <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">Gợi ý tìm kiếm</p>
                  <div className="space-y-0.5">
                    {aiSuggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => { setQuery(s); setShowSuggestions(false); navigate(`/search?q=${encodeURIComponent(s)}`); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-sky-50 transition-colors"
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Popular tags */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Phổ biến:</span>
            {popularTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { setQuery(tag); navigate(`/search?q=${encodeURIComponent(tag)}`); }}
                className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:shadow-sm"
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
