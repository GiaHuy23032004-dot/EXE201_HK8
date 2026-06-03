import { Shield, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettings() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cấu hình vận hành dành riêng cho khu vực quản trị.
        </p>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Quyền truy cập
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Quyền Admin được xác thực qua <code className="rounded bg-muted px-1 py-0.5">user_roles.role = admin</code>.
          Không sử dụng <code className="rounded bg-muted px-1 py-0.5">profiles.role</code> để phân quyền quản trị.
        </CardContent>
      </Card>
    </div>
  );
}
