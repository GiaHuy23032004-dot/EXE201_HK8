import { AlertTriangle, Loader2, Settings } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { AccountSettings } from "@/components/mentor/settings/AccountSettings";
import { NotificationSettings } from "@/components/mentor/settings/NotificationSettings";
import { PreferenceSettings } from "@/components/mentor/settings/PreferenceSettings";
import { PrivacySettings } from "@/components/mentor/settings/PrivacySettings";
import { SecuritySettings } from "@/components/mentor/settings/SecuritySettings";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";

type SettingsTab = "account" | "notifications" | "privacy" | "preferences" | "security";

function getSettingsTab(value: string | null): SettingsTab {
  if (value === "notifications" || value === "privacy" || value === "preferences" || value === "security") {
    return value;
  }
  return "account";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải cài đặt.";
}

export default function MentorSettings() {
  const { user, session } = useAuth();
  const userId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const activeTab = getSettingsTab(legacyTab);
  const settingsQuery = useUserSettings(userId);

  if (legacyTab === "verification") {
    return <Navigate to="/mentor/profile?tab=verification" replace />;
  }

  if (legacyTab === "profile") {
    return <Navigate to="/mentor/profile?tab=profile" replace />;
  }

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams(tab === "account" ? {} : { tab }, { replace: true });
  };

  const settingsContent = settingsQuery.isLoading ? (
    <div className="space-y-4">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  ) : settingsQuery.isError ? (
    <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
      <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        {getErrorMessage(settingsQuery.error)}
      </CardContent>
    </Card>
  ) : settingsQuery.data ? (
    <>
      <TabsContent value="notifications">
        <NotificationSettings settings={settingsQuery.data} />
      </TabsContent>
      <TabsContent value="privacy">
        <PrivacySettings settings={settingsQuery.data} />
      </TabsContent>
      <TabsContent value="preferences">
        <PreferenceSettings settings={settingsQuery.data} />
      </TabsContent>
    </>
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Đang tải cài đặt...
    </div>
  );

  return (
    <MentorLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý tài khoản, thông báo, quyền riêng tư và tùy chọn hệ thống.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(getSettingsTab(value))} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-primary/5 p-1">
            <TabsTrigger value="account" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Tài khoản
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Thông báo
            </TabsTrigger>
            <TabsTrigger value="privacy" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Quyền riêng tư
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Tùy chọn
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary">
              Bảo mật
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountSettings
              email={user?.email ?? session?.user?.email ?? ""}
              role={user?.role ?? "mentor"}
              createdAt={session?.user?.created_at}
              onChangePassword={() => setActiveTab("security")}
            />
          </TabsContent>

          {settingsContent}

          <TabsContent value="security">
            <SecuritySettings />
          </TabsContent>
        </Tabs>
      </div>
    </MentorLayout>
  );
}
