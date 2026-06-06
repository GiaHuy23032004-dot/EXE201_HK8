import { useState, useEffect, useCallback } from "react";
import { Users, BookOpen, DollarSign, TrendingUp, Shield, Check, X, Eye, BarChart3, Flag, Megaphone, UserX, UserCheck, Crown, Loader2, Search, AlertCircle, Wallet, Copy, Banknote, Download, BookText } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseCategoryLabel, normalizeCourseCategory } from "@/constants/courseCategories";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--muted-foreground))"];

type AdminSection = "analytics" | "users" | "mentors" | "courses" | "reports" | "promoted" | "payouts" | "ledger";

const adminRouteSections: Record<string, AdminSection> = {
  "/admin/dashboard": "analytics",
  "/admin/users": "users",
  "/admin/mentors": "mentors",
  "/admin/mentor-verifications": "mentors",
  "/admin/courses": "courses",
  "/admin/reports": "reports",
  "/admin/promotions": "promoted",
  "/admin/withdrawals": "payouts",
  "/admin/ledger": "ledger",
};

const adminSectionMeta: Record<AdminSection, { title: string; description: string; icon: typeof Shield }> = {
  analytics: {
    title: "Admin Dashboard",
    description: "Tổng quan số liệu, doanh thu và hoạt động marketplace.",
    icon: Shield,
  },
  users: {
    title: "Người dùng",
    description: "Quản lý tài khoản, trạng thái khóa và quyền hệ thống.",
    icon: Users,
  },
  mentors: {
    title: "Duyệt Mentor",
    description: "Theo dõi mentor cần xét duyệt và xử lý hồ sơ.",
    icon: UserCheck,
  },
  courses: {
    title: "Khóa học",
    description: "Kiểm duyệt và quản lý khóa học trên marketplace.",
    icon: BookOpen,
  },
  reports: {
    title: "Báo cáo",
    description: "Xử lý báo cáo vi phạm và điều phối moderation.",
    icon: Flag,
  },
  promoted: {
    title: "Quảng cáo",
    description: "Theo dõi các listing đang được quảng bá.",
    icon: Megaphone,
  },
  payouts: {
    title: "Rút tiền",
    description: "Đối soát và xác nhận yêu cầu rút tiền của mentor.",
    icon: Wallet,
  },
  ledger: {
    title: "Sổ cái dòng tiền",
    description: "Theo dõi dòng tiền, hoa hồng và giao dịch hệ thống.",
    icon: BookText,
  },
};

type UserRecord = {
  user_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  product_role: "learner" | "mentor";
  role?: string;
  created_at: string;
  is_blocked: boolean;
  roles: string[];
  is_admin?: boolean;
};

type UserActionDialogState = {
  type: "block" | "grant_admin" | "revoke_admin";
  user: UserRecord;
} | null;

type PayoutOrder = { code: string; date: string; gross: number };
type PayoutRequest = {
  id: string; mentor: string; amount: number; date: string;
  bank: string; account: string; holder: string;
  orders: PayoutOrder[]; status: "pending" | "paid";
};

