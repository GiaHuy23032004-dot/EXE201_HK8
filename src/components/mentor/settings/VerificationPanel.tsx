import { AlertTriangle } from "lucide-react";
import { ProfileCompletionChecklist } from "@/components/mentor/settings/ProfileCompletionChecklist";
import { SubmitVerificationCard } from "@/components/mentor/settings/SubmitVerificationCard";
import { TrustProofManager } from "@/components/mentor/settings/TrustProofManager";
import { VerificationStatusCard } from "@/components/mentor/settings/VerificationStatusCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { useMentorVerification } from "@/hooks/useMentorVerification";
import { useToast } from "@/hooks/use-toast";

interface VerificationPanelProps {
  verificationQuery: ReturnType<typeof useMentorVerification>;
  onEditProfile: () => void;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải trạng thái xác minh. Vui lòng thử lại.";
}

export function VerificationPanel({ verificationQuery, onEditProfile }: VerificationPanelProps) {
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      await verificationQuery.submitVerification.mutateAsync();
      toast({
        title: "Đã gửi hồ sơ xác minh. Admin sẽ xem xét trong thời gian sớm nhất.",
      });
    } catch (error: unknown) {
      toast({
        title: "Không thể gửi xác minh",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  if (verificationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (verificationQuery.isError) {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Không thể tải trạng thái xác minh. Vui lòng thử lại.
        </CardContent>
      </Card>
    );
  }

  const context = verificationQuery.data;
  if (!context) return null;

  return (
    <div className="space-y-6">
      <VerificationStatusCard
        status={context.verification.status}
        adminNote={context.verification.admin_note}
        completion={context.completion}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProfileCompletionChecklist completion={context.completion} onEditProfile={onEditProfile} />
          <TrustProofManager userId={context.profile.user_id} status={context.verification.status} />
        </div>

        <SubmitVerificationCard
          status={context.verification.status}
          adminNote={context.verification.admin_note}
          completion={context.completion}
          isSubmitting={verificationQuery.submitVerification.isPending}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
