import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Wallet,
  Users,
  Settings,
  UserCheck,
  Plus,
  LogOut,
  Menu,
  ChevronRight,
  ChevronDown,
  Mic2,
  Megaphone,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

const navItems = [
  { label: "Tổng quan",         path: "/mentor/dashboard",   icon: LayoutDashboard },
  { label: "Khóa học của tôi",  path: "/mentor/courses",     icon: BookOpen },
  { label: "Lịch dạy",          path: "/mentor/schedule",    icon: Calendar },
  { label: "Doanh thu & Ví",    path: "/mentor/wallet",      icon: Wallet },
  { label: "Quảng cáo",         path: "/mentor/promotions",  icon: Megaphone },
  { label: "Quản lý học viên",  path: "/mentor/students",    icon: Users },
  { label: "Hồ sơ & xác minh",  path: "/mentor/profile",     icon: UserCheck },
  { label: "Cài đặt",           path: "/mentor/settings",    icon: Settings },
];

interface MentorLayoutProps {
  children: React.ReactNode;
}

export function MentorLayout({ children }: MentorLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const displayName = user?.name || "Mentor";
  const email = user?.email || "";
  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    toast({ title: "Đã đăng xuất" });
    navigate("/auth", { replace: true });
  };

  const UserDropdown = ({ compact = false }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 gap-2 rounded-xl px-2 text-foreground hover:bg-muted/70",
            !compact && "border border-border/60 bg-background/80 shadow-sm",
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials || "M"}
            </AvatarFallback>
          </Avatar>
          <span className={cn("max-w-40 truncate text-sm font-semibold", compact ? "hidden" : "hidden sm:inline")}>
            {displayName}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg">
        <DropdownMenuLabel>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            {email && <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/mentor/profile")} className="cursor-pointer">
          <UserCheck className="mr-2 h-4 w-4" />
          Hồ sơ & xác minh
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/mentor/settings")} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <Link to="/mentor/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
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
          const active = location.pathname === path || (path === "/mentor/wallet" && location.pathname === "/mentor/revenue");
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
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-end border-b border-border/60 bg-background/95 px-6 backdrop-blur-sm lg:flex">
          <UserDropdown />
        </header>

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
            <UserDropdown compact />
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
