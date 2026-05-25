import { AlertTriangle, Loader2, Settings } from "lucide-react";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { ProfileSettingsForm } from "@/components/mentor/settings/ProfileSettingsForm";
import { VerificationStatusCard } from "@/components/mentor/settings/VerificationStatusCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorProfile } from "@/hooks/useMentorProfile";
import { useMentorVerification } from "@/hooks/useMentorVerification";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải cài đặt mentor.";
}

export default function MentorSettings() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const profileQuery = useMentorProfile(userId);
  const verificationQuery = useMentorVerification(userId);

  const isLoading = profileQuery.isLoading || verificationQuery.isLoading;
  const isError = profileQuery.isError || verificationQuery.isError;
  const error = profileQuery.error ?? verificationQuery.error;

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cài đặt mentor</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cập nhật hồ sơ cá nhân và trạng thái xác minh của bạn.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-[680px] rounded-2xl" />
          </div>
        ) : isError ? (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {getErrorMessage(error)}
            </CardContent>
          </Card>
        ) : profileQuery.data && verificationQuery.data ? (
          <>
            <VerificationStatusCard
              status={verificationQuery.data.verification.status}
              adminNote={verificationQuery.data.verification.admin_note}
              completion={verificationQuery.data.completion}
            />
            <ProfileSettingsForm profile={profileQuery.data} />
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải hồ sơ...
          </div>
        )}
      </div>
    </MentorLayout>
  );
}
