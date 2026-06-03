import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type MentorPayoutMethod = Tables<"mentor_payout_methods">;

export interface CreatePayoutMethodPayload {
  method_type: "bank_transfer" | "e_wallet";
  provider_name: string;
  provider_code?: string | null;
  account_number: string;
  account_holder: string;
  branch?: string | null;
  nickname?: string | null;
  is_default: boolean;
  confirmed: boolean;
}

export function maskAccountNumber(accountNumber?: string | null) {
  const normalized = (accountNumber ?? "").replace(/\s+/g, "");
  if (!normalized) return "—";
  const suffix = normalized.slice(-4);
  return `•••• ${suffix}`;
}

export function useMentorPayoutMethods() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["mentor-payout-methods", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_payout_methods")
        .select("*")
        .eq("mentor_id", userId!)
        .neq("status", "deleted")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MentorPayoutMethod[];
    },
  });
}

export function useCreateMentorPayoutMethod() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePayoutMethodPayload) => {
      const { data, error } = await supabase.rpc("create_mentor_payout_method", {
        method_type: payload.method_type,
        provider_name: payload.provider_name.trim(),
        provider_code: payload.provider_code?.trim() || null,
        account_number: payload.account_number.replace(/\s+/g, ""),
        account_holder: payload.account_holder.trim().toUpperCase(),
        branch: payload.branch?.trim() || null,
        nickname: payload.nickname?.trim() || null,
        is_default: payload.is_default,
        confirmed: payload.confirmed,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("create_mentor_payout_method error", error);
        throw error;
      }

      return data as MentorPayoutMethod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-payout-methods", userId] });
    },
  });
}

export function useSetDefaultMentorPayoutMethod() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payoutMethodId: string) => {
      const { data, error } = await supabase.rpc("set_default_mentor_payout_method", {
        payout_method_id: payoutMethodId,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("set_default_mentor_payout_method error", error);
        throw error;
      }

      return data as MentorPayoutMethod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-payout-methods", userId] });
    },
  });
}

export function useDeleteMentorPayoutMethod() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payoutMethodId: string) => {
      const { error } = await supabase.rpc("delete_mentor_payout_method", {
        payout_method_id: payoutMethodId,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("delete_mentor_payout_method error", error);
        throw error;
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-payout-methods", userId] });
    },
  });
}
