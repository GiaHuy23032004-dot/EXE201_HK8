import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Booking {
  id: string;
  course_id: string;
  learner_id: string;
  mentor_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  phone: string | null;
  payment_method: string;
  status: "pending" | "upcoming" | "completed" | "cancelled" | "declined";
  total_price: number;
  note: string | null;
  created_at: string;
  course?: { title: string; image_url: string | null; price: number; start_date: string | null };
  mentor?: { name: string | null; avatar_url: string | null };
  learner?: { name: string | null; avatar_url: string | null };
}

// Bookings của learner
export function useLearnerBookings(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-bookings", learnerId],
    enabled: !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          course:courses(title, image_url, price, start_date),
          mentor:profiles!bookings_mentor_id_fkey(name, avatar_url)
        `)
        .eq("learner_id", learnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });
}

// Bookings của mentor
export function useMentorBookings(mentorId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-bookings", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          course:courses(title, image_url, price, start_date),
          learner:profiles!bookings_learner_id_fkey(name, avatar_url)
        `)
        .eq("mentor_id", mentorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });
}

// Tạo booking mới + transaction record
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      course_id: string;
      learner_id: string;
      mentor_id: string;
      schedule_id?: string;
      booking_date: string;
      start_time: string;
      end_time: string;
      phone?: string;
      payment_method: "later" | "platform";
      total_price: number;
    }) => {
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({ ...payload, status: "pending" })
        .select()
        .single();
      if (error) throw error;

      // 2. Tạo transaction record (nếu thanh toán qua platform)
      if (payload.payment_method === "platform") {
        const platformFee = Math.round(payload.total_price * 0.15);
        const refCode = `TXN-${Date.now().toString(36).toUpperCase()}`;
        await supabase.from("transactions").insert({
          booking_id: booking.id,
          learner_id: payload.learner_id,
          mentor_id: payload.mentor_id,
          course_id: payload.course_id,
          amount: payload.total_price,
          platform_fee: platformFee,
          net_amount: payload.total_price - platformFee,
          payment_method: "platform",
          txn_type: "online",
          status: "pending",
          reference_code: refCode,
        });
      }

      return booking;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["learner-bookings", vars.learner_id] });
    },
  });
}

// Mentor cập nhật trạng thái booking
export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, mentorId }: { id: string; status: "upcoming" | "completed" | "declined"; mentorId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      return { id, status, mentorId };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["mentor-bookings", res.mentorId] });
    },
  });
}

// Learner hủy booking
export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, learnerId }: { id: string; learnerId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("learner_id", learnerId);
      if (error) throw error;
      return { id, learnerId };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["learner-bookings", res.learnerId] });
    },
  });
}
