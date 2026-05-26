import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountSettingsProps {
  email: string;
  role: string;
  createdAt?: string | null;
  onChangePassword: () => void;
}

export function AccountSettings({ email, role, createdAt, onChangePassword }: AccountSettingsProps) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Tài khoản</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email đăng nhập
            </div>
            <p className="truncate font-semibold text-foreground">{email || "Chưa có email"}</p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Vai trò
            </div>
            <Badge className="rounded-full border-0 bg-primary/10 text-primary">
              {role === "mentor" ? "Mentor" : role}
            </Badge>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Ngày tạo tài khoản
            </div>
            <p className="font-semibold text-foreground">
              {createdAt ? new Date(createdAt).toLocaleDateString("vi-VN") : "Chưa có dữ liệu"}
            </p>
          </div>
        </div>

        <Button type="button" variant="outline" onClick={onChangePassword} className="rounded-xl">
          Đổi mật khẩu
        </Button>
      </CardContent>
    </Card>
  );
}
