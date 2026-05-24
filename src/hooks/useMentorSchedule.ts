import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── types ────────────────────────────────────────────────────────────────────

export interface CourseSchedule {
  id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  created_at: string;
  // enriched
  course?: {
    id: string;
    title: string;
    format: "online" | "offline";
    category: string;
    location: string | null;
    meeting_link: string | null;
  };
}

export interface CreateSchedulePayload {
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  mentor_id: string; // used for ownership validation
}

export interface UpdateSchedulePayload {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  mentor_id: string; // used for ownership validation
}

// ─── fetch all schedules for mentor's courses ─────────────────────────────────

export function useMentorSchedules(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-schedules", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      // Step 1: get all course ids owned by this mentor
      const { data: courses, error: cErr } = await supabase
        .from("courses")
        .select("id, title, format, category, location, meeting_link")
        .eq("mentor_id", mentorId!);
      if (cErr) throw cErr;
      if (!courses || courses.length === 0) return [] as CourseSchedule[];

      const courseIds = courses.map((c) => c.id);
      const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));

      // Step 2: fetch schedules for those courses
      const { data: schedules, error: sErr } = await supabase
        .from("course_schedules")
        .select("*")
        .in("course_id", courseIds)
        .order("day_of_week")
        .order("start_time");
      if (sErr) throw sErr;

      return ((schedules ?? []) as CourseSchedule[]).map((s) => ({
        ...s,
        course: courseMap[s.course_id],
      }));
    },
  });
}

// ─── create schedule ──────────────────────────────────────────────────────────

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mentor_id, ...payload }: CreateSchedulePayload) => {
      // Verify ownership
      const { data: course, error: cErr } = await supabase
        .from("courses")
        .select("id")
        .eq("id", payload.course_id)
        .eq("mentor_id", mentor_id)
        .single();
      if (cErr || !course) throw new Error("Bạn không có quyền thêm lịch cho khóa học này.");

      const { data, error } = await supabase
        .from("course_schedules")
        .insert({
          course_id:   payload.course_id,
          day_of_week: payload.day_of_week,
          start_time:  payload.start_time,
          end_time:    payload.end_time,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CourseSchedule;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mentor-schedules", vars.mentor_id] });
    },
  });
}

// ─── update schedule ──────────────────────────────────────────────────────────

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mentor_id, ...fields }: UpdateSchedulePayload) => {
      // Verify ownership via join
      const { data: existing, error: eErr } = await supabase
        .from("course_schedules")
        .select("id, course_id, courses!inner(mentor_id)")
        .eq("id", id)
        .single();
      if (eErr || !existing) throw new Error("Không tìm thấy lịch dạy.");
      const owner = (existing as any).courses?.mentor_id;
      if (owner !== mentor_id) throw new Error("Bạn không có quyền chỉnh sửa lịch này.");

      const { data, error } = await supabase
        .from("course_schedules")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CourseSchedule;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mentor-schedules", vars.mentor_id] });
    },
  });
}

// ─── delete schedule ──────────────────────────────────────────────────────────

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mentor_id }: { id: string; mentor_id: string }) => {
      // Verify ownership
      const { data: existing, error: eErr } = await supabase
        .from("course_schedules")
        .select("id, course_id, courses!inner(mentor_id)")
        .eq("id", id)
        .single();
      if (eErr || !existing) throw new Error("Không tìm thấy lịch dạy.");
      const owner = (existing as any).courses?.mentor_id;
      if (owner !== mentor_id) throw new Error("Bạn không có quyền xóa lịch này.");

      const { error } = await supabase
        .from("course_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mentor-schedules", vars.mentor_id] });
    },
  });
}
