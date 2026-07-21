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

type CourseAction =
  | "list_courses"
  | "get_course_detail"
  | "approve_course"
  | "reject_course"
  | "hide_course"
  | "unhide_course"
  | "delete_course_if_safe"
  | "get_course_metrics"
  | "get_related_reports";

const countByCourseId = async (client: any, table: string, courseIds: string[]) => {
  const map = new Map<string, number>();
  if (courseIds.length === 0) return map;

  const { data, error } = await client
    .from(table)
    .select("course_id")
    .in("course_id", courseIds);

  if (error) throw error;

  (data ?? []).forEach((row: { course_id: string | null }) => {
    if (!row.course_id) return;
    map.set(row.course_id, (map.get(row.course_id) ?? 0) + 1);
  });

  return map;
};

const countCompletedBookingsByCourseId = async (client: any, courseIds: string[]) => {
  const map = new Map<string, number>();
  if (courseIds.length === 0) return map;

  const { data, error } = await client
    .from("bookings")
    .select("course_id")
    .in("course_id", courseIds)
    .eq("status", "completed");

  if (error) throw error;

  (data ?? []).forEach((row: { course_id: string | null }) => {
    if (!row.course_id) return;
    map.set(row.course_id, (map.get(row.course_id) ?? 0) + 1);
  });

  return map;
};

const getRelatedCounts = async (client: any, courseIds: string[]) => {
  const [bookings, completedBookings, reviews, transactions, reports] = await Promise.all([
    countByCourseId(client, "bookings", courseIds),
    countCompletedBookingsByCourseId(client, courseIds),
    countByCourseId(client, "reviews", courseIds),
    countByCourseId(client, "transactions", courseIds),
    countByCourseId(client, "reports", courseIds),
  ]);

  const counts = new Map<string, { bookings: number; completed_bookings: number; reviews: number; transactions: number; reports: number }>();
  courseIds.forEach((courseId) => {
    counts.set(courseId, {
      bookings: bookings.get(courseId) ?? 0,
      completed_bookings: completedBookings.get(courseId) ?? 0,
      reviews: reviews.get(courseId) ?? 0,
      transactions: transactions.get(courseId) ?? 0,
      reports: reports.get(courseId) ?? 0,
    });
  });

  return counts;
};

const enrichCourses = async (client: any, courses: any[]) => {
  const courseIds = courses.map((course) => course.id);
  const mentorIds = Array.from(new Set(courses.map((course) => course.mentor_id).filter(Boolean)));

  const [{ data: mentors, error: mentorsError }, counts] = await Promise.all([
    mentorIds.length
      ? client.from("profiles").select("user_id, name, email, phone, avatar_url").in("user_id", mentorIds)
      : Promise.resolve({ data: [], error: null }),
    getRelatedCounts(client, courseIds),
  ]);

  if (mentorsError) throw mentorsError;

  const mentorById = new Map((mentors ?? []).map((mentor: any) => [mentor.user_id, mentor]));

  return courses.map((course) => {
    const related = counts.get(course.id) ?? { bookings: 0, completed_bookings: 0, reviews: 0, transactions: 0, reports: 0 };
    const relatedTotal = related.bookings + related.reviews + related.transactions + related.reports;

    return {
      ...course,
      mentor: mentorById.get(course.mentor_id) ?? null,
      counts: related,
      completed_bookings_count: related.completed_bookings,
      can_delete: relatedTotal === 0,
    };
  });
};

const getCourseReports = async (client: any, courseId: string) => {
  const { data, error } = await client
    .from("reports")
    .select("id, title, reason, status, created_at, admin_verdict")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
};

