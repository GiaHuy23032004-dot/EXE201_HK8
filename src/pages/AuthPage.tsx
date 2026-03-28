import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2, BookOpen, Users, Star } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"learner" | "mentor">("learner");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, resetPassword } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(loginEmail.trim().toLowerCase(), loginPassword);
    setLoading(false);
    if (result.error) {
      const message = result.error.toLowerCase().includes("invalid login credentials")
        ? "Email hoặc mật khẩu chưa đúng. Nếu bạn vừa đăng ký, vui lòng xác nhận email trước rồi đăng nhập lại."
        : result.error;
      toast({ title: "Lỗi đăng nhập", description: message, variant: "destructive" });
    } else {
      toast({ title: "Đăng nhập thành công!", description: "Chào mừng bạn trở lại." });
      navigate("/");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) {
      toast({ title: "Lỗi", description: "Mật khẩu phải có ít nhất 6 ký tự.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await register(regEmail.trim().toLowerCase(), regPassword, regName.trim(), role);
    setLoading(false);
    if (result.error) {
      toast({ title: "Lỗi đăng ký", description: result.error, variant: "destructive" });
    } else if (result.needsEmailConfirmation) {
      toast({
        title: "Đăng ký thành công!",
        description: "Mình đã gửi email xác nhận. Bạn xác nhận email xong rồi đăng nhập nhé.",
      });
    } else {
      toast({ title: "Đăng ký thành công!", description: "Tài khoản đã sẵn sàng, bạn có thể đăng nhập ngay." });
      navigate("/");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.error) {
      toast({ title: "Lỗi đăng nhập Google", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Đăng nhập thành công!", description: "Chào mừng bạn trở lại." });
      navigate("/");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await resetPassword(forgotEmail);
    setLoading(false);
    if (result.error) {
      toast({ title: "Lỗi", description: result.error, variant: "destructive" });
    } else {
      setForgotSent(true);
      toast({ title: "Đã gửi email", description: "Vui lòng kiểm tra hộp thư để đặt lại mật khẩu." });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel - vibrant gradient */}
      <div className="hidden w-1/2 items-center justify-center lg:flex relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent to-secondary" />
        <div className="absolute inset-0 gradient-hero-mesh" />
        {/* Decorative shapes */}
        <div className="absolute top-20 left-10 h-32 w-32 rounded-full bg-primary/8 blur-2xl" />
        <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-emerald-400/6 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 h-24 w-24 rounded-2xl bg-amber-400/6 blur-xl" />

        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-md px-12 text-foreground">
          <Link to="/" className="mb-8 flex items-center gap-2">
            <img src={logoImg} alt="VET" className="h-10 w-auto" />
          </Link>
          <h2 className="mb-4 text-3xl font-bold leading-tight">Marketplace kết nối<br />người học & người dạy</h2>
          <p className="text-muted-foreground">
            Tham gia cộng đồng hơn 50,000 người học và 2,500 mentor chất lượng trên khắp Việt Nam.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-background p-4 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-4 w-4 text-primary" />
                <p className="text-2xl font-bold text-foreground">15,000+</p>
              </div>
              <p className="text-sm text-muted-foreground">Khóa học</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background p-4 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-warning" />
                <p className="text-2xl font-bold text-foreground">4.8★</p>
              </div>
              <p className="text-sm text-muted-foreground">Đánh giá TB</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-border/60 bg-background p-4 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold text-foreground">50,000+</p>
            </div>
            <p className="text-sm text-muted-foreground">Học viên đã tham gia</p>
          </div>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
            <img src={logoImg} alt="VET" className="h-9 w-auto" />
          </Link>

          <AnimatePresence mode="wait">
            {forgotPassword ? (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => { setForgotPassword(false); setForgotSent(false); }} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
                </button>
                <h2 className="mb-2 text-2xl font-bold text-foreground">Quên mật khẩu</h2>
                <p className="mb-6 text-sm text-muted-foreground">Nhập email để nhận link đặt lại mật khẩu</p>

                {forgotSent ? (
                  <div className="rounded-xl border bg-background p-6 text-center shadow-card">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-1 font-semibold text-foreground">Đã gửi email!</h3>
                    <p className="text-sm text-muted-foreground">
                      Chúng tôi đã gửi link đặt lại mật khẩu đến <strong>{forgotEmail}</strong>. Vui lòng kiểm tra hộp thư.
                    </p>
                    <Button onClick={() => { setForgotPassword(false); setForgotSent(false); }} className="mt-4 gradient-primary border-0 text-primary-foreground">
                      Quay lại đăng nhập
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <Label>Email</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gửi link đặt lại mật khẩu
                    </Button>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div key="auth" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="mb-6 w-full">
                    <TabsTrigger value="login" className="flex-1">Đăng nhập</TabsTrigger>
                    <TabsTrigger value="register" className="flex-1">Đăng ký</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Chào mừng trở lại!</h2>
                    <p className="mb-6 text-sm text-muted-foreground">Đăng nhập để tiếp tục học tập</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label>Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Mật khẩu</Label>
                          <button type="button" onClick={() => setForgotPassword(true)} className="text-xs font-medium text-primary hover:underline">
                            Quên mật khẩu?
                          </button>
                        </div>
                        <div className="relative mt-1">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground shadow-lg shadow-primary/25">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Đăng nhập
                      </Button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                      <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">hoặc</span></div>
                    </div>

                    <Button variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      )}
                      Đăng nhập với Google
                    </Button>
                  </TabsContent>

                  <TabsContent value="register">
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Tạo tài khoản mới</h2>
                    <p className="mb-6 text-sm text-muted-foreground">Bắt đầu hành trình học tập</p>

                    <div className="mb-6 flex gap-2">
                      <button onClick={() => setRole("learner")} className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "learner" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        🎓 Người học
                      </button>
                      <button onClick={() => setRole("mentor")} className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "mentor" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        👨‍🏫 Mentor
                      </button>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label>Họ và tên</Label>
                        <div className="relative mt-1">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nguyễn Văn A" className="pl-10" required />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required type="email" />
                        </div>
                      </div>
                      <div>
                        <Label>Mật khẩu</Label>
                        <div className="relative mt-1">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} type="password" placeholder="Tối thiểu 6 ký tự" className="pl-10" required />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground shadow-lg shadow-primary/25">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Đăng ký {role === "mentor" ? "làm Mentor" : ""}
                      </Button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                      <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">hoặc</span></div>
                    </div>

                    <Button variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      )}
                      Đăng ký với Google
                    </Button>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="absolute bottom-6 right-6">
          <Link to="/admin/login" className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin Panel
          </Link>
        </div>
      </div>
    </div>
  );
}
