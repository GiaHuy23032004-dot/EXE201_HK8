import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const REPORT_EVIDENCE_BUCKET = "report-evidence";
const URL_PATTERN = /^https?:\/\//i;
const AUTO_HIDE_REASON = "Auto-hidden due to high report volume";
const TRUST_FRAUD_PATTERN = /(giả mạo|mạo danh|giả danh|chứng chỉ giả|bằng giả|hồ sơ giả|lừa đảo|fraud|fake|scam|impersonat|fake identity|fake credential|fake certificate)/i;

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

type ReportAction =
  | "list_reports"
  | "get_report_detail"
  | "resolve_report"
  | "dismiss_report"
  | "mark_appealed"
  | "add_mentor_strike"
  | "hide_related_course"
  | "get_reporter_history"
  | "get_related_reports"
  | "apply_penalty"
  | "get_mentor_violation_summary"
  | "auto_hide_risky_courses";

type PenaltyAction = "dismiss" | "strike_1" | "strike_2" | "strike_3";

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const isActiveStrike = (strike: { expires_at: string | null }) =>
  !strike.expires_at || new Date(strike.expires_at).getTime() > Date.now();

const countByCourseId = async (client: any, table: string, courseId: string) => {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (error) throw error;
  return count ?? 0;
};

const resolveAttachmentUrl = async (client: any, attachment: any) => {
  const storedPath = attachment.file_path || attachment.file_url;
  if (!storedPath || URL_PATTERN.test(storedPath)) return attachment;

  const { data, error } = await client.storage
    .from(REPORT_EVIDENCE_BUCKET)
    .createSignedUrl(storedPath, 60 * 60);

  if (error) return attachment;
  return {
    ...attachment,
    file_path: storedPath,
    file_url: data?.signedUrl ?? attachment.file_url,
  };
};

const getProfiles = async (client: any, userIds: string[]) => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("profiles")
    .select("user_id, name, email, phone, avatar_url, role, is_blocked, created_at")
    .in("user_id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((profile: any) => [profile.user_id, profile]));
};

const getCoursePendingReportCounts = async (client: any, courseIds: string[]) => {
  const ids = Array.from(new Set(courseIds.filter(Boolean)));
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  const { data, error } = await client
    .from("reports")
    .select("course_id")
    .in("course_id", ids)
    .eq("status", "pending");

  if (error) throw error;

  (data ?? []).forEach((report: { course_id: string | null }) => {
    if (!report.course_id) return;
    counts.set(report.course_id, (counts.get(report.course_id) ?? 0) + 1);
  });

  return counts;
};

const getMentorViolationSummary = async (client: any, mentorId: string | null) => {
  if (!mentorId) {
    return { active_count: 0, total_count: 0, strikes: [] };
  }

  const { data, error } = await client
    .from("mentor_strikes")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const strikes = data ?? [];
  return {
    active_count: strikes.filter(isActiveStrike).length,
    total_count: strikes.length,
    strikes,
  };
};

const autoHideRiskyCourses = async (client: any, adminUserId: string) => {
  const { data: pendingReports, error } = await client
    .from("reports")
    .select("course_id")
    .eq("status", "pending")
    .not("course_id", "is", null);

  if (error) throw error;

  const counts = new Map<string, number>();
  (pendingReports ?? []).forEach((report: { course_id: string | null }) => {
    if (!report.course_id) return;
    counts.set(report.course_id, (counts.get(report.course_id) ?? 0) + 1);
  });

  const riskyCourseIds = Array.from(counts.entries())
    .filter(([, count]) => count >= 5)
    .map(([courseId]) => courseId);

  if (riskyCourseIds.length === 0) {
    return { hiddenCourseIds: [], counts: Object.fromEntries(counts) };
  }

  const now = new Date().toISOString();
  const { error: hideError } = await client
    .from("courses")
    .update({
      is_hidden: true,
      hidden_reason: AUTO_HIDE_REASON,
      hidden_at: now,
      hidden_by: adminUserId,
    })
    .in("id", riskyCourseIds);

  if (hideError) throw hideError;

  return { hiddenCourseIds: riskyCourseIds, counts: Object.fromEntries(counts) };
};

