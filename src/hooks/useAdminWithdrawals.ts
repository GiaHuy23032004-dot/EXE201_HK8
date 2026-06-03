import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AdminWithdrawal = Tables<"withdrawal_requests"> & {
  mentor?: {
    user_id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
};

export interface ProcessWithdrawalPayload {
  withdrawal_request_id: string;
  new_status: "paid" | "rejected";
  admin_note?: string | null;
  processed_reference?: string | null;
}

export function useAdminWithdrawals() {
  return useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data: withdrawals, error: withdrawalError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (withdrawalError) throw withdrawalError;

      const mentorIds = Array.from(new Set((withdrawals ?? []).map((item) => item.mentor_id).filter(Boolean)));
      if (mentorIds.length === 0) return [] as AdminWithdrawal[];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, name, email, avatar_url, phone")
        .in("user_id", mentorIds);

      if (profileError) throw profileError;

      const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

      return (withdrawals ?? []).map((withdrawal) => ({
        ...withdrawal,
        mentor: profileById.get(withdrawal.mentor_id) ?? null,
      })) as AdminWithdrawal[];
    },
  });
}

export function useProcessWithdrawalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProcessWithdrawalPayload) => {
      const { data, error } = await supabase.rpc("admin_process_withdrawal_request", {
        withdrawal_request_id: payload.withdrawal_request_id,
        new_status: payload.new_status,
        admin_note: payload.admin_note?.trim() || null,
        processed_reference: payload.processed_reference?.trim() || null,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("admin_process_withdrawal_request error", error);
        throw error;
      }

      return data as AdminWithdrawal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
  });
}
