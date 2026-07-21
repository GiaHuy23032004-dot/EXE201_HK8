import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFICATION_BUCKET = "mentor-verification";
const URL_PATTERN = /^https?:\/\//i;
const BADGE_TYPES = new Set(["vet_verified", "certificate_verified", "portfolio_verified", "trusted_mentor"]);
const BADGE_PUBLIC_META: Record<string, { label: string; description: string }> = {
  vet_verified: {
    label: "Đã xác minh bởi VET",
    description: "Hồ sơ mentor đã được VET kiểm tra.",
  },
  certificate_verified: {
    label: "Chứng chỉ đã đối chiếu",
    description: "Chứng chỉ hoặc bằng cấp đã được Admin đối chiếu.",
  },
  portfolio_verified: {
    label: "Portfolio đã kiểm tra",
    description: "Portfolio hoặc sản phẩm cá nhân đã được Admin kiểm tra.",
  },
  trusted_mentor: {
    label: "Mentor uy tín",
    description: "Mentor có lịch sử hoạt động đáng tin cậy trên VET.",
  },
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

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const isActiveStrike = (strike: { expires_at: string | null }) =>
  !strike.expires_at || new Date(strike.expires_at).getTime() > Date.now();

const normalizeStatus = (status: string | null | undefined) => {
  if (!status || status === "unverified" || status === "draft" || status === "not_submitted") {
    return "not_submitted";
  }
  return status === "revision_required" ? "revision_requested" : status;
};

const resolveProofFileUrl = async (client: any, proof: any) => {
  const path = proof.file_path || proof.metadata?.file_url;
  if (!path || URL_PATTERN.test(path)) return proof;

  const { data, error } = await client.storage.from(VERIFICATION_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return proof;
  return { ...proof, signed_file_url: data?.signedUrl ?? null };
};

const getProfiles = async (client: any, mentorIds: string[]) => {
  const ids = Array.from(new Set(mentorIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("profiles")
    .select("user_id, name, email, phone, avatar_url, bio, real_name, mentor_headline, teaching_fields, experience_years, city, portfolio_url, role, is_blocked, created_at")
    .in("user_id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((profile: any) => [profile.user_id, profile]));
};

const groupBy = <T extends Record<string, any>>(rows: T[], key: keyof T) => {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = row[key];
    if (!value) return;
    map.set(value, [...(map.get(value) ?? []), row]);
  });
  return map;
};

const fetchBadges = async (client: any, mentorIds: string[]) => {
  if (mentorIds.length === 0) return new Map<string, any[]>();
  const { data, error } = await client
    .from("mentor_trust_badges")
    .select("*")
    .in("mentor_id", mentorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return groupBy(data ?? [], "mentor_id");
};

const fetchProofs = async (client: any, mentorIds: string[]) => {
  if (mentorIds.length === 0) return new Map<string, any[]>();
  const { data, error } = await client
    .from("mentor_verification_proofs")
    .select("*")
    .in("mentor_id", mentorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return groupBy(data ?? [], "mentor_id");
};

const fetchStrikes = async (client: any, mentorIds: string[]) => {
  if (mentorIds.length === 0) return new Map<string, any[]>();
  const { data, error } = await client
    .from("mentor_strikes")
    .select("*")
    .in("mentor_id", mentorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return groupBy(data ?? [], "mentor_id");
};

const enrichVerificationRows = async (client: any, rows: any[]) => {
  const mentorIds = Array.from(new Set(rows.map((row) => row.mentor_id).filter(Boolean)));
  const [profileMap, proofsByMentor, badgesByMentor, strikesByMentor] = await Promise.all([
    getProfiles(client, mentorIds),
    fetchProofs(client, mentorIds),
    fetchBadges(client, mentorIds),
    fetchStrikes(client, mentorIds),
  ]);

  return rows.map((row) => {
    const proofs = proofsByMentor.get(row.mentor_id) ?? [];
    const badges = badgesByMentor.get(row.mentor_id) ?? [];
    const strikes = strikesByMentor.get(row.mentor_id) ?? [];
    return {
      ...row,
      status: normalizeStatus(row.status),
      profile: row.profile ?? profileMap.get(row.mentor_id) ?? null,
      evidence_count: proofs.length,
      approved_proof_count: proofs.filter((proof: any) => normalizeStatus(proof.status || proof.review_status) === "approved").length,
      proofs,
      trust_badges: badges,
      active_strike_count: strikes.filter(isActiveStrike).length,
      mentor_strikes: strikes,
    };
  });
};

const listMentorVerificationRequests = async (client: any, status: string) => {
  const { data: mentorProfiles, error: profileError } = await client
    .from("profiles")
    .select("user_id, name, email, phone, avatar_url, bio, real_name, mentor_headline, teaching_fields, experience_years, city, portfolio_url, role, is_blocked, created_at")
    .eq("role", "mentor")
    .order("created_at", { ascending: false });
  if (profileError) throw profileError;

  const mentorIds = (mentorProfiles ?? []).map((profile: any) => profile.user_id).filter(Boolean);
  if (mentorIds.length === 0) return [];

  const { data: verificationRows, error: verificationError } = await client
    .from("mentor_verifications")
    .select("*")
    .in("mentor_id", mentorIds)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (verificationError) throw verificationError;

  const verificationByMentor = new Map<string, any>();
  (verificationRows ?? []).forEach((row: any) => {
    if (!row.mentor_id || verificationByMentor.has(row.mentor_id)) return;
    verificationByMentor.set(row.mentor_id, row);
  });

  const rows = (mentorProfiles ?? []).map((profile: any) => {
    const verification = verificationByMentor.get(profile.user_id);
    if (verification) return { ...verification, status: normalizeStatus(verification.status), profile };

    return {
      id: `not-submitted-${profile.user_id}`,
      mentor_id: profile.user_id,
      status: "not_submitted",
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      admin_note: null,
      created_at: profile.created_at,
      profile,
    };
  });

  const enrichedRows = await enrichVerificationRows(client, rows);
  const normalizedFilter = normalizeStatus(status);
  if (status && status !== "all") {
    return enrichedRows.filter((row) => normalizeStatus(row.status) === normalizedFilter);
  }
  return enrichedRows;
};

const countByCourseId = async (client: any, table: string, courseIds: string[]) => {
  const map = new Map<string, number>();
  if (courseIds.length === 0) return map;
  const { data, error } = await client.from(table).select("course_id").in("course_id", courseIds);
  if (error) throw error;
  (data ?? []).forEach((row: any) => {
    if (!row.course_id) return;
    map.set(row.course_id, (map.get(row.course_id) ?? 0) + 1);
  });
  return map;
};

const getDetail = async (client: any, mentorId: string) => {
  const { data: verification, error: verificationError } = await client
    .from("mentor_verifications")
    .select("*")
    .eq("mentor_id", mentorId)
    .maybeSingle();
  if (verificationError) throw verificationError;

  const [
    profileMap,
    proofsResult,
    badgesByMentor,
    strikesByMentor,
    itemsResult,
    coursesResult,
    reportsResult,
  ] = await Promise.all([
    getProfiles(client, [mentorId]),
    client
      .from("mentor_verification_proofs")
      .select("*")
      .eq("mentor_id", mentorId)
      .order("created_at", { ascending: false }),
    fetchBadges(client, [mentorId]),
    fetchStrikes(client, [mentorId]),
    client
      .from("mentor_verification_items")
      .select("*")
      .eq("mentor_id", mentorId)
      .order("created_at", { ascending: false }),
    client
      .from("courses")
      .select("id, title, status, is_hidden, rating, review_count, students_count, created_at")
      .eq("mentor_id", mentorId)
      .order("created_at", { ascending: false }),
    client
      .from("reports")
      .select("id, title, reason, status, created_at, admin_verdict")
      .eq("reported_user_id", mentorId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (proofsResult.error) throw proofsResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (coursesResult.error) throw coursesResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const proofs = await Promise.all((proofsResult.data ?? []).map((proof: any) => resolveProofFileUrl(client, proof)));
  const courses = coursesResult.data ?? [];
  const courseIds = courses.map((course: any) => course.id);
  const [bookingsByCourse, reviewsByCourse] = await Promise.all([
    countByCourseId(client, "bookings", courseIds),
    countByCourseId(client, "reviews", courseIds),
  ]);

  const completedBookings = await Promise.all(
    courseIds.length
      ? [
          client
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("mentor_id", mentorId)
            .eq("status", "completed"),
        ]
      : [Promise.resolve({ count: 0, error: null })],
  );
  if (completedBookings[0].error) throw completedBookings[0].error;

  const ratingTotal = courses.reduce((sum: number, course: any) => sum + Number(course.rating || 0) * Number(course.review_count || 0), 0);
  const reviewTotal = courses.reduce((sum: number, course: any) => sum + Number(course.review_count || 0), 0);
  const profile = profileMap.get(mentorId) ?? null;
  if (!verification && !profile) return null;

  const baseVerification = verification ?? {
    id: `not-submitted-${mentorId}`,
    mentor_id: mentorId,
    status: "not_submitted",
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    admin_note: null,
    created_at: profile?.created_at ?? new Date(0).toISOString(),
  };

  return {
    ...baseVerification,
    status: normalizeStatus(baseVerification.status),
    profile,
    proofs,
    verification_items: itemsResult.data ?? [],
    trust_badges: badgesByMentor.get(mentorId) ?? [],
    mentor_strikes: strikesByMentor.get(mentorId) ?? [],
    reports: reportsResult.data ?? [],
    courses: courses.map((course: any) => ({
      ...course,
      bookings_count: bookingsByCourse.get(course.id) ?? 0,
      reviews_count: reviewsByCourse.get(course.id) ?? 0,
    })),
    summary: {
      courses_count: courses.length,
      completed_bookings_count: completedBookings[0].count ?? 0,
      reviews_count: reviewTotal,
      average_rating: reviewTotal > 0 ? ratingTotal / reviewTotal : 0,
      active_strike_count: (strikesByMentor.get(mentorId) ?? []).filter(isActiveStrike).length,
      reports_count: (reportsResult.data ?? []).length,
    },
  };
};

const isProfileComplete = (profile: any) => {
  if (!profile) return false;
  return Boolean(
    (profile.real_name || profile.name)?.trim?.() &&
      profile.avatar_url?.trim?.() &&
      profile.phone?.trim?.() &&
      (profile.bio?.trim?.().length ?? 0) >= 80 &&
      (Array.isArray(profile.teaching_fields) ? profile.teaching_fields.length > 0 : false) &&
      profile.experience_years !== null &&
      Number(profile.experience_years) >= 0,
  );
};

const validateApprovalRequirements = (detail: any) => {
  const proofs = detail.proofs ?? [];
  const distinctTypes = new Set(proofs.map((proof: any) => proof.proof_type).filter(Boolean)).size;
  const approvedProofs = proofs.filter((proof: any) => normalizeStatus(proof.status || proof.review_status) === "approved").length;

  return {
    profileComplete: isProfileComplete(detail.profile),
    hasEnoughProofs: proofs.length >= 2,
    hasDistinctTypes: distinctTypes >= 2,
    hasApprovedProofs: approvedProofs >= 2,
  };
};

const recordBadgeEvent = async (
  client: any,
  mentorId: string,
  badgeType: string,
  eventType: "granted" | "suspended" | "revoked" | "restored",
  reason: string | null,
  adminUserId: string,
  badgeId: string | null = null,
) => {
  const { error } = await client.from("mentor_badge_events").insert({
    mentor_id: mentorId,
    badge_id: badgeId,
    badge_type: badgeType,
    event_type: eventType,
    reason,
    created_by: adminUserId,
  });
  if (error) throw error;
};

const setBadgeStatus = async (
  client: any,
  mentorId: string,
  badgeType: string,
  status: "active" | "suspended" | "revoked",
  reason: string | null,
  adminUserId: string,
  suspendedUntil: string | null = null,
  eventType?: "granted" | "suspended" | "revoked" | "restored",
) => {
  if (!BADGE_TYPES.has(badgeType)) throw new Error("Loại huy hiệu không hợp lệ.");

  const publicMeta = BADGE_PUBLIC_META[badgeType] ?? { label: badgeType, description: badgeType };

  const payload = {
    mentor_id: mentorId,
    badge_type: badgeType,
    status,
    public_visible: status === "active",
    public_label: publicMeta.label,
    public_description: publicMeta.description,
    reason,
    granted_by: adminUserId,
    granted_at: new Date().toISOString(),
    suspended_until: status === "suspended" ? suspendedUntil : null,
    revoked_at: status === "revoked" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("mentor_trust_badges")
    .upsert(payload, { onConflict: "mentor_id,badge_type" })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  await recordBadgeEvent(
    client,
    mentorId,
    badgeType,
    eventType ?? (status === "active" ? "granted" : status === "suspended" ? "suspended" : "revoked"),
    reason,
    adminUserId,
    data?.id ?? null,
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const action = body.action as string | undefined;
    const mentorId = normalizeText(body.mentorId) || null;
    const proofId = normalizeText(body.proofId) || null;
    const reason = normalizeText(body.reason);
    const note = normalizeText(body.note);
    const badgeType = normalizeText(body.badgeType);
    const itemType = normalizeText(body.itemType);

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "list_requests") {
      const status = normalizeText(body.status);
      return json({ requests: await listMentorVerificationRequests(adminClient, status || "all") });
    }

    if (!mentorId) return json({ error: "Missing mentorId" }, 400);

    if (action === "get_detail") {
      const detail = await getDetail(adminClient, mentorId);
      if (!detail) return json({ error: "Verification request not found" }, 404);
      return json({ request: detail });
    }

    if (action === "get_badge_history") {
      const { data, error } = await adminClient
        .from("mentor_badge_events")
        .select("*")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ events: data ?? [] });
    }

    if (action === "review_evidence" || action === "approve_item" || action === "reject_item") {
      if (!proofId) return json({ error: "Missing proofId" }, 400);
      const reviewStatus =
        action === "approve_item"
          ? "approved"
          : action === "reject_item"
            ? "rejected"
            : normalizeStatus(normalizeText(body.reviewStatus)) || "";
      if (!["approved", "rejected", "revision_requested", "pending"].includes(reviewStatus)) {
        return json({ error: "Trạng thái bằng chứng không hợp lệ." }, 400);
      }

      const { error } = await adminClient
        .from("mentor_verification_proofs")
        .update({
          status: reviewStatus,
          review_status: reviewStatus,
          admin_note: note || null,
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", proofId)
        .eq("mentor_id", mentorId);
      if (error) throw error;
      return json({ success: true, request: await getDetail(adminClient, mentorId) });
    }

    if (action === "review_profile_item") {
      if (!["avatar"].includes(itemType)) return json({ error: "Mục hồ sơ không hợp lệ." }, 400);
      const reviewStatus = normalizeStatus(normalizeText(body.reviewStatus)) || "";
      if (!["approved", "rejected", "revision_requested", "pending"].includes(reviewStatus)) {
        return json({ error: "Trạng thái mục hồ sơ không hợp lệ." }, 400);
      }

      const payload = {
        mentor_id: mentorId,
        item_type: itemType,
        review_status: reviewStatus,
        admin_note: note || null,
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: existingItems, error: existingError } = await adminClient
        .from("mentor_verification_items")
        .select("id")
        .eq("mentor_id", mentorId)
        .eq("item_type", itemType)
        .is("proof_id", null)
        .limit(1);
      if (existingError) throw existingError;

      const existingId = existingItems?.[0]?.id;
      const { error } = existingId
        ? await adminClient
            .from("mentor_verification_items")
            .update(payload)
            .eq("id", existingId)
        : await adminClient
            .from("mentor_verification_items")
            .insert(payload);

      if (error) throw error;
      return json({ success: true, request: await getDetail(adminClient, mentorId) });
    }

    if (action === "approve_verification") {
      const detail = await getDetail(adminClient, mentorId);
      if (!detail) return json({ error: "Verification request not found" }, 404);
      if (normalizeStatus(detail.status) === "not_submitted") {
        return json({ error: "Mentor chưa gửi hồ sơ xác minh." }, 400);
      }
      const requirements = validateApprovalRequirements(detail);
      if (!requirements.profileComplete || !requirements.hasEnoughProofs || !requirements.hasDistinctTypes || !requirements.hasApprovedProofs) {
        return json({ error: "Mentor chưa đủ điều kiện xác minh.", requirements }, 400);
      }

      const { error } = await adminClient
        .from("mentor_verifications")
        .update({
          status: "approved",
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
          admin_note: note || "Đã duyệt hồ sơ xác minh.",
        })
        .eq("mentor_id", mentorId);
      if (error) throw error;
      await setBadgeStatus(adminClient, mentorId, "vet_verified", "active", "Verification approved", currentUser.id);
      return json({ success: true, request: await getDetail(adminClient, mentorId) });
    }

    if (action === "reject_verification" || action === "request_revision" || action === "revoke_verification") {
      if (!reason) return json({ error: "Vui lòng nhập lý do xử lý." }, 400);
      const detail = await getDetail(adminClient, mentorId);
      if (!detail) return json({ error: "Verification request not found" }, 404);
      if (normalizeStatus(detail.status) === "not_submitted") {
        return json({ error: "Mentor chưa gửi hồ sơ xác minh." }, 400);
      }

      const nextStatus = action === "reject_verification"
        ? "rejected"
        : action === "request_revision"
          ? "revision_requested"
          : "revoked";

      const { error } = await adminClient
        .from("mentor_verifications")
        .update({
          status: nextStatus,
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
          admin_note: reason,
        })
        .eq("mentor_id", mentorId);
      if (error) throw error;

      if (action === "revoke_verification") {
        await setBadgeStatus(adminClient, mentorId, "vet_verified", "revoked", reason, currentUser.id);
      }

      return json({ success: true, request: await getDetail(adminClient, mentorId) });
    }

    if (["grant_badge", "suspend_badge", "revoke_badge", "restore_badge"].includes(action)) {
      if (!badgeType) return json({ error: "Missing badgeType" }, 400);
      if (action === "grant_badge" || action === "restore_badge") {
        await setBadgeStatus(
          adminClient,
          mentorId,
          badgeType,
          "active",
          reason || null,
          currentUser.id,
          null,
          action === "restore_badge" ? "restored" : "granted",
        );
      }
      if (action === "suspend_badge") {
        await setBadgeStatus(adminClient, mentorId, badgeType, "suspended", reason || "Admin tạm dừng huy hiệu.", currentUser.id);
      }
      if (action === "revoke_badge") {
        await setBadgeStatus(adminClient, mentorId, badgeType, "revoked", reason || "Admin thu hồi huy hiệu.", currentUser.id);
      }
      return json({ success: true, request: await getDetail(adminClient, mentorId) });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-mentor-verification-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
