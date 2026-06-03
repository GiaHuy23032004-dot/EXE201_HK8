import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type MentorWallet = Tables<"mentor_wallets">;

export const zeroMentorWallet: MentorWallet = {
  id: "empty-wallet",
  mentor_id: "",
  balance: 0,
  held_balance: 0,
  total_earned: 0,
  bank_name: null,
  bank_account: null,
  bank_holder: null,
  updated_at: "",
};

export function useMentorWallet() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["mentor-wallet", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_wallets")
        .select("*")
        .eq("mentor_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? { ...zeroMentorWallet, mentor_id: userId! }) as MentorWallet;
    },
  });
}
