import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── types ────────────────────────────────────────────────────────────────────

export type BookingStatus = "pending" | "upcoming" | "completed" | "cancelled" | "declined";

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
  // enriched
  course?: {
    id: string;
    title: string;
    category: string;
    format: "online" | "offline";
    location: string | null;
    meeting_link: string | null;
  };
  learner?: {
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  };
}

// ─── fetch all bookings for mentor ───────────────────────────────────────────

export function useMentorScheduleBookings(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-schedule-bookings", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          course:courses(id, title, category, format, location, meeting_link),
          learner:profiles!bookings_learner_id_fkey(name, avatar_url, phone, email)
        `)
        .eq("mentor_id", mentorId!)
        .order("booking_date", { ascending: true })
        .order("start_time",   { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScheduleBooking[];
    },
  });
}

// ─── update booking status (mentor only) ─────────────────────────────────────

export function useUpdateScheduleBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      mentorId,
    }: {
      id: string;
      status: "upcoming" | "completed" | "declined";
      mentorId: string;
    }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .eq("mentor_id", mentorId);
      if (error) throw error;
      return { id, status, mentorId };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["mentor-schedule-bookings", res.mentorId] });
      qc.invalidateQueries({ queryKey: ["mentor-bookings",          res.mentorId] });
    },
  });
}
