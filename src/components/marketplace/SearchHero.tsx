import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const aiSuggestions = [
  "Học Guitar acoustic cho người mới",
  "Khóa tiếng Anh giao tiếp gần Quận 1",
  "Yoga cho người đi làm văn phòng",
  "Lập trình Python cơ bản online",
  "Nấu ăn Nhật Bản cho gia đình",
  "Thiết kế đồ họa Canva từ A-Z",
];

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
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleFocus = () => {
    setShowSuggestions(true);
    if (!aiText) {
      setAiTyping(true);
      const text = "🤖 Gợi ý: Bạn có thể thử tìm \"Guitar cơ bản\" hoặc \"Tiếng Anh giao tiếp gần đây\"";
      let i = 0;
      const timer = setInterval(() => {
        setAiText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(timer);
          setAiTyping(false);
        }
      }, 20);
    }
  };

  return (
    <section className="relative py-20 md:py-28">
      {/* Soft gradient background */}
      <div className="absolute inset-0 gradient-hero overflow-hidden" />
      <div className="absolute inset-0 gradient-hero-mesh overflow-hidden" />

      {/* Floating decorations - more visible */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute left-[8%] top-[12%] h-24 w-24 rounded-2xl bg-primary/8 blur-xl"
      />
      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute right-[12%] top-[20%] h-20 w-20 rounded-full bg-emerald-400/8 blur-xl"
      />
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity }}
        className="absolute left-[55%] bottom-[15%] h-28 w-28 rounded-3xl bg-amber-400/6 blur-xl"
      />
      <motion.div
        animate={{ x: [0, 10, 0], y: [0, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity }}
        className="absolute right-[5%] bottom-[25%] h-16 w-16 rounded-full bg-violet-400/6 blur-lg"
      />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-xs font-semibold text-primary shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Nền tảng #1 kết nối người học & mentor
          </motion.div>

          <h1 className="mb-5 text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            Khám phá{" "}
            <span className="text-gradient">khóa học</span>
            <br />
            phù hợp gần bạn
          </h1>
          <p className="mb-10 text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Kết nối với hàng nghìn mentor chất lượng. Học mọi thứ từ âm nhạc, ngoại ngữ đến lập trình.
          </p>

          <div className="relative mx-auto max-w-2xl overflow-visible">
            <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background p-2 shadow-elevated transition-shadow focus-within:shadow-glow focus-within:border-primary/30">
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="h-5 w-5 text-primary" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={aiSuggestions[placeholderIndex]}
                  className="flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
              </div>
              <div className="hidden items-center gap-2 border-l pl-3 sm:flex">
                <MapPin className="h-4 w-4 text-primary/60" />
                <span className="text-sm text-muted-foreground">TP.HCM</span>
              </div>
              <Button type="submit" className="gradient-primary border-0 text-primary-foreground rounded-xl px-6 shadow-lg shadow-primary/25">
                Tìm kiếm
              </Button>
            </form>

            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border bg-background p-3 shadow-elevated"
                >
                  {aiText && (
                    <div className="mb-3 rounded-xl bg-accent p-3 text-left text-xs text-accent-foreground">
                      {aiText}
                      {aiTyping && <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-primary" />}
                    </div>
                  )}
                  <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Gợi ý tìm kiếm</p>
                  <div className="space-y-0.5">
                    {aiSuggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => { setQuery(s); setShowSuggestions(false); navigate(`/search?q=${encodeURIComponent(s)}`); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
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

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Phổ biến:</span>
            {["Guitar", "Tiếng Anh", "Yoga", "Lập trình", "Nấu ăn"].map((tag) => (
              <button
                key={tag}
                onClick={() => { setQuery(tag); navigate(`/search?q=${encodeURIComponent(tag)}`); }}
                className="rounded-full border border-border/60 bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:shadow-sm"
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
