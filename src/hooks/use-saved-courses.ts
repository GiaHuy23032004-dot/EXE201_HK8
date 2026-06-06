import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCourseCategory } from "@/constants/courseCategories";

// Lấy danh sách course đã lưu của user
export function useSavedCourses(userId: string | undefined) {
  return useQuery({
    queryKey: ["saved-courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_courses")
        .select(`
          *,
          course:courses!inner(id, title, image_url, price, rating, review_count, format, category, status, is_hidden,
            mentor:profiles!courses_mentor_id_fkey(name, avatar_url)
          )
        `)
        .eq("user_id", userId!)
        .eq("course.status", "approved")
        .eq("course.is_hidden", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        ...item,
        course: item.course
          ? {
              ...item.course,
              category: normalizeCourseCategory(item.course.category),
            }
          : item.course,
      }));
    },
  });
}

// Toggle save/unsave course
export function useToggleSaveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, courseId, isSaved }: { userId: string; courseId: string; isSaved: boolean }) => {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_courses")
          .delete()
          .eq("user_id", userId)
          .eq("course_id", courseId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_courses")
          .insert({ user_id: userId, course_id: courseId });
        if (error) throw error;
      }
      return { userId, courseId, isSaved: !isSaved };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["saved-courses", res.userId] });
    },
  });
}

// Kiểm tra 1 course có được lưu chưa
export function useIsSaved(userId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ["is-saved", userId, courseId],
    enabled: !!userId && !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_courses")
        .select("id")
        .eq("user_id", userId!)
        .eq("course_id", courseId!)
        .maybeSingle();
      return !!data;
    },
  });
}
