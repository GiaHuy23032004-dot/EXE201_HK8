import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Lock, AtSign, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(true);
  const { login, isLoggedIn, session, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Ensure the seeded admin account exists (idempotent)
  useEffect(() => {
    supabase.functions
      .invoke("admin-seed", { body: {} })
      .catch(() => {})
      .finally(() => setSeeding(false));
  }, []);

  // After login, verify role and route
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.functions.invoke("admin-check", { body: { action: "check" } }).then(({ data }) => {
      if (cancelled) return;
      if (data?.isAdmin) {
        navigate("/admin");
      } else {
        toast({
          title: "Không có quyền truy cập",
          description: "Tài khoản này không phải Admin. Đã đăng xuất.",
          variant: "destructive",
        });
        logout();
      }
    });
    return () => { cancelled = true; };
  }, [userId, navigate, toast, logout]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(identifier.trim(), password);
    setLoading(false);
    if (result.error) {
      toast({ title: "Lỗi đăng nhập", description: result.error, variant: "destructive" });
    }
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
              <Label>Tên tài khoản Admin</Label>
              <div className="relative mt-1">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin"
                  className="pl-10"
                  required
                  autoComplete="username"
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading || seeding} className="w-full gradient-primary border-0 text-primary-foreground">
              {(loading || seeding) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
