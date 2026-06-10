import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "booking_new"
    | "booking_confirmed"
    | "booking_cancelled"
    | "payment_success"
    | "payment_failed"
    | "review_new"
    | "withdrawal_approved"
    | "withdrawal_rejected"
    | "admin_message"
    | "promotion_approved"
    | "promotion_rejected"
    | "course_approved"
    | "course_rejected"
    | "mentor_verified"
    | "system";
  title: string;
  body: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const notificationsTable = () => (supabase as any).from("notifications");

// Fetch notifications cho user
async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await notificationsTable()
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as Notification[];
}

// Đánh dấu 1 notification đã đọc
async function markOneRead(notificationId: string): Promise<void> {
  const { error } = await notificationsTable()
    .update({ is_read: true })
    .eq("id", notificationId);
  if (error) throw error;
}

// Đánh dấu tất cả đã đọc
async function markAllRead(userId: string): Promise<void> {
  const { error } = await notificationsTable()
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: () => fetchNotifications(userId!),
    staleTime: 30_000, // 30s
    refetchInterval: 60_000, // poll mỗi 60s
  });

  // Realtime subscription — lắng nghe INSERT mới
  useEffect(() => {
    if (!userId) return;

    const channel = (supabase as any)
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate để refetch khi có notification mới
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [userId, queryClient]);

  const unreadCount = query.data?.filter((n) => !n.is_read).length ?? 0;

  return { ...query, unreadCount };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markOneRead,
    onSuccess: (_data, notificationId) => {
      // Optimistic update trong cache
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ["notifications"] },
        (old) =>
          old?.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ) ?? []
      );
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Chưa đăng nhập");
      return markAllRead(userId);
    },
    onSuccess: () => {
      // Optimistic update
      queryClient.setQueriesData<Notification[]>(
        { queryKey: ["notifications", userId] },
        (old) => old?.map((n) => ({ ...n, is_read: true })) ?? []
      );
    },
  });
}
