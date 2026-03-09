import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const { login, isLoggedIn, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // If already logged in, check admin role
  useEffect(() => {
    if (isLoggedIn && session) {
      checkAdminRole();
    }
  }, [isLoggedIn, session]);

  const checkAdminRole = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-check", {
        body: { action: "check" },
      });
      if (!error && data?.isAdmin) {
        navigate("/admin");
      } else {
        toast({
          title: "Không có quyền truy cập",
          description: "Tài khoản này không phải Admin.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể xác thực quyền Admin.", variant: "destructive" });
    }
    setChecking(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    if (result.error) {
      toast({ title: "Lỗi đăng nhập", description: result.error, variant: "destructive" });
      setLoading(false);
      return;
    }
    // checkAdminRole will be triggered by useEffect when isLoggedIn changes
    setLoading(false);
  };

  const handleSetupFirstAdmin = async () => {
    if (!isLoggedIn || !session) {
      toast({ title: "Lỗi", description: "Bạn cần đăng nhập trước.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-check", {
        body: { action: "setup-first-admin" },
      });
      if (error) {
        toast({ title: "Lỗi", description: "Không thể thiết lập Admin.", variant: "destructive" });
      } else if (data?.error) {
        toast({ title: "Lỗi", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Thành công!", description: data.message });
        navigate("/admin");
      }
    } catch {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img src={logoImg} alt="EduMarket" className="h-9 w-auto" />
        </Link>

        <div className="rounded-2xl border bg-card p-8 shadow-elevated">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Đăng nhập với tài khoản Admin</p>
          </div>

          {checking ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Đang xác thực quyền Admin...</p>
            </div>
          ) : isLoggedIn && !setupMode ? (
            <div className="text-center space-y-4">
              <div className="rounded-xl bg-accent/50 p-4">
                <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warning" />
                <p className="text-sm text-foreground font-medium">Bạn đã đăng nhập nhưng chưa có quyền Admin.</p>
                <p className="text-xs text-muted-foreground mt-1">Nếu đây là lần đầu thiết lập, bạn có thể kích hoạt quyền Admin cho tài khoản này.</p>
              </div>
              <Button onClick={handleSetupFirstAdmin} disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Shield className="mr-2 h-4 w-4" />
                Kích hoạt Admin (Lần đầu)
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay về trang chủ
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@edumarket.vn"
                      className="pl-10"
                      required
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
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Chỉ tài khoản được cấp quyền Admin mới có thể truy cập.
        </p>
      </motion.div>
    </div>
  );
}
