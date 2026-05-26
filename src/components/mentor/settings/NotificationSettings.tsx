import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { UpdateUserSettingsPayload, UserSettings } from "@/hooks/useUserSettings";
import { useUpdateUserSettings } from "@/hooks/useUserSettings";

interface NotificationSettingsProps {
  settings: UserSettings;
}

const NOTIFICATION_FIELDS: Array<{ key: keyof UpdateUserSettingsPayload; label: string }> = [
  { key: "email_notifications", label: "Nhận thông báo qua email" },
  { key: "booking_notifications", label: "Booking mới" },
  { key: "review_notifications", label: "Đánh giá mới" },
  { key: "payout_notifications", label: "Doanh thu & rút tiền" },
  { key: "admin_notifications", label: "Thông báo từ admin" },
  { key: "marketing_emails", label: "Email giới thiệu tính năng / ưu đãi" },
];

export function NotificationSettings({ settings }: NotificationSettingsProps) {
  const { toast } = useToast();
  const updateSettings = useUpdateUserSettings(settings.user_id);
  const [form, setForm] = useState<UpdateUserSettingsPayload>({});

  useEffect(() => {
    setForm({
      email_notifications: settings.email_notifications,
      booking_notifications: settings.booking_notifications,
      review_notifications: settings.review_notifications,
      payout_notifications: settings.payout_notifications,
      admin_notifications: settings.admin_notifications,
      marketing_emails: settings.marketing_emails,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      toast({ title: "Đã lưu cài đặt thông báo." });
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
        <CardTitle>Thông báo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_FIELDS.map(({ key, label }) => (
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
