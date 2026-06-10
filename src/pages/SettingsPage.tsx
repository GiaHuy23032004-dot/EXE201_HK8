import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Lock, Globe, Moon, Shield, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

function LanguageSection() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Chọn ngôn ngữ hiển thị của ứng dụng
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setLang("vi")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
            lang === "vi"
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted"
          }`}
        >
          <span className="text-2xl">🇻🇳</span>
          <div>
            <p className={`font-semibold text-sm ${lang === "vi" ? "text-primary" : "text-foreground"}`}>
              Tiếng Việt
            </p>
            <p className="text-xs text-muted-foreground">Vietnamese</p>
          </div>
          {lang === "vi" && (
            <span className="ml-auto text-primary text-sm font-bold">✓</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setLang("en")}
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
            lang === "en"
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted"
          }`}
        >
          <span className="text-2xl">🇬🇧</span>
          <div>
            <p className={`font-semibold text-sm ${lang === "en" ? "text-primary" : "text-foreground"}`}>
              English
            </p>
            <p className="text-xs text-muted-foreground">Tiếng Anh</p>
          </div>
          {lang === "en" && (
            <span className="ml-auto text-primary text-sm font-bold">✓</span>
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Ngôn ngữ hiện tại:{" "}
        <span className="font-medium text-foreground">
          {lang === "vi" ? "🇻🇳 Tiếng Việt" : "🇬🇧 English"}
        </span>
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { isLoggedIn, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif]   = useState(true);
  const [darkMode, setDarkMode]     = useState(false);
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [pwLoading, setPwLoading]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 8) {
      toast({ title: "Mật khẩu mới phải có ít nhất 8 ký tự", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) {
      toast({ title: "Đổi mật khẩu thất bại", description: error.message, variant: "destructive" });
    } else {
      setCurrentPw("");
      setNewPw("");
      toast({ title: "Đã đổi mật khẩu thành công" });
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa tài khoản? Hành động này không thể hoàn tác.")) return;
    setDeleteLoading(true);
    // Đăng xuất trước, admin sẽ xóa user qua Edge Function nếu cần
    await logout();
    toast({ title: "Đã đăng xuất. Liên hệ admin để xóa tài khoản hoàn toàn." });
    navigate("/");
    setDeleteLoading(false);
  };

  return (
    <MainLayout>
      <div className="container max-w-3xl py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Cài đặt</h1>

        <div className="space-y-6">
          {/* Notifications */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Bell className="h-5 w-5 text-primary" /> Thông báo
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Thông báo qua email</p>
                  <p className="text-sm text-muted-foreground">Nhận cập nhật booking, khóa học mới</p>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Thông báo đẩy</p>
                  <p className="text-sm text-muted-foreground">Nhắc nhở lịch học sắp tới</p>
                </div>
                <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Lock className="h-5 w-5 text-primary" /> Bảo mật
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleChangePassword}
                disabled={pwLoading || !newPw}
              >
                {pwLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang đổi...</> : "Đổi mật khẩu"}
              </Button>
            </div>
          </div>

          {/* Appearance */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Moon className="h-5 w-5 text-primary" /> Giao diện
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Chế độ tối</p>
                <p className="text-sm text-muted-foreground">Chuyển sang giao diện tối</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
          </div>

          {/* Language */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" /> Ngôn ngữ
            </h2>
            <LanguageSection />
          </div>

          {/* Privacy */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5 text-primary" /> Quyền riêng tư
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Hiển thị hồ sơ công khai</p>
                <p className="text-sm text-muted-foreground">Cho phép người khác xem hồ sơ của bạn</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          {/* Danger */}
          <div className="rounded-2xl border border-destructive/20 bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-destructive">
              <Trash2 className="h-5 w-5" /> Vùng nguy hiểm
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">Xóa tài khoản sẽ xóa tất cả dữ liệu và không thể hoàn tác.</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xóa tài khoản
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
