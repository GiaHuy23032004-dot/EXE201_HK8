import { AlertTriangle, CheckCircle2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VerificationCompletion } from "@/hooks/useMentorVerification";

interface ProfileCompletionChecklistProps {
  completion: VerificationCompletion;
  onEditProfile: () => void;
}

export function ProfileCompletionChecklist({ completion, onEditProfile }: ProfileCompletionChecklistProps) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          Hồ sơ cá nhân
        </CardTitle>
        <Button type="button" variant="outline" onClick={onEditProfile} className="rounded-xl">
          Cập nhật hồ sơ
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!completion.profileComplete && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Hồ sơ của bạn chưa đủ điều kiện gửi xác minh.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {completion.profileItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              {item.complete ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              <span className={item.complete ? "font-medium text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
