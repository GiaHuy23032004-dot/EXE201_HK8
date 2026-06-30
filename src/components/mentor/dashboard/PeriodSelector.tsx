import { Button } from "@/components/ui/button";
import type { MentorDashboardPeriod } from "@/hooks/useMentorDashboardAnalytics";
import { cn } from "@/lib/utils";

const PERIODS: { value: MentorDashboardPeriod; label: string }[] = [
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
  { value: 365, label: "12 tháng" },
];

interface PeriodSelectorProps {
  value: MentorDashboardPeriod;
  onChange: (value: MentorDashboardPeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-2xl border bg-muted/40 p-1 shadow-sm" role="group" aria-label="Chọn khoảng thời gian phân tích">
      {PERIODS.map((period) => (
        <Button
          key={period.value}
          type="button"
          aria-pressed={value === period.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(period.value)}
          className={cn(
            "h-9 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-background/80",
            value === period.value && "bg-background text-primary shadow-sm hover:bg-background hover:text-primary",
          )}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
