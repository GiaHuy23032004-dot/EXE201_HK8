import { useState, useEffect, useCallback } from "react";
import { Users, BookOpen, DollarSign, TrendingUp, Shield, Check, X, BarChart3, Flag, Megaphone, UserX, UserCheck, Crown, Loader2, Search, AlertCircle, Wallet, Copy, Banknote, Download, BookText, ClipboardCheck, Activity, ArrowUpRight, RefreshCw, Info, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminDashboardMetrics, type AdminDashboardViewMode, type AdminRecentActivityItem } from "@/hooks/admin/useAdminDashboardMetrics";
import { cn } from "@/lib/utils";

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
    title: "Tổng quan quản trị",
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
  phone?: string | null;
  avatar_url: string | null;
  product_role: "learner" | "mentor";
  role?: string;
  created_at: string;
  is_blocked: boolean;
  roles: string[];
  is_admin?: boolean;
  bookings_count?: number | null;
  reports_submitted_count?: number | null;
  reports_against_count?: number | null;
};

type UserActionDialogState = {
  type: "block" | "grant_admin" | "revoke_admin";
  user: UserRecord;
} | null;

type UserFilter = "all" | "learner" | "mentor" | "admin" | "blocked";

const USER_PAGE_SIZE = 10;

const userFilterOptions: Array<{ value: UserFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "learner", label: "Learner" },
  { value: "mentor", label: "Mentor" },
  { value: "admin", label: "Admin" },
  { value: "blocked", label: "Đã khóa" },
];

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
  const location = useLocation();
  const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const currentSection = adminRouteSections[location.pathname] ?? "analytics";
  const currentMeta = adminSectionMeta[currentSection];
  const PageIcon = currentMeta.icon;
  const [dashboardViewMode, setDashboardViewMode] = useState<AdminDashboardViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const {
    data: dashboardMetrics,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboardMetrics,
    isFetching: dashboardFetching,
  } = useAdminDashboardMetrics({
    mode: dashboardViewMode,
    month: dashboardViewMode === "month" ? selectedMonth : undefined,
    year: selectedYear,
  }, currentSection === "analytics");

  // ── UI state ──────────────────────────────────────────────
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userActionDialog, setUserActionDialog] = useState<UserActionDialogState>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [hideDemoUsers, setHideDemoUsers] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
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
      throw new Error(`Vui lòng xử lý yêu cầu ${id} tại trang /admin/withdrawals để nhập mã tham chiếu chuyển khoản.`);
    },
    onSuccess: () => {
      refetchPayouts();
      toast({ title: "Đã xác nhận chuyển khoản" });
      setActivePayout(null);
    },
    onError: (error) => toast({
      title: "Không thể xử lý tại dashboard cũ",
      description: error instanceof Error ? error.message : "Hãy mở trang Rút tiền để xử lý.",
      variant: "destructive",
    }),
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
  const isAdminUser = (user: UserRecord) => user.roles.includes("admin") || user.is_admin === true;
  const getProductRole = (user: UserRecord) => (user.product_role === "mentor" ? "mentor" : "learner");
  const getUserName = (user: UserRecord) => user.name || user.email || "Không có tên";
  const getUserInitial = (user: UserRecord) => (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  const isDemoUser = (user: UserRecord) => {
    const email = (user.email ?? "").toLowerCase();
    return email.startsWith("demo-dashboard") || email.includes("vet.local");
  };

  const adminUserCount = new Set(userList.filter((u) => isAdminUser(u)).map((u) => u.user_id)).size;
  const hasDemoUsers = userList.some(isDemoUser);
  const userMetrics = {
    total: userList.length,
    learners: userList.filter((u) => getProductRole(u) === "learner").length,
    mentors: userList.filter((u) => getProductRole(u) === "mentor").length,
    admins: adminUserCount,
    blocked: userList.filter((u) => u.is_blocked).length,
  };
  const userSearchText = userSearch.trim().toLowerCase();
  const filteredUsers = userList.filter((u) => {
    if (hideDemoUsers && isDemoUser(u)) return false;

    if (userFilter === "learner" && getProductRole(u) !== "learner") return false;
    if (userFilter === "mentor" && getProductRole(u) !== "mentor") return false;
    if (userFilter === "admin" && !isAdminUser(u)) return false;
    if (userFilter === "blocked" && !u.is_blocked) return false;

    if (!userSearchText) return true;
    return [u.name, u.email, u.username]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(userSearchText));
  });
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE);
  const userPageStart = filteredUsers.length === 0 ? 0 : (userPage - 1) * USER_PAGE_SIZE + 1;
  const userPageEnd = Math.min(userPage * USER_PAGE_SIZE, filteredUsers.length);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userFilter, hideDemoUsers]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [totalUserPages, userPage]);

  const formatUserDate = (value?: string | null) => {
    if (!value) return "";
    return new Date(value).toLocaleString("vi-VN");
  };

  const formatUserDateShort = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("vi-VN");
  };

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const exportUsersCsv = () => {
    const rows = filteredUsers.map((u) => [
      u.name ?? "",
      u.email ?? "",
      u.username ?? "",
      getProductRole(u),
      isAdminUser(u) ? "Yes" : "No",
      u.is_blocked ? "Yes" : "No",
      formatUserDate(u.created_at),
    ]);
    const header = ["Name", "Email", "Username", "Product Role", "Is Admin", "Is Blocked", "Created At"];
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
  const renderUserAvatar = (user: UserRecord, className = "h-10 w-10") => (
    <Avatar className={cn("shrink-0 rounded-xl", className)}>
      <AvatarImage src={user.avatar_url ?? undefined} />
      <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-sm font-bold">
        {getUserInitial(user)}
      </AvatarFallback>
    </Avatar>
  );

  const renderProductRoleBadge = (user: UserRecord) => {
    const role = getProductRole(user);
    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full text-xs",
          role === "mentor" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-blue-200 bg-blue-50 text-blue-700",
        )}
      >
        {role === "mentor" ? "Mentor" : "Learner"}
      </Badge>
    );
  };

  const renderSystemRoleBadge = (user: UserRecord) => (
    isAdminUser(user)
      ? <Badge className="rounded-full border-0 bg-amber-100 text-amber-700"><Crown className="mr-1 h-3 w-3" />Admin</Badge>
      : <Badge variant="outline" className="rounded-full text-xs text-muted-foreground">User</Badge>
  );

  const renderStatusBadge = (user: UserRecord) => (
    user.is_blocked
      ? <Badge className="rounded-full border-0 bg-destructive/10 text-destructive">Blocked</Badge>
      : <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700">Active</Badge>
  );

  const renderUserActions = (user: UserRecord, compact = false) => {
    const admin = isAdminUser(user);
    const isSelf = user.user_id === currentAdminId;
    const cannotRevokeAdmin = isSelf || (admin && adminUserCount <= 1);
    const blockLoading = actionLoading === `${user.user_id}_block`;
    const roleLoading = actionLoading === `${user.user_id}_role`;

    return (
      <div className={cn("flex flex-wrap items-center gap-2", compact ? "justify-start" : "justify-end")}>
        <Button
          size="sm"
          variant={user.is_blocked ? "default" : "outline"}
          className={cn(
            "h-8 rounded-lg px-3 text-xs",
            user.is_blocked ? "gradient-primary border-0 text-primary-foreground" : "text-destructive hover:text-destructive",
          )}
          disabled={blockLoading || (isSelf && !user.is_blocked)}
          onClick={(event) => {
            event.stopPropagation();
            user.is_blocked ? void handleUnblockUser(user) : handleUserAction("block", user);
          }}
        >
          {blockLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : user.is_blocked ? <><UserCheck className="mr-1 h-3 w-3" />Mở khóa</> : <><UserX className="mr-1 h-3 w-3" />Khóa</>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn("h-8 rounded-lg px-3 text-xs", admin ? "text-destructive hover:text-destructive" : "")}
          disabled={roleLoading || (admin && cannotRevokeAdmin)}
          onClick={(event) => {
            event.stopPropagation();
            handleUserAction(admin ? "revoke_admin" : "grant_admin", user);
          }}
        >
          {roleLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : admin ? <><Crown className="mr-1 h-3 w-3" />Thu hồi Admin</> : <><Crown className="mr-1 h-3 w-3" />Cấp Admin</>}
        </Button>
      </div>
    );
  };

  const renderDetailStat = (label: string, value: string | number | null | undefined) => (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value ?? "Chưa có dữ liệu"}</p>
    </div>
  );

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

  const formatCount = (value: number | null | undefined) => (value ?? 0).toLocaleString("vi-VN");
  const getFunnelLabel = (key: string, fallback: string) => {
    const labels: Record<string, string> = {
      page_view: "Truy cập",
      search_submit: "Tìm kiếm",
      course_view: "Xem khóa học",
      booking_start: "Bắt đầu đặt lịch",
      booking_created: "Tạo booking",
      payment_success: "Thanh toán thành công",
    };
    return labels[key] ?? fallback;
  };
  const getTrafficConversionLabel = (key: string, fallback: string) => {
    const labels: Record<string, string> = {
      search_per_visit: "Truy cập → Tìm kiếm",
      course_view_per_search: "Tìm kiếm → Xem khóa học",
      booking_start_per_course_view: "Xem khóa học → Bắt đầu đặt lịch",
      booking_created_per_booking_start: "Bắt đầu đặt lịch → Tạo booking",
      payment_success_per_booking_created: "Tạo booking → Thanh toán thành công",
    };
    return labels[key] ?? fallback;
  };
  const getOperationalConversionLabel = (key: string, fallback: string) => {
    const labels: Record<string, string> = {
      booking_to_payment_success: "Booking → Thanh toán thành công",
      payment_success_to_completed_booking: "Thanh toán → Hoàn thành buổi học",
      completed_booking_to_review: "Hoàn thành → Đánh giá",
      refund_rate: "Tỷ lệ hoàn tiền",
      course_approval_rate: "Tỷ lệ duyệt khóa học",
      report_resolution_rate: "Tỷ lệ xử lý báo cáo",
      withdrawal_processing_rate: "Tỷ lệ xử lý rút tiền",
    };
    return labels[key] ?? fallback;
  };
  const getOperationalConversionHelper = (key: string, fallback: string) => {
    const helpers: Record<string, string> = {
      booking_to_payment_success: "Giao dịch thành công / booking được tạo",
      payment_success_to_completed_booking: "Booking hoàn thành / giao dịch thành công",
      completed_booking_to_review: "Review được gửi / booking hoàn thành",
      refund_rate: "Giao dịch hoàn tiền / giao dịch thành công",
      course_approval_rate: "Khóa đã duyệt / khóa tạo mới",
      report_resolution_rate: "Report đã xử lý hoặc bỏ qua / report mới",
      withdrawal_processing_rate: "Yêu cầu đã xử lý / yêu cầu rút tiền mới",
    };
    return helpers[key] ?? fallback;
  };
  const formatCompactVnd = (value: number | null | undefined) => {
    const amount = value ?? 0;
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace(".0", "")}B VNĐ`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".0", "")}M VNĐ`;
    return fmtVnd(amount);
  };
  const formatAxisVnd = (value: number) => {
    if (value === 0) return "0đ";
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".0", "")} tỷ`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")} tr`;
    if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
    return `${value}đ`;
  };
  const formatPercent = (value: number | null | undefined) =>
    value === null || value === undefined ? "Chưa đủ dữ liệu" : `${(value * 100).toFixed(1).replace(".0", "")}%`;

  const dashboard = dashboardMetrics;
  const overview = dashboard?.overview;
  const revenueChartData = dashboard?.charts?.revenue ?? [];
  const bookingChartData = dashboard?.charts?.bookings ?? [];
  const periodLabel = dashboard?.selectedPeriod?.label ?? (
    dashboardViewMode === "year"
      ? `Năm ${selectedYear}`
      : `Tháng ${String(selectedMonth).padStart(2, "0")}/${selectedYear}`
  );
  const isCurrentPeriod = dashboardViewMode === "year"
    ? selectedYear >= currentYear
    : selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth);
  const handlePreviousPeriod = () => {
    if (dashboardViewMode === "year") {
      setSelectedYear((year) => year - 1);
      return;
    }

    setSelectedMonth((month) => {
      if (month > 1) return month - 1;
      setSelectedYear((year) => year - 1);
      return 12;
    });
  };
  const handleNextPeriod = () => {
    if (isCurrentPeriod) return;
    if (dashboardViewMode === "year") {
      setSelectedYear((year) => Math.min(year + 1, currentYear));
      return;
    }

    setSelectedMonth((month) => {
      if (selectedYear === currentYear && month >= currentMonth) return month;
      if (month < 12) return month + 1;
      setSelectedYear((year) => Math.min(year + 1, currentYear));
      return 1;
    });
  };
  const handleCurrentPeriod = () => {
    setSelectedYear(currentYear);
    if (dashboardViewMode === "month") {
      setSelectedMonth(currentMonth);
    }
  };
  const handleViewModeChange = (mode: AdminDashboardViewMode) => {
    setDashboardViewMode(mode);
    if (mode === "month") {
      setSelectedMonth((month) => selectedYear === currentYear ? Math.min(month, currentMonth) : month);
    }
  };
  const buildFallbackTimeline = () => {
    if (dashboardViewMode === "year") {
      return Array.from({ length: 12 }, (_, index) => {
        const start = new Date(selectedYear, index, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return {
          bucketKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
          label: `T${start.getMonth() + 1}`,
          start: start.toISOString(),
          end: end.toISOString(),
        };
      });
    }

    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    const periodEnd = new Date(selectedYear, selectedMonth, 1);

    const buckets = [];
    for (let index = 0; index < 6; index += 1) {
      const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + index * 7);
      if (start >= periodEnd) break;
      const rawEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      const end = rawEnd < periodEnd ? rawEnd : periodEnd;
      const endLabelDate = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      buckets.push({
        bucketKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}_${endLabelDate.getFullYear()}-${String(endLabelDate.getMonth() + 1).padStart(2, "0")}-${String(endLabelDate.getDate()).padStart(2, "0")}`,
        label: `Tuần ${index + 1}`,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }

    return buckets;
  };
  const fallbackTimeline = buildFallbackTimeline();
  const revenueTimelineData = revenueChartData.length > 0
    ? revenueChartData
    : fallbackTimeline.map((bucket) => ({ ...bucket, gmv: 0, platformFee: 0 }));
  const bookingTimelineData = bookingChartData.length > 0
    ? bookingChartData
    : fallbackTimeline.map((bucket) => ({ ...bucket, total: 0, completed: 0 }));
  const ledgerCashFlowData = dashboard?.charts?.ledgerCashFlow?.length
    ? dashboard.charts.ledgerCashFlow
    : fallbackTimeline.map((bucket) => ({ ...bucket, inflow: 0, platformFee: 0, mentorNet: 0, refund: 0 }));
  const payoutStatusData = dashboard?.charts?.payoutStatus?.length
    ? dashboard.charts.payoutStatus
    : fallbackTimeline.map((bucket) => ({ ...bucket, paid: 0, pending: 0, rejected: 0, refund: 0 }));
  const revenueTotal = revenueChartData.reduce(
    (sum, item) => sum + Number(item.gmv || 0) + Number(item.platformFee || 0),
    0,
  );
  const bookingTotal = bookingChartData.reduce(
    (sum, item) => sum + Number(item.total || 0) + Number(item.completed || 0),
    0,
  );
  const hasRevenueSeriesData = revenueTotal > 0;
  const hasBookingSeriesData = bookingTotal > 0;
  const hasLedgerCashFlowData = ledgerCashFlowData.some((item) =>
    Number(item.inflow || 0) > 0 ||
    Number(item.platformFee || 0) > 0 ||
    Number(item.mentorNet || 0) > 0 ||
    Number(item.refund || 0) > 0
  );
  const hasPayoutStatusData = payoutStatusData.some((item) =>
    Number(item.paid || 0) > 0 ||
    Number(item.pending || 0) > 0 ||
    Number(item.rejected || 0) > 0 ||
    Number(item.refund || 0) > 0
  );
  const hasRefundSeriesData = ledgerCashFlowData.some((item) => Number(item.refund || 0) > 0);
  const hasRejectedPayoutData = payoutStatusData.some((item) => Number(item.rejected || 0) > 0);
  const operationalRates = dashboard?.operationalRates ?? [];
  const trafficFunnel = dashboard?.trafficFunnel ?? null;
  const trafficConversionRates = dashboard?.conversionRates ?? [];
  const pendingActions = dashboard?.pendingActions;
  const recentActivity = dashboard?.recentActivity ?? [];
  const selectedRangeLabel = periodLabel;
  const chartGranularityLabel = dashboard?.granularity === "week" ? "tuần" : "tháng";
  const formatDateShort = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };
  const formatBucketRange = (start?: string, end?: string) => {
    if (!start || !end) return "";
    const endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) return "";
    const inclusiveEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
    return `${formatDateShort(start)} - ${inclusiveEnd.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
  };
  type ChartTooltipPayload = {
    value?: number | string;
    dataKey?: string | number;
    name?: string;
    payload?: {
      label?: string;
      start?: string;
      end?: string;
      gmv?: number;
      platformFee?: number;
      total?: number;
      completed?: number;
      inflow?: number;
      mentorNet?: number;
      refund?: number;
      paid?: number;
      pending?: number;
      rejected?: number;
    };
  };
  const renderLegendText = (value: unknown) => (
    <span className="text-sm font-medium text-foreground">{String(value)}</span>
  );
  const formatAxisLabel = (value: string) => value === "Tuần hiện tại" ? "Tuần này" : value;
  const RevenueTooltip = ({ active, payload }: { active?: boolean; payload?: ChartTooltipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const header = `${point?.label ?? ""}${point?.start && point?.end ? ` · ${formatBucketRange(point.start, point.end)}` : ""}`;

    return (
      <div className="rounded-xl border bg-background p-3 text-xs shadow-lg">
        <p className="mb-2 font-semibold text-foreground">{header}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>GMV: <span className="font-medium text-foreground">{fmtVnd(Number(point?.gmv ?? 0))}</span></p>
          <p>Phí nền tảng: <span className="font-medium text-foreground">{fmtVnd(Number(point?.platformFee ?? 0))}</span></p>
        </div>
      </div>
    );
  };
  const BookingTooltip = ({ active, payload }: { active?: boolean; payload?: ChartTooltipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const total = Number(point?.total ?? 0);
    const completed = Number(point?.completed ?? 0);
    const completionRate = total > 0 ? `${((completed / total) * 100).toFixed(1).replace(".0", "")}%` : "—";
    const header = `${point?.label ?? ""}${point?.start && point?.end ? ` · ${formatBucketRange(point.start, point.end)}` : ""}`;

    return (
      <div className="rounded-xl border bg-background p-3 text-xs shadow-lg">
        <p className="mb-2 font-semibold text-foreground">{header}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>Tổng booking: <span className="font-medium text-foreground">{formatCount(total)}</span></p>
          <p>Đã hoàn thành: <span className="font-medium text-foreground">{formatCount(completed)}</span></p>
          <p>Tỷ lệ hoàn thành: <span className="font-medium text-foreground">{completionRate}</span></p>
        </div>
      </div>
    );
  };
  const LedgerCashFlowTooltip = ({ active, payload }: { active?: boolean; payload?: ChartTooltipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const header = `${point?.label ?? ""}${point?.start && point?.end ? ` · ${formatBucketRange(point.start, point.end)}` : ""}`;

    return (
      <div className="rounded-xl border bg-background p-3 text-xs shadow-lg">
        <p className="mb-2 font-semibold text-foreground">{header}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>Tiền vào: <span className="font-medium text-foreground">{fmtVnd(Number(point?.inflow ?? 0))}</span></p>
          <p>Phí nền tảng: <span className="font-medium text-foreground">{fmtVnd(Number(point?.platformFee ?? 0))}</span></p>
          <p>Net mentor: <span className="font-medium text-foreground">{fmtVnd(Number(point?.mentorNet ?? 0))}</span></p>
          {Number(point?.refund ?? 0) > 0 && (
            <p>Hoàn tiền: <span className="font-medium text-rose-600">{fmtVnd(Number(point?.refund ?? 0))}</span></p>
          )}
        </div>
      </div>
    );
  };
  const PayoutStatusTooltip = ({ active, payload }: { active?: boolean; payload?: ChartTooltipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const header = `${point?.label ?? ""}${point?.start && point?.end ? ` · ${formatBucketRange(point.start, point.end)}` : ""}`;

    return (
      <div className="rounded-xl border bg-background p-3 text-xs shadow-lg">
        <p className="mb-2 font-semibold text-foreground">{header}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>Đã chi: <span className="font-medium text-emerald-700">{fmtVnd(Number(point?.paid ?? 0))}</span></p>
          <p>Đang chờ chi: <span className="font-medium text-amber-700">{fmtVnd(Number(point?.pending ?? 0))}</span></p>
          {Number(point?.rejected ?? 0) > 0 && (
            <p>Từ chối: <span className="font-medium text-slate-700">{fmtVnd(Number(point?.rejected ?? 0))}</span></p>
          )}
          {Number(point?.refund ?? 0) > 0 && (
            <p>Hoàn tiền: <span className="font-medium text-rose-600">{fmtVnd(Number(point?.refund ?? 0))}</span></p>
          )}
        </div>
      </div>
    );
  };
  const cleanDashboardText = (value: string | null | undefined) => {
    if (!value) return "";

    const replacements: Array<[string, string]> = [
      ["Thanh toÃ¡n thÃ nh cÃ´ng", "Thanh toán thành công"],
      ["Booking má»›i", "Booking mới"],
      ["BÃ¡o cÃ¡o má»›i", "Báo cáo mới"],
      ["KhÃ³a há»c chá» duyá»‡t", "Khóa học chờ duyệt"],
      ["KhÃ³a há»c má»›i", "Khóa học mới"],
      ["YÃªu cáº§u rÃºt tiá»n", "Yêu cầu rút tiền"],
      ["Giao dá»‹ch", "Giao dịch"],
      ["Hoáº¡t Ä‘á»™ng gáº§n Ä‘Ã¢y", "Hoạt động gần đây"],
      ["Xá»­ lÃ½", "Xử lý"],
      ["â€¢", "•"],
      ["Ä‘", "đ"],
      ["upcoming", "sắp diễn ra"],
      ["pending", "chờ xử lý"],
      ["completed", "đã hoàn thành"],
      ["success", "thành công"],
      ["failed", "thất bại"],
    ];

    return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
  };
  const getRecentActivityTitle = (item: AdminRecentActivityItem) => {
    if (item.type === "transaction") return "Thanh toán thành công";
    if (item.type === "booking") return "Booking mới";
    if (item.type === "report") return "Báo cáo mới";
    if (item.type === "course" || item.type === "course_submitted") return "Khóa học chờ duyệt";
    if (item.type === "withdrawal") return "Yêu cầu rút tiền";
    return cleanDashboardText(item.title);
  };

  const dashboardKpis = overview ? [
    {
      icon: Users,
      label: "Tổng người dùng",
      value: formatCount(overview.totalUsers),
      helper: `${formatCount(overview.totalLearners)} learner • ${formatCount(overview.totalMentors)} mentor`,
      tone: "text-sky-600",
      bg: "bg-sky-50",
      scope: "Toàn hệ thống",
    },
    {
      icon: TrendingUp,
      label: "Mentor có khóa đang hoạt động",
      value: formatCount(overview.activeMentors),
      helper: "Có khóa đã duyệt hoặc từng có booking",
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
      scope: "Hiện tại",
    },
    {
      icon: BookOpen,
      label: "Khóa học đã duyệt",
      value: formatCount(overview.approvedCourses),
      helper: `${formatCount(overview.pendingCourses)} khóa chờ duyệt`,
      tone: "text-cyan-600",
      bg: "bg-cyan-50",
      scope: "Hiện tại",
    },
    {
      icon: BarChart3,
      label: "Booking trong kỳ",
      value: formatCount(overview.bookingsInRange),
      helper: `${formatCount(overview.completedBookingsInRange)} đã hoàn thành`,
      tone: "text-indigo-600",
      bg: "bg-indigo-50",
      scope: "Theo khoảng thời gian đã chọn",
    },
    {
      icon: DollarSign,
      label: "GMV trong kỳ",
      value: formatCompactVnd(overview.gmvInRange),
      helper: "GMV từ giao dịch thành công",
      tone: "text-amber-600",
      bg: "bg-amber-50",
      scope: "Theo khoảng thời gian đã chọn",
    },
    {
      icon: Flag,
      label: "Report chờ xử lý",
      value: formatCount(overview.pendingReports),
      helper: overview.appealedReports > 0 ? `${formatCount(overview.appealedReports)} kháng cáo` : "Không tính report đã đóng",
      tone: overview.pendingReports > 0 ? "text-rose-600" : "text-slate-600",
      bg: overview.pendingReports > 0 ? "bg-rose-50" : "bg-slate-50",
      scope: "Hiện tại",
    },
    {
      icon: Wallet,
      label: "Rút tiền chờ duyệt",
      value: formatCount(overview.pendingWithdrawals),
      helper: formatCompactVnd(overview.pendingWithdrawalAmount),
      tone: overview.pendingWithdrawals > 0 ? "text-orange-600" : "text-slate-600",
      bg: overview.pendingWithdrawals > 0 ? "bg-orange-50" : "bg-slate-50",
      scope: "Hiện tại",
    },
  ] : [];

  const actionItems = pendingActions ? [
    {
      label: "Khóa học chờ duyệt",
      description: "Kiểm tra nội dung trước khi public",
      count: pendingActions.pendingCourseCount,
      link: "/admin/courses?status=pending",
    },
    ...(pendingActions.pendingMentorVerificationCount !== null ? [{
      label: "Hồ sơ Mentor chờ xác minh",
      description: "Duyệt hồ sơ và bằng chứng tin cậy",
      count: pendingActions.pendingMentorVerificationCount,
      link: "/admin/mentor-verifications?status=pending",
    }] : []),
    {
      label: "Báo cáo chờ xử lý",
      description: "Xử lý report mới từ learner",
      count: pendingActions.pendingReportCount,
      link: "/admin/reports?status=pending",
    },
    {
      label: "Kháng cáo",
      description: "Các case cần xem xét lại",
      count: pendingActions.appealedReportCount,
      link: "/admin/reports?status=appealed",
    },
    {
      label: "Yêu cầu rút tiền",
      description: "Đối soát payout đang pending",
      count: pendingActions.pendingWithdrawalCount,
      link: "/admin/withdrawals?status=pending",
    },
  ] : [];

  const operationalAlerts = [
    ...(overview?.pendingReports ? [{
      label: `${formatCount(overview.pendingReports)} báo cáo đang chờ xử lý`,
      link: "/admin/reports?status=pending",
    }] : []),
    ...(overview?.appealedReports ? [{
      label: `${formatCount(overview.appealedReports)} kháng cáo cần review`,
      link: "/admin/reports?status=appealed",
    }] : []),
    ...(overview?.pendingWithdrawals ? [{
      label: `${formatCount(overview.pendingWithdrawals)} yêu cầu rút tiền cần đối soát`,
      link: "/admin/withdrawals?status=pending",
    }] : []),
    ...(overview?.pendingCourses ? [{
      label: `${formatCount(overview.pendingCourses)} khóa học chờ duyệt`,
      link: "/admin/courses?status=pending",
    }] : []),
    ...((pendingActions?.pendingMentorVerificationCount ?? 0) > 0 ? [{
      label: `${formatCount(pendingActions?.pendingMentorVerificationCount ?? 0)} hồ sơ Mentor chờ xác minh`,
      link: "/admin/mentor-verifications?status=pending",
    }] : []),
  ];

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PageIcon className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">{currentMeta.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{currentMeta.description}</p>
          </div>
          {currentSection === "analytics" && (
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm lg:flex-row lg:items-center">
              <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                {([
                  { value: "month", label: "1 tháng" },
                  { value: "year", label: "1 năm" },
                ] as const).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={dashboardViewMode === option.value ? "default" : "ghost"}
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => handleViewModeChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1 text-xs font-medium text-muted-foreground">Chế độ xem</span>
                {dashboardViewMode === "month" && (
                  <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                    <SelectTrigger className="h-9 w-[128px] rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <SelectItem
                          key={month}
                          value={String(month)}
                          disabled={selectedYear === currentYear && month > currentMonth}
                        >
                          Tháng {String(month).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  type="number"
                  value={selectedYear}
                  max={currentYear}
                  min={2000}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);
                    if (!Number.isFinite(nextYear)) return;
                    const clampedYear = Math.min(Math.max(nextYear, 2000), currentYear);
                    setSelectedYear(clampedYear);
                    if (clampedYear === currentYear && selectedMonth > currentMonth) {
                      setSelectedMonth(currentMonth);
                    }
                  }}
                  className="h-9 w-[96px] rounded-xl bg-background text-sm"
                  aria-label="Năm"
                />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={handlePreviousPeriod} aria-label="Kỳ trước">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={handleNextPeriod} disabled={isCurrentPeriod} aria-label="Kỳ sau">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs" onClick={handleCurrentPeriod}>
                  Hiện tại
                </Button>
                <span className="w-full px-1 text-xs text-muted-foreground sm:w-auto">
                  Dữ liệu trong {periodLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {currentSection === "analytics" && (
          <>
            {dashboardError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-card">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
                <h2 className="text-lg font-semibold text-foreground">
                  {dashboardError.message.includes("quyền") ? "Bạn không có quyền truy cập trang này." : "Không thể tải số liệu dashboard."}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{dashboardError.message}</p>
                <Button
                  variant="outline"
                  onClick={() => refetchDashboardMetrics()}
                  className="mt-5 rounded-xl"
                  disabled={dashboardFetching}
                >
                  {dashboardFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Thử lại
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {operationalAlerts.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Cần chú ý hôm nay</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {operationalAlerts.map((alert) => (
                            <Link
                              key={alert.link}
                              to={alert.link}
                              className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium transition-colors hover:bg-background"
                            >
                              {alert.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardLoading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="rounded-2xl border bg-card p-5 shadow-sm">
                          <Skeleton className="mb-4 h-10 w-10 rounded-xl" />
                          <Skeleton className="mb-3 h-4 w-28" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      ))
                    : dashboardKpis.map((stat) => (
                        <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.bg)}>
                              <stat.icon className={cn("h-5 w-5", stat.tone)} />
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{stat.scope}</span>
                          </div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                          <p className="mt-1 min-h-4 text-xs text-muted-foreground">{stat.helper}</p>
                        </div>
                      ))}
                </div>

                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Phễu truy cập & đặt lịch</h3>
                      <p className="text-sm text-muted-foreground">
                        Theo dõi hành trình từ truy cập, tìm kiếm, xem khóa học đến đặt lịch và thanh toán.
                      </p>
                    </div>
                    {dashboard && (
                      <Badge variant="outline" className="w-fit rounded-full">
                        {selectedRangeLabel}
                      </Badge>
                    )}
                  </div>
                  {dashboardLoading ? (
                    <Skeleton className="h-40 rounded-2xl" />
                  ) : trafficFunnel ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {trafficFunnel.map((step, index) => {
                          const stepConversion = index > 0 ? trafficConversionRates[index - 1] : null;

                          return (
                            <div key={step.key} className="rounded-2xl border bg-background p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {index + 1}
                                </span>
                                {index > 0 && <span className="text-xs text-muted-foreground">sau bước {index}</span>}
                              </div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {getFunnelLabel(step.key, step.label)}
                              </p>
                              <p className="mt-2 text-2xl font-bold text-foreground">{formatCount(step.count)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">người dùng/visitor</p>
                              <p className="mt-3 rounded-lg bg-muted/40 px-2 py-1 text-xs font-medium text-foreground">
                                {stepConversion ? `${formatPercent(stepConversion.rate)} từ bước trước` : "Bước đầu"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        {trafficConversionRates.map((item) => (
                          <div key={item.key} className="rounded-xl border bg-muted/20 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {getTrafficConversionLabel(item.key, `${item.from} → ${item.to}`)}
                            </p>
                            <p className={cn("mt-2 text-lg font-bold", item.rate === null ? "text-muted-foreground" : "text-primary")}>
                              {formatPercent(item.rate)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatCount(item.numerator)} / {formatCount(item.denominator)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Chưa có dữ liệu tracking.</p>
                      <p className="mt-1">Phễu truy cập sẽ hiển thị khi hệ thống ghi nhận dữ liệu hành vi thật.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Hiệu suất xử lý vận hành</h3>
                      <p className="text-sm text-muted-foreground">
                        Theo dõi tỷ lệ xử lý các hàng đợi quan trọng của Admin.
                      </p>
                    </div>
                    {dashboard && (
                      <Badge variant="outline" className="w-fit rounded-full">
                        {selectedRangeLabel}
                      </Badge>
                    )}
                  </div>
                  {dashboardLoading ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        {operationalRates.map((item) => (
                          <div key={item.key} className="rounded-2xl border bg-background p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {getOperationalConversionLabel(item.key, item.label)}
                            </p>
                            <p className={cn("mt-3 text-2xl font-bold", item.rate === null ? "text-muted-foreground" : "text-foreground")}>
                              {formatPercent(item.rate)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatCount(item.numerator)} / {formatCount(item.denominator)}
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {getOperationalConversionHelper(item.key, item.helper)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 items-stretch gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0 space-y-6">
                    <div className="rounded-2xl border bg-card p-6 shadow-sm">
                      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">GMV & phí nền tảng</h3>
                            <Info
                              className="h-4 w-4 text-muted-foreground"
                              aria-label="GMV là tổng tiền học viên đã thanh toán thành công. Phí nền tảng là phần VET giữ lại từ các giao dịch thành công. Không bao gồm giao dịch pending, failed hoặc refunded."
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            GMV từ giao dịch thành công trong kỳ.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          {overview && (
                            <div className="rounded-xl bg-primary/5 px-4 py-2 text-right">
                              <p className="text-xs text-muted-foreground">Phí nền tảng trong kỳ</p>
                              <p className="font-semibold text-primary">{formatCompactVnd(overview.platformFeeInRange)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {dashboardLoading ? (
                        <Skeleton className="h-[280px] rounded-xl" />
                      ) : (
                        <div className="relative h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueTimelineData} margin={{ top: 18, right: 28, left: 8, bottom: 20 }}>
                              <defs>
                                <linearGradient id="adminGmv" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                height={44}
                                interval={0}
                                minTickGap={10}
                                tickMargin={12}
                                padding={{ left: 18, right: 18 }}
                                tickFormatter={(value) => formatAxisLabel(String(value))}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                width={70}
                                tickMargin={8}
                                tickFormatter={(value) => formatAxisVnd(Number(value))}
                              />
                              <Tooltip content={<RevenueTooltip />} />
                              <Legend formatter={renderLegendText} verticalAlign="bottom" height={34} iconType="circle" />
                              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                              <Area type="monotone" dataKey="gmv" name="GMV" stroke="hsl(var(--primary))" fill="url(#adminGmv)" strokeWidth={2.5} dot={false} activeDot={hasRevenueSeriesData} />
                              <Area type="monotone" dataKey="platformFee" name="Phí nền tảng" stroke="hsl(var(--muted-foreground))" fill="transparent" strokeWidth={2.25} dot={false} activeDot={hasRevenueSeriesData} />
                            </AreaChart>
                          </ResponsiveContainer>
                          {!hasRevenueSeriesData && (
                            <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                              Chưa có dữ liệu giao dịch thành công trong giai đoạn này.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-card p-6 shadow-sm">
                      <div className="mb-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-foreground">Booking theo thời gian</h3>
                              <Info
                                className="h-4 w-4 text-muted-foreground"
                                aria-label="Tổng booking là số booking được tạo trong kỳ. Đã hoàn thành là booking có trạng thái completed."
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">Tổng booking và số booking đã hoàn thành trong {selectedRangeLabel}.</p>
                          </div>
                        </div>
                      </div>
                      {dashboardLoading ? (
                        <Skeleton className="h-[280px] rounded-xl" />
                      ) : (
                        <div className="relative h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bookingTimelineData} margin={{ top: 18, right: 28, left: 8, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                height={44}
                                interval={0}
                                minTickGap={10}
                                tickMargin={12}
                                padding={{ left: 18, right: 18 }}
                                tickFormatter={(value) => formatAxisLabel(String(value))}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                width={48}
                                tickMargin={8}
                                allowDecimals={false}
                              />
                              <Tooltip content={<BookingTooltip />} />
                              <Legend formatter={renderLegendText} verticalAlign="bottom" height={34} iconType="circle" />
                              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                              <Bar dataKey="total" name="Tổng booking" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                              <Bar dataKey="completed" name="Đã hoàn thành" fill="hsl(var(--muted-foreground))" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                          {!hasBookingSeriesData && (
                            <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                              Chưa có dữ liệu booking trong giai đoạn này.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-h-[380px] flex-col rounded-2xl border bg-card p-6 shadow-sm">
                      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">Dòng tiền vận hành</h3>
                            <Info
                              className="h-4 w-4 text-muted-foreground"
                              aria-label="Tiền vào là tổng giao dịch thành công. Phí nền tảng là platform_fee của giao dịch thành công. Net mentor bằng tiền vào trừ phí nền tảng. Hoàn tiền chỉ tính giao dịch refunded."
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Theo dõi tiền vào, phí nền tảng và phần doanh thu thuộc mentor trong kỳ.
                          </p>
                        </div>
                        <Badge variant="outline" className="w-fit rounded-full">
                          Gộp theo {chartGranularityLabel}
                        </Badge>
                      </div>

                      {dashboardLoading ? (
                        <Skeleton className="h-[320px] rounded-xl" />
                      ) : (
                        <div className="relative h-[320px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ledgerCashFlowData} margin={{ top: 18, right: 28, left: 8, bottom: 20 }}>
                              <defs>
                                <linearGradient id="ledgerInflow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.14} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                                </linearGradient>
                                <linearGradient id="ledgerMentorNet" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.09} />
                                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.01} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                height={44}
                                interval={0}
                                minTickGap={10}
                                tickMargin={12}
                                padding={{ left: 18, right: 18 }}
                                tickFormatter={(value) => formatAxisLabel(String(value))}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                width={70}
                                tickMargin={8}
                                tickFormatter={(value) => formatAxisVnd(Number(value))}
                              />
                              <Tooltip content={<LedgerCashFlowTooltip />} />
                              <Legend formatter={renderLegendText} verticalAlign="bottom" height={34} iconType="circle" />
                              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                              <Area type="monotone" dataKey="inflow" name="Tiền vào" stroke="#2563eb" fill="url(#ledgerInflow)" strokeWidth={2.4} dot={false} activeDot={hasLedgerCashFlowData} />
                              <Area type="monotone" dataKey="mentorNet" name="Net mentor" stroke="#0f766e" fill="url(#ledgerMentorNet)" strokeWidth={2.1} dot={false} activeDot={hasLedgerCashFlowData} />
                              <Area type="monotone" dataKey="platformFee" name="Phí nền tảng" stroke="#64748b" fill="transparent" strokeWidth={1.9} dot={false} activeDot={hasLedgerCashFlowData} />
                              {hasRefundSeriesData && (
                                <Area type="monotone" dataKey="refund" name="Hoàn tiền" stroke="#9f1239" fill="transparent" strokeWidth={1.8} strokeDasharray="5 4" dot={false} />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                          {!hasLedgerCashFlowData && (
                            <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                              Chưa có dữ liệu dòng tiền trong giai đoạn này.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-h-[380px] flex-col rounded-2xl border bg-card p-6 shadow-sm">
                      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">Trạng thái chi trả mentor</h3>
                            <Info
                              className="h-4 w-4 text-muted-foreground"
                              aria-label="Đã chi là withdrawal_requests paid. Đang chờ chi là pending. Từ chối là rejected hoặc canceled. Hoàn tiền lấy từ giao dịch refunded."
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Theo dõi tiền đã chi, đang chờ chi và hoàn tiền để kiểm soát áp lực vận hành.
                          </p>
                        </div>
                      </div>

                      {dashboardLoading ? (
                        <Skeleton className="h-[320px] rounded-xl" />
                      ) : (
                        <div className="relative h-[320px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={payoutStatusData} margin={{ top: 18, right: 20, left: 8, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                height={44}
                                interval={0}
                                minTickGap={8}
                                tickMargin={12}
                                padding={{ left: 14, right: 14 }}
                                tickFormatter={(value) => formatAxisLabel(String(value))}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                width={66}
                                tickMargin={8}
                                tickFormatter={(value) => formatAxisVnd(Number(value))}
                              />
                              <Tooltip content={<PayoutStatusTooltip />} />
                              <Legend formatter={renderLegendText} verticalAlign="bottom" height={46} iconType="circle" />
                              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                              <Bar dataKey="paid" name="Đã chi" stackId="payout" fill="#0f766e" fillOpacity={0.9} radius={[8, 8, 0, 0]} />
                              <Bar dataKey="pending" name="Đang chờ chi" stackId="payout" fill="#64748b" fillOpacity={0.82} radius={[8, 8, 0, 0]} />
                              {hasRejectedPayoutData && (
                                <Bar dataKey="rejected" name="Từ chối" stackId="payout" fill="#334155" fillOpacity={0.8} radius={[8, 8, 0, 0]} />
                              )}
                              {hasRefundSeriesData && (
                                <Bar dataKey="refund" name="Hoàn tiền" stackId="payout" fill="#9f1239" fillOpacity={0.72} radius={[8, 8, 0, 0]} />
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                          {!hasPayoutStatusData && (
                            <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                              Chưa có dữ liệu chi trả trong giai đoạn này.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="flex min-w-0 flex-col gap-6">
                    <div className="shrink-0 rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Việc cần xử lý</h3>
                          <p className="text-sm text-muted-foreground">Các hàng đợi vận hành quan trọng.</p>
                        </div>
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                      </div>
                      {dashboardLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
                        </div>
                      ) : actionItems.every((item) => item.count === 0) ? (
                        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                          <Check className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                          <p className="font-medium text-foreground">Tất cả đã ổn.</p>
                          <p className="mt-1 text-sm text-muted-foreground">Không có hàng đợi cần xử lý ngay.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {actionItems.map((item) => (
                            <div key={item.label} className="rounded-xl border bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground">{item.label}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                                </div>
                                <Badge className={item.count > 0 ? "bg-primary/10 text-primary border-0" : "bg-muted text-muted-foreground border-0"}>
                                  {formatCount(item.count)}
                                </Badge>
                              </div>
                              {item.count > 0 && (
                                <Button asChild variant="outline" size="sm" className="mt-3 h-8 rounded-lg">
                                  <Link to={item.link}>
                                    Xử lý
                                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex min-h-[380px] flex-1 flex-col rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Hoạt động gần đây</h3>
                          <p className="text-sm text-muted-foreground">Booking, thanh toán, báo cáo và kiểm duyệt.</p>
                        </div>
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      {dashboardLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-14 rounded-xl" />)}
                        </div>
                      ) : recentActivity.length ? (
                        <div className="space-y-3">
                          {recentActivity.map((item, index) => {
                            const ActivityIcon =
                              item.type === "transaction" ? DollarSign :
                              item.type === "report" ? Flag :
                              item.type === "withdrawal" ? Wallet :
                              item.type === "course" || item.type === "course_submitted" ? BookOpen :
                              item.type === "mentor_verification" ? UserCheck :
                              BarChart3;

                            return (
                              <Link
                                key={`${item.type}-${item.created_at}-${index}`}
                                to={item.link}
                                className="flex gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <ActivityIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-foreground">{getRecentActivityTitle(item)}</p>
                                  <p className="truncate text-xs text-muted-foreground">{cleanDashboardText(item.description)}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("vi-VN")}</p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                          Chưa có hoạt động gần đây.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </>)}

          {/* User management section */}
          {currentSection === "users" && (<>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Tổng user", value: userMetrics.total, hint: "Toàn hệ thống" },
                { label: "Learner", value: userMetrics.learners, hint: "Product role" },
                { label: "Mentor", value: userMetrics.mentors, hint: "Product role" },
                { label: "Admin", value: userMetrics.admins, hint: "System role" },
                { label: "Đã khóa", value: userMetrics.blocked, hint: "Blocked" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                    <span className="text-[11px] text-muted-foreground">{metric.hint}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên, email hoặc username..."
                    className="h-10 rounded-xl pl-10"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {userFilterOptions.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={userFilter === option.value ? "default" : "outline"}
                      className={cn("h-9 rounded-full px-4 text-xs", userFilter === option.value ? "gradient-primary border-0 text-primary-foreground" : "")}
                      onClick={() => setUserFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  {hasDemoUsers && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={hideDemoUsers}
                        onChange={(event) => setHideDemoUsers(event.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                      Ẩn dữ liệu demo
                    </label>
                  )}
                  {(userSearch || userFilter !== "all" || hideDemoUsers) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full text-xs"
                      onClick={() => {
                        setUserSearch("");
                        setUserFilter("all");
                        setHideDemoUsers(false);
                      }}
                    >
                      <X className="mr-1 h-3 w-3" />Xóa bộ lọc
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchUsers} disabled={userLoading} className="h-9 rounded-xl">
                    {userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Làm mới
                  </Button>
                  <Button variant="outline" onClick={exportUsersCsv} disabled={userLoading || filteredUsers.length === 0} className="h-9 rounded-xl">
                    <Download className="mr-2 h-4 w-4" />
                    Tải danh sách
                  </Button>
                </div>
              </div>
            </div>

            {userLoading ? (
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <Skeleton key={item} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : userLoadError ? (
              <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-14 text-center">
                <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
                <p className="font-semibold text-foreground">Không thể tải danh sách người dùng</p>
                <p className="mt-1 text-sm text-muted-foreground">{userLoadError}</p>
                <Button variant="outline" onClick={fetchUsers} className="mt-4 rounded-xl">Thử lại</Button>
              </div>
            ) : userList.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-sm">
                <Users className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Chưa có người dùng nào trong hệ thống.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-sm">
                <Search className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-foreground">Không có người dùng phù hợp với bộ lọc.</p>
                <p className="text-sm text-muted-foreground">Thử đổi từ khóa, role hoặc trạng thái.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[280px]">User</TableHead>
                        <TableHead>Product role</TableHead>
                        <TableHead>System role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((user) => (
                        <TableRow
                          key={user.user_id}
                          className={cn("cursor-pointer transition-colors hover:bg-muted/40", user.is_blocked && "bg-muted/20")}
                          onClick={() => setSelectedUser(user)}
                        >
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              {renderUserAvatar(user)}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-semibold text-foreground">{getUserName(user)}</p>
                                  {user.user_id === currentAdminId && <Badge variant="outline" className="rounded-full text-[10px]">Bạn</Badge>}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{user.email || "Chưa có email"}</p>
                                {user.username && <p className="truncate text-xs text-muted-foreground">@{user.username}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{renderProductRoleBadge(user)}</TableCell>
                          <TableCell>{renderSystemRoleBadge(user)}</TableCell>
                          <TableCell>{renderStatusBadge(user)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatUserDateShort(user.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-lg px-2 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedUser(user);
                                }}
                              >
                                <Eye className="mr-1 h-3 w-3" />Xem chi tiết
                              </Button>
                              {renderUserActions(user)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-3 lg:hidden">
                  {paginatedUsers.map((user) => (
                    <div
                      key={user.user_id}
                      role="button"
                      tabIndex={0}
                      className="w-full rounded-2xl border bg-background p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
                      onClick={() => setSelectedUser(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setSelectedUser(user);
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        {renderUserAvatar(user)}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground">{getUserName(user)}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email || "Chưa có email"}</p>
                          {user.username && <p className="truncate text-xs text-muted-foreground">@{user.username}</p>}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {renderProductRoleBadge(user)}
                        {renderSystemRoleBadge(user)}
                        {renderStatusBadge(user)}
                      </div>
                      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                        {renderUserActions(user, true)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <p>
                    Hiển thị {userPageStart}–{userPageEnd} trong {filteredUsers.length} người dùng
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />Trước
                    </Button>
                    <span className="min-w-16 text-center text-xs font-medium text-foreground">
                      {userPage}/{totalUserPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={userPage >= totalUserPages}
                      onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                    >
                      Sau<ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>)}
          {false && currentSection === "users" && (<>
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

      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-[92vw] overflow-y-auto sm:max-w-md">
          {selectedUser && (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle>Chi tiết người dùng</SheetTitle>
                <SheetDescription>
                  Xem hồ sơ cơ bản, role sản phẩm, quyền hệ thống và thao tác quản trị an toàn.
                </SheetDescription>
              </SheetHeader>

              <div className="rounded-2xl border bg-card p-4">
                <div className="flex gap-3">
                  {renderUserAvatar(selectedUser, "h-14 w-14")}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-foreground">{getUserName(selectedUser)}</p>
                    <p className="truncate text-sm text-muted-foreground">{selectedUser.email || "Chưa có email"}</p>
                    {selectedUser.username && <p className="truncate text-sm text-muted-foreground">@{selectedUser.username}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {renderProductRoleBadge(selectedUser)}
                  {renderSystemRoleBadge(selectedUser)}
                  {renderStatusBadge(selectedUser)}
                  {selectedUser.user_id === currentAdminId && <Badge variant="outline" className="rounded-full">Bạn</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderDetailStat("Product role", getProductRole(selectedUser))}
                {renderDetailStat("System role", isAdminUser(selectedUser) ? "Admin" : "User")}
                {renderDetailStat("Trạng thái", selectedUser.is_blocked ? "Blocked" : "Active")}
                {renderDetailStat("Ngày tạo", formatUserDate(selectedUser.created_at) || "Chưa có dữ liệu")}
                {renderDetailStat("Số điện thoại", selectedUser.phone)}
                {renderDetailStat("Booking gần đây", selectedUser.bookings_count)}
                {renderDetailStat("Báo cáo đã gửi", selectedUser.reports_submitted_count)}
                {renderDetailStat("Báo cáo về user", selectedUser.reports_against_count)}
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Admin actions</p>
                  <p className="text-xs text-muted-foreground">Các thao tác nhạy cảm vẫn được xác thực qua Edge Function.</p>
                </div>
                {renderUserActions(selectedUser, true)}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
