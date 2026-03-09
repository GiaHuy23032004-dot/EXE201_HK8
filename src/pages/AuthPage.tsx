import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"learner" | "mentor">("learner");
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      {/* Left */}
      <div className="hidden w-1/2 gradient-primary items-center justify-center lg:flex">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md px-12 text-primary-foreground"
        >
          <Link to="/" className="mb-8 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">EduMarket</span>
          </Link>
          <h2 className="mb-4 text-3xl font-bold">Marketplace kết nối người học & người dạy</h2>
          <p className="text-primary-foreground/80">
            Tham gia cộng đồng hơn 50,000 người học và 2,500 mentor chất lượng trên khắp Việt Nam.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-2xl font-bold">15,000+</p>
              <p className="text-sm text-primary-foreground/70">Khóa học</p>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-2xl font-bold">4.8★</p>
              <p className="text-sm text-primary-foreground/70">Đánh giá TB</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right */}
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">EduMarket</span>
          </Link>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="login" className="flex-1">Đăng nhập</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Đăng ký</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <h2 className="mb-2 text-2xl font-bold text-foreground">Chào mừng trở lại!</h2>
              <p className="mb-6 text-sm text-muted-foreground">Đăng nhập để tiếp tục học tập</p>

              <form onSubmit={(e) => { e.preventDefault(); navigate("/"); }} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="email@example.com" className="pl-10" />
                  </div>
                </div>
                <div>
                  <Label>Mật khẩu</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary border-0 text-primary-foreground">
                  Đăng nhập
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">hoặc</span></div>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Đăng nhập với Google
              </Button>
            </TabsContent>

            <TabsContent value="register">
              <h2 className="mb-2 text-2xl font-bold text-foreground">Tạo tài khoản mới</h2>
              <p className="mb-6 text-sm text-muted-foreground">Bắt đầu hành trình học tập</p>

              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setRole("learner")}
                  className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "learner" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}
                >
                  🎓 Người học
                </button>
                <button
                  onClick={() => setRole("mentor")}
                  className={`flex-1 rounded-xl border-2 p-3 text-center text-sm font-medium transition-colors ${role === "mentor" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/30"}`}
                >
                  👨‍🏫 Mentor
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); navigate("/"); }} className="space-y-4">
                <div>
                  <Label>Họ và tên</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Nguyễn Văn A" className="pl-10" />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="email@example.com" className="pl-10" />
                  </div>
                </div>
                <div>
                  <Label>Mật khẩu</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="password" placeholder="Tối thiểu 8 ký tự" className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary border-0 text-primary-foreground">
                  Đăng ký {role === "mentor" ? "làm Mentor" : ""}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">hoặc</span></div>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Đăng ký với Google
              </Button>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
