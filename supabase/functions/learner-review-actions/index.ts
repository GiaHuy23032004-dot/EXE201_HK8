import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = getBearerToken(req);
    if (!jwt) return json({ error: "Missing authorization token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server env not configured" }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    const currentUser = userData.user;
    if (userError || !currentUser) return json({ error: "Invalid authorization token" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action !== "create_review") return json({ error: "Invalid action" }, 400);

    const bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
    const rating = Number(body.rating);
    const comment = typeof body.comment === "string" ? body.comment.trim() : null;

    if (!bookingId) return json({ error: "Thiếu booking_id để đánh giá." }, 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: "Vui lòng chọn số sao từ 1 đến 5." }, 400);
    }

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("id, course_id, learner_id, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking || booking.learner_id !== currentUser.id) {
      return json({ error: "Bạn chỉ có thể đánh giá booking thuộc về mình." }, 403);
    }
    if (booking.status !== "completed") {
      return json({ error: "Bạn chỉ có thể đánh giá sau khi buổi học đã hoàn thành." }, 400);
    }

    const { data: existingReview, error: existingError } = await adminClient
      .from("reviews")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingReview) return json({ error: "Bạn đã đánh giá booking này rồi." }, 409);

    const { data: review, error: reviewError } = await adminClient
      .from("reviews")
      .insert({
        course_id: booking.course_id,
        booking_id: booking.id,
        learner_id: currentUser.id,
        rating,
        comment,
      })
      .select()
      .single();

    if (reviewError) {
      if (reviewError.code === "23505") {
        return json({ error: "Bạn đã đánh giá booking này rồi." }, 409);
      }
      throw reviewError;
    }

    return json({ success: true, review });
  } catch (error) {
    console.error("learner-review-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
