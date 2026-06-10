import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  BookText,
  CreditCard,
  ExternalLink,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Shield,
  Users,
  Wallet,
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

type AdminLayoutProps = {
  children: ReactNode;
};

const adminNavItems = [
  { labelKey: "admin.dashboard",          path: "/admin/dashboard",            icon: LayoutDashboard, matches: ["/admin/dashboard"] },
  { labelKey: "admin.users",              path: "/admin/users",                icon: Users,           matches: ["/admin/users"] },
  { labelKey: "admin.mentor_verification",path: "/admin/mentor-verifications", icon: BadgeCheck,      matches: ["/admin/mentors", "/admin/mentor-verifications"] },
  { labelKey: "admin.courses",            path: "/admin/courses",              icon: BookOpen,        matches: ["/admin/courses"] },
  { labelKey: "admin.reports",            path: "/admin/reports",              icon: Flag,            matches: ["/admin/reports"] },
  { labelKey: "admin.promotions",         path: "/admin/promotions",           icon: Megaphone,       matches: ["/admin/promotions"] },
  { labelKey: "admin.withdrawals",        path: "/admin/withdrawals",          icon: Wallet,          matches: ["/admin/withdrawals"] },
  { labelKey: "admin.ledger",             path: "/admin/ledger",               icon: BookText,        matches: ["/admin/ledger"] },
  { labelKey: "admin.subscriptions",      path: "/admin/subscriptions",        icon: CreditCard,      matches: ["/admin/subscriptions"] },
  { labelKey: "admin.settings",           path: "/admin/settings",             icon: Settings,        matches: ["/admin/settings"] },
];

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const email = user?.email || session?.user?.email || "";
  const displayName = user?.name || email || "Admin";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <Link to="/admin/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-4 py-5">
        <img src={logoImg} alt="VET" className="h-8 w-auto" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">VET Admin</p>
          <p className="text-xs text-muted-foreground">Control Panel</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.matches.some((path) => location.pathname === path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initials || "AD"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email || "System Admin"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, session, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const email = user?.email || session?.user?.email || "";
  const displayName = user?.name || email || "Admin";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background/95 backdrop-blur lg:block">
        <AdminSidebar />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <AdminSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Admin Panel</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Quản trị vận hành VET</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                      {initials || "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-medium md:inline">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("admin.view_marketplace")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t("admin.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("admin.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
