import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Wallet,
  Users,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Mic2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";

const navItems = [
  { label: "Tổng quan",         path: "/mentor/dashboard",  icon: LayoutDashboard },
  { label: "Khóa học của tôi",  path: "/mentor/courses",    icon: BookOpen },
  { label: "Lịch dạy",          path: "/mentor/schedule",   icon: Calendar },
  { label: "Doanh thu & Ví",    path: "/mentor/wallet",     icon: Wallet },
  { label: "Quản lý học viên",  path: "/mentor/students",   icon: Users },
  { label: "Cài đặt",           path: "/mentor/settings",   icon: Settings },
];

interface MentorLayoutProps {
  children: React.ReactNode;
}

export function MentorLayout({ children }: MentorLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImg} alt="VET" className="h-8 w-auto" />
        </Link>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
          <Mic2 className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">Mentor</span>
        </div>
      </div>

      {/* Create Course CTA */}
      <div className="px-4 pt-4">
        <Link to="/mentor/create-course" onClick={() => setSidebarOpen(false)}>
          <Button className="w-full gradient-primary border-0 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 text-sm">
            <Plus className="mr-2 h-4 w-4" />
            Tạo khóa học mới
          </Button>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                style={{ width: "1.125rem", height: "1.125rem" }}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 text-primary/60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border/60 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="flex-1">
            <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
              Về trang chủ
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive px-3"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-background lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border/60 bg-background transition-transform duration-300 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src={logoImg} alt="VET" className="h-7 w-auto" />
          <div className="ml-auto">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
