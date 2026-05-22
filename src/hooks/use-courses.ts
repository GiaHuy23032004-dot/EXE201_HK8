import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Course {
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
  created_at: string;
  // joined
  mentor?: {
    name: string | null;
    avatar_url: string | null;
    user_id: string;
  };
}

export interface CourseFilters {
  query?: string;
  category?: string | null;
  format?: "all" | "online" | "offline";
  minPrice?: number;
  maxPrice?: number;
}

// Fetch tất cả courses đã approved (cho trang Search & Home)
export function useCourses(filters?: CourseFilters) {
  return useQuery({
    queryKey: ["courses", filters],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select(`
          *,
          mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id)
        `)
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
      return (data ?? []) as Course[];
    },
  });
}

// Fetch 1 course theo id
export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: ["course", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          mentor:profiles!courses_mentor_id_fkey(name, avatar_url, user_id, bio, phone),
          course_schedules(*)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Fetch courses của mentor đang đăng nhập
export function useMentorCourses(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-courses", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Course[];
    },
  });
}

// Tạo course mới
export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      mentor_id: string;
      title: string;
      description?: string;
      category: string;
      format: "online" | "offline";
      price: number;
      location?: string;
      meeting_link?: string;
      image_url?: string;
      schedules?: { day_of_week: string; start_time: string; end_time: string }[];
    }) => {
      const { schedules, ...courseData } = payload;
      const { data, error } = await supabase
        .from("courses")
        .insert(courseData)
        .select()
        .single();
      if (error) throw error;

      if (schedules && schedules.length > 0) {
        const { error: schedErr } = await supabase
          .from("course_schedules")
          .insert(schedules.map((s) => ({ ...s, course_id: data.id })));
        if (schedErr) throw schedErr;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-courses"] });
    },
  });
}
