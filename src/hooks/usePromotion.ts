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

export const PROMOTION_PACKAGES = [
  { days: 3,  label: "3 ngày",  price: 3 * RATE_PER_DAY },
  { days: 7,  label: "7 ngày",  price: 7 * RATE_PER_DAY },
  { days: 14, label: "14 ngày", price: 14 * RATE_PER_DAY },
  { days: 30, label: "30 ngày", price: 30 * RATE_PER_DAY },
];

// ── Mentor hooks ──────────────────────────────────────────────────────────────

/** Fetch all promotions for the current mentor */
export function useMentorPromotions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mentor-promotions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promoted_listings")
        .select(`
          *,
          course:courses(title, price, thumbnail_url)
        `)
        .eq("mentor_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Promotion[];
    },
  });
}

/** Request a promotion for a course (deducts balance via RPC) */
export function useRequestPromotion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      course_id,
      days,
    }: {
      course_id: string;
      days: number;
    }) => {
      const { data, error } = await supabase.rpc("request_course_promotion", {
        p_course_id: course_id,
        p_days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-promotions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["mentor-wallet", user?.id] });
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
      return data as Promotion[];
    },
  });
}

/** Admin approve a pending promotion */
export function useApprovePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (promotionId: string) => {
      const { data, error } = await supabase.rpc("admin_approve_promotion", {
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
      const { error: refundError } = await supabase.rpc("admin_refund_promotion", {
        p_promotion_id: promotionId,
      });
      if (refundError) throw refundError;

      // Update status to rejected
      const { error } = await supabase
        .from("promoted_listings")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", promotionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    },
  });
}
