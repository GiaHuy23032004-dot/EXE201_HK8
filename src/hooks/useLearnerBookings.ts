/**
 * useLearnerBookings.ts
 * Toàn bộ logic booking dành cho Learner (học viên)
 * - Xem danh sách lịch học
 * - Đặt lịch mới
 * - Hủy lịch
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LearnerPaymentOption } from "@/lib/learnerPayment";
import { normalizeCourseCategory } from "@/constants/courseCategories";

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
  original_total_price?: number | null;
  voucher_discount_amount?: number | null;
  applied_voucher_id?: string | null;
  note: string | null;
  created_at: string;
  course?: {
    title: string;
    image_url: string | null;
    price: number;
    start_date: string | null;
    category?: string;
    format: "online" | "offline";
  };
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
          course:courses(title, image_url, price, start_date, format),
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
  payment_option?: LearnerPaymentOption;
  platform_amount?: number;
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
      const bookingPayload = {
        course_id: payload.course_id,
        learner_id: payload.learner_id,
        mentor_id: payload.mentor_id,
        schedule_id: payload.schedule_id,
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        phone: payload.phone,
        payment_method: payload.payment_method,
        total_price: payload.total_price,
        status: "pending" as const,
      };

      const { data: booking, error } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select()
        .single();
      if (error) throw error;

      // Backend integration point:
      // for platform_full/platform_deposit, create the payment session and transaction
      // through a protected Edge Function. The frontend must not insert transactions
      // directly because RLS correctly blocks that table.

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
          course:courses(title, image_url, price, start_date, category, format),
          mentor:profiles!bookings_mentor_id_fkey(name, avatar_url)
        `)
        .eq("id", bookingId!)
        .eq("learner_id", learnerId!)
        .single();
      if (error) throw error;
      return {
        ...(data as LearnerBooking),
        course: (data as LearnerBooking).course
          ? {
              ...(data as LearnerBooking).course,
              category: normalizeCourseCategory((data as LearnerBooking).course?.category),
            }
          : (data as LearnerBooking).course,
      } as LearnerBooking;
    },
  });
}
