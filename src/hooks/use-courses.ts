import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CourseScheduleSummary {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

type CourseBookingStatus = "pending" | "upcoming" | "completed" | "cancelled" | "declined";

export interface Course {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string;
  format: "online" | "offline";
  price: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  location_geocoded_at?: string | null;
  meeting_link: string | null;
  image_url: string | null;
  status: "pending" | "approved" | "rejected";
  is_promoted: boolean;
  students_count: number;
  rating: number;
  review_count: number;
  start_date: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  admin_note?: string | null;
  is_hidden: boolean;
  hidden_reason?: string | null;
  hidden_at?: string | null;
  hidden_by?: string | null;
  created_at: string;
  updated_at?: string;
  course_schedules?: CourseScheduleSummary[];
  active_booking_count?: number;
  // joined
  mentor?: {
    name: string | null;
    avatar_url: string | null;
    user_id: string;
  };
}

export interface CourseFilters {
  query?: string;
  location?: string;
  category?: string | null;
  format?: "all" | "online" | "offline";
  minPrice?: number;
  maxPrice?: number;
}

const ACTIVE_BOOKING_STATUSES = new Set<CourseBookingStatus>(["pending", "upcoming", "completed"]);

type MentorCourseRow = Course & {
  bookings?: { id: string; status: CourseBookingStatus }[];
};

function normalizeMentorCourse(course: MentorCourseRow): Course {
  const schedules = [...(course.course_schedules ?? [])].sort((a, b) => {
    const timeDiff = a.start_time.localeCompare(b.start_time);
    return timeDiff || a.day_of_week.localeCompare(b.day_of_week);
  });
  const activeBookingCount = (course.bookings ?? []).filter((booking) =>
    ACTIVE_BOOKING_STATUSES.has(booking.status),
  ).length;

  const { bookings: _bookings, ...rest } = course;
  return {
    ...rest,
    course_schedules: schedules,
    active_booking_count: activeBookingCount,
  };
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
        .eq("is_hidden", false)
        .order("is_promoted", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.format && filters.format !== "all") q = q.eq("format", filters.format);
      if (filters?.minPrice !== undefined) q = q.gte("price", filters.minPrice);
      if (filters?.maxPrice !== undefined) q = q.lte("price", filters.maxPrice);
      if (filters?.query) q = q.ilike("title", `%${filters.query}%`);
      if (filters?.location) {
        const locationTerm = filters.location.split(",")[0]?.trim() || filters.location.trim();
        if (locationTerm) q = q.ilike("location", `%${locationTerm}%`);
      }

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
        .eq("status", "approved")
        .eq("is_hidden", false)
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
        .select(`
          *,
          course_schedules(id, day_of_week, start_time, end_time),
          bookings(id, status)
        `)
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as MentorCourseRow[]).map(normalizeMentorCourse);
    },
  });
}

// Xóa course
export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-schedules"] });
    },
  });
}

// Cập nhật course (chỉ các trường mentor được phép sửa)
export interface UpdateCoursePayload {
  id: string;
  mentor_id: string; // dùng để xác thực ownership trong WHERE clause
  title: string;
  description: string | null;
  category: string;
  format: "online" | "offline";
  price: number;
  location: string | null;
  meeting_link: string | null;
  image_url: string | null;
  start_date: string | null;
}

async function ensureMentorCanManageCourses(mentorId: string) {
  const { data, error } = await supabase
    .from("mentor_restrictions")
    .select("restriction_type, reason, expires_at")
    .eq("mentor_id", mentorId)
    .in("restriction_type", ["posting_suspended", "account_locked"]);

  if (error) throw error;

  const now = Date.now();
  const activeRestrictions = (data ?? []).filter((restriction) => {
    return !restriction.expires_at || new Date(restriction.expires_at).getTime() > now;
  });

  const accountLock = activeRestrictions.find((restriction) => restriction.restriction_type === "account_locked");
  if (accountLock) {
    throw new Error(accountLock.reason || "Tài khoản mentor đang bị khóa, không thể quản lý khóa học.");
  }

  const postingSuspension = activeRestrictions.find((restriction) => restriction.restriction_type === "posting_suspended");
  if (postingSuspension) {
    const until = postingSuspension.expires_at
      ? ` đến ${new Date(postingSuspension.expires_at).toLocaleDateString("vi-VN")}`
      : "";
    throw new Error(`Bạn đang bị tạm khóa quyền đăng/chỉnh sửa khóa học${until}.`);
  }
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mentor_id, ...fields }: UpdateCoursePayload) => {
      await ensureMentorCanManageCourses(mentor_id);

      const { data, error } = await supabase
        .from("courses")
        .update(fields)
        .eq("id", id)
        .eq("mentor_id", mentor_id)
        .select()
        .single();
      if (error) throw error;
      return data as Course;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-courses", vars.mentor_id] });
      qc.invalidateQueries({ queryKey: ["course", vars.id] });
      qc.invalidateQueries({ queryKey: ["mentor-schedules", vars.mentor_id] });
      qc.invalidateQueries({ queryKey: ["mentor-bookings", vars.mentor_id] });
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
      start_date: string;
      schedules?: { day_of_week: string; start_time: string; end_time: string }[];
    }) => {
      const { schedules, ...courseData } = payload;
      await ensureMentorCanManageCourses(payload.mentor_id);

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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-courses"] });
      qc.invalidateQueries({ queryKey: ["mentor-schedules", variables.mentor_id] });
    },
  });
}
