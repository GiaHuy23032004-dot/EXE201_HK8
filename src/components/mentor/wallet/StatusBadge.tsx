import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Đang xử lý", className: "border-warning/20 bg-warning/10 text-warning" },
  paid: { label: "Đã chuyển khoản", className: "border-success/20 bg-success/10 text-success" },
  rejected: { label: "Bị từ chối", className: "border-destructive/20 bg-destructive/10 text-destructive" },
  active: { label: "Đang hoạt động", className: "border-success/20 bg-success/10 text-success" },
  inactive: { label: "Tạm ngưng", className: "border-muted bg-muted text-muted-foreground" },
  deleted: { label: "Đã xóa", className: "border-muted bg-muted text-muted-foreground" },
  success: { label: "Thành công", className: "border-success/20 bg-success/10 text-success" },
  failed: { label: "Thất bại", className: "border-destructive/20 bg-destructive/10 text-destructive" },
  refunded: { label: "Đã hoàn", className: "border-warning/20 bg-warning/10 text-warning" },
  sale: { label: "Doanh thu", className: "border-success/20 bg-success/10 text-success" },
  withdraw: { label: "Rút tiền", className: "border-blue-200 bg-blue-100 text-blue-700" },
  refund: { label: "Hoàn tiền", className: "border-teal-200 bg-teal-100 text-teal-700" },
};

export function getStatusLabel(status: string) {
  return STATUS_CONFIG[status]?.label ?? status;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full", config.className, className)}>
      {config.label}
    </Badge>
  );
}
