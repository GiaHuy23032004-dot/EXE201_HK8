/**
 * useLearnerReviews.ts
 * Toàn bộ logic đánh giá dành cho Learner
 * - Xem đánh giá của 1 khóa học
 * - Xem đánh giá đã viết
 * - Viết đánh giá mới
 * - Kiểm tra đã review booking chưa
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerReview {
  id: string;
  course_id: string;
  booking_id: string | null;
  learner_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  learner?: { name: string | null; avatar_url: string | null };
  course?: { title: string };
}

// ── Xem đánh giá của 1 khóa học (public) ─────────────────────────────────────
export function useCourseReviews(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course-reviews", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`*, learner:profiles!reviews_learner_id_fkey(name, avatar_url)`)
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LearnerReview[];
    },
  });
}

// ── Xem tất cả đánh giá learner đã viết ──────────────────────────────────────
export function useLearnerReviews(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-reviews", learnerId],
    enabled: !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`*, course:courses(title)`)
        .eq("learner_id", learnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LearnerReview[];
    },
  });
}

// ── Kiểm tra booking đã được review chưa ─────────────────────────────────────
export function useLearnerHasReviewed(bookingId: string | undefined, learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-has-reviewed", bookingId, learnerId],
    enabled: !!bookingId && !!learnerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId!)
        .eq("learner_id", learnerId!)
        .maybeSingle();
      return !!data;
    },
  });
}

// ── Viết đánh giá mới ─────────────────────────────────────────────────────────
export function useCreateLearnerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      course_id: string;
      booking_id: string;
      learner_id: string;
      rating: number;
      comment?: string;
    }) => {
      // Kiểm tra đã review chưa
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", payload.booking_id)
        .eq("learner_id", payload.learner_id)
        .maybeSingle();

      if (existing) throw new Error("Bạn đã đánh giá buổi học này rồi.");

      const { data, error } = await supabase
        .from("reviews")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["course-reviews", vars.course_id] });
      qc.invalidateQueries({ queryKey: ["learner-reviews", vars.learner_id] });
      qc.invalidateQueries({ queryKey: ["learner-has-reviewed", vars.booking_id, vars.learner_id] });
      qc.invalidateQueries({ queryKey: ["learner-course-detail", vars.course_id] });
    },
  });
}
