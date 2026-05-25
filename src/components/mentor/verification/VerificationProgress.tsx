import { BadgeCheck, FileCheck2, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MentorVerificationStatus, VerificationCompletion } from "@/hooks/useMentorVerification";

interface VerificationProgressProps {
  completion: VerificationCompletion;
  status: MentorVerificationStatus;
}

export function VerificationProgress({ completion, status }: VerificationProgressProps) {
  const submitted = status === "pending" || status === "approved";
  const finishedSteps = Number(completion.profileComplete) + Number(completion.proofsComplete) + Number(submitted);
  const percent = Math.round((finishedSteps / 3) * 100);

  const steps = [
    { label: "Hồ sơ cá nhân", complete: completion.profileComplete, icon: UserCheck },
    { label: "Bằng chứng tin cậy", complete: completion.proofsComplete, icon: FileCheck2 },
    { label: "Gửi xác minh", complete: submitted, icon: BadgeCheck },
  ];

  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">Tiến độ xác minh</p>
            <p className="mt-1 text-xs text-muted-foreground">{finishedSteps}/3 bước đã hoàn tất</p>
          </div>
          <span className="text-xl font-bold text-primary">{percent}%</span>
        </div>
        <Progress value={percent} className="h-3" />
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map(({ label, complete, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <Icon className={complete ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"} />
              <span className={complete ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
