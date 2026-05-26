import { CheckCircle2, Circle, Loader2, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MentorVerificationStatus, VerificationCompletion } from "@/hooks/useMentorVerification";

interface SubmitVerificationCardProps {
  status: MentorVerificationStatus;
  adminNote?: string | null;
  completion: VerificationCompletion;
  isSubmitting?: boolean;
  onSubmit: () => void;
}

function ChecklistRow({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      {complete ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      <span className={complete ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export function SubmitVerificationCard({ status, adminNote, completion, isSubmitting, onSubmit }: SubmitVerificationCardProps) {
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Gửi xác minh
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Hồ sơ của bạn đang chờ duyệt.
          </div>
        )}

        {isRejected && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {adminNote || "Hồ sơ cần bổ sung."}
          </div>
        )}

        {isApproved && (
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">
            <Badge className="mb-2 rounded-full border-0 bg-success/10 text-success">Verified Mentor</Badge>
            <p>Bạn đã được xác minh.</p>
          </div>
        )}

        <div className="space-y-2">
          <ChecklistRow complete={completion.profileComplete} label="Hồ sơ cá nhân đủ thông tin" />
          <ChecklistRow complete={completion.proofsComplete} label="Có ít nhất 2 loại bằng chứng khác nhau" />
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={!completion.canSubmit || isSubmitting}
          className="w-full rounded-xl border-0 text-primary-foreground gradient-primary"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Gửi xác minh
        </Button>
      </CardContent>
    </Card>
  );
}
