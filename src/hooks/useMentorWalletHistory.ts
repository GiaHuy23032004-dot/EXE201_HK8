import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type MentorWalletTransaction = Tables<"wallet_transactions">;
export type MentorRevenueTransaction = Tables<"transactions"> & {
  course?: { title: string | null; image_url: string | null } | null;
  learner?: { name: string | null; email: string | null; avatar_url: string | null } | null;
};

export function useMentorWalletHistory() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["mentor-wallet-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [walletTxnsRes, revenueTxnsRes] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("mentor_id", userId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select(`
            *,
            course:courses(title, image_url),
            learner:profiles!transactions_learner_id_fkey(name, email, avatar_url)
          `)
          .eq("mentor_id", userId!)
          .order("created_at", { ascending: false }),
      ]);

      if (walletTxnsRes.error) throw walletTxnsRes.error;
      if (revenueTxnsRes.error) throw revenueTxnsRes.error;

      return {
        walletTransactions: (walletTxnsRes.data ?? []) as MentorWalletTransaction[],
        transactions: (revenueTxnsRes.data ?? []) as unknown as MentorRevenueTransaction[],
      };
    },
  });
}

export function useMentorTransactions() {
  const history = useMentorWalletHistory();
  return {
    ...history,
    data: history.data?.transactions ?? [],
  };
}
