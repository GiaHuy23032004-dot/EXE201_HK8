import { useState } from "react";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PasswordErrors {
  password?: string;
  confirm?: string;
}

export function SecuritySettings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const validate = () => {
    const next: PasswordErrors = {};
    if (password.length < 8) next.password = "Mật khẩu mới cần tối thiểu 8 ký tự.";
    if (confirmPassword !== password) next.confirm = "Xác nhận mật khẩu không khớp.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsUpdatingPassword(false);

    if (error) {
      toast({
        title: "Không thể cập nhật mật khẩu",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    toast({ title: "Đã cập nhật mật khẩu." });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle>Bảo mật</CardTitle>
          <CardDescription>Đổi mật khẩu và quản lý phiên đăng nhập.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl"
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label>Xác nhận mật khẩu mới</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-xl"
                />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isUpdatingPassword}
              className="rounded-xl border-0 text-primary-foreground gradient-primary"
            >
              {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cập nhật mật khẩu
            </Button>
          </form>

          <Separator />

          <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Đăng xuất</p>
              <p className="mt-1 text-sm text-muted-foreground">Thoát khỏi tài khoản mentor trên thiết bị này.</p>
            </div>
            <Button type="button" variant="outline" onClick={handleLogout} className="rounded-xl text-destructive hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-destructive/20 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Xóa tài khoản
          </CardTitle>
          <CardDescription>Vui lòng liên hệ admin nếu bạn muốn khóa hoặc xóa tài khoản.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
