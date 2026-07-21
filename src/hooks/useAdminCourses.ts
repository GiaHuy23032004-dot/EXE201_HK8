import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminCourseStatus = "pending" | "approved" | "rejected";
export type AdminCourseAction =
  | "approve_course"
  | "reject_course"
  | "hide_course"
  | "unhide_course"
  | "delete_course_if_safe";

export type CourseCounts = {
  bookings: number;
  completed_bookings?: number;
  reviews: number;
  transactions: number;
  reports: number;
};

export type CourseSchedule = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

export type CourseReportSummary = {
  id: string;
  title: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
  admin_verdict?: string | null;
};

export type AdminCourse = {
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
  status: AdminCourseStatus;
  is_promoted: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  students_count: number;
  rating: number;
  review_count: number;
  reviewed_by?: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  mentor: {
    user_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  counts: CourseCounts;
  completed_bookings_count?: number;
  can_delete: boolean;
  course_schedules?: CourseSchedule[];
  related_reports?: CourseReportSummary[];
};

type AdminCourseResponse = {
  error?: string;
  courses?: AdminCourse[];
  course?: AdminCourse;
  reports?: CourseReportSummary[];
  counts?: CourseCounts;
  success?: boolean;
};

export const adminCourseKeys = {
  all: ["admin-courses"] as const,
  list: () => ["admin-courses", "list"] as const,
  detail: (courseId: string | null | undefined) => ["admin-courses", "detail", courseId] as const,
};

export function useAdminCourseApi() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const invokeCourseAction = useCallback(
    async (body: Record<string, unknown>) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Missing admin session");

      const { data, error } = await supabase.functions.invoke<AdminCourseResponse>("admin-course-actions", {
        body,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (import.meta.env.DEV) {
        console.log("admin-course-actions response", { body, data, error });
      }

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Không thể thực hiện thao tác.");
      }

      return data ?? {};
    },
    [session?.access_token],
  );

  const refreshCourses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: adminCourseKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["courses"] });
    await queryClient.invalidateQueries({ queryKey: ["public-courses"] });
  }, [queryClient]);

  return {
    accessToken: session?.access_token,
    invokeCourseAction,
    refreshCourses,
  };
}

export function useAdminCourses() {
  const { accessToken, invokeCourseAction } = useAdminCourseApi();

  return useQuery({
    queryKey: adminCourseKeys.list(),
    enabled: !!accessToken,
    queryFn: async () => {
      const data = await invokeCourseAction({ action: "list_courses" });
      return data.courses ?? [];
    },
  });
}

export function useAdminCourseDetail(courseId: string | null | undefined, enabled = true) {
  const { accessToken, invokeCourseAction } = useAdminCourseApi();

  return useQuery({
    queryKey: adminCourseKeys.detail(courseId),
    enabled: Boolean(accessToken && courseId && enabled),
    queryFn: async () => {
      const data = await invokeCourseAction({ action: "get_course_detail", courseId });
      return data.course as AdminCourse;
    },
  });
}

export function useAdminCourseActions() {
  const api = useAdminCourseApi();

  return {
    ...api,
    updateCourse: (payload: { action: AdminCourseAction; courseId: string; reason?: string }) =>
      api.invokeCourseAction(payload),
  };
}
