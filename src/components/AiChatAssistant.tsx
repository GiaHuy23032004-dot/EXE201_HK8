import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, Bot, ExternalLink, Loader2, MapPin, MessageCircle, Send, Sparkles, Star, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, matchPath, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { AI_CREDIT_COSTS } from "@/constants/aiCredits";
import { AiCreditUpgradeDialog } from "@/components/subscription/AiCreditUpgradeDialog";
import { isAiCreditRequiredPayload } from "@/lib/aiCreditErrors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";

type CourseRecommendation = {
  id: string;
  title: string;
  mentorName?: string | null;
  category?: string | null;
  format: "online" | "offline" | string | null;
  price: number | null;
  location?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  detailUrl: string;
  matchType: "exact" | "similar";
};

type NoMatchInfo = {
  no_match: true;
  message: string;
  suggestions: string[];
  suggested_filters?: {
    category?: string | null;
    format?: string | null;
    location?: string | null;
  };
  can_create_request: boolean;
};

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: CourseRecommendation[];
  noMatch?: NoMatchInfo;
};

type ChatConversationRow = {
  id: string;
  title: string | null;
  last_message_at: string;
};

type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  metadata?: unknown;
};

type ChatRpcClient = {
  rpc<T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const CHAT_AI_COST = AI_CREDIT_COSTS.chat;
const chatRpc = supabase as unknown as ChatRpcClient;
const WIDGET_POSITION_KEY = "vet-ai-chat-widget-position";
const WIDGET_MARGIN = 16;
const LAUNCHER_SIZE = 56;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 520;

type WidgetPosition = {
  x: number;
  y: number;
};

type DragState = {
  active: boolean;
  moved: boolean;
  mode: "launcher" | "panel";
  startX: number;
  startY: number;
  startPosition: WidgetPosition;
  size: { width: number; height: number };
};

const quickPrompts = [
  "Kỹ thuật đánh pickleball cho người mới?",
  "Cách luyện nói tiếng Anh công việc?",
  "Làm sao dùng voucher VET Plus?",
  "Tôi đã thanh toán nhưng chưa thấy cập nhật",
  "Làm sao đổi mật khẩu?",
  "Tìm khóa học phù hợp với tôi",
];

function getPanelSize() {
  if (typeof window === "undefined") return { width: PANEL_WIDTH, height: PANEL_HEIGHT };
  return {
    width: Math.min(PANEL_WIDTH, window.innerWidth - WIDGET_MARGIN * 2),
    height: Math.min(PANEL_HEIGHT, window.innerHeight - WIDGET_MARGIN * 2),
  };
}

function clampPosition(position: WidgetPosition, size = { width: LAUNCHER_SIZE, height: LAUNCHER_SIZE }) {
  if (typeof window === "undefined") return position;

  const maxX = Math.max(WIDGET_MARGIN, window.innerWidth - size.width - WIDGET_MARGIN);
  const maxY = Math.max(WIDGET_MARGIN, window.innerHeight - size.height - WIDGET_MARGIN);

  return {
    x: Math.min(Math.max(WIDGET_MARGIN, position.x), maxX),
    y: Math.min(Math.max(WIDGET_MARGIN, position.y), maxY),
  };
}

function getInitialWidgetPosition() {
  if (typeof window === "undefined") return { x: 24, y: 480 };

  // Default: bottom-right corner
  const fallback = {
    x: Math.max(WIDGET_MARGIN, window.innerWidth - LAUNCHER_SIZE - 24),
    y: Math.max(WIDGET_MARGIN, window.innerHeight - LAUNCHER_SIZE - 24),
  };

  try {
    const raw = window.localStorage.getItem(WIDGET_POSITION_KEY);
    if (!raw) return clampPosition(fallback);
    const parsed = JSON.parse(raw) as Partial<WidgetPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return clampPosition(fallback);
    // If stored position is on the left side (old default), reset to bottom-right
    if (parsed.x < 100) return clampPosition(fallback);
    return clampPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return clampPosition(fallback);
  }
}

function toChatMessages(rows: ChatMessageRow[] | null | undefined): Msg[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      recommendations: extractRecommendations(row.metadata),
      noMatch: extractNoMatch(row.metadata),
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRecommendation(value: unknown): CourseRecommendation | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title : "";
  const detailUrl = typeof value.detailUrl === "string" ? value.detailUrl : `/course/${id}`;
  const matchType = value.matchType === "similar" ? "similar" : "exact";

  if (!id || !title) return null;

  return {
    id,
    title,
    mentorName: typeof value.mentorName === "string" ? value.mentorName : null,
    category: typeof value.category === "string" ? value.category : null,
    format: typeof value.format === "string" ? value.format : null,
    price: Number.isFinite(Number(value.price)) ? Number(value.price) : null,
    location: typeof value.location === "string" ? value.location : null,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : null,
    rating: Number.isFinite(Number(value.rating)) ? Number(value.rating) : null,
    reviewCount: Number.isFinite(Number(value.reviewCount)) ? Number(value.reviewCount) : null,
    detailUrl,
    matchType,
  };
}

function extractRecommendations(metadata: unknown): CourseRecommendation[] | undefined {
  if (!isRecord(metadata) || !Array.isArray(metadata.recommendations)) return undefined;
  const recommendations = metadata.recommendations
    .map(normalizeRecommendation)
    .filter((item): item is CourseRecommendation => Boolean(item));
  return recommendations.length ? recommendations : undefined;
}

function normalizeNoMatch(value: unknown): NoMatchInfo | undefined {
  if (!isRecord(value) || value.no_match !== true) return undefined;
  const suggestions = Array.isArray(value.suggestions)
    ? value.suggestions.map((item) => String(item)).filter(Boolean).slice(0, 4)
    : [];
  const suggestedFilters = isRecord(value.suggested_filters) ? value.suggested_filters : {};
  return {
    no_match: true,
    message:
      typeof value.message === "string" && value.message.trim()
        ? value.message
        : "Hiện tại VET chưa có khóa học khớp chính xác với nhu cầu này.",
    suggestions,
    suggested_filters: {
      category: typeof suggestedFilters.category === "string" ? suggestedFilters.category : null,
      format: typeof suggestedFilters.format === "string" ? suggestedFilters.format : null,
      location: typeof suggestedFilters.location === "string" ? suggestedFilters.location : null,
    },
    can_create_request: value.can_create_request === true,
  };
}

function extractNoMatch(metadata: unknown): NoMatchInfo | undefined {
  if (!isRecord(metadata)) return undefined;
  return normalizeNoMatch(metadata.no_match ?? metadata);
}

function formatCurrency(value: number | null) {
  if (!Number.isFinite(Number(value))) return "Chưa cập nhật";
  return `${Number(value).toLocaleString("vi-VN")}đ/buổi`;
}

function getFormatLabel(format: CourseRecommendation["format"]) {
  if (format === "online") return "Online";
  if (format === "offline") return "Offline";
  return "Khóa học";
}

function CourseRecommendationCards({ courses }: { courses: CourseRecommendation[] }) {
  const { trackEvent } = useAnalyticsTracker();

  if (!courses.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {courses.map((course) => (
        <Link
          key={`${course.matchType}-${course.id}`}
          to={course.detailUrl}
          onClick={() => {
            void trackEvent("course_detail_click", {
              courseId: course.id,
              source: "edubot_recommendation",
              metadata: {
                title: course.title,
                matchType: course.matchType,
              },
            });
            void trackEvent("ai_course_recommendation_click", {
              courseId: course.id,
              source: "edubot_recommendation",
              metadata: {
                title: course.title,
                matchType: course.matchType,
              },
            });
          }}
          className="group block overflow-hidden rounded-2xl border bg-background text-foreground shadow-sm transition hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex gap-3 p-2.5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
              {course.imageUrl ? (
                <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-accent">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={course.format === "offline" ? "secondary" : "outline"} className="px-2 py-0 text-[10px]">
                  {getFormatLabel(course.format)}
                </Badge>
                {course.matchType === "similar" && (
                  <Badge variant="outline" className="px-2 py-0 text-[10px]">
                    Tương tự
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-primary">
                {course.title}
              </p>
              {course.mentorName && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Mentor: {course.mentorName}</p>
              )}
              {course.format === "offline" && course.location && (
                <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{course.location}</span>
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary">{formatCurrency(course.price)}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {course.rating ?? "Mới"} {course.reviewCount ? `(${course.reviewCount})` : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 border-t px-3 py-2 text-xs font-semibold text-primary">
            Xem chi tiết
            <ExternalLink className="h-3 w-3" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function NoMatchPanel({
  info,
  onCreateRequest,
}: {
  info: NoMatchInfo;
  onCreateRequest: () => void;
}) {
  return (
    <div className="mt-2 w-full rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-amber-950 shadow-sm">
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">Hiện chưa có khóa học phù hợp.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-900/80">
            {info.message} Mình sẽ không đề xuất khóa học chưa có trong hệ thống để tránh thông tin sai.
          </p>
          {info.suggestions.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-900/80">
              {info.suggestions.map((suggestion) => (
                <li key={suggestion}>• {suggestion}</li>
              ))}
            </ul>
          )}
          {info.can_create_request && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateRequest}
              className="mt-3 h-8 rounded-xl border-amber-300 bg-white/80 px-3 text-xs font-semibold text-amber-900 hover:bg-white"
            >
              Gửi nhu cầu học này
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderMessageContent(content: string) {
  const parts: Array<string | { label: string; href: string }> = [];
  const linkRegex = /\[([^\]]+)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push({ label: match[1], href: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <a
        key={`${part.href}-${index}`}
        href={part.href}
        className="font-semibold underline underline-offset-2 hover:opacity-80"
      >
        {part.label}
      </a>
    ),
  );
}

function getChatRouteContext(pathname: string) {
  const courseMatch = matchPath("/course/:id", pathname);
  const bookingMatch = matchPath("/booking/:id", pathname);

  if (courseMatch?.params.id) {
    return {
      pageContext: "course_detail",
      courseId: courseMatch.params.id,
      bookingId: null,
    };
  }

  if (bookingMatch?.params.id) {
    return {
      pageContext: "booking",
      courseId: null,
      bookingId: bookingMatch.params.id,
    };
  }

  if (pathname === "/") return { pageContext: "home", courseId: null, bookingId: null };
  if (pathname.startsWith("/search")) return { pageContext: "search", courseId: null, bookingId: null };
  if (pathname === "/pricing" || pathname === "/vet-plus" || pathname === "/learner/subscription") {
    return { pageContext: "pricing", courseId: null, bookingId: null };
  }
  if (pathname.startsWith("/learner/learning-profile")) {
    return { pageContext: "learning_profile", courseId: null, bookingId: null };
  }
  if (pathname.startsWith("/learner/dashboard")) {
    return { pageContext: "learner_dashboard", courseId: null, bookingId: null };
  }
  if (pathname.startsWith("/mentor")) {
    return { pageContext: "mentor_dashboard", courseId: null, bookingId: null };
  }
  if (pathname.startsWith("/admin")) {
    return { pageContext: "admin", courseId: null, bookingId: null };
  }
  return { pageContext: null, courseId: null, bookingId: null };
}

function normalizeAssistantText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function isPasswordHelpQuestion(content: string) {
  const normalized = normalizeAssistantText(content);
  return ["mat khau", "password", "otp", "ma bao mat", "quen mat khau", "doi mat khau"].some((term) =>
    normalized.includes(term),
  );
}

function PasswordSafetyNotice() {
  return (
    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[11px] leading-relaxed text-amber-900">
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>Không chia sẻ mật khẩu, OTP hoặc mã bảo mật trong chat.</span>
      </div>
    </div>
  );
}

export function AiChatAssistant() {
  const { session, isLoggedIn } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const { trackEvent } = useAnalyticsTracker();
  const {
    aiCreditsRemaining,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useSubscription();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyActionLoading, setHistoryActionLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition>(getInitialWidgetPosition);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const panelPosition = useMemo(() => clampPosition(widgetPosition, getPanelSize()), [widgetPosition]);
  const routeContext = useMemo(() => getChatRouteContext(location.pathname), [location.pathname]);
  const currentCourseId = routeContext.courseId;
  const currentBookingId = routeContext.bookingId;
  const pageContext = routeContext.pageContext;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(widgetPosition));
  }, [widgetPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWidgetPosition((current) => clampPosition(current, open ? getPanelSize() : undefined));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setHistoryLoaded(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!open || !session?.user?.id || historyLoaded) return;

    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const { data: conversations, error: conversationsError } =
          await chatRpc.rpc<ChatConversationRow[]>("get_my_chat_conversations");
        if (conversationsError) throw conversationsError;

        const latestConversation = Array.isArray(conversations)
          ? (conversations[0] as ChatConversationRow | undefined)
          : null;

        if (!latestConversation?.id) {
          if (!cancelled) {
            setMessages([]);
            setConversationId(null);
          }
          return;
        }

        const { data: loadedMessages, error: messagesError } = await chatRpc.rpc<ChatMessageRow[]>("get_my_chat_messages", {
          _conversation_id: latestConversation.id,
        });
        if (messagesError) throw messagesError;

        if (!cancelled) {
          setConversationId(latestConversation.id);
          setMessages(toChatMessages(loadedMessages as ChatMessageRow[]));
        }
      } catch (error) {
        console.error("Không thể tải lịch sử EduBot:", error);
        if (!cancelled) {
          setMessages([]);
          setConversationId(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
          setHistoryLoaded(true);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [open, session?.user?.id, historyLoaded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, historyLoading]);

  const clearHistory = async () => {
    if (!session || historyActionLoading) return;

    setHistoryActionLoading(true);
    try {
      if (conversationId) {
        const { error } = await chatRpc.rpc("clear_my_chat_conversation", {
          _conversation_id: conversationId,
        });
        if (error) throw error;
      }

      setMessages([]);
      setConversationId(null);
      setHistoryLoaded(true);
    } catch (error) {
      console.error("Không thể xóa lịch sử EduBot:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Mình chưa thể xóa lịch sử lúc này. Bạn thử lại sau nhé." },
      ]);
    } finally {
      setHistoryActionLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (!session) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Vui lòng đăng nhập để dùng EduBot AI. Free có 3 AI credits dùng thử mỗi tháng." },
      ]);
      return;
    }

    if (subscriptionLoading) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "VET đang tải số AI credits của bạn. Vui lòng thử lại sau vài giây." },
      ]);
      return;
    }

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    void trackEvent("ai_chat_message", {
      courseId: currentCourseId,
      bookingId: currentBookingId,
      source: "edubot",
      metadata: {
        page_context: pageContext,
        message_length: text.trim().length,
        has_conversation: Boolean(conversationId),
      },
    });

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((message, index) =>
            index === prev.length - 1 ? { ...message, content: assistantSoFar } : message,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    const setAssistantId = (messageId: string) => {
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || prev[lastIndex]?.role !== "assistant") return prev;
        return prev.map((message, index) =>
          index === lastIndex ? { ...message, id: messageId } : message,
        );
      });
    };

    const setAssistantRecommendations = (recommendations: CourseRecommendation[]) => {
      if (!recommendations.length) return;
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || prev[lastIndex]?.role !== "assistant") return prev;
        return prev.map((message, index) =>
          index === lastIndex ? { ...message, recommendations } : message,
        );
      });
    };

    const setAssistantNoMatch = (noMatch: NoMatchInfo) => {
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || prev[lastIndex]?.role !== "assistant") return prev;
        return prev.map((message, index) =>
          index === lastIndex ? { ...message, noMatch } : message,
        );
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          messages: newMessages,
          conversation_id: conversationId,
          page_context: pageContext,
          course_id: currentCourseId,
          booking_id: currentBookingId,
          current_path: location.pathname,
        }),
      });

      if (!resp.ok || !resp.body) {
        const payload = await resp.clone().json().catch(() => null);
        if (isAiCreditRequiredPayload(payload)) {
          setCreditDialogOpen(true);
          upsertAssistant("Bạn đã hết AI credits. Mở VET Plus để nhận 60 AI credits mỗi tháng nhé.");
        } else if (resp.status === 401) {
          upsertAssistant("Vui lòng đăng nhập lại để dùng EduBot AI.");
        } else if (resp.status === 429) {
          upsertAssistant("Quá nhiều yêu cầu, vui lòng thử lại sau một chút nhé!");
        } else if (resp.status === 402) {
          upsertAssistant("Hệ thống AI tạm hết credit. Vui lòng thử lại sau!");
        } else {
          upsertAssistant("Có lỗi xảy ra, vui lòng thử lại nhé! Nếu AI đã bị lỗi, credit sẽ được hoàn qua hệ thống.");
        }
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
            const recommendations = extractRecommendations(parsed);
            if (recommendations?.length) {
              setAssistantRecommendations(recommendations);
            }
            const noMatch = normalizeNoMatch(parsed);
            if (noMatch) {
              setAssistantNoMatch(noMatch);
            }
            if (typeof parsed.conversation_id === "string") {
              setConversationId(parsed.conversation_id);
              setHistoryLoaded(true);
            }
            if (typeof parsed.message_id === "string") {
              setAssistantId(parsed.message_id);
            }
          } catch {
            textBuffer = `${line}\n${textBuffer}`;
            break;
          }
        }
      }
    } catch {
      upsertAssistant("Không thể kết nối. Vui lòng thử lại! Nếu AI đã bị lỗi, credit sẽ được hoàn qua hệ thống.");
    } finally {
      await refetchSubscription();
      setIsLoading(false);
    }
  };

  const startWidgetDrag = (event: ReactPointerEvent<HTMLElement>, mode: DragState["mode"]) => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      active: true,
      moved: false,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: mode === "panel" ? panelPosition : widgetPosition,
      size: mode === "panel" ? getPanelSize() : { width: LAUNCHER_SIZE, height: LAUNCHER_SIZE },
    };
    setIsDraggingWidget(true);
  };

  const moveWidget = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState?.active) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragState.moved = true;
    }

    setWidgetPosition(
      clampPosition(
        {
          x: dragState.startPosition.x + deltaX,
          y: dragState.startPosition.y + deltaY,
        },
        dragState.size,
      ),
    );
  };

  const stopWidgetDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState?.active) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
    setIsDraggingWidget(false);

    if (dragState.mode === "launcher" && !dragState.moved) {
      setOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onPointerDown={(event) => startWidgetDrag(event, "launcher")}
            onPointerMove={moveWidget}
            onPointerUp={stopWidgetDrag}
            onPointerCancel={stopWidgetDrag}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
              }
            }}
            style={{ left: widgetPosition.x, top: widgetPosition.y }}
            title="Kéo để di chuyển EduBot"
            className={`fixed z-50 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-elevated transition-shadow hover:shadow-glow ${
              isDraggingWidget ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{ left: panelPosition.x, top: panelPosition.y }}
            className="fixed z-50 flex h-[520px] max-h-[calc(100vh-32px)] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-elevated"
          >
            <div
              onPointerDown={(event) => startWidgetDrag(event, "panel")}
              onPointerMove={moveWidget}
              onPointerUp={stopWidgetDrag}
              onPointerCancel={stopWidgetDrag}
              title="Kéo để di chuyển EduBot"
              className={`flex touch-none select-none items-center justify-between gradient-primary px-4 py-3 text-primary-foreground ${
                isDraggingWidget ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">EduBot AI</p>
                  <p className="truncate text-[10px] opacity-80">
                    {subscriptionLoading
                      ? "Đang tải AI credits..."
                      : isLoggedIn
                        ? `Còn ${aiCreditsRemaining} credits · mỗi tin ${CHAT_AI_COST} credit`
                        : "Đăng nhập để dùng AI"}
                  </p>
                </div>
              </div>
              <button
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                aria-label="Đóng EduBot"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoggedIn && messages.length > 0 && (
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <span className="text-[11px] text-muted-foreground">
                  Lịch sử EduBot được lưu cho tài khoản của bạn.
                </span>
                <button
                  type="button"
                  onClick={clearHistory}
                  disabled={historyActionLoading || isLoading}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-destructive disabled:opacity-60"
                >
                  {historyActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Xóa lịch sử
                </button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyLoading && (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải lịch sử EduBot...
                </div>
              )}

              {!historyLoading && messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Chào bạn!</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Xin chào, mình là EduBot. Mình có thể giúp bạn tìm khóa học, giải thích kỹ năng học tập, đặt lịch, thanh toán, dùng VET Plus, voucher và cài đặt tài khoản. Tính năng này dùng 1 AI credit.
                  </p>
                  <div className="space-y-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-left text-xs text-foreground hover:border-primary hover:bg-accent transition-colors"
                      >
                        <Sparkles className="mr-1.5 inline h-3 w-3 text-primary" />
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={message.id ?? index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex max-w-[85%] flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`w-fit max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        message.role === "user"
                          ? "gradient-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}
                    >
                      {renderMessageContent(message.content)}
                    </div>
                    {message.role === "user" && isPasswordHelpQuestion(message.content) ? (
                      <PasswordSafetyNotice />
                    ) : null}
                    {message.role === "assistant" && message.noMatch ? (
                      <NoMatchPanel
                        info={message.noMatch}
                        onCreateRequest={() =>
                          toast({
                            title: "Đã ghi nhận nhu cầu học",
                            description: "Tính năng ghi nhận nhu cầu sẽ được hoàn thiện sau.",
                          })
                        }
                      />
                    ) : null}
                    {message.role === "assistant" && !message.noMatch && message.recommendations?.length ? (
                      <CourseRecommendationCards courses={message.recommendations} />
                    ) : null}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t bg-background p-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Hỏi EduBot..."
                  className="flex-1 rounded-xl border bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || subscriptionLoading || historyLoading || !input.trim()}
                  className="h-10 w-10 rounded-xl gradient-primary border-0 text-primary-foreground shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AiCreditUpgradeDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen} />
    </>
  );
}
