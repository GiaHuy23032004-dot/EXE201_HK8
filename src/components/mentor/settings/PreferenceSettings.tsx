import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { UpdateUserSettingsPayload, UserSettings } from "@/hooks/useUserSettings";
import { useUpdateUserSettings } from "@/hooks/useUserSettings";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

interface PreferenceSettingsProps {
  settings: UserSettings;
}

export function PreferenceSettings({ settings }: PreferenceSettingsProps) {
  const { toast } = useToast();
  const { setLang } = useLanguage();
  const updateSettings = useUpdateUserSettings(settings.user_id);
  const [form, setForm] = useState<UpdateUserSettingsPayload>({});

  useEffect(() => {
    setForm({
      language: settings.language,
      timezone: settings.timezone,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      // Đồng bộ ngôn ngữ với LanguageContext ngay lập tức
      if (form.language === "vi" || form.language === "en") {
        setLang(form.language as Language);
      }
      toast({ title: "Đã lưu tùy chọn hệ thống." });
    } catch (error) {
      toast({
        title: "Không thể lưu tùy chọn",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Tùy chọn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Ngôn ngữ</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["vi", "en"] as Language[]).map((langOption) => (
                <button
                  key={langOption}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, language: langOption }))}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                    form.language === langOption
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:bg-muted"
                  }`}
                >
                  <span className="text-xl">{langOption === "vi" ? "🇻🇳" : "🇬🇧"}</span>
                  <div>
                    <p className={`text-xs font-semibold ${form.language === langOption ? "text-primary" : "text-foreground"}`}>
                      {langOption === "vi" ? "Tiếng Việt" : "English"}
                    </p>
                  </div>
                  {form.language === langOption && (
                    <span className="ml-auto text-xs text-primary font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Múi giờ</Label>
            <Select
              value={form.timezone as string}
              onValueChange={(value) => setForm((current) => ({ ...current, timezone: value }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Chọn múi giờ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium text-foreground">Tiền tệ</span>
          <Badge variant="secondary" className="rounded-full">VNĐ</Badge>
        </div>

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
