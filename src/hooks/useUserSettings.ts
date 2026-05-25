import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  user_id: string;
  email_notifications: boolean;
  booking_notifications: boolean;
  review_notifications: boolean;
  payout_notifications: boolean;
  admin_notifications: boolean;
  marketing_emails: boolean;
  profile_public: boolean;
  show_phone_public: boolean;
  show_email_public: boolean;
  allow_student_contact: boolean;
  language: "vi" | "en";
  timezone: string;
  created_at: string | null;
  updated_at: string | null;
}

export type UpdateUserSettingsPayload = Partial<
  Pick<
    UserSettings,
    | "email_notifications"
    | "booking_notifications"
    | "review_notifications"
    | "payout_notifications"
    | "admin_notifications"
    | "marketing_emails"
    | "profile_public"
    | "show_phone_public"
    | "show_email_public"
    | "allow_student_contact"
    | "language"
    | "timezone"
  >
>;

const DEFAULT_SETTINGS: Omit<UserSettings, "user_id" | "created_at" | "updated_at"> = {
  email_notifications: true,
  booking_notifications: true,
  review_notifications: true,
  payout_notifications: true,
  admin_notifications: true,
  marketing_emails: false,
  profile_public: true,
  show_phone_public: false,
  show_email_public: false,
  allow_student_contact: true,
  language: "vi",
  timezone: "Asia/Ho_Chi_Minh",
};

const userSettingsTable = () => (supabase as any).from("user_settings");

function normalizeSettings(row: Partial<UserSettings> & { user_id: string }): UserSettings {
  return {
    user_id: row.user_id,
    email_notifications: row.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
    booking_notifications: row.booking_notifications ?? DEFAULT_SETTINGS.booking_notifications,
    review_notifications: row.review_notifications ?? DEFAULT_SETTINGS.review_notifications,
    payout_notifications: row.payout_notifications ?? DEFAULT_SETTINGS.payout_notifications,
    admin_notifications: row.admin_notifications ?? DEFAULT_SETTINGS.admin_notifications,
    marketing_emails: row.marketing_emails ?? DEFAULT_SETTINGS.marketing_emails,
    profile_public: row.profile_public ?? DEFAULT_SETTINGS.profile_public,
    show_phone_public: row.show_phone_public ?? DEFAULT_SETTINGS.show_phone_public,
    show_email_public: row.show_email_public ?? DEFAULT_SETTINGS.show_email_public,
    allow_student_contact: row.allow_student_contact ?? DEFAULT_SETTINGS.allow_student_contact,
    language: row.language === "en" ? "en" : "vi",
    timezone: row.timezone ?? DEFAULT_SETTINGS.timezone,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function getUserSettings(userId: string) {
  const { data, error } = await userSettingsTable()
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeSettings(data) : null;
}

export async function ensureUserSettingsRow(userId: string) {
  const existing = await getUserSettings(userId);
  if (existing) return existing;

  const { data, error } = await userSettingsTable()
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select("*")
    .single();

  if (error) {
    const refetched = await getUserSettings(userId);
    if (refetched) return refetched;
    throw error;
  }

  return normalizeSettings(data);
}

export async function updateUserSettings(userId: string, updates: UpdateUserSettingsPayload) {
  const { data, error } = await userSettingsTable()
    .update(updates)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeSettings(data);
}

export function useUserSettings(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-settings", userId],
    enabled: !!userId,
    queryFn: () => ensureUserSettingsRow(userId!),
  });
}

export function useUpdateUserSettings(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateUserSettingsPayload) => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      return updateUserSettings(userId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", userId] });
    },
  });
}
