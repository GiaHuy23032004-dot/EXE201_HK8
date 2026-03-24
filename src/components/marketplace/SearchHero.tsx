import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Sparkles, Loader2 } from "lucide-react";
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

  // Rotating placeholder
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
      // Simulate AI typing suggestion
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
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 gradient-hero-mesh opacity-60" />
      <div className="absolute inset-0 gradient-hero" />

      {/* Floating decorations */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute left-[10%] top-[15%] h-20 w-20 rounded-2xl gradient-primary opacity-10 blur-sm"
      />
      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute right-[15%] top-[25%] h-16 w-16 rounded-full gradient-secondary opacity-10 blur-sm"
      />
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity }}
        className="absolute left-[60%] bottom-[20%] h-24 w-24 rounded-3xl gradient-warm opacity-[0.07] blur-sm"
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
            className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/95 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-card backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Nền tảng #1 kết nối người học & mentor
          </motion.div>

          <h1 className="mb-5 text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            Khám phá{" "}
            <span className="text-gradient">khóa học</span>
            <br />
            phù hợp gần bạn
          </h1>
          <p className="mb-10 text-muted-foreground md:text-lg">
            Kết nối với hàng nghìn mentor chất lượng. Học mọi thứ từ âm nhạc, ngoại ngữ đến lập trình.
          </p>

          <div className="relative mx-auto max-w-2xl">
            <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-elevated transition-shadow focus-within:shadow-glow">
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
              <Button type="submit" className="gradient-primary border-0 text-primary-foreground rounded-xl px-6 shadow-glow/50">
                Tìm kiếm
              </Button>
            </form>

            {/* AI Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border bg-background p-3 shadow-elevated"
                >
                  {aiText && (
                    <div className="mb-3 rounded-xl bg-accent/50 p-3 text-left text-xs text-accent-foreground">
                      {aiText}
                      {aiTyping && <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-primary" />}
                    </div>
                  )}
                  <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Gợi ý tìm kiếm</p>
                  <div className="space-y-0.5">
                    {aiSuggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => { setQuery(s); navigate(`/search?q=${encodeURIComponent(s)}`); }}
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
                className="rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary hover:text-primary hover:shadow-card backdrop-blur-sm"
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