type LedgerEntry = {
  id: string; date: string; from: string; to: string;
  kind: "in" | "payout" | "commission" | "refund";
  gross: number; commission: number;
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const { session } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const FEE = 0.15;
  const currentSection = adminRouteSections[location.pathname] ?? "analytics";
  const currentMeta = adminSectionMeta[currentSection];
  const PageIcon = currentMeta.icon;

  // ── UI state ──────────────────────────────────────────────
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userActionDialog, setUserActionDialog] = useState<UserActionDialogState>(null);
  const [activePayout, setActivePayout] = useState<PayoutRequest | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [ledgerKind, setLedgerKind] = useState<"all" | "in" | "payout" | "refund">("all");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const invokeAdminUserActions = useCallback((body: Record<string, unknown>) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Missing admin session");
    }

    return supabase.functions.invoke("admin-user-actions", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }, [session?.access_token]);

  // ── Supabase queries ──────────────────────────────────────

  // Pending Mentors
  const { data: mentors = [], isLoading: mentorsLoading, refetch: refetchMentors } = useQuery({
    queryKey: ["admin-pending-mentors"],
    enabled: currentSection === "mentors",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, email, role, created_at")
        .eq("role", "mentor")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: p.name ?? "Không tên",
        email: p.email ?? "",
        specialty: "",
        date: new Date(p.created_at).toLocaleDateString("vi-VN"),
      }));
    },
  });

  // Promoted listings
  const { data: promotedListings = [], isLoading: promotedLoading } = useQuery({
    queryKey: ["admin-promoted"],
    enabled: currentSection === "promoted",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promoted_listings")
        .select("*, course:courses(title), mentor:profiles!promoted_listings_mentor_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        title: p.course?.title ?? "Khóa học",
        mentor: p.mentor?.name ?? "Mentor",
        fee: p.fee,
        days: p.days,
        status: p.status as string,
      }));
    },
  });

  // Withdrawal requests (payouts)
  const { data: payouts = [], isLoading: payoutsLoading, refetch: refetchPayouts } = useQuery({
    queryKey: ["admin-payouts"],
    enabled: currentSection === "payouts",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*, mentor:profiles!withdrawal_requests_mentor_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        mentor: p.mentor?.name ?? "Mentor",
        amount: p.amount,
        date: new Date(p.created_at).toLocaleDateString("vi-VN"),
        bank: p.bank_name,
        account: p.bank_account,
        holder: p.bank_holder,
        status: p.status as "pending" | "paid",
        orders: [],
      })) as PayoutRequest[];
    },
  });

  // Ledger (transactions)
  const { data: ledgerData = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["admin-ledger"],
    enabled: currentSection === "ledger",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, amount, platform_fee, net_amount, status, created_at, reference_code,
          learner:profiles!transactions_learner_id_fkey(name),
          mentor:profiles!transactions_mentor_id_fkey(name)
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.reference_code ?? t.id.slice(0, 8),
        date: new Date(t.created_at).toLocaleString("vi-VN"),
        from: t.learner?.name ?? "Học viên",
        to: t.mentor?.name ?? "Hệ thống",
        kind: t.status === "refunded" ? "refund" : "in" as LedgerEntry["kind"],
        gross: t.amount,
        commission: t.platform_fee,
      })) as LedgerEntry[];
    },
  });

  // Analytics aggregates
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-analytics"],
    enabled: currentSection === "analytics",
    queryFn: async () => {
      const [usersRes, coursesRes, bookingsRes, revenueRes, mentorsRes] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("amount").eq("status", "success"),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "mentor"),
      ]);
      const totalRevenue = (revenueRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0);
      return {
        users: usersRes.count ?? 0,
        courses: coursesRes.count ?? 0,
        bookings: bookingsRes.count ?? 0,
        revenue: totalRevenue,
        activeMentors: mentorsRes.count ?? 0,
      };
    },
  });

  // Monthly revenue from transactions
  const { data: monthlyRevenue = [] } = useQuery({
    queryKey: ["admin-monthly-revenue"],
    enabled: currentSection === "analytics",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, created_at")
        .eq("status", "success")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, { revenue: number; bookings: number }> = {};
      (data ?? []).forEach((t: any) => {
        const d = new Date(t.created_at);
        const key = `T${d.getMonth() + 1}`;
        if (!map[key]) map[key] = { revenue: 0, bookings: 0 };
        map[key].revenue += Math.round(t.amount / 1_000_000);
        map[key].bookings += 1;
      });
      return Object.entries(map).map(([month, v]) => ({ month, ...v, users: 0 }));
    },
  });

  // Category distribution
  const { data: categoryData = [] } = useQuery({
    queryKey: ["admin-categories"],
    enabled: currentSection === "analytics",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("category")
        .eq("status", "approved");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((c: any) => {
        const category = normalizeCourseCategory(c.category);
        map[category] = (map[category] ?? 0) + 1;
      });
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name: getCourseCategoryLabel(name), value }));
    },
  });

  // ── Mutations ─────────────────────────────────────────────

  const approveMentor = useMutation({
    mutationFn: async (userId: string) => {
      // Mentor is already role=mentor; just toast success (no extra status field)
      return userId;
    },
    onSuccess: () => { refetchMentors(); toast({ title: "Đã duyệt mentor" }); },
  });

  const rejectMentor = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ role: "learner" }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { refetchMentors(); toast({ title: "Đã từ chối mentor" }); },
    onError: () => toast({ title: "Lỗi", variant: "destructive" }),
  });

  const confirmPayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_process_withdrawal_request", {
        withdrawal_request_id: id,
        new_status: "paid",
        admin_note: null,
        processed_reference: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPayouts();
      toast({ title: "Đã xác nhận chuyển khoản" });
      setActivePayout(null);
    },
    onError: () => toast({ title: "Lỗi xác nhận payout", variant: "destructive" }),
  });

  // ── User management (via Edge Function) ──────────────────

  const fetchUsers = useCallback(async () => {
    setUserLoading(true);
    setUserLoadError(null);
    try {
      const { data, error } = await invokeAdminUserActions({ action: "list_users" });
      if (import.meta.env.DEV) {
        console.log("admin-user-actions list response", { data, error });
      }

      if (!error && data?.users) {
        setUserList(data.users);
      } else {
        const message = error?.message || data?.error || "Không thể tải danh sách người dùng.";
        setUserLoadError(message);
        toast({ title: "Lỗi", description: message, variant: "destructive" });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("admin-user-actions list error", error);
      }

      const message = error instanceof Error ? error.message : "Không thể kết nối server.";
      setUserLoadError(message);
      toast({ title: "Lỗi", description: message, variant: "destructive" });
    } finally {
      setUsersLoaded(true);
      setUserLoading(false);
    }
  }, [invokeAdminUserActions, toast]);

  useEffect(() => {
    if (currentSection === "users" && !usersLoaded && !userLoading) {
      void fetchUsers();
    }
  }, [currentSection, fetchUsers, userLoading, usersLoaded]);

  const executeUserAction = async (dialogState: NonNullable<UserActionDialogState>) => {
    const { type, user } = dialogState;
    const isRoleAction = type === "grant_admin" || type === "revoke_admin";
    const loadingKey = `${user.user_id}_${isRoleAction ? "role" : "block"}`;
    const edgeAction = type === "block" ? "block_user" : type;

    setActionLoading(loadingKey);
    try {
      const { data, error } = await invokeAdminUserActions({
        action: edgeAction,
        targetUserId: user.user_id,
        confirmed: true,
      });

      if (!error && data?.success) {
        await fetchUsers();
        const title =
          type === "block"
            ? "Đã khóa tài khoản"
            : type === "grant_admin"
              ? "Đã cấp quyền Admin"
              : "Đã thu hồi quyền Admin";
        toast({ title });
        setUserActionDialog(null);
      } else {
        toast({
          title: "Lỗi",
          description: error?.message || data?.error || "Không thể thực hiện thao tác.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockUser = async (user: UserRecord) => {
    const loadingKey = `${user.user_id}_block`;
    setActionLoading(loadingKey);
    try {
      const { data, error } = await invokeAdminUserActions({
        action: "unblock_user",
        targetUserId: user.user_id,
      });

      if (!error && data?.success) {
        await fetchUsers();
        toast({ title: "Đã mở khóa tài khoản" });
      } else {
        toast({
          title: "Lỗi",
          description: error?.message || data?.error || "Không thể mở khóa tài khoản.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserAction = (type: NonNullable<UserActionDialogState>["type"], user: UserRecord) => {
    setUserActionDialog({ type, user });
  };

  // ── Helpers ───────────────────────────────────────────────

  const confirmPayout = () => {
    if (!activePayout) return;
    confirmPayoutMutation.mutate(activePayout.id);
  };

  const copyAccount = (acc: string) => {
    navigator.clipboard?.writeText(acc);
    toast({ title: "Đã copy số tài khoản" });
  };

  const currentAdminId = session?.user?.id ?? "";
  const adminUserCount = new Set(userList.filter((u) => u.roles.includes("admin")).map((u) => u.user_id)).size;
  const userSearchText = userSearch.trim().toLowerCase();
  const filteredUsers = userList.filter((u) => {
    if (!userSearchText) return true;
    return [u.name, u.email, u.username]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(userSearchText));
  });

  const formatUserDate = (value?: string | null) => {
    if (!value) return "";
    return new Date(value).toLocaleString("vi-VN");
  };

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const exportUsersCsv = () => {
    const rows = filteredUsers.map((u) => [
      u.name ?? "",
      u.email ?? "",
      u.product_role,
      u.roles.includes("admin") ? "Yes" : "No",
      u.is_blocked ? "Yes" : "No",
      formatUserDate(u.created_at),
    ]);
    const header = ["Name", "Email", "Product Role", "Is Admin", "Is Blocked", "Created At"];
    const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vet-users-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Đã tải danh sách người dùng", description: `${rows.length} tài khoản trong file CSV.` });
  };

  // ── Ledger filter logic ───────────────────────────────────
  const filteredLedger = (() => {
    const parse = (s: string) => {
      const parts = s.split(/[\s/]/);
      if (parts.length >= 3) {
        const [d, m, y] = parts;
        return new Date(`${y}-${m}-${d}`).getTime();
      }
      return NaN;
    };
    const fromTs = ledgerFrom ? new Date(ledgerFrom).getTime() : -Infinity;
    const toTs = ledgerTo ? new Date(ledgerTo).getTime() + 86400000 : Infinity;
    return ledgerData.filter(e => {
      if (ledgerKind !== "all" && e.kind !== ledgerKind) return false;
      const ts = parse(e.date.split(" ")[0]);
      if (!isNaN(ts) && (ts < fromTs || ts > toTs)) return false;
      if (ledgerSearch) {
        const q = ledgerSearch.toLowerCase();
        if (!e.id.toLowerCase().includes(q) && !e.from.toLowerCase().includes(q) && !e.to.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  })();

  const totalGross = filteredLedger.reduce((s, e) => s + (e.kind === "in" ? e.gross : 0), 0);
  const totalCommission = filteredLedger.reduce((s, e) => s + e.commission, 0);
  const totalPayout = filteredLedger.reduce((s, e) => s + (e.kind === "payout" ? e.gross : 0), 0);

  const kindLabel = (k: LedgerEntry["kind"]) =>
    k === "in" ? <Badge className="bg-success/10 text-success border-0 text-[10px]">Nạp vào</Badge>
    : k === "payout" ? <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Rút ra</Badge>
    : k === "refund" ? <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Hoàn tiền</Badge>
    : <Badge className="bg-secondary/10 text-secondary border-0 text-[10px]">Hoa hồng</Badge>;

  const exportCsv = () => {
    const header = ["Mã TXN", "Thời gian", "Người gửi", "Người nhận", "Phân loại", "Tổng tiền", "Hoa hồng"];
    const rows = filteredLedger.map(e => [e.id, e.date, e.from, e.to, e.kind, e.gross, e.commission]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `so-cai-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Đã xuất file CSV", description: `${filteredLedger.length} giao dịch` });
  };

  const renderChartEmpty = (message: string) => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <PageIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{currentMeta.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{currentMeta.description}</p>
        </div>

        {currentSection === "analytics" && (
          <>
        {/* Metrics */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { icon: Users, label: "Tổng người dùng", value: analytics?.users.toLocaleString("vi-VN"), color: "text-secondary" },
            { icon: BookOpen, label: "Tổng khóa học", value: analytics?.courses.toLocaleString("vi-VN"), color: "text-primary" },
            { icon: BarChart3, label: "Tổng booking", value: analytics?.bookings.toLocaleString("vi-VN"), color: "text-success" },
            { icon: DollarSign, label: "Doanh thu", value: analytics ? (analytics.revenue >= 1_000_000 ? (analytics.revenue / 1_000_000).toFixed(1) + "M" : fmtVnd(analytics.revenue)) : undefined, color: "text-warning" },
            { icon: TrendingUp, label: "Mentor hoạt động", value: analytics?.activeMentors.toLocaleString("vi-VN"), color: "text-accent-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              {analyticsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{stat.value ?? "0"}</p>
              )}
            </div>
          ))}
        </div>
          {/* Analytics section */}
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {[
                { label: "Tổng doanh thu tháng", value: analytics ? (analytics.revenue >= 1_000_000 ? (analytics.revenue / 1_000_000).toFixed(1) + "M VNĐ" : fmtVnd(analytics.revenue)) : "—", change: "", icon: DollarSign },
                { label: "Booking tháng này", value: analytics ? analytics.bookings.toLocaleString("vi-VN") : "—", change: "", icon: BarChart3 },
                { label: "Người dùng", value: analytics ? analytics.users.toLocaleString("vi-VN") : "—", change: "", icon: Users },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-2xl border bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <kpi.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {analyticsLoading ? (
                    <Skeleton className="h-9 w-28" />
                  ) : (
                    <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Doanh thu theo tháng (triệu VNĐ)</h3>
                {monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyRevenue}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : renderChartEmpty("Chưa có dữ liệu doanh thu")}
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Bookings theo tháng</h3>
                {monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="bookings" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : renderChartEmpty("Chưa có dữ liệu booking")}
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Phân bổ danh mục</h3>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : renderChartEmpty("Chưa có dữ liệu danh mục")}
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Tăng trưởng người dùng</h3>
                {monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyRevenue}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="users" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : renderChartEmpty("Chưa có dữ liệu tăng trưởng")}
              </div>
            </div>
          </>)}

          {/* User management section */}
          {currentSection === "users" && (<>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Tìm theo tên, email hoặc username..." className="pl-10" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchUsers} disabled={userLoading} className="rounded-xl">
                  {userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Làm mới"}
                </Button>
                <Button variant="outline" onClick={exportUsersCsv} disabled={userLoading || userList.length === 0} className="rounded-xl">
                  <Download className="mr-2 h-4 w-4" />
                  Tải danh sách
                </Button>
              </div>
            </div>
            {userLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : userLoadError ? (
              <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-14 text-center">
                <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
                <p className="font-semibold text-foreground">Không thể tải danh sách người dùng</p>
                <p className="mt-1 text-sm text-muted-foreground">{userLoadError}</p>
                <Button variant="outline" onClick={fetchUsers} className="mt-4 rounded-xl">Thử lại</Button>
              </div>
            ) : userList.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Users className="h-12 w-12 text-muted mb-3" />
                <p className="text-muted-foreground text-sm">Chưa có người dùng nào trong hệ thống</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Search className="h-12 w-12 text-muted mb-3" />
                <p className="font-medium text-foreground">Không tìm thấy người dùng phù hợp</p>
                <p className="text-muted-foreground text-sm">Thử đổi từ khóa tìm kiếm.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers
                  .map((u) => {
                    const isAdminUser = u.roles.includes("admin");
                    const isSelf = u.user_id === currentAdminId;
                    const cannotRevokeAdmin = isSelf || (isAdminUser && adminUserCount <= 1);
                    const blockLoading = actionLoading === `${u.user_id}_block`;
                    const roleLoading = actionLoading === `${u.user_id}_role`;
                    return (
                      <div key={u.user_id} className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card md:flex-row md:items-center ${u.is_blocked ? "opacity-75" : ""}`}>
                        <Avatar className="h-10 w-10 shrink-0 rounded-xl">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-sm font-bold">
                            {(u.name || u.email || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-card-foreground text-sm truncate">{u.name || "Không có tên"}</p>
                            {isAdminUser && <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]"><Crown className="mr-1 h-2.5 w-2.5" />Admin</Badge>}
                            {u.is_blocked && <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Đã khóa</Badge>}
                            <Badge variant="outline" className="text-[10px]">{u.product_role}</Badge>
                            {isSelf && <Badge variant="outline" className="text-[10px]">Bạn</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          {u.username && <p className="text-xs text-muted-foreground truncate">@{u.username}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">
                          <Button
                            size="sm"
                            variant={u.is_blocked ? "default" : "outline"}
                            className={`rounded-lg h-8 text-xs ${u.is_blocked ? "gradient-primary border-0 text-primary-foreground" : "text-destructive hover:text-destructive"}`}
                            disabled={blockLoading || (isSelf && !u.is_blocked)}
                            onClick={() => u.is_blocked ? handleUnblockUser(u) : handleUserAction("block", u)}
                          >
                            {blockLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : u.is_blocked ? <><UserCheck className="mr-1 h-3 w-3" />Mở khóa</> : <><UserX className="mr-1 h-3 w-3" />Khóa</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`rounded-lg h-8 text-xs ${isAdminUser ? "text-destructive hover:text-destructive" : ""}`}
                            disabled={roleLoading || (isAdminUser && cannotRevokeAdmin)}
                            onClick={() => handleUserAction(isAdminUser ? "revoke_admin" : "grant_admin", u)}
                          >
                            {roleLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isAdminUser ? <><Crown className="mr-1 h-3 w-3" />Thu hồi Admin</> : <><Crown className="mr-1 h-3 w-3" />Cấp Admin</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>)}

          {/* Mentor verification section */}
          {currentSection === "mentors" && (<div className="space-y-3">
            {mentorsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : mentors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Không có mentor nào đang chờ duyệt</p>
            ) : mentors.map((m: any) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-lg font-bold text-accent-foreground">{m.name[0]}</div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}{m.specialty ? ` • ${m.specialty}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Đăng ký: {m.date}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMentor.mutate(m.id)} className="gradient-primary border-0 text-primary-foreground rounded-lg" disabled={approveMentor.isPending}>
                    <Check className="mr-1 h-4 w-4" />Duyệt
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectMentor.mutate(m.id)} className="rounded-lg" disabled={rejectMentor.isPending}>
                    <X className="mr-1 h-4 w-4" />Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </div>)}

          {/* Promotions section */}
          {currentSection === "promoted" && (<div className="space-y-3">
            {promotedLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : promotedListings.length > 0 ? promotedListings.map((p: any) => (
                <div key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                  <div className="rounded-xl bg-warning/10 p-3"><Megaphone className="h-5 w-5 text-warning" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-card-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground">Mentor: {p.mentor} • {p.fee.toLocaleString("vi-VN")}đ / {p.days} ngày</p>
                  </div>
                  <Badge className={p.status === "active" ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                    {p.status === "active" ? "Đang chạy" : p.status === "expired" ? "Hết hạn" : "Chờ duyệt"}
                  </Badge>
                </div>
              )) : <p className="text-center text-muted-foreground py-8">Chưa có tin quảng cáo nào</p>}
          </div>)}

          {/* Withdrawals section */}
          {currentSection === "payouts" && (<>
            <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <div className="p-5 border-b flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Quản lý Rút tiền</h3>
                  <p className="text-xs text-muted-foreground">Đối soát và xác nhận chuyển khoản cho Mentor</p>
                </div>
              </div>
              {payoutsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mentor</TableHead>
                      <TableHead className="text-right">Số tiền yêu cầu</TableHead>
                      <TableHead>Ngày gửi</TableHead>
                      <TableHead>Ngân hàng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.length > 0 ? payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.mentor}</TableCell>
                        <TableCell className="text-right font-bold text-secondary">{fmtVnd(p.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.date}</TableCell>
                        <TableCell className="text-sm">{p.bank} • {p.account}</TableCell>
                        <TableCell>
                          {p.status === "pending"
                            ? <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Chờ xử lý</Badge>
                            : <Badge className="bg-success/10 text-success border-0 text-[10px]">Đã thanh toán</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "pending" ? (
                            <Button size="sm" onClick={() => setActivePayout(p)} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                              <Banknote className="mr-1 h-4 w-4" />Duyệt
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chưa có yêu cầu rút tiền nào</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </>)}

          {/* Ledger section */}
          {currentSection === "ledger" && (<>
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                    <Input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                    <Input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">Loại</Label>
                    <Select value={ledgerKind} onValueChange={(v: typeof ledgerKind) => setLedgerKind(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="in">Tiền vào</SelectItem>
                        <SelectItem value="payout">Payout</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Tìm kiếm</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-10" value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Mã TXN hoặc tên..." />
                    </div>
                  </div>
                  <Button onClick={exportCsv} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                    <Download className="mr-1 h-4 w-4" />Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="text-xs text-muted-foreground">Tổng tiền vào</p>
                  <p className="text-xl font-bold text-success text-right">{fmtVnd(filteredLedger.reduce((s, e) => s + (e.kind === "in" ? e.gross : 0), 0))}</p>
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-card">
                  <p className="text-xs text-muted-foreground">Tổng payout</p>
                  <p className="text-xl font-bold text-primary text-right">{fmtVnd(filteredLedger.reduce((s, e) => s + (e.kind === "payout" ? e.gross : 0), 0))}</p>
                </div>
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 shadow-card">
                  <p className="text-xs text-muted-foreground">Hoa hồng (Net)</p>
                  <p className="text-xl font-extrabold text-primary text-right">{fmtVnd(filteredLedger.reduce((s, e) => s + e.commission, 0))}</p>
                </div>
              </div>

              <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <BookText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Sổ cái — {filteredLedger.length} giao dịch</h3>
                </div>
                {ledgerLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã TXN & Thời gian</TableHead>
                        <TableHead>Người gửi ➔ Người nhận</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead className="text-right">Tổng tiền</TableHead>
                        <TableHead className="text-right">Hoa hồng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLedger.length > 0 ? filteredLedger.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <p className="font-mono text-xs font-semibold">{e.id}</p>
                            <p className="text-[11px] text-muted-foreground">{e.date}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-muted-foreground">{e.from}</span>
                            <span className="mx-1 text-primary">➔</span>
                            <span className="font-medium">{e.to}</span>
                          </TableCell>
                          <TableCell>
                            {e.kind === "in" ? <Badge className="bg-success/10 text-success border-0 text-[10px]">Tiền vào</Badge>
                              : e.kind === "payout" ? <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Payout</Badge>
                              : <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Hoàn tiền</Badge>}
                          </TableCell>
                          <TableCell className="text-right text-sm">{fmtVnd(e.gross)}</TableCell>
                          <TableCell className={`text-right text-sm font-bold ${e.commission < 0 ? "text-destructive" : "text-primary"}`}>
                            {e.commission === 0 ? "—" : fmtVnd(Math.abs(e.commission))}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Không có giao dịch nào</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </>)}
      </div>

      <AlertDialog open={!!userActionDialog} onOpenChange={(open) => !open && setUserActionDialog(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userActionDialog?.type === "block"
                ? "Khóa tài khoản?"
                : userActionDialog?.type === "grant_admin"
                  ? "Cấp quyền Admin?"
                  : "Thu hồi quyền Admin?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userActionDialog?.type === "block"
                ? `Bạn có chắc muốn khóa tài khoản ${userActionDialog.user.email || userActionDialog.user.name || "này"} không?`
                : userActionDialog?.type === "grant_admin"
                  ? "Bạn có chắc muốn cấp quyền Admin cho tài khoản này không?"
                  : "Bạn có chắc muốn thu hồi quyền Admin của tài khoản này không?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              className={`rounded-xl ${userActionDialog?.type === "grant_admin" ? "gradient-primary border-0 text-primary-foreground" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}
              disabled={!!actionLoading}
              onClick={(event) => {
                event.preventDefault();
                if (userActionDialog) {
                  void executeUserAction(userActionDialog);
                }
              }}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payout Modal */}
      <Dialog open={!!activePayout} onOpenChange={(o) => !o && setActivePayout(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />Xác nhận rút tiền — {activePayout?.mentor}
            </DialogTitle>
          </DialogHeader>
          {activePayout && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-accent/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ngân hàng</span><span className="font-semibold">{activePayout.bank}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Số tài khoản</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tracking-wider">{activePayout.account}</span>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyAccount(activePayout.account)}><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Chủ tài khoản</span><span className="font-semibold uppercase">{activePayout.holder}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span>Số tiền</span><span className="text-secondary">{fmtVnd(activePayout.amount)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivePayout(null)} className="rounded-lg">Hủy</Button>
            <Button onClick={confirmPayout} disabled={confirmPayoutMutation.isPending} className="gradient-primary border-0 text-primary-foreground rounded-lg">
              {confirmPayoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" />Xác nhận đã chuyển</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
