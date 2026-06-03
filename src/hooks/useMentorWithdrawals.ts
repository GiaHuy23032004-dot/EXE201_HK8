import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type MentorWithdrawal = Tables<"withdrawal_requests">;

export interface CreateWithdrawalRequestPayload {
  amount: number;
  payout_method_id: string;
}

export function useMentorWithdrawals() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["mentor-withdrawals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("mentor_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MentorWithdrawal[];
    },
  });
}

export function useCreateWithdrawalRequest() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateWithdrawalRequestPayload) => {
      const { data, error } = await supabase.rpc("request_mentor_withdrawal", {
        amount: payload.amount,
        payout_method_id: payload.payout_method_id,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("request_mentor_withdrawal error", error);
        throw error;
      }

      return data as MentorWithdrawal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-wallet", userId] });
      qc.invalidateQueries({ queryKey: ["mentor-withdrawals", userId] });
      qc.invalidateQueries({ queryKey: ["mentor-wallet-transactions", userId] });
    },
  });
}
