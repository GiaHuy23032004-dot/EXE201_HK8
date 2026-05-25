import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BookingStatus } from "@/hooks/useMentorBookings";

export type StudentLearningStatus = "pending" | "learning" | "completed" | "cancelled";

export interface MentorStudentProfile {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  created_at: string;
}

export interface MentorStudentCourse {
  id: string;
  title: string;
  category: string;
  format: "online" | "offline";
  price: number;
  location: string | null;
  meeting_link: string | null;
}

export interface MentorStudentBooking {
  id: string;
  learner_id: string;
  course_id: string;
  mentor_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  total_price: number;
  phone: string | null;
  note: string | null;
  payment_method: string;
  created_at: string;
  course?: MentorStudentCourse | null;
}

export interface MentorStudent {
  learner_id: string;
  profile: MentorStudentProfile | null;
  bookings: MentorStudentBooking[];
  total_bookings: number;
  completed_bookings: number;
  upcoming_bookings: number;
  pending_bookings: number;
  cancelled_or_declined_bookings: number;
  total_spent: number;
  last_booking_date: string | null;
  next_booking_date: string | null;
  next_booking: MentorStudentBooking | null;
  courses_enrolled: MentorStudentCourse[];
  latest_status: StudentLearningStatus;
}

export interface MentorStudentStats {
  total: number;
  learning: number;
  pending: number;
  completed: number;
}

type RawBookingRow = Omit<MentorStudentBooking, "course">;

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingDateTimeValue(booking: Pick<MentorStudentBooking, "booking_date" | "start_time">) {
  return `${booking.booking_date}T${booking.start_time ?? "00:00"}`;
}

function sortBookingsNewestFirst(a: MentorStudentBooking, b: MentorStudentBooking) {
  return bookingDateTimeValue(b).localeCompare(bookingDateTimeValue(a));
}

function deriveLatestStatus(bookings: MentorStudentBooking[]): StudentLearningStatus {
  if (bookings.some((booking) => booking.status === "pending")) return "pending";
  if (bookings.some((booking) => booking.status === "upcoming")) return "learning";
  if (bookings.some((booking) => booking.status === "completed")) return "completed";
  return "cancelled";
}

function groupStudents(
  bookings: RawBookingRow[],
  profilesById: Map<string, MentorStudentProfile>,
  coursesById: Map<string, MentorStudentCourse>,
) {
  const todayIso = formatLocalDate(new Date());
  const byLearner = new Map<string, MentorStudentBooking[]>();

  for (const booking of bookings) {
    const enriched: MentorStudentBooking = {
      ...booking,
      course: coursesById.get(booking.course_id) ?? null,
    };
    const current = byLearner.get(booking.learner_id) ?? [];
    current.push(enriched);
    byLearner.set(booking.learner_id, current);
  }

  return Array.from(byLearner.entries()).map(([learnerId, learnerBookings]) => {
    const sortedBookings = [...learnerBookings].sort(sortBookingsNewestFirst);
    const completedBookings = learnerBookings.filter((booking) => booking.status === "completed").length;
    const upcomingBookings = learnerBookings.filter((booking) => booking.status === "upcoming").length;
    const pendingBookings = learnerBookings.filter((booking) => booking.status === "pending").length;
    const cancelledOrDeclinedBookings = learnerBookings.filter(
      (booking) => booking.status === "cancelled" || booking.status === "declined",
    ).length;

    const lastBooking = learnerBookings
      .filter((booking) => booking.booking_date <= todayIso)
      .sort(sortBookingsNewestFirst)[0] ?? null;

    const nextBooking = learnerBookings
      .filter(
        (booking) =>
          booking.booking_date >= todayIso &&
          (booking.status === "pending" || booking.status === "upcoming"),
      )
      .sort((a, b) => bookingDateTimeValue(a).localeCompare(bookingDateTimeValue(b)))[0] ?? null;

    const coursesByStudent = new Map<string, MentorStudentCourse>();
    for (const booking of learnerBookings) {
      if (booking.course) coursesByStudent.set(booking.course.id, booking.course);
    }

    return {
      learner_id: learnerId,
      profile: profilesById.get(learnerId) ?? null,
      bookings: sortedBookings,
      total_bookings: learnerBookings.length,
      completed_bookings: completedBookings,
      upcoming_bookings: upcomingBookings,
      pending_bookings: pendingBookings,
      cancelled_or_declined_bookings: cancelledOrDeclinedBookings,
      total_spent: learnerBookings
        .filter((booking) => booking.status === "completed" || booking.status === "upcoming")
        .reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0),
      last_booking_date: lastBooking?.booking_date ?? null,
      next_booking_date: nextBooking?.booking_date ?? null,
      next_booking: nextBooking,
      courses_enrolled: Array.from(coursesByStudent.values()),
      latest_status: deriveLatestStatus(learnerBookings),
    } satisfies MentorStudent;
  });
}

