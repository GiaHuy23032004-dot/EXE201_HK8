import { CheckCircle2, Circle, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MentorVerificationStatus, VerificationCompletion } from "@/hooks/useMentorVerification";

interface VerificationSubmitCardProps {
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

export function VerificationSubmitCard({
  status,
  adminNote,
  completion,
  isSubmitting,
  onSubmit,
}: VerificationSubmitCardProps) {
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
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          VET không yêu cầu CCCD hoặc CV. Bạn chỉ cần hoàn thiện hồ sơ cá nhân và cung cấp ít nhất 2 tài liệu hợp lệ.
        </div>

        {isPending && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Hồ sơ của bạn đang được xem xét. Bạn sẽ nhận được thông báo khi có kết quả.
          </div>
        )}

        {isRejected && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {adminNote || "Hồ sơ cần bổ sung thêm thông tin."}
          </div>
        )}

        {isApproved && (
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">
            Bạn đã được xác minh. Huy hiệu Verified Mentor sẽ hiển thị trên hồ sơ và khóa học của bạn.
          </div>
        )}

        <div className="space-y-2">
          <ChecklistRow complete={completion.profileComplete} label="Hồ sơ cá nhân đủ thông tin" />
          <ChecklistRow complete={completion.proofsComplete} label="Có ít nhất 2 tài liệu hợp lệ" />
          <ChecklistRow complete label="Không yêu cầu CCCD" />
          <ChecklistRow complete label="Không yêu cầu CV" />
          <ChecklistRow complete label="Không bắt buộc chứng chỉ nếu có portfolio/minh chứng tốt" />
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
