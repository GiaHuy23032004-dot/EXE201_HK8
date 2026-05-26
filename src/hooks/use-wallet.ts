import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Lấy ví của mentor
export function useMentorWallet(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["wallet", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_wallets")
        .select("*")
        .eq("mentor_id", mentorId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Lịch sử giao dịch ví
export function useWalletTransactions(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["wallet-txns", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Lịch sử doanh thu (transactions)
export function useMentorTransactions(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-txns", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`*, course:courses(title, image_url)`)
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Yêu cầu rút tiền
export function useCreateWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      mentor_id: string;
      amount: number;
      bank_name: string;
      bank_account: string;
      bank_holder: string;
    }) => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wallet", vars.mentor_id] });
    },
  });
}

// Cập nhật thông tin ngân hàng
export function useUpdateBankInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      mentor_id: string;
      bank_name: string;
      bank_account: string;
      bank_holder: string;
    }) => {
      const { error } = await supabase
        .from("mentor_wallets")
        .update({
          bank_name: payload.bank_name,
          bank_account: payload.bank_account,
          bank_holder: payload.bank_holder,
        })
        .eq("mentor_id", payload.mentor_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wallet", vars.mentor_id] });
    },
  });
}

// Lịch sử thanh toán của learner
export function useLearnerTransactions(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-transactions", learnerId],
    enabled: !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          course:courses(title, image_url),
          booking:bookings(booking_date, start_time, end_time)
        `)
        .eq("learner_id", learnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
