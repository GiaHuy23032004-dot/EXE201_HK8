import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2, BookOpen, Users, Star, IdCard } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [params] = useSearchParams();
  const initialTab = params.get("tab") === "register" || params.get("role") === "mentor" ? "register" : "login";
  const initialRole: "learner" | "mentor" = params.get("role") === "mentor" ? "mentor" : "learner";

  const [showPassword, setShowPassword]       = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [role, setRole]                       = useState<"learner" | "mentor">(initialRole);
  const [forgotPassword, setForgotPassword]   = useState(false);
  const [forgotEmail, setForgotEmail]         = useState("");
  const [forgotSent, setForgotSent]           = useState(false);

  // Login
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register
  const [regName, setRegName]         = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm]   = useState("");

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register, resetPassword } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng nhập email và mật khẩu.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await login(loginEmail.trim(), loginPassword);
    setLoading(false);
    if (result.error) {
      const message = result.error.toLowerCase().includes("invalid login credentials")
        ? "Email hoặc mật khẩu chưa đúng."
        : result.error;
      toast({ title: "Lỗi đăng nhập", description: message, variant: "destructive" });
      return;
    }
    toast({ title: "Đăng nhập thành công!", description: "Chào mừng bạn trở lại." });
    if (result.role === "mentor") {
      navigate("/mentor/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regName.trim().length < 2) {
      toast({ title: "Lỗi", description: "Tên hiển thị quá ngắn.", variant: "destructive" });
      return;
    }
    if (regPassword.length < 6) {
      toast({ title: "Lỗi", description: "Mật khẩu phải có ít nhất 6 ký tự.", variant: "destructive" });
      return;
    }
    if (regPassword !== regConfirm) {
      toast({ title: "Lỗi", description: "Mật khẩu xác nhận không khớp.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const result = await register({
      name: regName.trim(),
      email: regEmail.trim(),
      password: regPassword,
      role,
    });
    setLoading(false);

    if (result.error) {
      toast({ title: "Lỗi đăng ký", description: result.error, variant: "destructive" });
    } else if (result.needsEmailConfirmation) {
      toast({
        title: "Đăng ký thành công!",
        description: "Vui lòng kiểm tra email để xác nhận tài khoản rồi đăng nhập.",
      });
    } else {
      toast({ title: "Đăng ký thành công!", description: "Tài khoản đã sẵn sàng." });
      if (role === "mentor") {
        navigate("/mentor/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
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
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel */}
      <div className="hidden w-1/2 items-center justify-center lg:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent to-secondary" />
        <div className="absolute inset-0 gradient-hero-mesh" />
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-md px-12 text-foreground">
          <Link to="/" className="mb-8 flex items-center gap-2">
            <img src={logoImg} alt="VET" className="h-10 w-auto" />
          </Link>
          <h2 className="mb-4 text-3xl font-bold leading-tight">Marketplace kết nối<br />người học &amp; người dạy</h2>
          <p className="text-muted-foreground">Tham gia cộng đồng hơn 50,000 người học và 2,500 mentor chất lượng trên khắp Việt Nam.</p>
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
                <p className="mb-6 text-sm text-muted-foreground">Nhập email để nhận liên kết đặt lại mật khẩu.</p>
                {forgotSent ? (
                  <div className="rounded-xl border bg-background p-6 text-center shadow-card">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-1 font-semibold text-foreground">Đã gửi email!</h3>
                    <p className="text-sm text-muted-foreground">Kiểm tra hộp thư <strong>{forgotEmail}</strong> (kể cả Spam).</p>
                    <Button onClick={() => { setForgotPassword(false); setForgotSent(false); }} className="mt-4 gradient-primary border-0 text-primary-foreground">
                      Quay lại đăng nhập
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <Label>Email đã đăng ký</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required type="email" />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gửi liên kết đặt lại mật khẩu
                    </Button>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div key="auth" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Tabs defaultValue={initialTab} className="w-full">
                  <TabsList className="mb-6 w-full">
                    <TabsTrigger value="login" className="flex-1">Đăng nhập</TabsTrigger>
                    <TabsTrigger value="register" className="flex-1">Đăng ký</TabsTrigger>
                  </TabsList>

                  {/* LOGIN */}
                  <TabsContent value="login">
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Chào mừng trở lại!</h2>
                    <p className="mb-6 text-sm text-muted-foreground">Đăng nhập bằng <strong>email</strong> và mật khẩu.</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label>Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required type="email" autoComplete="email" />
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
                          <Input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" required autoComplete="current-password" />
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
                    <p className="mt-6 text-center text-xs text-muted-foreground">
                      Chưa có tài khoản? Chuyển sang tab <strong>Đăng ký</strong> phía trên.
                    </p>
                  </TabsContent>

                  {/* REGISTER */}
                  <TabsContent value="register">
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Tạo tài khoản mới</h2>
                    <p className="mb-6 text-sm text-muted-foreground">Bắt đầu hành trình của bạn trên VET</p>
                    <div className="mb-6 flex gap-2">
                      <button type="button" onClick={() => setRole("learner")} className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "learner" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        🎓 Người học
                      </button>
                      <button type="button" onClick={() => setRole("mentor")} className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "mentor" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        👨‍🏫 Mentor
                      </button>
                    </div>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label>Tên hiển thị</Label>
                        <div className="relative mt-1">
                          <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nguyễn Văn A" className="pl-10" required />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required type="email" autoComplete="email" />
                        </div>
                      </div>
                      <div>
                        <Label>Mật khẩu</Label>
                        <div className="relative mt-1">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} type={showRegPassword ? "text" : "password"} placeholder="Tối thiểu 6 ký tự" className="pl-10 pr-10" required minLength={6} autoComplete="new-password" />
                          <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label>Xác nhận mật khẩu</Label>
                        <div className="relative mt-1">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} type={showRegPassword ? "text" : "password"} placeholder="Nhập lại mật khẩu" className="pl-10" required minLength={6} autoComplete="new-password" />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground shadow-lg shadow-primary/25">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Đăng ký {role === "mentor" ? "làm Mentor" : "làm Học viên"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
