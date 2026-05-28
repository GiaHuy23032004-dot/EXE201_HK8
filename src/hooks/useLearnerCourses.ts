/**
 * useLearnerCourses.ts
 * Toàn bộ logic khóa học dành cho Learner
 * - Tìm kiếm, lọc khóa học
 * - Xem chi tiết khóa học
 * - Lưu / bỏ lưu khóa học
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerCourse {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string;
  format: "online" | "offline";
  price: number;
  location: string | null;
  meeting_link: string | null;
  image_url: string | null;
  status: "pending" | "approved" | "rejected";
  is_promoted: boolean;
  students_count: number;
  rating: number;
  review_count: number;
  start_date: string | null;
  created_at: string;
  mentor?: { name: string | null; avatar_url: string | null; user_id: string };
  course_schedules?: { id: string; day_of_week: string; start_time: string; end_time: string }[];
}

export interface CourseSearchFilters {
  query?: string;
  category?: string | null;
  format?: "all" | "online" | "offline";
  minPrice?: number;
  maxPrice?: number;
}

// ── Tìm kiếm & lọc khóa học ──────────────────────────────────────────────────
export function useLearnerSearchCourses(filters?: CourseSearchFilters) {
  return useQuery({
    queryKey: ["learner-courses", filters],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select(`*, mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id)`)
        .eq("status", "approved")
        .order("is_promoted", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.format && filters.format !== "all") q = q.eq("format", filters.format);
      if (filters?.minPrice !== undefined) q = q.gte("price", filters.minPrice);
      if (filters?.maxPrice !== undefined) q = q.lte("price", filters.maxPrice);
      if (filters?.query) q = q.ilike("title", `%${filters.query}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LearnerCourse[];
    },
  });
}

// ── Xem chi tiết 1 khóa học ───────────────────────────────────────────────────
export function useLearnerCourseDetail(courseId: string | undefined) {
  return useQuery({
    queryKey: ["learner-course-detail", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id, bio, phone),
          course_schedules(id, day_of_week, start_time, end_time)
        `)
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data as LearnerCourse;
    },
  });
}

// ── Lưu khóa học (wishlist) ───────────────────────────────────────────────────
export function useLearnerSavedCourses(userId: string | undefined) {
  return useQuery({
    queryKey: ["learner-saved-courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_courses")
        .select(`
          *,
          course:courses(
            id, title, image_url, price, rating, review_count, format, category,
            mentor:profiles!courses_mentor_id_fkey(name, avatar_url)
          )
        `)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Kiểm tra đã lưu chưa ─────────────────────────────────────────────────────
export function useLearnerIsSaved(userId: string | undefined, courseId: string | undefined) {
  return useQuery({
    queryKey: ["learner-is-saved", userId, courseId],
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

// ── Toggle lưu / bỏ lưu ──────────────────────────────────────────────────────
export function useLearnerToggleSaveCourse() {
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
      qc.invalidateQueries({ queryKey: ["learner-saved-courses", res.userId] });
      qc.invalidateQueries({ queryKey: ["learner-is-saved", res.userId, res.courseId] });
    },
  });
}
