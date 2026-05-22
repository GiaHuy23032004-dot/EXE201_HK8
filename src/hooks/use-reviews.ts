import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Review {
  id: string;
  course_id: string;
  booking_id: string | null;
  learner_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  learner?: { name: string | null; avatar_url: string | null };
}

// Reviews của 1 course
export function useCourseReviews(courseId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          learner:profiles!reviews_learner_id_fkey(name, avatar_url)
        `)
        .eq("course_id", courseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

// Reviews của learner (cho dashboard)
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
      return data ?? [];
    },
  });
}

// Tạo review
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      course_id: string;
      booking_id?: string;
      learner_id: string;
      rating: number;
      comment?: string;
    }) => {
      const { data, error } = await supabase
        .from("reviews")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["reviews", vars.course_id] });
      qc.invalidateQueries({ queryKey: ["learner-reviews", vars.learner_id] });
      qc.invalidateQueries({ queryKey: ["course", vars.course_id] });
    },
  });
}
