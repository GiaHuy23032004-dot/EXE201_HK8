import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PromotionStatus = "pending" | "active" | "expired" | "rejected";

export interface Promotion {
  id: string;
  course_id: string;
  mentor_id: string;
  status: PromotionStatus;
  starts_at: string | null;
  expires_at: string | null;
  fee?: number | null;
  days?: number | null;
  paid_amount: number;
  rejection_reason: string | null;
  payment_ref: string | null;
  created_at: string;
  course?: {
    title: string;
    price: number;
    thumbnail_url: string | null;
  };
  mentor?: {
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

const RATE_PER_DAY = 15_000; // VND per day
type PromotionRow = Partial<Promotion> & {
  id: string;
  course_id: string;
  mentor_id: string;
  status: PromotionStatus;
  created_at: string;
  fee?: number | null;
};

const normalizePromotions = (rows: unknown): Promotion[] =>
  ((rows ?? []) as PromotionRow[]).map((row) => ({
    ...row,
    starts_at: row.starts_at ?? null,
    expires_at: row.expires_at ?? null,
    paid_amount: row.paid_amount ?? row.fee ?? 0,
    rejection_reason: row.rejection_reason ?? null,
    payment_ref: row.payment_ref ?? null,
  }));

const rpc = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => ReturnType<typeof supabase.rpc>;

export const PROMOTION_PACKAGES = [
  { days: 3,  label: "3 ngày",  price: 3 * RATE_PER_DAY },
  { days: 7,  label: "7 ngày",  price: 7 * RATE_PER_DAY },
  { days: 14, label: "14 ngày", price: 14 * RATE_PER_DAY },
  { days: 30, label: "30 ngày", price: 30 * RATE_PER_DAY },
];

// ── Mentor hooks ──────────────────────────────────────────────────────────────

/** Fetch all promotions for the current mentor */
export function useMentorPromotions() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["mentor-promotions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promoted_listings")
        .select(`
          *,
          course:courses(title, price, thumbnail_url)
        `)
        .eq("mentor_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return normalizePromotions(data);
    },
  });
}

/** Request a promotion for a course (deducts balance via RPC) */
export function useRequestPromotion() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({
      course_id,
      days,
    }: {
      course_id: string;
      days: number;
    }) => {
      const { data, error } = await rpc("request_course_promotion", {
        p_course_id: course_id,
        p_days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-promotions", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-wallet", userId] });
    },
  });
}

// ── Admin hooks ───────────────────────────────────────────────────────────────

/** Fetch all promotions for admin */
export function useAdminPromotions() {
  return useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promoted_listings")
        .select(`
          *,
          course:courses(title, price, thumbnail_url),
          mentor:profiles(name, email, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return normalizePromotions(data);
    },
  });
}

/** Admin approve a pending promotion */
export function useApprovePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (promotionId: string) => {
      const { data, error } = await rpc("admin_approve_promotion", {
        p_promotion_id: promotionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    },
  });
}

/** Admin reject a pending promotion (refunds balance) */
export function useRejectPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      promotionId,
      reason,
    }: {
      promotionId: string;
      reason: string;
    }) => {
      // Refund balance to mentor wallet
      const { error: refundError } = await rpc("admin_refund_promotion", {
        p_promotion_id: promotionId,
      });
      if (refundError) throw refundError;

      // Update status to rejected
      const { error } = await supabase
        .from("promoted_listings")
        .update({
          status: "rejected",
          rejection_reason: reason,
        } as never)
        .eq("id", promotionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    },
  });
}
