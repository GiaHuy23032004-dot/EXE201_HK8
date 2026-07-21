import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VerificationStatus = "all" | "not_submitted" | "pending" | "approved" | "revision_requested" | "rejected" | "revoked";
export type ProofStatus = "pending" | "approved" | "revision_requested" | "rejected";
export type DecisionAction = "request_revision" | "reject_verification" | "revoke_verification";
export type BadgeAction = "grant_badge" | "suspend_badge" | "restore_badge" | "revoke_badge";
export type TrustBadgeType = "vet_verified" | "certificate_verified" | "portfolio_verified" | "trusted_mentor";

export type ProfileRef = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  real_name: string | null;
  mentor_headline: string | null;
  teaching_fields: string[] | null;
  experience_years: number | null;
  city: string | null;
  portfolio_url: string | null;
  role: string;
};

export type VerificationProof = {
  id: string;
  mentor_id: string;
  proof_type: string;
  title: string;
  url: string | null;
  file_path: string | null;
  signed_file_url?: string | null;
  file_name?: string | null;
  file_mime_type?: string | null;
  issuer?: string | null;
  issued_year?: number | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  status?: string;
  review_status?: string;
  admin_note?: string | null;
  created_at: string;
};

export type TrustBadge = {
  id: string;
  mentor_id: string;
  badge_type: TrustBadgeType | string;
  status: "active" | "suspended" | "revoked" | string;
  public_visible?: boolean;
  reason?: string | null;
  granted_at?: string | null;
  suspended_until?: string | null;
  revoked_at?: string | null;
};

export type MentorStrike = {
  id: string;
  mentor_id: string;
  level: number;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
};

export type MentorCourseSummary = {
  id: string;
  title: string;
  status: string;
  is_hidden?: boolean | null;
  rating?: number | null;
  review_count?: number | null;
  students_count?: number | null;
  bookings_count?: number;
  reviews_count?: number;
  created_at?: string | null;
};

export type MentorReportSummary = {
  id: string;
  title: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
  admin_verdict?: string | null;
};

export type VerificationRequest = {
  id: string;
  mentor_id: string;
  status: VerificationStatus | string;
  submitted_at: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  profile: ProfileRef | null;
  evidence_count: number;
  approved_proof_count?: number;
  proofs: VerificationProof[];
  trust_badges?: TrustBadge[];
  verification_items?: Array<Record<string, unknown>>;
  courses?: MentorCourseSummary[];
  reports?: MentorReportSummary[];
  mentor_strikes?: MentorStrike[];
  summary?: {
    courses_count?: number;
    completed_bookings_count?: number;
    reviews_count?: number;
    average_rating?: number;
    active_strike_count?: number;
    reports_count?: number;
  };
  active_strike_count: number;
};

type AdminMentorVerificationResponse = {
  error?: string;
  requests?: VerificationRequest[];
  request?: VerificationRequest;
  [key: string]: unknown;
};

export const adminMentorVerificationKeys = {
  all: ["admin-mentor-verifications"] as const,
  list: (status: VerificationStatus) => ["admin-mentor-verifications", status] as const,
  detail: (mentorId: string | null | undefined) => ["admin-mentor-verifications", "detail", mentorId] as const,
};

export function useAdminMentorVerificationApi() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const invokeAction = useCallback(
    async (body: Record<string, unknown>) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Missing admin session");

      const { data, error } = await supabase.functions.invoke<AdminMentorVerificationResponse>(
        "admin-mentor-verification-actions",
        {
          body,
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (import.meta.env.DEV) {
        console.log("admin-mentor-verification-actions", { body, data, error });
      }

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Không thể xử lý hồ sơ xác minh.");
      }

      return data ?? {};
    },
    [session?.access_token],
  );

  const refreshVerificationQueries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: adminMentorVerificationKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["public-mentor-verification"] });
    await queryClient.invalidateQueries({ queryKey: ["public-mentor-verifications"] });
    await queryClient.invalidateQueries({ queryKey: ["public-mentor-trust-badges"] });
  }, [queryClient]);

  return {
    accessToken: session?.access_token,
    invokeAction,
    refreshVerificationQueries,
  };
}

export function useAdminMentorVerificationRequests(status: VerificationStatus) {
  const { accessToken, invokeAction } = useAdminMentorVerificationApi();

  return useQuery({
    queryKey: adminMentorVerificationKeys.list(status),
    enabled: !!accessToken,
    queryFn: async () => {
      const data = await invokeAction({ action: "list_requests", status });
      return data.requests ?? [];
    },
  });
}

export const useAdminMentorVerificationList = useAdminMentorVerificationRequests;

export function useAdminMentorVerificationDetail(mentorId: string | null | undefined, enabled = true) {
  const { accessToken, invokeAction } = useAdminMentorVerificationApi();

  return useQuery({
    queryKey: adminMentorVerificationKeys.detail(mentorId),
    enabled: Boolean(accessToken && mentorId && enabled),
    queryFn: async () => {
      const data = await invokeAction({ action: "get_detail", mentorId });
      return data.request as VerificationRequest;
    },
  });
}

export function useAdminMentorVerificationActions() {
  const api = useAdminMentorVerificationApi();
  return {
    ...api,
    reviewProof: (payload: { mentorId: string; proofId: string; reviewStatus: ProofStatus; note?: string }) =>
      api.invokeAction({ action: "review_evidence", ...payload }),
    reviewProfileItem: (payload: { mentorId: string; itemType: string; reviewStatus: ProofStatus; note?: string }) =>
      api.invokeAction({ action: "review_profile_item", ...payload }),
    decideVerification: (payload: { mentorId: string; action: "approve_verification" | DecisionAction; reason?: string; note?: string }) =>
      api.invokeAction(payload),
    updateBadge: (payload: { mentorId: string; action: BadgeAction; badgeType: TrustBadgeType; reason?: string; suspendedUntil?: string | null }) =>
      api.invokeAction(payload),
  };
}
