import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCourseCategory } from "@/constants/courseCategories";

export interface CourseSchedule {
  id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  created_at: string;
  course?: {
    id: string;
    title: string;
    format: "online" | "offline";
    category: string;
    location: string | null;
    meeting_link: string | null;
    start_date: string | null;
  };
}

export interface CreateSchedulePayload {
  mentor_id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export interface UpdateSchedulePayload {
  id: string;
  mentor_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

type ScheduleOwnershipRow = {
  id: string;
  course_id: string;
  course?: { mentor_id: string } | null;
  courses?: { mentor_id: string } | null;
};

const DAY_ORDER: Record<string, number> = {
  "Thứ 2": 1,
  "Thứ 3": 2,
  "Thứ 4": 3,
  "Thứ 5": 4,
  "Thứ 6": 5,
  "Thứ 7": 6,
  "Chủ nhật": 7,
};

function assertTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime || endTime <= startTime) {
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  }
}

function getOwner(row: ScheduleOwnershipRow) {
  return row.course?.mentor_id ?? row.courses?.mentor_id;
}

async function verifyCourseOwner(courseId: string, mentorId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("mentor_id", mentorId)
    .single();

  if (error || !data) {
    throw new Error("Bạn không có quyền quản lý lịch dạy cho khóa học này.");
  }
}

async function verifyScheduleOwner(scheduleId: string, mentorId: string) {
  const { data, error } = await supabase
    .from("course_schedules")
    .select("id, course_id, course:courses!inner(mentor_id)")
    .eq("id", scheduleId)
    .single();

  const row = data as unknown as ScheduleOwnershipRow | null;
  if (error || !row) {
    throw new Error("Không tìm thấy lịch dạy.");
  }

  if (getOwner(row) !== mentorId) {
    throw new Error("Bạn không có quyền quản lý lịch dạy này.");
  }
}

export function useMentorSchedules(mentorId: string | undefined, courseId?: string) {
  return useQuery({
    queryKey: ["mentor-schedules", mentorId, courseId ?? "all"],
    enabled: !!mentorId,
    queryFn: async () => {
      let courseQuery = supabase
        .from("courses")
        .select("id, title, format, category, location, meeting_link, start_date")
        .eq("mentor_id", mentorId!);

      if (courseId) {
        courseQuery = courseQuery.eq("id", courseId);
      }

      const { data: courses, error: courseError } = await courseQuery;

      if (courseError) throw courseError;
      if (!courses?.length) return [] as CourseSchedule[];

      const normalizedCourses = courses.map((course) => ({
        ...course,
        category: normalizeCourseCategory(course.category),
      }));
      const courseIds = normalizedCourses.map((course) => course.id);
      const courseById = Object.fromEntries(normalizedCourses.map((course) => [course.id, course]));

      const { data: schedules, error: scheduleError } = await supabase
        .from("course_schedules")
        .select("id, course_id, day_of_week, start_time, end_time, created_at")
        .in("course_id", courseIds);

      if (scheduleError) throw scheduleError;

      return ((schedules ?? []) as CourseSchedule[])
        .map((schedule) => ({
          ...schedule,
          course: courseById[schedule.course_id],
        }))
        .sort((a, b) => {
          const dayDiff = (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99);
          return dayDiff || a.start_time.localeCompare(b.start_time);
        });
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mentor_id, course_id, day_of_week, start_time, end_time }: CreateSchedulePayload) => {
      if (!course_id) throw new Error("Vui lòng chọn khóa học.");
      if (!day_of_week) throw new Error("Vui lòng chọn ngày trong tuần.");
      assertTimeRange(start_time, end_time);
      await verifyCourseOwner(course_id, mentor_id);

      const { data, error } = await supabase
        .from("course_schedules")
        .insert({ course_id, day_of_week, start_time, end_time })
        .select("id, course_id, day_of_week, start_time, end_time, created_at")
        .single();

      if (error) throw error;
      return data as CourseSchedule;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-schedules", variables.mentor_id] });
      queryClient.invalidateQueries({ queryKey: ["mentor-bookings", variables.mentor_id] });
      queryClient.invalidateQueries({ queryKey: ["mentor-courses", variables.mentor_id] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, mentor_id, day_of_week, start_time, end_time }: UpdateSchedulePayload) => {
      if (!day_of_week) throw new Error("Vui lòng chọn ngày trong tuần.");
      assertTimeRange(start_time, end_time);
      await verifyScheduleOwner(id, mentor_id);

      const { data, error } = await supabase
        .from("course_schedules")
        .update({ day_of_week, start_time, end_time })
        .eq("id", id)
        .select("id, course_id, day_of_week, start_time, end_time, created_at")
        .single();

      if (error) throw error;
      return data as CourseSchedule;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-schedules", variables.mentor_id] });
      queryClient.invalidateQueries({ queryKey: ["mentor-bookings", variables.mentor_id] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, mentor_id }: { id: string; mentor_id: string }) => {
      await verifyScheduleOwner(id, mentor_id);

      const { error } = await supabase
        .from("course_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-schedules", variables.mentor_id] });
      queryClient.invalidateQueries({ queryKey: ["mentor-bookings", variables.mentor_id] });
    },
  });
}
