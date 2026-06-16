import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();

  const { data: notifications, isLoading, unreadCount } = useNotifications(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const markOneRead = useMarkNotificationRead();

  const handleNotificationClick = (id: string, actionUrl: string | null) => {
    markOneRead.mutate(id);
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-2xl py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Bell className="h-6 w-6 text-primary" />
                Thông báo
              </h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {unreadCount} thông báo chưa đọc
                </p>
              )}
            </div>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>

        {/* List */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleNotificationClick(n.id, n.action_url)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-base font-medium text-muted-foreground">Chưa có thông báo nào</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Khi có hoạt động mới, thông báo sẽ xuất hiện ở đây.
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
