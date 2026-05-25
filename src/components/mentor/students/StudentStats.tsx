import { CheckCircle2, Clock3, GraduationCap, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MentorStudentStats } from "@/hooks/useMentorStudents";

interface StudentStatsProps {
  stats: MentorStudentStats;
}

const CARDS = [
  {
    key: "total",
    label: "Tổng học viên",
    icon: Users,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "learning",
    label: "Đang học",
    icon: GraduationCap,
    color: "text-sky-600",
    bg: "bg-sky-500/10",
  },
  {
    key: "pending",
    label: "Chờ xác nhận",
    icon: Clock3,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    key: "completed",
    label: "Đã hoàn thành",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
  },
] as const;

export function StudentStats({ stats }: StudentStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key} className="rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl ${bg} p-2.5`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">{stats[key]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