const getCourseDetail = async (client: any, courseId: string) => {
  const { data: course, error: courseError } = await client
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return null;

  const [enrichedCourses, schedulesResult, reports] = await Promise.all([
    enrichCourses(client, [course]),
    client
      .from("course_schedules")
      .select("id, day_of_week, start_time, end_time, created_at")
      .eq("course_id", courseId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    getCourseReports(client, courseId),
  ]);

  if (schedulesResult.error) throw schedulesResult.error;

  return {
    ...enrichedCourses[0],
    course_schedules: schedulesResult.data ?? [],
    related_reports: reports,
  };
};

const getCourseOrFail = async (client: any, courseId: string) => {
  const { data, error } = await client
    .from("courses")
    .select("id, status, is_hidden")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Course not found");
  return data;
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

    if (userError || !currentUser) {
      return json({ error: "Invalid authorization token" }, 401);
    }

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) throw adminRoleError;
    if (adminRole?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as CourseAction | undefined;
    const courseId = typeof body.courseId === "string" ? body.courseId : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "list_courses") {
      const { data: courses, error } = await adminClient
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return json({ courses: await enrichCourses(adminClient, courses ?? []) });
    }

    if (!courseId) return json({ error: "Missing courseId" }, 400);

    if (action === "get_course_detail") {
      const detail = await getCourseDetail(adminClient, courseId);
      if (!detail) return json({ error: "Course not found" }, 404);
      return json({ course: detail });
    }

    if (action === "get_related_reports") {
      return json({ reports: await getCourseReports(adminClient, courseId) });
    }

    if (action === "get_course_metrics") {
      const counts = await getRelatedCounts(adminClient, [courseId]);
      return json({ counts: counts.get(courseId) ?? { bookings: 0, completed_bookings: 0, reviews: 0, transactions: 0, reports: 0 } });
    }

    const now = new Date().toISOString();

    if (action === "approve_course") {
      const course = await getCourseOrFail(adminClient, courseId);
      if (!["pending", "rejected"].includes(String(course.status))) {
        return json({ error: "Chỉ có thể duyệt khóa học đang chờ duyệt hoặc đã bị từ chối." }, 400);
      }

      const { error } = await adminClient
        .from("courses")
        .update({
          status: "approved",
          reviewed_by: currentUser.id,
          reviewed_at: now,
          rejection_reason: null,
          admin_note: null,
          is_hidden: false,
          hidden_reason: null,
          hidden_at: null,
          hidden_by: null,
        })
        .eq("id", courseId);

      if (error) throw error;
      return json({ success: true, course: await getCourseDetail(adminClient, courseId) });
    }

    if (action === "reject_course") {
      if (!reason) return json({ error: "Vui lòng nhập lý do từ chối." }, 400);

      const course = await getCourseOrFail(adminClient, courseId);
      if (!["pending", "approved"].includes(String(course.status))) {
        return json({ error: "Chỉ có thể từ chối khóa học đang chờ duyệt hoặc đã duyệt." }, 400);
      }

      const { error } = await adminClient
        .from("courses")
        .update({
          status: "rejected",
          reviewed_by: currentUser.id,
          reviewed_at: now,
          rejection_reason: reason,
          admin_note: reason,
        })
        .eq("id", courseId);

      if (error) throw error;
      return json({ success: true, course: await getCourseDetail(adminClient, courseId) });
    }

    if (action === "hide_course") {
      if (!reason) return json({ error: "Vui lòng nhập lý do tạm ẩn khóa học." }, 400);
      const course = await getCourseOrFail(adminClient, courseId);
      if (course.status !== "approved" || course.is_hidden === true) {
        return json({ error: "Chỉ có thể tạm ẩn khóa học đã duyệt và đang hiển thị." }, 400);
      }

      const { error } = await adminClient
        .from("courses")
        .update({
          is_hidden: true,
          hidden_reason: reason,
          hidden_at: now,
          hidden_by: currentUser.id,
        })
        .eq("id", courseId);

      if (error) throw error;
      return json({ success: true, course: await getCourseDetail(adminClient, courseId) });
    }

    if (action === "unhide_course") {
      const course = await getCourseOrFail(adminClient, courseId);
      if (course.is_hidden !== true) {
        return json({ error: "Khóa học này chưa bị tạm ẩn." }, 400);
      }

      const { error } = await adminClient
        .from("courses")
        .update({
          is_hidden: false,
          hidden_reason: null,
          hidden_at: null,
          hidden_by: null,
        })
        .eq("id", courseId);

      if (error) throw error;
      return json({ success: true, course: await getCourseDetail(adminClient, courseId) });
    }

    if (action === "delete_course_if_safe") {
      const counts = await getRelatedCounts(adminClient, [courseId]);
      const related = counts.get(courseId) ?? { bookings: 0, reviews: 0, transactions: 0, reports: 0 };
      const relatedTotal = related.bookings + related.reviews + related.transactions + related.reports;

      if (relatedTotal > 0) {
        return json({
          error: "Không thể xóa khóa học đã có dữ liệu liên quan. Hãy dùng Tạm ẩn thay thế.",
          counts: related,
        }, 400);
      }

      const { error } = await adminClient.from("courses").delete().eq("id", courseId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-course-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
