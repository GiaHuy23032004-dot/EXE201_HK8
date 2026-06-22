import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { ProfileSettingsForm } from "@/components/mentor/settings/ProfileSettingsForm";
import { VerificationPanel } from "@/components/mentor/settings/VerificationPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorProfile } from "@/hooks/useMentorProfile";
import { useMentorVerification } from "@/hooks/useMentorVerification";

type ProfileTab = "profile" | "verification";

function getTab(value: string | null): ProfileTab {
  return value === "verification" ? "verification" : "profile";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải hồ sơ mentor.";
}

export default function MentorProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getTab(searchParams.get("tab"));

  const profileQuery = useMentorProfile(userId);
  const verificationQuery = useMentorVerification(userId);

  const setActiveTab = (tab: ProfileTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hồ sơ & xác minh</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý thông tin mentor và trạng thái xác minh của bạn.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(getTab(value))} className="space-y-6">
          <TabsList className="rounded-2xl bg-primary/5 p-1">
            <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Hồ sơ cá nhân
            </TabsTrigger>
            <TabsTrigger value="verification" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Xác minh mentor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle>Hồ sơ cá nhân</CardTitle>
                <CardDescription>
                  Cập nhật thông tin hiển thị và thông tin định danh cơ bản của mentor.
                </CardDescription>
              </CardHeader>
            </Card>

            {profileQuery.isLoading ? (
              <Skeleton className="h-[680px] rounded-2xl" />
            ) : profileQuery.isError ? (
              <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  {getErrorMessage(profileQuery.error)}
                </CardContent>
              </Card>
            ) : profileQuery.data ? (
              <ProfileSettingsForm profile={profileQuery.data} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải hồ sơ...
              </div>
            )}
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle>Xác minh mentor</CardTitle>
                <CardDescription>
                  Hoàn thiện hồ sơ và thêm tài liệu tin cậy để nhận huy hiệu Verified Mentor.
                </CardDescription>
              </CardHeader>
            </Card>

            <VerificationPanel verificationQuery={verificationQuery} onEditProfile={() => setActiveTab("profile")} />
          </TabsContent>
        </Tabs>
      </div>
    </MentorLayout>
  );
}
