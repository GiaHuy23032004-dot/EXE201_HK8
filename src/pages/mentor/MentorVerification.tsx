import { AlertTriangle, Info } from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { ProfileCompletionChecklist } from "@/components/mentor/verification/ProfileCompletionChecklist";
import { SubmitVerificationCard } from "@/components/mentor/verification/SubmitVerificationCard";
import { TrustProofManager } from "@/components/mentor/verification/TrustProofManager";
import { VerificationHeader } from "@/components/mentor/verification/VerificationHeader";
import { VerificationProgress } from "@/components/mentor/verification/VerificationProgress";
import { VerificationStatusCard } from "@/components/mentor/verification/VerificationStatusCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMentorVerification } from "@/hooks/useMentorVerification";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải hồ sơ xác minh.";
}

export default function MentorVerification() {
  const { session } = useAuth();
  const { toast } = useToast();
  const userId = session?.user?.id;

  const verificationQuery = useMentorVerification(userId);

  const handleSubmit = async () => {
    try {
      await verificationQuery.submitVerification.mutateAsync();
      toast({
        title: "Đã gửi hồ sơ xác minh",
        description: "Admin sẽ xem xét trong thời gian sớm nhất.",
      });
    } catch (error: unknown) {
      toast({
        title: "Không thể gửi xác minh",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <VerificationHeader />

        <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Bạn cập nhật thông tin cá nhân ở phần Hồ sơ cá nhân. Trang này dùng để kiểm tra điều kiện
              và gửi bằng chứng xác minh.
            </p>
          </CardContent>
        </Card>

        {verificationQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : verificationQuery.isError ? (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {getErrorMessage(verificationQuery.error)}
            </CardContent>
          </Card>
        ) : verificationQuery.data ? (
          <>
            <VerificationStatusCard
              status={verificationQuery.data.verification.status}
              adminNote={verificationQuery.data.verification.admin_note}
            />
            <VerificationProgress
              completion={verificationQuery.data.completion}
              status={verificationQuery.data.verification.status}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <ProfileCompletionChecklist completion={verificationQuery.data.completion} />
                <TrustProofManager
                  userId={verificationQuery.data.profile.user_id}
                  status={verificationQuery.data.verification.status}
                />
              </div>

              <SubmitVerificationCard
                status={verificationQuery.data.verification.status}
                adminNote={verificationQuery.data.verification.admin_note}
                completion={verificationQuery.data.completion}
                isSubmitting={verificationQuery.submitVerification.isPending}
                onSubmit={handleSubmit}
              />
            </div>
          </>
        ) : null}
      </div>
    </MentorLayout>
  );
}
