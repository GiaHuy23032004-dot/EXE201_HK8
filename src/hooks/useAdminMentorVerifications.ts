import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VerificationStatus = "pending" | "approved" | "revision_requested" | "rejected" | "revoked";
export type ProofStatus = "pending" | "approved" | "revision_requested" | "rejected";
export type DecisionAction = "request_revision" | "reject_verification" | "revoke_verification";

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
