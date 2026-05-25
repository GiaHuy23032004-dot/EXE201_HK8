import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { UpdateUserSettingsPayload, UserSettings } from "@/hooks/useUserSettings";
import { useUpdateUserSettings } from "@/hooks/useUserSettings";

interface PrivacySettingsProps {
  settings: UserSettings;
}

const PRIVACY_FIELDS: Array<{ key: keyof UpdateUserSettingsPayload; label: string }> = [
  { key: "profile_public", label: "Hiển thị hồ sơ công khai" },
  { key: "show_phone_public", label: "Hiển thị số điện thoại công khai" },
  { key: "show_email_public", label: "Hiển thị email công khai" },
  { key: "allow_student_contact", label: "Cho phép học viên đã booking liên hệ" },
];

export function PrivacySettings({ settings }: PrivacySettingsProps) {
  const { toast } = useToast();
  const updateSettings = useUpdateUserSettings(settings.user_id);
  const [form, setForm] = useState<UpdateUserSettingsPayload>({});

  useEffect(() => {
    setForm({
      profile_public: settings.profile_public,
      show_phone_public: settings.show_phone_public,
      show_email_public: settings.show_email_public,
      allow_student_contact: settings.allow_student_contact,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      toast({ title: "Đã lưu cài đặt quyền riêng tư." });
    } catch (error) {
      toast({
        title: "Không thể lưu cài đặt",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Quyền riêng tư</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Một số thông tin công khai có thể cần được áp dụng ở các trang hồ sơ và khóa học.</p>
        </div>

        {PRIVACY_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <Switch
              checked={Boolean(form[key])}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, [key]: checked }))}
            />
          </div>
        ))}

        <Button
          type="button"
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="rounded-xl border-0 text-primary-foreground gradient-primary"
        >
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
}
