import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCourseCategory } from "@/constants/courseCategories";

export type BookingStatus = "pending" | "upcoming" | "completed" | "cancelled" | "declined";
export type BookingStatusFilter = "all" | BookingStatus;

export interface MentorBookingFilters {
  search?: string;
  courseId?: string;
  learnerId?: string;
  status?: BookingStatusFilter;
}

export interface ScheduleBooking {
  id: string;
  course_id: string;
  learner_id: string;
  mentor_id: string;
  schedule_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  phone: string | null;
  payment_method: string;
  status: BookingStatus;
  total_price: number;
  note: string | null;
  created_at: string;
  course?: {
    id: string;
    title: string;
    category: string;
    format: "online" | "offline";
    location: string | null;
    meeting_link: string | null;
    start_date: string | null;
  } | null;
  learner?: {
    user_id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

type BookingRow = Omit<ScheduleBooking, "course" | "learner">;
type CourseRow = NonNullable<ScheduleBooking["course"]>;
type LearnerRow = NonNullable<ScheduleBooking["learner"]>;

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toWeekStartIso(weekStart: Date | string | undefined) {
  if (!weekStart) return "";
  return typeof weekStart === "string" ? weekStart : formatLocalDate(weekStart);
}

function normalizeFilters(filters: MentorBookingFilters = {}) {
  return {
    search: filters.search?.trim().toLowerCase() ?? "",
    courseId: filters.courseId && filters.courseId !== "all" ? filters.courseId : "all",
    learnerId: filters.learnerId && filters.learnerId !== "all" ? filters.learnerId : "all",
    status: (filters.status && filters.status !== "all" ? filters.status : "all") as BookingStatusFilter,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesSearch(booking: ScheduleBooking, search: string) {
  if (!search) return true;

  return [
    booking.course?.title,
    booking.learner?.name,
    booking.learner?.email,
    booking.phone,
    booking.note,
  ].some((value) => (value ?? "").toLowerCase().includes(search));
}

async function fetchMentorBookings(
  mentorId: string,
  weekStartIso: string,
  weekEndIso: string,
  filters: MentorBookingFilters = {},
) {
  const normalizedFilters = normalizeFilters(filters);
  let query = supabase
    .from("bookings")
    .select(`
      id,
      course_id,
      learner_id,
      mentor_id,
      schedule_id,
      booking_date,
      start_time,
      end_time,
      phone,
      payment_method,
      status,
      total_price,
      note,
      created_at
    `)
    .eq("mentor_id", mentorId)
    .gte("booking_date", weekStartIso)
    .lte("booking_date", weekEndIso)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (normalizedFilters.courseId !== "all") {
    query = query.eq("course_id", normalizedFilters.courseId);
  }

  if (normalizedFilters.learnerId !== "all") {
    query = query.eq("learner_id", normalizedFilters.learnerId);
  }

  if (normalizedFilters.status !== "all") {
    query = query.eq("status", normalizedFilters.status as BookingStatus);
  }

  const { data: bookingRows, error: bookingError } = await query;
  if (bookingError) throw bookingError;

  const bookings = (bookingRows ?? []) as BookingRow[];
  if (bookings.length === 0) return [] as ScheduleBooking[];

  const courseIds = unique(bookings.map((booking) => booking.course_id));
  const learnerIds = unique(bookings.map((booking) => booking.learner_id));

  const [courseResult, learnerResult] = await Promise.all([
    courseIds.length
      ? supabase
          .from("courses")
          .select("id, title, category, format, location, meeting_link, start_date")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    learnerIds.length
      ? supabase
          .from("profiles")
          .select("user_id, name, email, avatar_url, phone")
          .in("user_id", learnerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (courseResult.error) throw courseResult.error;
  if (learnerResult.error) throw learnerResult.error;

  const courseById = new Map(
    (courseResult.data ?? []).map((course) => [
      course.id,
      {
        ...(course as CourseRow),
        category: normalizeCourseCategory(course.category),
      },
    ]),
  );
  const learnerById = new Map(
    (learnerResult.data ?? []).map((learner) => [learner.user_id, learner as LearnerRow]),
  );

  return bookings
    .map((booking) => ({
      ...booking,
      course: courseById.get(booking.course_id) ?? null,
      learner: learnerById.get(booking.learner_id) ?? null,
    }))
    .filter((booking) => matchesSearch(booking, normalizedFilters.search)) as ScheduleBooking[];
}

function useMentorBookingsQuery(
  queryKeyPrefix: "mentor-bookings" | "mentor-schedule-stats",
  mentorId: string | undefined,
  weekStart: Date | string | undefined,
  filters: MentorBookingFilters = {},
) {
  const weekStartIso = toWeekStartIso(weekStart);
  const weekEndIso = weekStartIso
    ? formatLocalDate(addDays(new Date(`${weekStartIso}T00:00:00`), 6))
    : "";
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: [queryKeyPrefix, mentorId, weekStartIso, weekEndIso, normalizedFilters],
    enabled: !!mentorId && !!weekStartIso && !!weekEndIso,
    queryFn: () => fetchMentorBookings(mentorId!, weekStartIso, weekEndIso, normalizedFilters),
  });
}

export function useMentorBookings(
  mentorId: string | undefined,
  weekStart: Date | string | undefined,
  filters: MentorBookingFilters = {},
) {
  return useMentorBookingsQuery("mentor-bookings", mentorId, weekStart, filters);
}

export function useMentorScheduleStats(
  mentorId: string | undefined,
  weekStart: Date | string | undefined,
  filters: Pick<MentorBookingFilters, "courseId" | "learnerId"> = {},
) {
  return useMentorBookingsQuery("mentor-schedule-stats", mentorId, weekStart, {
    ...filters,
    status: "all",
    search: "",
  });
}

export const useMentorScheduleBookings = useMentorBookings;

export function useUpdateMentorBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      mentorId,
      status,
      expectedStatus,
    }: {
      id: string;
      mentorId: string;
      status: Extract<BookingStatus, "upcoming" | "completed" | "declined">;
      expectedStatus?: BookingStatus;
    }) => {
      let query = supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .eq("mentor_id", mentorId);

      if (expectedStatus) {
        query = query.eq("status", expectedStatus);
      }

      const { data, error } = await query.select("id, mentor_id, status").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-bookings", variables.mentorId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-schedule-stats", variables.mentorId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-students", variables.mentorId] });
    },
  });
}

export const useUpdateScheduleBookingStatus = useUpdateMentorBookingStatus;