async function fetchMentorStudentRows(mentorId: string, learnerId?: string) {
  let bookingQuery = supabase
    .from("bookings")
    .select(`
      id,
      learner_id,
      course_id,
      mentor_id,
      booking_date,
      start_time,
      end_time,
      status,
      total_price,
      phone,
      note,
      payment_method,
      created_at
    `)
    .eq("mentor_id", mentorId)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (learnerId) {
    bookingQuery = bookingQuery.eq("learner_id", learnerId);
  }

  const { data: bookings, error: bookingError } = await bookingQuery;
  if (bookingError) throw bookingError;

  const bookingRows = (bookings ?? []) as RawBookingRow[];
  if (bookingRows.length === 0) {
    return [] as MentorStudent[];
  }

  const learnerIds = Array.from(new Set(bookingRows.map((booking) => booking.learner_id)));
  const courseIds = Array.from(new Set(bookingRows.map((booking) => booking.course_id)));

  const [profilesResult, coursesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, name, email, avatar_url, phone, bio, created_at")
      .in("user_id", learnerIds),
    supabase
      .from("courses")
      .select("id, title, category, format, price, location, meeting_link")
      .in("id", courseIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (coursesResult.error) throw coursesResult.error;

  const profilesById = new Map(
    ((profilesResult.data ?? []) as MentorStudentProfile[]).map((profile) => [profile.user_id, profile]),
  );
  const coursesById = new Map(
    ((coursesResult.data ?? []) as MentorStudentCourse[]).map((course) => [course.id, course]),
  );

  return groupStudents(bookingRows, profilesById, coursesById);
}

export function useMentorStudents(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-students", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const students = await fetchMentorStudentRows(mentorId!);
      return students.sort((a, b) => {
        const aDate = a.next_booking_date ?? a.last_booking_date ?? "";
        const bDate = b.next_booking_date ?? b.last_booking_date ?? "";
        return bDate.localeCompare(aDate);
      });
    },
  });
}

export function buildMentorStudentStats(students: MentorStudent[]): MentorStudentStats {
  return {
    total: students.length,
    learning: students.filter((student) => student.upcoming_bookings > 0).length,
    pending: students.filter((student) => student.pending_bookings > 0).length,
    completed: students.filter(
      (student) =>
        student.latest_status === "completed" ||
        (student.completed_bookings > 0 && student.pending_bookings === 0 && student.upcoming_bookings === 0),
    ).length,
  };
}

export function useUpdateMentorStudentBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      mentorId,
      learnerId,
      status,
      expectedStatus,
    }: {
      id: string;
      mentorId: string;
      learnerId?: string;
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

      const { data, error } = await query
        .select("id, learner_id, mentor_id, status")
        .single();

      if (error) throw error;
      return {
        booking: data,
        mentorId,
        learnerId: learnerId ?? data.learner_id,
      };
    },
    onSuccess: ({ mentorId, learnerId }) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-students", mentorId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-student-detail", mentorId, learnerId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-bookings", mentorId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-schedules", mentorId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-schedule-stats", mentorId] });
    },
  });
}

export async function fetchMentorStudentDetail(mentorId: string, learnerId: string) {
  const students = await fetchMentorStudentRows(mentorId, learnerId);
  return students[0] ?? null;
}
