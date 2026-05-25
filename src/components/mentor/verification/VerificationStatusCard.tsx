import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  VERIFICATION_STATUS_LABELS,
  type MentorVerificationStatus,
} from "@/hooks/useMentorVerification";
import { cn } from "@/lib/utils";

interface VerificationStatusCardProps {
  status: MentorVerificationStatus;
  adminNote?: string | null;
}

const STATUS_STYLE: Record<MentorVerificationStatus, string> = {
  unverified: "bg-muted text-muted-foreground border-border",
  draft: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

function getStatusMessage(status: MentorVerificationStatus, adminNote?: string | null) {
  switch (status) {
    case "pending":
      return "Hồ sơ của bạn đang chờ duyệt.";
    case "approved":
      return "Bạn đã được xác minh.";
    case "rejected":
      return adminNote || "Hồ sơ cần bổ sung thêm thông tin.";
    case "draft":
      return "Hồ sơ xác minh chưa hoàn tất. Bạn có thể tiếp tục bổ sung thông tin trước khi gửi duyệt.";
    case "unverified":
    default:
      return "Hoàn thiện hồ sơ và thêm bằng chứng chuyên môn để tăng độ tin cậy với học viên.";
  }
}

export function VerificationStatusCard({ status, adminNote }: VerificationStatusCardProps) {
  const approved = status === "approved";

  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          {approved ? (
            <BadgeCheck className="h-6 w-6 text-success" />
          ) : (
            <ShieldCheck className="h-6 w-6 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">Trạng thái xác minh</h2>
            <Badge variant="outline" className={cn("rounded-full", STATUS_STYLE[status])}>
              {approved ? "Verified Mentor" : VERIFICATION_STATUS_LABELS[status]}
            </Badge>
          </div>
          <p
            className={cn(
              "mt-1 text-sm",
              status === "rejected" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {getStatusMessage(status, adminNote)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
