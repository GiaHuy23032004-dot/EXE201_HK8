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

type ReportType = "course" | "mentor" | "comment" | "payment";

const VALID_TYPES = new Set<ReportType>(["course", "mentor", "comment", "payment"]);
const TITLE_MAX_LENGTH = 120;
const REASON_MAX_LENGTH = 160;
const DETAIL_MIN_LENGTH = 20;
const DETAIL_MAX_LENGTH = 1200;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTime(value: string | null | undefined) {
  const [hours = "0", minutes = "0", seconds = "0"] = String(value ?? "00:00:00").split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
}

function hasStarted(booking: { booking_date: string; start_time: string }) {
  const startsAt = new Date(`${booking.booking_date}T${parseTime(booking.start_time)}+07:00`);
  if (Number.isNaN(startsAt.getTime())) return false;
  return startsAt.getTime() <= Date.now();
}

function isNoShowReason(reason: string) {
  const lower = reason.toLowerCase();
  return lower.includes("không thực hiện")
    || lower.includes("không tham gia")
    || lower.includes("khong thuc hien")
    || lower.includes("khong tham gia")
    || lower.includes("no-show");
}

async function hasPendingDuplicate(client: any, filters: Record<string, string | null>) {
  let query = client
    .from("reports")
    .select("id")
    .eq("reporter_id", filters.reporter_id)
    .eq("type", filters.type)
    .eq("status", "pending");

  for (const [key, value] of Object.entries(filters)) {
    if (key === "reporter_id" || key === "type") continue;
    query = value ? query.eq(key, value) : query.is(key, null);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function getProfile(client: any, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("user_id, name, email, role, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

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
    if (action !== "create_report") return json({ error: "Invalid action" }, 400);

    const type = body.type as ReportType;
    const title = normalizeText(body.title);
    const reason = normalizeText(body.reason);
    const detail = normalizeText(body.detail);
    const courseId = normalizeText(body.courseId) || null;
    const reportedUserIdInput = normalizeText(body.reportedUserId) || null;
    const bookingId = normalizeText(body.bookingId) || null;
    const transactionId = normalizeText(body.transactionId) || null;
    const commentId = normalizeText(body.commentId) || null;

    if (!VALID_TYPES.has(type)) return json({ error: "Loại báo cáo không hợp lệ." }, 400);
    if (!title) return json({ error: "Vui lòng nhập tiêu đề báo cáo." }, 400);
    if (title.length > TITLE_MAX_LENGTH) {
      return json({ error: "Tiêu đề báo cáo không được vượt quá 120 ký tự." }, 400);
    }
    if (!reason) return json({ error: "Vui lòng chọn lý do báo cáo." }, 400);
    if (reason.length > REASON_MAX_LENGTH) {
      return json({ error: "Lý do báo cáo không được vượt quá 160 ký tự." }, 400);
    }
    if (detail.length < DETAIL_MIN_LENGTH || detail.length > DETAIL_MAX_LENGTH) {
      return json({ error: "Nội dung báo cáo phải từ 20 đến 1200 ký tự." }, 400);
    }

    let resolvedCourseId: string | null = null;
    let resolvedReportedUserId: string | null = null;
    let resolvedBookingId: string | null = null;
    let resolvedTransactionId: string | null = null;
    let resolvedCommentId: string | null = null;
    let snapshot: Record<string, unknown> = {};

    if (type === "course") {
      if (!courseId) return json({ error: "Thiếu khóa học cần báo cáo." }, 400);

      const { data: course, error } = await adminClient
        .from("courses")
        .select("id, title, mentor_id, status, is_hidden, category")
        .eq("id", courseId)
        .maybeSingle();

      if (error) throw error;
      if (!course || course.status !== "approved" || course.is_hidden === true) {
        return json({ error: "Chỉ có thể báo cáo khóa học đang được hiển thị." }, 400);
      }
      if (course.mentor_id === currentUser.id) {
        return json({ error: "Bạn không thể báo cáo khóa học của chính mình." }, 400);
      }
      if (await hasPendingDuplicate(adminClient, { reporter_id: currentUser.id, type, course_id: course.id })) {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho khóa học này." }, 409);
      }

      resolvedCourseId = course.id;
      resolvedReportedUserId = course.mentor_id;
      snapshot = { course };
    }

    if (type === "mentor") {
      if (!reportedUserIdInput) return json({ error: "Thiếu mentor cần báo cáo." }, 400);
      if (reportedUserIdInput === currentUser.id) return json({ error: "Bạn không thể báo cáo chính mình." }, 400);

      const profile = await getProfile(adminClient, reportedUserIdInput);
      if (!profile || profile.role !== "mentor") return json({ error: "Không tìm thấy hồ sơ mentor hợp lệ." }, 400);
      if (await hasPendingDuplicate(adminClient, { reporter_id: currentUser.id, type, reported_user_id: profile.user_id })) {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho mentor này." }, 409);
      }

      resolvedReportedUserId = profile.user_id;
      snapshot = { mentor: profile };
    }

    if (type === "payment") {
      if (!bookingId && !transactionId) {
        return json({ error: "Báo cáo thanh toán/buổi học cần booking_id hoặc transaction_id." }, 400);
      }

      let booking: any = null;
      let transaction: any = null;

      if (transactionId) {
        const { data, error } = await adminClient
          .from("transactions")
          .select("id, booking_id, learner_id, mentor_id, course_id, amount, status, reference_code")
          .eq("id", transactionId)
          .maybeSingle();

        if (error) throw error;
        if (!data || data.learner_id !== currentUser.id) {
          return json({ error: "Bạn chỉ có thể báo cáo giao dịch thuộc về mình." }, 403);
        }
        transaction = data;
      }

      const targetBookingId = bookingId || transaction?.booking_id || null;
      if (targetBookingId) {
        const { data, error } = await adminClient
          .from("bookings")
          .select("id, course_id, mentor_id, learner_id, booking_date, start_time, end_time, status, total_price")
          .eq("id", targetBookingId)
          .maybeSingle();

        if (error) throw error;
        if (!data || data.learner_id !== currentUser.id) {
          return json({ error: "Bạn chỉ có thể báo cáo buổi học thuộc về mình." }, 403);
        }
        booking = data;
      }

      if (!booking && !transaction) {
        return json({ error: "Không tìm thấy booking/giao dịch hợp lệ để báo cáo." }, 400);
      }

      if (isNoShowReason(reason)) {
        if (!booking) return json({ error: "Báo cáo vắng mặt cần booking hợp lệ." }, 400);
        if (!hasStarted(booking)) {
          return json({ error: "Chỉ có thể báo cáo mentor vắng mặt sau khi buổi học đã bắt đầu." }, 400);
        }
      }

      resolvedBookingId = booking?.id ?? null;
      resolvedTransactionId = transaction?.id ?? null;
      resolvedCourseId = booking?.course_id ?? transaction?.course_id ?? null;
      resolvedReportedUserId = booking?.mentor_id ?? transaction?.mentor_id ?? null;

      if (resolvedReportedUserId === currentUser.id) {
        return json({ error: "Bạn không thể báo cáo chính mình." }, 400);
      }
      if (resolvedBookingId && await hasPendingDuplicate(adminClient, { reporter_id: currentUser.id, type, booking_id: resolvedBookingId })) {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho booking này." }, 409);
      }
      if (!resolvedBookingId && resolvedTransactionId && await hasPendingDuplicate(adminClient, { reporter_id: currentUser.id, type, transaction_id: resolvedTransactionId })) {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho giao dịch này." }, 409);
      }

      snapshot = { booking, transaction };
    }

    if (type === "comment") {
      if (!commentId) return json({ error: "Thiếu bình luận cần báo cáo." }, 400);

      const { data: comment, error } = await adminClient
        .from("reviews")
        .select("id, course_id, learner_id, comment, created_at")
        .eq("id", commentId)
        .maybeSingle();

      if (error) throw error;
      if (!comment || !comment.comment) return json({ error: "Không tìm thấy bình luận hợp lệ." }, 400);
      if (comment.learner_id === currentUser.id) return json({ error: "Bạn không thể báo cáo bình luận của chính mình." }, 400);
      if (await hasPendingDuplicate(adminClient, { reporter_id: currentUser.id, type, comment_id: comment.id })) {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho bình luận này." }, 409);
      }

      resolvedCommentId = comment.id;
      resolvedCourseId = comment.course_id;
      resolvedReportedUserId = comment.learner_id;
      snapshot = { comment };
    }

    const { data: report, error: reportError } = await adminClient
      .from("reports")
      .insert({
        type,
        title,
        reason,
        detail,
        reporter_id: currentUser.id,
        reported_user_id: resolvedReportedUserId,
        course_id: resolvedCourseId,
        booking_id: resolvedBookingId,
        transaction_id: resolvedTransactionId,
        comment_id: resolvedCommentId,
        reviewed_target_snapshot: snapshot,
        status: "pending",
      })
      .select()
      .single();

    if (reportError) {
      if (reportError.code === "23505") {
        return json({ error: "Bạn đã có một báo cáo đang chờ xử lý cho nội dung này." }, 409);
      }
      throw reportError;
    }

    return json({ success: true, report });
  } catch (error) {
    console.error("learner-report-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
