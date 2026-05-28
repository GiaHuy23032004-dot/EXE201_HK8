/**
 * useLearnerPayments.ts
 * Toàn bộ logic thanh toán & biên lai dành cho Learner
 * - Xem lịch sử giao dịch
 * - Xem chi tiết biên lai
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerTransaction {
  id: string;
  booking_id: string | null;
  learner_id: string;
  mentor_id: string;
  course_id: string | null;
  amount: number;
  platform_fee: number;
  net_amount: number;
  payment_method: string;
  txn_type: string;
  status: "success" | "refunded" | "pending" | "failed";
  reference_code: string | null;
  created_at: string;
  course?: { title: string; image_url: string | null };
  booking?: { booking_date: string; start_time: string; end_time: string } | null;
}

export interface LearnerReceipt {
  booking: {
    id: string;
    course_id: string;
    learner_id: string;
    mentor_id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    phone: string | null;
    payment_method: string;
    status: string;
    total_price: number;
    created_at: string;
    course?: { title: string; image_url: string | null; price: number; category: string; format: string } | null;
    mentor?: { name: string | null; avatar_url: string | null } | null;
  };
  transaction?: LearnerTransaction | null;
}

// ── Lịch sử thanh toán ────────────────────────────────────────────────────────
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
      return (data ?? []) as LearnerTransaction[];
    },
  });
}

// ── Chi tiết biên lai theo bookingId ─────────────────────────────────────────
export function useLearnerReceipt(bookingId: string | undefined, learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-receipt", bookingId],
    enabled: !!bookingId && !!learnerId,
    queryFn: async () => {
      // Lấy booking
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select(`
          *,
          course:courses(title, image_url, price, category, format),
          mentor:profiles!bookings_mentor_id_fkey(name, avatar_url)
        `)
        .eq("id", bookingId!)
        .eq("learner_id", learnerId!)
        .single();
      if (bErr) throw bErr;

      // Lấy transaction nếu có
      const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("booking_id", bookingId!)
        .maybeSingle();

      return { booking, transaction } as LearnerReceipt;
    },
  });
}

// ── Tổng chi tiêu của learner ─────────────────────────────────────────────────
export function useLearnerTotalSpent(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-total-spent", learnerId],
    enabled: !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, status")
        .eq("learner_id", learnerId!)
        .eq("status", "success");
      if (error) throw error;
      return (data ?? []).reduce((sum, t) => sum + t.amount, 0);
    },
  });
}
