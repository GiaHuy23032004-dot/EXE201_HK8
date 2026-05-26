import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Lock, AtSign, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = identifier.trim().toLowerCase();
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setLoading(false);
      toast({
        title: "Lỗi đăng nhập",
        description: loginError.message,
        variant: "destructive",
      });
      return;
    }

    const accessToken =
      authData.session?.access_token ??
      (await supabase.auth.getSession()).data.session?.access_token;

    if (!accessToken) {
      await supabase.auth.signOut();
      setLoading(false);
      toast({
        title: "Không thể xác thực",
        description: "Phiên đăng nhập không hợp lệ. Vui lòng thử lại.",
        variant: "destructive",
      });
      return;
    }

    if (import.meta.env.DEV) {
      console.log("Supabase URL", supabaseUrl);
    }

    const { data, error } = await supabase.functions.invoke("admin-check", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((checkError) => ({
      data: null,
      error: checkError instanceof Error ? checkError : new Error("Không thể gọi admin-check"),
    }));

    if (import.meta.env.DEV) {
      console.log("admin-check response", { data, error });
      console.log("admin-check response payload", data);
      if (error) console.error("admin-check error object", error);
    }

    setLoading(false);

    if (error) {
      await supabase.auth.signOut();
      toast({
        title: "Không thể xác thực quyền Admin",
        description: error.message || "Vui lòng kiểm tra Edge Function admin-check.",
        variant: "destructive",
      });
      return;
    }

    if (data?.isAdmin === true) {
      toast({
        title: "Đăng nhập Admin thành công",
        description: "Chào mừng bạn quay lại trang quản trị VET.",
      });
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    await supabase.auth.signOut();
    toast({
      title: "Không có quyền truy cập",
      description: "Tài khoản này không phải Admin. Đã đăng xuất.",
      variant: "destructive",
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img src={logoImg} alt="VET" className="h-9 w-auto" />
        </Link>

        <div className="rounded-2xl border bg-card p-8 shadow-elevated">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Khu vực dành riêng cho quản trị viên</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email Admin</Label>
              <div className="relative mt-1">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@vet-platform.com"
                  className="pl-10"
                  required
                  autoComplete="username"
                  type="email"
                />
              </div>
            </div>
            <div>
              <Label>Mật khẩu</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Shield className="mr-2 h-4 w-4" />
              Đăng nhập Admin
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline h-3 w-3" />
              Quay về trang chủ
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Chỉ tài khoản đã được cấp quyền Admin mới có thể truy cập trang này.
        </p>
      </motion.div>
    </div>
  );
}
