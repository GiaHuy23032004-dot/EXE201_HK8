import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AnalyticsEventType =
  | "page_view"
  | "search_submit"
  | "map_view"
  | "map_filter_apply"
  | "course_view"
  | "course_detail_click"
  | "booking_start"
  | "booking_created"
  | "payment_start"
  | "payment_success"
  | "payment_failed"
  | "review_submitted"
  | "ai_chat_message"
  | "ai_course_recommendation_click";

export type AnalyticsEventPayload = {
  route?: string;
  pageTitle?: string;
  courseId?: string | null;
  mentorId?: string | null;
  bookingId?: string | null;
  transactionId?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

const VISITOR_KEY = "vet_analytics_visitor_id";
const SESSION_KEY = "vet_analytics_session_id";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getStorageId = (storage: Storage | null, key: string) => {
  if (!storage) return createId();
  const existing = storage.getItem(key);
  if (existing) return existing;
  const generated = createId();
  storage.setItem(key, generated);
  return generated;
};

const getVisitorId = () => {
  if (typeof window === "undefined") return createId();
  return getStorageId(window.localStorage, VISITOR_KEY);
};

const getSessionId = () => {
  if (typeof window === "undefined") return createId();
  return getStorageId(window.sessionStorage, SESSION_KEY);
};

export function useAnalyticsTracker() {
  const { session } = useAuth();

  const trackEvent = useCallback(
    async (eventType: AnalyticsEventType, payload: AnalyticsEventPayload = {}) => {
      try {
        const { error } = await supabase.functions.invoke("track-event", {
          headers: session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : undefined,
          body: {
            eventType,
            visitorId: getVisitorId(),
            sessionId: getSessionId(),
            route: payload.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
            pageTitle: payload.pageTitle ?? (typeof document !== "undefined" ? document.title : undefined),
            courseId: payload.courseId ?? undefined,
            mentorId: payload.mentorId ?? undefined,
            bookingId: payload.bookingId ?? undefined,
            transactionId: payload.transactionId ?? undefined,
            source: payload.source,
            metadata: payload.metadata ?? {},
          },
        });

        if (error && import.meta.env.DEV) {
          console.warn("track-event failed", { eventType, error });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("track-event unexpected failure", { eventType, error });
        }
      }
    },
    [session?.access_token],
  );

  return { trackEvent };
}
