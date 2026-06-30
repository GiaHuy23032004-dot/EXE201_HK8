import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const allowedEventTypes = new Set([
  "page_view",
  "search_submit",
  "map_view",
  "map_filter_apply",
  "course_view",
  "course_detail_click",
  "booking_start",
  "booking_created",
  "payment_start",
  "payment_success",
  "payment_failed",
  "review_submitted",
  "ai_chat_message",
  "ai_course_recommendation_click",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const asString = (value: unknown, maxLength = 500) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const asUuid = (value: unknown) => {
  const text = asString(value, 80);
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
};

const sanitizeMetadata = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const jsonText = JSON.stringify(value);
  if (jsonText.length > 5000) {
    return {
      truncated: true,
    };
  }

  return value as Record<string, unknown>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ success: false, error: "Server env not configured" }, 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const eventType = asString(body.eventType, 80);
    if (!eventType || !allowedEventTypes.has(eventType)) {
      return json({ success: false, error: "Invalid eventType" }, 400);
    }

    let userId: string | null = null;
    const jwt = getBearerToken(req);
    if (jwt) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await authClient.auth.getUser(jwt);
      if (error) {
        console.warn("track-event auth lookup failed", {
          message: error.message,
          name: error.name,
        });
      }
      userId = data.user?.id ?? null;
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await serviceClient.from("analytics_events").insert({
      event_type: eventType,
      user_id: userId,
      visitor_id: asString(body.visitorId, 120),
      session_id: asString(body.sessionId, 120),
      route: asString(body.route, 500),
      page_title: asString(body.pageTitle, 300),
      course_id: asUuid(body.courseId),
      mentor_id: asUuid(body.mentorId),
      booking_id: asUuid(body.bookingId),
      transaction_id: asUuid(body.transactionId),
      source: asString(body.source, 120),
      metadata: sanitizeMetadata(body.metadata),
    });

    if (error) {
      console.error("track-event insert failed", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return json({ success: false, error: "Could not track event" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("track-event unexpected error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    });
    return json({ success: false, error: "Unexpected error" }, 500);
  }
});
