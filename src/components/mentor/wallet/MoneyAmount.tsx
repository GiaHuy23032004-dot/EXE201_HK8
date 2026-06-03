import { cn } from "@/lib/utils";

export function formatVND(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString("vi-VN")}đ`;
}

export function MoneyAmount({
  amount,
  className,
  signed = false,
}: {
  amount: number;
  className?: string;
  signed?: boolean;
}) {
  const sign = signed && amount > 0 ? "+" : "";

  return (
    <span className={cn("font-semibold tabular-nums", className)}>
      {sign}
      {formatVND(amount)}
    </span>
  );
}
