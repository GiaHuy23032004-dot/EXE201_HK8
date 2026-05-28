/**
 * useLearnerBookings.ts
 * Toàn bộ logic booking dành cho Learner (học viên)
 * - Xem danh sách lịch học
 * - Đặt lịch mới
 * - Hủy lịch
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerBooking {
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
  status: "pending" | "upcoming" | "completed" | "cancelled" | "declined";
  total_price: number;
  note: string | null;
  created_at: string;
  course?: { title: string; image_url: string | null; price: number; start_date: string | null };
  mentor?: { name: string | null; avatar_url: string | null };
}

export type LearnerBookingStatus = LearnerBooking["status"];

// ── Lấy tất cả bookings của learner ──────────────────────────────────────────
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
      return (data ?? []) as LearnerBooking[];
    },
  });
}

// ── Đặt lịch học mới ─────────────────────────────────────────────────────────
export interface CreateBookingPayload {
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
}

export function useCreateLearnerBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      // Kiểm tra ngày khai giảng
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("start_date")
        .eq("id", payload.course_id)
        .single();
      if (courseError) throw courseError;
      if (course?.start_date && payload.booking_date < course.start_date) {
        throw new Error("Không thể đặt lịch trước ngày khai giảng.");
      }

      // Tạo booking
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({ ...payload, status: "pending" })
        .select()
        .single();
      if (error) throw error;

      // Tạo transaction nếu thanh toán qua nền tảng
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
      qc.invalidateQueries({ queryKey: ["learner-transactions", vars.learner_id] });
    },
  });
}

// ── Hủy booking ──────────────────────────────────────────────────────────────
export function useCancelLearnerBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, learnerId }: { id: string; learnerId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("learner_id", learnerId)
        .eq("status", "upcoming"); // chỉ hủy được khi đang upcoming
      if (error) throw error;
      return { id, learnerId };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["learner-bookings", res.learnerId] });
    },
  });
}

// ── Lấy 1 booking theo id (cho trang biên lai) ────────────────────────────────
export function useLearnerBookingById(bookingId: string | undefined, learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-booking", bookingId],
    enabled: !!bookingId && !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          course:courses(title, image_url, price, category, format),
          mentor:profiles!bookings_mentor_id_fkey(name, avatar_url)
        `)
        .eq("id", bookingId!)
        .eq("learner_id", learnerId!)
        .single();
      if (error) throw error;
      return data as LearnerBooking;
    },
  });
}
