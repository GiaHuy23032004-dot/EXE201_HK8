import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type SettingsAction = "get_settings" | "update_settings" | "get_system_health";

const SETTINGS_KEYS = new Set([
  "access_security",
  "moderation_reports",
  "mentor_verification",
  "marketplace_rules",
  "payment_placeholder",
  "system_health",
]);

const EDITABLE_KEYS = new Set([
  "access_security",
  "moderation_reports",
  "mentor_verification",
  "marketplace_rules",
]);

const descriptions: Record<string, string> = {
  access_security: "Admin access and security guardrail settings.",
  moderation_reports: "Report validation, auto-hide, appeal, and strike behavior.",
  mentor_verification: "Mentor verification, public trust badge, and punishment settings.",
  marketplace_rules: "Marketplace visibility and listing defaults.",
  payment_placeholder: "Payment planning placeholder. No secrets are stored here.",
  system_health: "Read-only lightweight health metadata.",
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

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const numberInRange = (
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = true,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
};

function validateSettingValue(key: string, rawValue: unknown) {
  if (!EDITABLE_KEYS.has(key)) {
    throw new Error("This settings section is read-only.");
  }

  const value = asObject(rawValue);

  if (key === "access_security") {
    return {
      prevent_last_admin_removal: value.prevent_last_admin_removal !== false,
      prevent_admin_self_block: value.prevent_admin_self_block !== false,
      require_admin_check_edge_function: value.require_admin_check_edge_function !== false,
    };
  }

  if (key === "moderation_reports") {
    const reportDetailMin = numberInRange(value.report_detail_min_length, "Report detail minimum length", 10, 3000);
    const reportDetailMax = numberInRange(value.report_detail_max_length, "Report detail maximum length", 100, 3000);
    if (reportDetailMax <= reportDetailMin) {
      throw new Error("Report detail maximum length must be greater than minimum length.");
    }

    return {
      report_detail_min_length: reportDetailMin,
      report_detail_max_length: reportDetailMax,
      report_title_max_length: numberInRange(value.report_title_max_length, "Report title maximum length", 20, 200),
      report_reason_max_length: numberInRange(value.report_reason_max_length, "Report reason maximum length", 20, 300),
      evidence_max_files: numberInRange(value.evidence_max_files, "Evidence max files", 1, 10),
      evidence_max_file_mb: numberInRange(value.evidence_max_file_mb, "Evidence max file size", 1, 20),
      auto_hide_report_threshold: numberInRange(value.auto_hide_report_threshold, "Auto-hide report threshold", 3, 20),
      appeal_window_days: numberInRange(value.appeal_window_days, "Appeal window days", 1, 30),
      strike_1_expire_days: numberInRange(value.strike_1_expire_days, "Strike 1 expiry days", 1, 365),
      strike_2_expire_days: numberInRange(value.strike_2_expire_days, "Strike 2 expiry days", 1, 365),
      strike_2_posting_suspension_days: numberInRange(value.strike_2_posting_suspension_days, "Strike 2 posting suspension days", 1, 90),
      strike_3_permanent: value.strike_3_permanent !== false,
    };
  }

  if (key === "mentor_verification") {
    const evidenceTypes = Array.isArray(value.accepted_evidence_types)
      ? value.accepted_evidence_types.filter((item) => typeof item === "string")
      : ["social_link", "certificate", "cv_portfolio"];

    if (evidenceTypes.length === 0) {
      throw new Error("At least one evidence type is required.");
    }

    return {
      allow_mentor_create_draft_before_verified: value.allow_mentor_create_draft_before_verified !== false,
      allow_mentor_publish_before_verified: value.allow_mentor_publish_before_verified === true,
      allow_mentor_receive_booking_before_verified: value.allow_mentor_receive_booking_before_verified === true,
      require_avatar_upload: value.require_avatar_upload !== false,
      require_at_least_one_evidence: value.require_at_least_one_evidence !== false,
      accepted_evidence_types: evidenceTypes,
      show_vet_verified_badge: value.show_vet_verified_badge !== false,
      show_certificate_verified_badge: value.show_certificate_verified_badge !== false,
      show_portfolio_verified_badge: value.show_portfolio_verified_badge !== false,
      show_trusted_mentor_badge: value.show_trusted_mentor_badge !== false,
      strike_1_suspend_trusted_badge_days: numberInRange(value.strike_1_suspend_trusted_badge_days ?? 0, "Strike 1 trusted badge suspension days", 0, 365),
      strike_2_suspend_trusted_badge: value.strike_2_suspend_trusted_badge !== false,
      strike_3_revoke_trusted_badge: value.strike_3_revoke_trusted_badge !== false,
      revoke_vet_verified_only_for_fraud: value.revoke_vet_verified_only_for_fraud !== false,
    };
  }

  if (key === "marketplace_rules") {
    const minimumCoursePrice = numberInRange(value.minimum_course_price, "Minimum course price", 0, 999_999_999);
    const maximumCoursePrice =
      value.maximum_course_price === null || value.maximum_course_price === undefined || value.maximum_course_price === ""
        ? null
        : numberInRange(value.maximum_course_price, "Maximum course price", 0, 999_999_999);

    if (maximumCoursePrice !== null && maximumCoursePrice <= minimumCoursePrice) {
      throw new Error("Maximum course price must be greater than minimum course price.");
    }

    return {
      public_only_show_approved_courses: value.public_only_show_approved_courses !== false,
      public_hide_hidden_courses: value.public_hide_hidden_courses !== false,
      allow_online_courses: value.allow_online_courses !== false,
      allow_offline_courses: value.allow_offline_courses !== false,
      promoted_listing_default_days: numberInRange(value.promoted_listing_default_days, "Promoted listing default days", 1, 30),
      promoted_listing_default_fee: numberInRange(value.promoted_listing_default_fee, "Promoted listing default fee", 0, 999_999_999),
      minimum_course_price: minimumCoursePrice,
      maximum_course_price: maximumCoursePrice,
    };
  }

  return value;
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

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) {
      console.error("admin-settings-actions role lookup error:", adminRoleError);
      return json({ error: adminRoleError.message }, 500);
    }
    if (adminRole?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as SettingsAction | undefined;
    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "get_settings") {
      const { data: settings, error } = await adminClient
        .from("system_settings")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;

      const { data: profile } = await adminClient
        .from("profiles")
        .select("name, email, avatar_url")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      return json({
        settings: settings ?? [],
        admin: {
          id: currentUser.id,
          email: currentUser.email ?? profile?.email ?? null,
          name: profile?.name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
      });
    }

    if (action === "get_system_health") {
      return json({
        health: {
          "admin-check": { status: "ok", label: "Hoat dong" },
          "admin-settings-actions": { status: "ok", label: "Hoat dong" },
          "learner-report-actions": { status: "unknown", label: "Khong xac dinh" },
          "learner-review-actions": { status: "unknown", label: "Khong xac dinh" },
          "admin-report-actions": { status: "unknown", label: "Khong xac dinh" },
          payment_webhook: { status: "not_configured", label: "Chua cau hinh" },
          last_payment_webhook_received: null,
          environment_mode: Deno.env.get("VET_ENV") ?? Deno.env.get("ENVIRONMENT") ?? "Khong xac dinh",
        },
      });
    }

    if (action === "update_settings") {
      const key = typeof body.key === "string" ? body.key : "";
      if (!SETTINGS_KEYS.has(key)) return json({ error: "Unknown settings key" }, 400);

      const nextValue = validateSettingValue(key, body.value);

      const { data: currentSetting, error: currentError } = await adminClient
        .from("system_settings")
        .select("*")
        .eq("key", key)
        .maybeSingle();
      if (currentError) throw currentError;

      const { data: updated, error: upsertError } = await adminClient
        .from("system_settings")
        .upsert(
          {
            key,
            category: currentSetting?.category ?? key,
            value: nextValue,
            description: currentSetting?.description ?? descriptions[key] ?? null,
            is_sensitive: false,
            updated_by: currentUser.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
        .select("*")
        .single();

      if (upsertError) throw upsertError;

      const { error: auditError } = await adminClient
        .from("system_setting_audit_logs")
        .insert({
          setting_key: key,
          old_value: currentSetting?.value ?? null,
          new_value: nextValue,
          changed_by: currentUser.id,
        });

      if (auditError) {
        console.error("admin-settings-actions audit insert error:", auditError);
      }

      return json({ setting: updated });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-settings-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
