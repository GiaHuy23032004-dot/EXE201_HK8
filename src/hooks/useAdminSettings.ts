import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SettingsKey =
  | "access_security"
  | "moderation_reports"
  | "mentor_verification"
  | "marketplace_rules"
  | "payment_placeholder"
  | "system_health";

export interface SystemSetting<TValue = Record<string, unknown>> {
  id: string;
  key: SettingsKey;
  category: string;
  value: TValue;
  description: string | null;
  is_sensitive: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface AdminSettingsResponse {
  settings: SystemSetting[];
  admin: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
  source?: "edge-function" | "direct-read" | "local-defaults";
  functionUnavailable?: boolean;
  warning?: string;
}

export interface SystemHealthResponse {
  health: Record<string, { status: string; label: string } | string | null>;
}

async function invokeAdminSettings<T>(accessToken: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-settings-actions", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  if (error) {
    if (import.meta.env.DEV) console.error("admin-settings-actions error", { body, error, data });
    throw error;
  }

  return data as T;
}

const fallbackSettings: SystemSetting[] = [
  {
    id: "fallback-access-security",
    key: "access_security",
    category: "access_security",
    value: {
      prevent_last_admin_removal: true,
      prevent_admin_self_block: true,
      require_admin_check_edge_function: true,
    },
    description: "Fallback access and security settings.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-moderation-reports",
    key: "moderation_reports",
    category: "moderation_reports",
    value: {
      report_detail_min_length: 20,
      report_detail_max_length: 1200,
      report_title_max_length: 120,
      report_reason_max_length: 160,
      evidence_max_files: 5,
      evidence_max_file_mb: 5,
      auto_hide_report_threshold: 5,
      appeal_window_days: 7,
      strike_1_expire_days: 30,
      strike_2_expire_days: 90,
      strike_2_posting_suspension_days: 7,
      strike_3_permanent: true,
    },
    description: "Fallback report and moderation settings.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-mentor-verification",
    key: "mentor_verification",
    category: "mentor_verification",
    value: {
      allow_mentor_create_draft_before_verified: true,
      allow_mentor_publish_before_verified: false,
      allow_mentor_receive_booking_before_verified: false,
      require_avatar_upload: true,
      require_at_least_one_evidence: true,
      accepted_evidence_types: ["social_link", "certificate", "cv_portfolio"],
      show_vet_verified_badge: true,
      show_certificate_verified_badge: true,
      show_portfolio_verified_badge: true,
      show_trusted_mentor_badge: true,
      strike_1_suspend_trusted_badge_days: 0,
      strike_2_suspend_trusted_badge: true,
      strike_3_revoke_trusted_badge: true,
      revoke_vet_verified_only_for_fraud: true,
    },
    description: "Fallback mentor verification settings.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-marketplace-rules",
    key: "marketplace_rules",
    category: "marketplace_rules",
    value: {
      public_only_show_approved_courses: true,
      public_hide_hidden_courses: true,
      allow_online_courses: true,
      allow_offline_courses: true,
      promoted_listing_default_days: 3,
      promoted_listing_default_fee: 15000,
      minimum_course_price: 0,
      maximum_course_price: null,
    },
    description: "Fallback marketplace settings.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-payment-placeholder",
    key: "payment_placeholder",
    category: "payment_placeholder",
    value: {
      payment_provider_status: "planning",
      current_provider: "mock / not configured",
      platform_fee_rate: 0.15,
      hold_period: "Chưa chốt",
      webhook_status: "Chưa cấu hình",
      learner_payment_flow_status: "Đang lên kế hoạch",
      mentor_withdrawal_status: "Giải quyết sau",
    },
    description: "Fallback payment planning placeholder.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-system-health",
    key: "system_health",
    category: "system_health",
    value: {
      payment_webhook_status: "not_configured",
      last_payment_webhook_received: null,
    },
    description: "Fallback system health metadata.",
    is_sensitive: false,
    updated_by: null,
    updated_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
  },
];

async function getSettingsWithFallback(accessToken: string): Promise<AdminSettingsResponse> {
  try {
    const response = await invokeAdminSettings<AdminSettingsResponse>(accessToken, { action: "get_settings" });
    return { ...response, source: "edge-function" };
  } catch (functionError) {
    if (import.meta.env.DEV) {
      console.warn("admin-settings-actions unavailable; attempting RLS direct-read fallback", functionError);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      const { data, error } = await (supabase as any)
        .from("system_settings")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;

      return {
        settings: (data ?? []) as SystemSetting[],
        admin: currentUser
          ? {
              id: currentUser.id,
              email: currentUser.email ?? null,
              name: null,
              avatar_url: null,
            }
          : null,
        source: "direct-read",
        functionUnavailable: true,
        warning: "admin-settings-actions chưa sẵn sàng. Trang đang dùng fallback đọc qua RLS; thao tác lưu cần Edge Function.",
      };
    } catch (directReadError) {
      if (import.meta.env.DEV) {
        console.warn("system_settings direct-read fallback failed; using local defaults", directReadError);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;

      return {
        settings: fallbackSettings,
        admin: currentUser
          ? {
              id: currentUser.id,
              email: currentUser.email ?? null,
              name: null,
              avatar_url: null,
            }
          : null,
        source: "local-defaults",
        functionUnavailable: true,
        warning: "Không thể gọi admin-settings-actions hoặc đọc system_settings. Đang hiển thị cấu hình mặc định cục bộ.",
      };
    }
  }
}

function fallbackHealth(functionUnavailable = true): SystemHealthResponse {
  return {
    health: {
      "admin-check": { status: "unknown", label: "Không xác định" },
      "admin-settings-actions": {
        status: functionUnavailable ? "not_configured" : "unknown",
        label: functionUnavailable ? "Chưa deploy / chưa serve" : "Không xác định",
      },
      "learner-report-actions": { status: "unknown", label: "Không xác định" },
      "learner-review-actions": { status: "unknown", label: "Không xác định" },
      "admin-report-actions": { status: "unknown", label: "Không xác định" },
      payment_webhook: { status: "not_configured", label: "Chưa cấu hình" },
      last_payment_webhook_received: null,
      environment_mode: import.meta.env.MODE ?? "Không xác định",
    },
  };
}

export function useAdminSettings() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  return useQuery({
    queryKey: ["admin-settings"],
    enabled: !!accessToken,
    queryFn: async () => {
      return getSettingsWithFallback(accessToken!);
    },
  });
}

export function useSystemHealth() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  return useQuery({
    queryKey: ["admin-system-health"],
    enabled: !!accessToken,
    queryFn: async () => {
      try {
        return await invokeAdminSettings<SystemHealthResponse>(accessToken!, { action: "get_system_health" });
      } catch (error) {
        if (import.meta.env.DEV) console.warn("admin settings health fallback", error);
        return fallbackHealth(true);
      }
    },
    retry: 1,
  });
}

export function useUpdateAdminSettings() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: SettingsKey; value: Record<string, unknown> }) => {
      if (!accessToken) throw new Error("Missing admin session.");
      if (import.meta.env.DEV) console.log("Saving settings", { key, value });
      try {
        const result = await invokeAdminSettings<{ setting: SystemSetting }>(accessToken, {
          action: "update_settings",
          key,
          value,
        });
        if (import.meta.env.DEV) console.log("Save result", { data: result, error: null });
        return result;
      } catch (error) {
        if (import.meta.env.DEV) console.log("Save result", { data: null, error });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-system-health"] });
    },
  });
}
