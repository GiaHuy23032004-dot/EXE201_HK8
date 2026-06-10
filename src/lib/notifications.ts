/**
 * Utility để tạo notifications từ server-side code hoặc Supabase trigger.
 * Dùng supabase admin client (service role) để insert.
 */
import type { Notification } from "@/hooks/useNotifications";

export type CreateNotificationPayload = {
  user_id: string;
  type: Notification["type"];
  title: string;
  body: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Map notification type → default action_url.
 * Dùng khi tạo notification và muốn tự động set URL.
 */
export function getDefaultActionUrl(
  type: Notification["type"],
  metadata?: Record<string, unknown>
): string | null {
  switch (type) {
    case "booking_new":
    case "booking_confirmed":
    case "booking_cancelled":
      return metadata?.booking_id ? `/booking/${metadata.booking_id}` : "/learner/dashboard";

    case "payment_success":
      return metadata?.booking_id ? `/receipt/${metadata.booking_id}` : "/learner/dashboard";

    case "payment_failed":
      return "/learner/dashboard";

    case "review_new":
      return "/mentor/dashboard";

    case "withdrawal_approved":
    case "withdrawal_rejected":
      return "/mentor/wallet";

    case "admin_message":
      return null;

    case "promotion_approved":
    case "promotion_rejected":
      return "/mentor/promotions";

    case "course_approved":
    case "course_rejected":
      return "/mentor/courses";

    case "mentor_verified":
      return "/mentor/profile";

    case "system":
      return null;

    default:
      return null;
  }
}
