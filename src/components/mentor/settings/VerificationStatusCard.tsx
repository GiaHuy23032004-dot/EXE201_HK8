import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  VERIFICATION_STATUS_LABELS,
  type MentorVerificationStatus,
  type VerificationCompletion,
} from "@/hooks/useMentorVerification";
import { cn } from "@/lib/utils";

interface VerificationStatusCardProps {
  status: MentorVerificationStatus;
  adminNote?: string | null;
  completion?: VerificationCompletion;
}

const STATUS_STYLE: Record<MentorVerificationStatus, string> = {
  unverified: "bg-muted text-muted-foreground border-border",
  draft: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  revision_requested: "bg-primary/10 text-primary border-primary/20",
  revoked: "bg-destructive/10 text-destructive border-destructive/20",
};

export function VerificationStatusCard({ status, adminNote, completion }: VerificationStatusCardProps) {
  const approved = status === "approved";
  const message: Record<MentorVerificationStatus, string> = {
    unverified: "Bạn chưa gửi hồ sơ xác minh.",
    draft: "Hồ sơ xác minh của bạn chưa hoàn tất.",
    pending: "Hồ sơ của bạn đang chờ admin duyệt.",
    approved: "Bạn đã được xác minh.",
    revision_requested: "Admin yêu cầu bổ sung hồ sơ xác minh.",
    rejected: "Hồ sơ đã bị từ chối.",
    revoked: "Huy hiệu xác minh đã bị thu hồi.",
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          {approved ? <BadgeCheck className="h-6 w-6 text-success" /> : <ShieldCheck className="h-6 w-6 text-primary" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">Trạng thái xác minh</h3>
            <Badge variant="outline" className={cn("rounded-full", STATUS_STYLE[status])}>
              {approved ? "Verified Mentor" : VERIFICATION_STATUS_LABELS[status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{message[status]}</p>
          {(status === "rejected" || status === "revision_requested" || status === "revoked") && adminNote && (
            <p className="mt-2 rounded-xl bg-destructive/5 px-3 py-2 text-sm text-destructive">{adminNote}</p>
          )}
          {completion && !approved && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hồ sơ: {completion.completedProfileItems}/{completion.totalProfileItems} mục · Tài liệu:{" "}
              {completion.validProofCount}/2 hợp lệ
            </p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
