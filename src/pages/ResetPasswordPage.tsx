import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase places recovery in URL hash; the SDK sets a session automatically.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setRecoveryReady(true);
    } else {
      // If user navigates here without recovery token, allow change only if logged in
      supabase.auth.getSession().then(({ data }) => setRecoveryReady(!!data.session));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Lỗi", description: "Mật khẩu phải có ít nhất 6 ký tự.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Lỗi", description: "Mật khẩu xác nhận không khớp.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "Thành công!", description: "Mật khẩu đã được cập nhật." });
    await supabase.auth.signOut();
    setTimeout(() => navigate("/auth"), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img src={logoImg} alt="VET" className="h-9 w-auto" />
        </Link>

        <div className="rounded-2xl border bg-card p-8 shadow-elevated">
          <h1 className="mb-2 text-xl font-bold text-foreground">Đặt lại mật khẩu</h1>
          <p className="mb-6 text-sm text-muted-foreground">Tạo mật khẩu mới để khôi phục truy cập tài khoản.</p>

          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <p className="text-sm text-foreground font-medium">Mật khẩu đã được cập nhật!</p>
              <p className="text-xs text-muted-foreground">Đang chuyển về trang đăng nhập…</p>
            </div>
          ) : !recoveryReady ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại từ trang đăng nhập.
              </p>
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại đăng nhập
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Mật khẩu mới</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Xác nhận mật khẩu</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cập nhật mật khẩu
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
