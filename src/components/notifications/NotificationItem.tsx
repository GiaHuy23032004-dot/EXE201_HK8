import {
  Calendar,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  Star,
  AlertCircle,
  Bell,
  TrendingUp,
  BookOpen,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  compact?: boolean; // true = dùng trong dropdown navbar
}

type NotifConfig = {
  icon: React.ElementType;
  color: string;
  bg: string;
};

const NOTIF_CONFIG: Record<Notification["type"], NotifConfig> = {
  booking_new: { icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
  booking_confirmed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  booking_cancelled: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  payment_success: { icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
  payment_failed: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
  review_new: { icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
  withdrawal_approved: { icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
  withdrawal_rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  admin_message: { icon: ShieldCheck, color: "text-purple-600", bg: "bg-purple-50" },
  promotion_approved: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
  promotion_rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  course_approved: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  course_rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  mentor_verified: { icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50" },
  system: { icon: Bell, color: "text-gray-600", bg: "bg-gray-50" },
};

export function NotificationItem({
  notification,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const config = NOTIF_CONFIG[notification.type] ?? NOTIF_CONFIG.system;
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: vi,
  });

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 transition-colors",
        compact ? "p-3" : "p-4",
        onClick && "cursor-pointer",
        !notification.is_read
          ? "bg-primary/5 hover:bg-primary/8"
          : "hover:bg-muted/50"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-center rounded-full",
          config.bg,
          compact ? "h-9 w-9" : "h-10 w-10"
        )}
      >
        <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "leading-tight",
              compact ? "text-sm font-medium" : "text-sm font-semibold",
              !notification.is_read && "text-foreground"
            )}
          >
            {notification.title}
          </p>
          {/* Unread dot */}
          {!notification.is_read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p
          className={cn(
            "text-muted-foreground mt-0.5",
            compact ? "text-xs line-clamp-2" : "text-sm line-clamp-3"
          )}
        >
          {notification.body}
        </p>
        <p className={cn("text-muted-foreground/70 mt-1", compact ? "text-[10px]" : "text-xs")}>
          {timeAgo}
        </p>
      </div>
    </div>
  );
}
