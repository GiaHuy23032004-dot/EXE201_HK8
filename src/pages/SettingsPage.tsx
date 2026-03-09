import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Lock, Globe, Moon, Shield, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { isLoggedIn, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

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
                <Label>Mật khẩu hiện tại</Label>
                <Input type="password" placeholder="••••••••" className="mt-1" />
              </div>
              <div>
                <Label>Mật khẩu mới</Label>
                <Input type="password" placeholder="Tối thiểu 8 ký tự" className="mt-1" />
              </div>
              <Button variant="outline" onClick={() => toast({ title: "Đã cập nhật mật khẩu" })}>
                Đổi mật khẩu
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
            <p className="text-sm text-muted-foreground">Hiện tại: <span className="font-medium text-foreground">Tiếng Việt</span></p>
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
            <Button variant="destructive" size="sm">Xóa tài khoản</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
