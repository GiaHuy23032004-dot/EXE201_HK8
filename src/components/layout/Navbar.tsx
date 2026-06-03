import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Bell, LogOut, Settings, User, BookOpen, ChevronDown, Shield, GraduationCap, Mic2, Calendar, MessageSquare, CheckCircle2, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/use-admin-role";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const { isAdmin } = useAdminRole();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dashboardPath = user?.role === "mentor" ? "/mentor/dashboard" : "/learner/dashboard";
  const dashboardLabel = user?.role === "mentor" ? "Quản lý dạy học" : "Trang học viên";
  const DashboardIcon = user?.role === "mentor" ? Mic2 : GraduationCap;
  const homePath = user?.role === "mentor" ? "/mentor/dashboard" : "/";
  const profilePath = user?.role === "mentor" ? "/mentor/profile" : "/profile";
  const settingsPath = user?.role === "mentor" ? "/mentor/settings" : "/settings";

  const baseLinks = [
    { label: "Trang chủ", path: homePath },
    { label: "Tìm kiếm", path: "/search" },
    { label: "Bản đồ", path: "/map" },
  ];

  const mentorNotifs = [
    { icon: Calendar, color: "text-primary", title: "Học viên mới đặt lịch", desc: "Trần Thị B vừa đặt lịch học khóa 'Guitar cơ bản' lúc 19:00 thứ 5.", time: "5 phút trước" },
    { icon: MessageSquare, color: "text-secondary", title: "Tin nhắn mới", desc: "Bạn có 1 tin nhắn mới từ học viên Lê Văn C.", time: "1 giờ trước" },
    { icon: DollarSign, color: "text-success", title: "Thanh toán thành công", desc: "Bạn vừa nhận 450.000đ từ buổi học hôm nay.", time: "3 giờ trước" },
  ];
  const learnerNotifs = [
    { icon: CheckCircle2, color: "text-success", title: "Mentor đã xác nhận lịch", desc: "Mentor Nguyễn Văn A đã xác nhận buổi học vào 20:00 tối nay.", time: "10 phút trước" },
    { icon: Star, color: "text-warning", title: "Đánh giá khóa học", desc: "Hãy đánh giá buổi học 'Tiếng Anh giao tiếp' bạn vừa hoàn thành.", time: "2 giờ trước" },
    { icon: MessageSquare, color: "text-secondary", title: "Tin nhắn từ Mentor", desc: "Mentor đã gửi tài liệu cho buổi học sắp tới.", time: "Hôm qua" },
  ];
  const notifications = user?.role === "mentor" ? mentorNotifs : learnerNotifs;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link to={homePath} className="flex items-center gap-2">
          <img src={logoImg} alt="EduMarket" className="h-9 w-auto" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {baseLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname.startsWith("/admin")
                  ? "bg-destructive/10 text-destructive"
                  : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {notifications.length}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <p className="text-sm font-semibold">Thông báo</p>
                    <button className="text-xs text-primary hover:underline">Đánh dấu đã đọc</button>
                  </div>
                  <ScrollArea className="max-h-80">
                    <div className="divide-y">
                      {notifications.map((n, i) => {
                        const Icon = n.icon;
                        return (
                          <div key={i} className="flex gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted ${n.color}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{n.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.desc}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <div className="border-t px-4 py-2 text-center">
                    <button className="text-xs text-primary hover:underline">Xem tất cả</button>
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium md:inline">{user?.name?.split(" ").pop()}</span>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user?.name}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                      <span className="mt-0.5 text-[10px] font-medium text-primary capitalize">
                        {user?.role === "mentor" ? "👨‍🏫 Mentor" : "🎓 Học viên"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(profilePath)}>
                    <User className="mr-2 h-4 w-4" />
                    Hồ sơ cá nhân
                  </DropdownMenuItem>
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => navigate(dashboardPath)}>
                      <DashboardIcon className="mr-2 h-4 w-4" />
                      {dashboardLabel}
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin/dashboard")} className="text-destructive focus:text-destructive">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Cài đặt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="default" size="sm" className="gradient-primary border-0 text-primary-foreground">
                  <User className="mr-2 h-4 w-4" />
                  Đăng nhập
                </Button>
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t bg-background md:hidden"
          >
            <div className="container flex flex-col gap-1 py-3">
              {baseLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isLoggedIn && (
                <>
                  {!isAdmin && (
                    <Link to={dashboardPath} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted">
                      <DashboardIcon className="h-4 w-4" />{dashboardLabel}
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-muted">
                      <Shield className="h-4 w-4" />Admin Panel
                    </Link>
                  )}
                  <Link to={profilePath} onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted">
                    Hồ sơ cá nhân
                  </Link>
                  <Link to={settingsPath} onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted">
                    Cài đặt
                  </Link>
                  <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="rounded-lg px-4 py-3 text-left text-sm font-medium text-destructive hover:bg-muted">
                    Đăng xuất
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