const enrichReports = async (client: any, reports: any[]) => {
  const userIds = reports.flatMap((report) => [report.reporter_id, report.reported_user_id]).filter(Boolean);
  const courseIds = Array.from(new Set(reports.map((report) => report.course_id).filter(Boolean)));

  const [profileMap, coursesResult, attachmentsResult, pendingCounts] = await Promise.all([
    getProfiles(client, userIds),
    courseIds.length
      ? client
          .from("courses")
          .select("id, title, mentor_id, status, is_hidden, hidden_reason, price, category, format, image_url")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    reports.length
      ? client
          .from("report_attachments")
          .select("*")
          .in("report_id", reports.map((report) => report.id))
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    getCoursePendingReportCounts(client, courseIds),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const signedAttachments = await Promise.all(
    (attachmentsResult.data ?? []).map((attachment: any) => resolveAttachmentUrl(client, attachment)),
  );

  const courseById = new Map((coursesResult.data ?? []).map((course: any) => [course.id, course]));
  const attachmentsByReport = new Map<string, any[]>();
  signedAttachments.forEach((attachment: any) => {
    attachmentsByReport.set(attachment.report_id, [...(attachmentsByReport.get(attachment.report_id) ?? []), attachment]);
  });

  return reports.map((report) => {
    const course = report.course_id ? courseById.get(report.course_id) ?? null : null;
    const pendingReportCount = report.course_id ? pendingCounts.get(report.course_id) ?? 0 : 0;
    const autoHidden = Boolean(
      course && course.is_hidden && (course.hidden_reason === AUTO_HIDE_REASON || pendingReportCount >= 5),
    );

    return {
      ...report,
      reporter: profileMap.get(report.reporter_id) ?? null,
      reported_user: report.reported_user_id ? profileMap.get(report.reported_user_id) ?? null : null,
      course,
      course_pending_report_count: pendingReportCount,
      auto_hidden: autoHidden,
      attachments: attachmentsByReport.get(report.id) ?? [],
    };
  });
};

const getReportDetail = async (client: any, reportId: string) => {
  const { data: report, error } = await client
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const [detail] = await enrichReports(client, [report]);
  const mentorId = detail.reported_user?.role === "mentor"
    ? detail.reported_user_id
    : detail.course?.mentor_id ?? null;

  const [courseCounts, violationSummary] = await Promise.all([
    report.course_id
      ? Promise.all([
          countByCourseId(client, "bookings", report.course_id),
          countByCourseId(client, "reviews", report.course_id),
          countByCourseId(client, "reports", report.course_id),
        ]).then(([bookings, reviews, reports]) => ({ bookings, reviews, reports }))
      : Promise.resolve(null),
    getMentorViolationSummary(client, mentorId),
  ]);

  return {
    ...detail,
    mentor_id_for_penalty: mentorId,
    mentor_strikes: violationSummary.strikes,
    mentor_violation_summary: violationSummary,
    course_counts: courseCounts,
  };
};

const getReporterHistory = async (client: any, reporterId: string) => {
  const { data: reports, error } = await client
    .from("reports")
    .select("*")
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = await enrichReports(client, reports ?? []);
  const summary = {
    total: rows.length,
    pending: rows.filter((report) => report.status === "pending").length,
    resolved: rows.filter((report) => report.status === "resolved").length,
    dismissed: rows.filter((report) => report.status === "dismissed").length,
    appealed: rows.filter((report) => report.status === "appealed").length,
  };

  return { summary, reports: rows };
};

const getRelatedReports = async (client: any, detail: any) => {
  const related = new Map<string, any>();

  if (detail.course_id) {
    const { data, error } = await client
      .from("reports")
      .select("*")
      .eq("course_id", detail.course_id)
      .neq("id", detail.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    (data ?? []).forEach((report: any) => related.set(report.id, report));
  }

  if (detail.reported_user_id) {
    const { data, error } = await client
      .from("reports")
      .select("*")
      .eq("reported_user_id", detail.reported_user_id)
      .neq("id", detail.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    (data ?? []).forEach((report: any) => related.set(report.id, report));
  }

  return enrichReports(client, Array.from(related.values()).slice(0, 20));
};

const resolveMentorTarget = (detail: any) => {
  const mentorId = detail.mentor_id_for_penalty || (detail.reported_user?.role === "mentor" ? detail.reported_user_id : null);
  return mentorId || null;
};

const ensureNoStrikeForReport = async (client: any, reportId: string) => {
  const { data, error } = await client
    .from("mentor_strikes")
    .select("id")
    .eq("report_id", reportId)
    .limit(1);

  if (error) throw error;
  if ((data ?? []).length > 0) {
    throw new Error("Báo cáo này đã có gậy phạt. Không thể tạo gậy trùng lặp.");
  }
};

const insertStrike = async (client: any, mentorId: string, reportId: string, level: number, reason: string) => {
  const expiresAt = level === 1 ? addDays(30) : level === 2 ? addDays(90) : null;
  const { error } = await client.from("mentor_strikes").insert({
    mentor_id: mentorId,
    report_id: reportId,
    level,
    reason,
    expires_at: expiresAt,
  });

  if (error) throw error;
};

const createRestriction = async (
  client: any,
  mentorId: string,
  reportId: string,
  adminUserId: string,
  restrictionType: "posting_suspended" | "account_locked" | "course_hidden",
  reason: string,
  expiresAt: string | null,
) => {
  const { error } = await client.from("mentor_restrictions").insert({
    mentor_id: mentorId,
    restriction_type: restrictionType,
    reason,
    expires_at: expiresAt,
    created_by: adminUserId,
    report_id: reportId,
  });

  if (error) throw error;
};

const recordBadgeEvent = async (
  client: any,
  mentorId: string,
  badgeType: string,
  eventType: "granted" | "suspended" | "revoked" | "restored",
  reason: string,
  adminUserId: string,
  reportId: string | null,
) => {
  const { error } = await client.from("mentor_badge_events").insert({
    mentor_id: mentorId,
    badge_type: badgeType,
    event_type: eventType,
    reason,
    created_by: adminUserId,
    report_id: reportId,
  });

  if (error) throw error;
};

const setTrustBadgeStatus = async (
  client: any,
  mentorId: string,
  badgeType: "vet_verified" | "certificate_verified" | "portfolio_verified" | "trusted_mentor",
  status: "active" | "suspended" | "revoked",
  eventType: "granted" | "suspended" | "revoked" | "restored",
  reason: string,
  adminUserId: string,
  reportId: string,
  suspendedUntil: string | null = null,
) => {
  const now = new Date().toISOString();
  const { error } = await client
    .from("mentor_trust_badges")
    .upsert({
      mentor_id: mentorId,
      badge_type: badgeType,
      status,
      public_visible: status === "active",
      reason,
      granted_by: adminUserId,
      granted_at: now,
      suspended_until: status === "suspended" ? suspendedUntil : null,
      revoked_at: status === "revoked" ? now : null,
      updated_at: now,
    }, { onConflict: "mentor_id,badge_type" });

  if (error) throw error;
  await recordBadgeEvent(client, mentorId, badgeType, eventType, reason, adminUserId, reportId);
};

const shouldRevokeVetVerified = (detail: any, verdict: string) => {
  const source = [
    verdict,
    detail.title,
    detail.reason,
    detail.detail,
    detail.admin_verdict,
  ]
    .filter(Boolean)
    .join(" ");
  return TRUST_FRAUD_PATTERN.test(source);
};

const applyPenalty = async (
  client: any,
  detail: any,
  adminUserId: string,
  penaltyAction: PenaltyAction,
  verdict: string,
  mentorEmailContent: string,
) => {
  if (!verdict) return { error: "Vui lòng nhập phán quyết Admin.", status: 400 };
  if (detail.status === "resolved" || detail.status === "dismissed") {
    return {
      error: "Báo cáo đã có kết quả. Hãy mở lại hồ sơ trước khi áp dụng hình phạt mới.",
      status: 400,
    };
  }

  const now = new Date().toISOString();

  if (penaltyAction === "dismiss") {
    const { error } = await client
      .from("reports")
      .update({
        status: "dismissed",
        admin_verdict: verdict,
        admin_email: mentorEmailContent || null,
        resolved_at: now,
      })
      .eq("id", detail.id);

    if (error) throw error;
    return { success: true };
  }

  const mentorId = resolveMentorTarget(detail);
  if (!mentorId) {
    return { error: "Chỉ có thể áp dụng gậy phạt cho tài khoản mentor.", status: 400 };
  }

  const { data: existingStrike, error: existingStrikeError } = await client
    .from("mentor_strikes")
    .select("id")
    .eq("report_id", detail.id)
    .limit(1);

  if (existingStrikeError) throw existingStrikeError;
  if ((existingStrike ?? []).length > 0) {
    return { error: "Báo cáo này đã có gậy phạt. Không thể tạo gậy trùng lặp.", status: 409 };
  }

  const level = penaltyAction === "strike_1" ? 1 : penaltyAction === "strike_2" ? 2 : 3;
  await insertStrike(client, mentorId, detail.id, level, verdict);

  if (penaltyAction === "strike_2") {
    await setTrustBadgeStatus(
      client,
      mentorId,
      "trusted_mentor",
      "suspended",
      "suspended",
      verdict,
      adminUserId,
      detail.id,
      addDays(90),
    );

    if (detail.course_id) {
      const { error: hideError } = await client
        .from("courses")
        .update({
          is_hidden: true,
          hidden_reason: verdict,
          hidden_at: now,
          hidden_by: adminUserId,
        })
        .eq("id", detail.course_id);
      if (hideError) throw hideError;

      await createRestriction(client, mentorId, detail.id, adminUserId, "course_hidden", verdict, null);
    }

    await createRestriction(client, mentorId, detail.id, adminUserId, "posting_suspended", verdict, addDays(7));
  }

  if (penaltyAction === "strike_3") {
    await setTrustBadgeStatus(
      client,
      mentorId,
      "trusted_mentor",
      "revoked",
      "revoked",
      verdict,
      adminUserId,
      detail.id,
    );

    if (shouldRevokeVetVerified(detail, verdict)) {
      await setTrustBadgeStatus(
        client,
        mentorId,
        "vet_verified",
        "revoked",
        "revoked",
        verdict,
        adminUserId,
        detail.id,
      );
    }

    const { error: blockError } = await client
      .from("profiles")
      .update({ is_blocked: true })
      .eq("user_id", mentorId);
    if (blockError) throw blockError;

    const { error: hideCoursesError } = await client
      .from("courses")
      .update({
        is_hidden: true,
        hidden_reason: verdict,
        hidden_at: now,
        hidden_by: adminUserId,
      })
      .eq("mentor_id", mentorId);
    if (hideCoursesError) throw hideCoursesError;

    await createRestriction(client, mentorId, detail.id, adminUserId, "account_locked", verdict, null);
  }

  const { error: reportError } = await client
    .from("reports")
    .update({
      status: "resolved",
      admin_verdict: verdict,
      admin_email: mentorEmailContent || null,
      resolved_at: now,
    })
    .eq("id", detail.id);

  if (reportError) throw reportError;
  return { success: true };
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

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) throw adminRoleError;
    if (adminRole?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as ReportAction | undefined;
    const reportId = typeof body.reportId === "string" ? body.reportId : null;
    const reporterId = typeof body.reporterId === "string" ? body.reporterId : null;
    const mentorId = typeof body.mentorId === "string" ? body.mentorId : null;
    const verdict = typeof body.verdict === "string" ? body.verdict.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const mentorEmailContent = typeof body.mentorEmailContent === "string"
      ? body.mentorEmailContent.trim()
      : typeof body.warningContent === "string"
        ? body.warningContent.trim()
        : "";
    const penaltyAction = body.penaltyAction as PenaltyAction | undefined;
    const strikeLevel = Number(body.strikeLevel);
    const strikeReason = typeof body.strikeReason === "string" ? body.strikeReason.trim() : "";

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "auto_hide_risky_courses") {
      return json({ success: true, result: await autoHideRiskyCourses(adminClient, currentUser.id) });
    }

    if (action === "list_reports") {
      await autoHideRiskyCourses(adminClient, currentUser.id);
      const { data: reports, error } = await adminClient
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ reports: await enrichReports(adminClient, reports ?? []) });
    }

    if (action === "get_reporter_history") {
      if (!reporterId) return json({ error: "Missing reporterId" }, 400);
      return json({ history: await getReporterHistory(adminClient, reporterId) });
    }

    if (action === "get_mentor_violation_summary") {
      if (!mentorId) return json({ error: "Missing mentorId" }, 400);
      return json({ summary: await getMentorViolationSummary(adminClient, mentorId) });
    }

    if (!reportId) return json({ error: "Missing reportId" }, 400);

    const detail = await getReportDetail(adminClient, reportId);
    if (!detail) return json({ error: "Report not found" }, 404);

    if (action === "get_report_detail") {
      return json({ report: detail });
    }

    if (action === "get_related_reports") {
      return json({ reports: await getRelatedReports(adminClient, detail) });
    }

    const now = new Date().toISOString();

    if (action === "apply_penalty") {
      if (!penaltyAction) return json({ error: "Vui lòng chọn hình thức xử lý." }, 400);
      if (!["dismiss", "strike_1", "strike_2", "strike_3"].includes(penaltyAction)) {
        return json({ error: "Hình thức xử lý không hợp lệ." }, 400);
      }

      const result = await applyPenalty(adminClient, detail, currentUser.id, penaltyAction, verdict, mentorEmailContent);
      if ("error" in result) return json({ error: result.error }, result.status);

      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    if (action === "resolve_report") {
      const legacyPenalty = body.createStrike === true
        ? Number(body.strikeLevel) === 2
          ? "strike_2"
          : Number(body.strikeLevel) === 3
            ? "strike_3"
            : "strike_1"
        : "strike_1";

      const result = await applyPenalty(
        adminClient,
        detail,
        currentUser.id,
        legacyPenalty,
        verdict,
        mentorEmailContent,
      );
      if ("error" in result) return json({ error: result.error }, result.status);
      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    if (action === "dismiss_report") {
      const result = await applyPenalty(adminClient, detail, currentUser.id, "dismiss", reason, mentorEmailContent);
      if ("error" in result) return json({ error: result.error }, result.status);
      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    if (action === "mark_appealed") {
      const { error } = await adminClient
        .from("reports")
        .update({ status: "appealed" })
        .eq("id", reportId);

      if (error) throw error;
      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    if (action === "add_mentor_strike") {
      if (![1, 2, 3].includes(strikeLevel)) return json({ error: "Vui lòng chọn mức gậy hợp lệ." }, 400);
      if (!strikeReason) return json({ error: "Vui lòng nhập lý do gậy phạt." }, 400);
      const targetMentorId = resolveMentorTarget(detail);
      if (!targetMentorId) return json({ error: "Chỉ có thể tạo gậy phạt cho tài khoản mentor." }, 400);
      await ensureNoStrikeForReport(adminClient, reportId);
      await insertStrike(adminClient, targetMentorId, reportId, strikeLevel, strikeReason);
      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    if (action === "hide_related_course") {
      if (!detail.course_id) return json({ error: "Báo cáo này không gắn với khóa học." }, 400);

      const { error } = await adminClient
        .from("courses")
        .update({
          is_hidden: true,
          hidden_reason: reason || detail.reason,
          hidden_at: now,
          hidden_by: currentUser.id,
        })
        .eq("id", detail.course_id);

      if (error) throw error;
      return json({ success: true, report: await getReportDetail(adminClient, reportId) });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-report-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
