import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, BookOpen, DollarSign, TrendingUp, Shield, Check, X, Eye, BarChart3, Flag, Megaphone, UserX, UserCheck, Crown, Loader2, Search, Trash2, AlertCircle, CheckCircle2, EyeOff, FileText, UserCircle2, History, Send, AlertTriangle, Gavel, Wallet, Copy, Banknote, Download, BookText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--muted-foreground))"];

type UserRecord = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  is_blocked: boolean;
  roles: string[];
};

type ReportItem = {
  id: string; title: string; type: "course" | "mentor" | "comment" | "payment";
  reason: string; reporter: string; reportedUser: string; reports: number;
  date: string; status: "pending" | "resolved" | "dismissed" | "appealed"; detail: string;
  mentorStrikes: number;
};

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
  const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const FEE = 0.15;

  // ── UI state ──────────────────────────────────────────────
  const [courseFilter, setCourseFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "resolved" | "dismissed" | "appealed">("all");
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [strikeChoice, setStrikeChoice] = useState<string>("");
  const [emailContent, setEmailContent] = useState<string>("");
  const [activePayout, setActivePayout] = useState<PayoutRequest | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [ledgerKind, setLedgerKind] = useState<"all" | "in" | "payout" | "refund">("all");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const invokeAdminUsers = useCallback((body: Record<string, unknown>) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Missing admin session");
    }

    return supabase.functions.invoke("admin-users", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }, [session?.access_token]);

  // ── Supabase queries ──────────────────────────────────────

  // Pending Mentors
  const { data: mentors = [], isLoading: mentorsLoading, refetch: refetchMentors } = useQuery({
    queryKey: ["admin-pending-mentors"],
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

  // Courses (all statuses for admin)
  const { data: courses = [], isLoading: coursesLoading, refetch: refetchCourses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, mentor:profiles!courses_mentor_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        mentor: c.mentor?.name ?? "Mentor",
        category: c.category,
        price: c.price,
        status: c.status as "pending" | "approved" | "rejected",
        createdAt: new Date(c.created_at).toLocaleDateString("vi-VN"),
        description: c.description ?? "",
      }));
    },
  });

  // Reports
  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          id, type, title, reason, detail, status, created_at,
          reporter:profiles!reports_reporter_id_fkey(name),
          reported:profiles!reports_reported_user_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type as ReportItem["type"],
        reason: r.reason,
        reporter: r.reporter?.name ?? "Ẩn danh",
        reportedUser: r.reported?.name ?? "Không rõ",
        reports: 1,
        date: new Date(r.created_at).toLocaleDateString("vi-VN"),
        status: r.status as ReportItem["status"],
        detail: r.detail ?? "",
        mentorStrikes: 0,
      })) as ReportItem[];
    },
  });

  // Promoted listings
  const { data: promotedListings = [], isLoading: promotedLoading } = useQuery({
    queryKey: ["admin-promoted"],
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
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [usersRes, coursesRes, bookingsRes, revenueRes] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("amount").eq("status", "success"),
      ]);
      const totalRevenue = (revenueRes.data ?? []).reduce((s: number, t: any) => s + t.amount, 0);
      return {
        users: usersRes.count ?? 0,
        courses: coursesRes.count ?? 0,
        bookings: bookingsRes.count ?? 0,
        revenue: totalRevenue,
      };
    },
  });

  // Monthly revenue from transactions
  const { data: monthlyRevenue = [] } = useQuery({
    queryKey: ["admin-monthly-revenue"],
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("category")
        .eq("status", "approved");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((c: any) => { map[c.category] = (map[c.category] ?? 0) + 1; });
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
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

  const updateCourseStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("courses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      refetchCourses();
      toast({ title: vars.status === "approved" ? "Đã duyệt khóa học" : "Đã từ chối khóa học" });
    },
    onError: () => toast({ title: "Lỗi cập nhật khóa học", variant: "destructive" }),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchCourses(); toast({ title: "Đã xóa khóa học" }); },
    onError: () => toast({ title: "Lỗi xóa khóa học", variant: "destructive" }),
  });

  const updateReportStatus = useMutation({
    mutationFn: async ({ id, status, verdict, email }: { id: string; status: "pending" | "resolved" | "dismissed" | "appealed"; verdict?: string; email?: string }) => {
      const { error } = await supabase.from("reports").update({
        status,
        admin_verdict: verdict,
        admin_email: email,
        resolved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchReports(); },
    onError: () => toast({ title: "Lỗi cập nhật báo cáo", variant: "destructive" }),
  });

  const confirmPayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "paid", processed_at: new Date().toISOString() })
        .eq("id", id);
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
    try {
      const { data, error } = await invokeAdminUsers({ action: "list" });
      if (!error && data?.users) {
        setUserList(data.users);
      } else {
        toast({ title: "Lỗi", description: "Không thể tải danh sách người dùng.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể kết nối server.", variant: "destructive" });
    }
    setUserLoading(false);
  }, [invokeAdminUsers, toast]);

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    setActionLoading(userId + "_block");
    try {
      const { data, error } = await invokeAdminUsers({ action: "toggle-block", targetUserId: userId });
      if (!error && data?.success) {
        setUserList((prev) => prev.map((u) => u.user_id === userId ? { ...u, is_blocked: data.is_blocked } : u));
        toast({ title: data.is_blocked ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản" });
      } else {
        toast({ title: "Lỗi", description: "Không thể thực hiện thao tác.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra.", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleAssignAdmin = async (userId: string, hasAdmin: boolean) => {
    setActionLoading(userId + "_role");
    const action = hasAdmin ? "remove-role" : "assign-role";
    try {
      const { data, error } = await invokeAdminUsers({ action, targetUserId: userId, role: "admin" });
      if (!error && data?.success) {
        setUserList((prev) => prev.map((u) => {
          if (u.user_id !== userId) return u;
          const roles = hasAdmin ? u.roles.filter((r) => r !== "admin") : [...u.roles, "admin"];
          return { ...u, roles };
        }));
        toast({ title: hasAdmin ? "Đã thu hồi quyền Admin" : "Đã cấp quyền Admin" });
      } else {
        toast({ title: "Lỗi", description: "Không thể thay đổi quyền.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra.", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // ── Helpers ───────────────────────────────────────────────

  const handleCourseAction = (courseId: string, action: "approve" | "reject" | "delete") => {
    if (action === "delete") {
      deleteCourse.mutate(courseId);
    } else {
      updateCourseStatus.mutate({ id: courseId, status: action === "approve" ? "approved" : "rejected" });
    }
  };

  const handleReportAction = (reportId: string, action: "resolve" | "dismiss") => {
    updateReportStatus.mutate({
      id: reportId,
      status: action === "resolve" ? "resolved" : "dismissed",
    });
    toast({ title: action === "resolve" ? "Đã xử lý báo cáo" : "Đã bỏ qua báo cáo" });
  };

  const confirmPayout = () => {
    if (!activePayout) return;
    confirmPayoutMutation.mutate(activePayout.id);
  };

  const copyAccount = (acc: string) => {
    navigator.clipboard?.writeText(acc);
    toast({ title: "Đã copy số tài khoản" });
  };

  const strikeOptions = [
    { id: "ignore", label: "Bỏ qua báo cáo", desc: "Sai sự thật / Không phạt", tone: "muted", email: "Xin chào, sau khi xem xét, chúng tôi không tìm thấy vi phạm trong nội dung của bạn. Báo cáo đã được bỏ qua. Cảm ơn bạn đã đóng góp cho cộng đồng." },
    { id: "strike1", label: "Gậy 1: Nhắc nhở", desc: "Yêu cầu sửa nội dung", tone: "warning", email: "Xin chào, nội dung của bạn vi phạm tiêu chuẩn cộng đồng (lần 1). Vui lòng chỉnh sửa nội dung trong vòng 48 giờ để tránh các biện pháp xử lý nặng hơn." },
    { id: "strike2", label: "Gậy 2: Gỡ bài & cấm đăng 7 ngày", desc: "Tạm khóa quyền đăng nội dung mới", tone: "warning", email: "Xin chào, nội dung của bạn đã bị gỡ và bạn bị cấm đăng nội dung mới trong 7 ngày (vi phạm lần 2). Vui lòng đọc kỹ chính sách trước khi tiếp tục." },
    { id: "strike3", label: "Gậy 3: Khóa vĩnh viễn tài khoản", desc: "Vi phạm nghiêm trọng / lặp lại 3 lần", tone: "destructive", email: "Xin chào, do vi phạm chính sách lần thứ 3, tài khoản Mentor của bạn đã bị khóa vĩnh viễn. Bạn có quyền kháng cáo trong vòng 7 ngày kể từ khi nhận được email này." },
  ];

  const openReportModal = (r: ReportItem) => {
    setActiveReport(r);
    setStrikeChoice("");
    setEmailContent("");
  };

  const handleStrikeChange = (val: string) => {
    setStrikeChoice(val);
    const opt = strikeOptions.find((o) => o.id === val);
    if (opt) setEmailContent(opt.email);
  };

  const submitVerdict = () => {
    if (!activeReport || !strikeChoice) return;
    const opt = strikeOptions.find((o) => o.id === strikeChoice)!;
    const newStatus = strikeChoice === "ignore" ? "dismissed" : "resolved";
    updateReportStatus.mutate({
      id: activeReport.id,
      status: newStatus,
      verdict: opt.label,
      email: emailContent,
    });
    toast({ title: "Đã gửi phán quyết", description: `${opt.label} → đã gửi email cho mentor.` });
    setActiveReport(null);
  };

  const filteredCourses = courses.filter(c => courseFilter === "all" || c.status === courseFilter);
  const filteredReports = reports.filter(r => reportFilter === "all" || r.status === reportFilter);

  const reportTypeIcon = (type: string) => {
    switch (type) {
      case "course": return <BookOpen className="h-4 w-4" />;
      case "mentor": return <Users className="h-4 w-4" />;
      case "comment": return <AlertCircle className="h-4 w-4" />;
      case "payment": return <DollarSign className="h-4 w-4" />;
      default: return <Flag className="h-4 w-4" />;
    }
  };

  const reportStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Chờ xử lý</Badge>;
      case "resolved": return <Badge className="bg-success/10 text-success border-0 text-[10px]">Đã xử lý</Badge>;
      case "dismissed": return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Bỏ qua</Badge>;
      case "appealed": return <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Kháng cáo</Badge>;
      default: return null;
    }
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

  // ── Render ────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Quản lý marketplace và giám sát hoạt động</p>
        </div>

        {/* Metrics */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { icon: Users, label: "Tổng người dùng", value: analytics ? analytics.users.toLocaleString("vi-VN") : "—", color: "text-secondary" },
            { icon: BookOpen, label: "Tổng khóa học", value: analytics ? analytics.courses.toLocaleString("vi-VN") : "—", color: "text-primary" },
            { icon: BarChart3, label: "Tổng booking", value: analytics ? analytics.bookings.toLocaleString("vi-VN") : "—", color: "text-success" },
            { icon: DollarSign, label: "Doanh thu", value: analytics ? (analytics.revenue >= 1_000_000 ? (analytics.revenue / 1_000_000).toFixed(1) + "M" : fmtVnd(analytics.revenue)) : "—", color: "text-warning" },
            { icon: TrendingUp, label: "Mentor hoạt động", value: mentors.length.toString(), color: "text-accent-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="analytics">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics">📊 Thống kê</TabsTrigger>
            <TabsTrigger value="users" onClick={fetchUsers}>👥 Người dùng</TabsTrigger>
            <TabsTrigger value="mentors">Duyệt Mentor ({mentors.length})</TabsTrigger>
            <TabsTrigger value="courses">📚 Khóa học ({courses.filter(c => c.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="reports">🚩 Báo cáo ({reports.filter(r => r.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="promoted">Quảng cáo</TabsTrigger>
            <TabsTrigger value="payouts">💸 Rút tiền ({payouts.filter(p => p.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="ledger">📒 Sổ cái dòng tiền</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
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
                  <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Doanh thu theo tháng (triệu VNĐ)</h3>
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
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Bookings theo tháng</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                    <Bar dataKey="bookings" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Phân bổ danh mục</h3>
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
              </div>

              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Tăng trưởng người dùng</h3>
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
              </div>
            </div>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Tìm theo tên hoặc email..." className="pl-10" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              </div>
              <Button variant="outline" onClick={fetchUsers} disabled={userLoading} className="rounded-xl">
                {userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tải danh sách"}
              </Button>
            </div>
            {userLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : userList.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Users className="h-12 w-12 text-muted mb-3" />
                <p className="text-muted-foreground text-sm">Bấm "Tải danh sách" để xem người dùng</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userList
                  .filter((u) => !userSearch || (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(userSearch.toLowerCase()))
                  .map((u) => {
                    const isAdminUser = u.roles.includes("admin");
                    return (
                      <div key={u.user_id} className={`flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card ${u.is_blocked ? "opacity-60" : ""}`}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-primary-foreground text-sm font-bold">
                          {(u.name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-card-foreground text-sm truncate">{u.name || "Không có tên"}</p>
                            {isAdminUser && <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]"><Crown className="mr-1 h-2.5 w-2.5" />Admin</Badge>}
                            {u.is_blocked && <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Đã khóa</Badge>}
                            <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant={u.is_blocked ? "default" : "outline"} className={`rounded-lg h-8 text-xs ${u.is_blocked ? "gradient-primary border-0 text-primary-foreground" : "text-destructive hover:text-destructive"}`} disabled={actionLoading === u.user_id + "_block"} onClick={() => handleToggleBlock(u.user_id, u.is_blocked)}>
                            {actionLoading === u.user_id + "_block" ? <Loader2 className="h-3 w-3 animate-spin" /> : u.is_blocked ? <><UserCheck className="mr-1 h-3 w-3" />Mở khóa</> : <><UserX className="mr-1 h-3 w-3" />Khóa</>}
                          </Button>
                          <Button size="sm" variant="outline" className={`rounded-lg h-8 text-xs ${isAdminUser ? "text-destructive hover:text-destructive" : ""}`} disabled={actionLoading === u.user_id + "_role"} onClick={() => handleAssignAdmin(u.user_id, isAdminUser)}>
                            {actionLoading === u.user_id + "_role" ? <Loader2 className="h-3 w-3 animate-spin" /> : isAdminUser ? <><Crown className="mr-1 h-3 w-3" />Thu hồi Admin</> : <><Crown className="mr-1 h-3 w-3" />Cấp Admin</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* Mentors Tab */}
          <TabsContent value="mentors" className="space-y-3">
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
          </TabsContent>

          {/* Course Management Tab */}
          <TabsContent value="courses">
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <Button key={f} size="sm" variant={courseFilter === f ? "default" : "outline"} className={`rounded-lg text-xs ${courseFilter === f ? "gradient-primary border-0 text-primary-foreground" : ""}`} onClick={() => setCourseFilter(f)}>
                  {f === "all" ? "Tất cả" : f === "pending" ? "Chờ duyệt" : f === "approved" ? "Đã duyệt" : "Từ chối"}
                  {f !== "all" && ` (${courses.filter(c => c.status === f).length})`}
                </Button>
              ))}
            </div>
            {coursesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {filteredCourses.map((c) => (
                  <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-card-foreground">{c.title}</p>
                          {c.status === "pending" && <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Chờ duyệt</Badge>}
                          {c.status === "approved" && <Badge className="bg-success/10 text-success border-0 text-[10px]">Đã duyệt</Badge>}
                          {c.status === "rejected" && <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Từ chối</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">Mentor: {c.mentor} • {c.category} • {c.createdAt}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                        <p className="text-sm font-bold text-primary mt-2">{c.price.toLocaleString("vi-VN")}đ/buổi</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {c.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => handleCourseAction(c.id, "approve")} className="gradient-primary border-0 text-primary-foreground rounded-lg" disabled={updateCourseStatus.isPending}><Check className="mr-1 h-4 w-4" />Duyệt</Button>
                            <Button size="sm" variant="outline" onClick={() => handleCourseAction(c.id, "reject")} className="rounded-lg" disabled={updateCourseStatus.isPending}><X className="mr-1 h-4 w-4" />Từ chối</Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleCourseAction(c.id, "delete")} className="rounded-lg text-destructive hover:text-destructive" disabled={deleteCourse.isPending}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCourses.length === 0 && <p className="text-center text-muted-foreground py-8">Không có khóa học nào</p>}
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              {(["all", "pending", "appealed", "resolved", "dismissed"] as const).map((f) => (
                <Button key={f} size="sm" variant={reportFilter === f ? "default" : "outline"} className={`rounded-lg text-xs ${reportFilter === f ? "gradient-primary border-0 text-primary-foreground" : ""}`} onClick={() => setReportFilter(f)}>
                  {f === "all" ? "Tất cả" : f === "pending" ? "Chờ xử lý" : f === "appealed" ? "Kháng cáo" : f === "resolved" ? "Đã xử lý" : "Bỏ qua"}
                  {f !== "all" && ` (${reports.filter(r => r.status === f).length})`}
                </Button>
              ))}
            </div>
            {reportsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((r) => (
                  <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-destructive/10 p-3 shrink-0">{reportTypeIcon(r.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-card-foreground">{r.title}</p>
                          {reportStatusBadge(r.status)}
                          <Badge variant="outline" className="text-[10px]">{r.reports} báo cáo</Badge>
                          {r.reports >= 5 && (
                            <Badge className="bg-warning/15 text-warning border-0 text-[10px] gap-1">
                              <EyeOff className="h-3 w-3" /> Hệ thống tự động ẩn
                            </Badge>
                          )}
                          {r.status === "appealed" && (
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px] gap-1">
                              <AlertTriangle className="h-3 w-3" /> Mentor kháng cáo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Lý do: {r.reason}</p>
                        <p className="text-xs text-muted-foreground">Người báo cáo: {r.reporter} → Bị báo cáo: {r.reportedUser}</p>
                        <p className="text-xs text-muted-foreground mt-1 italic">{r.detail}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.date} • Lịch sử vi phạm Mentor: {r.mentorStrikes}/3</p>
                      </div>
                      {(r.status === "pending" || r.status === "appealed") && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => openReportModal(r)} className="gradient-primary border-0 text-primary-foreground rounded-lg"><Gavel className="mr-1 h-4 w-4" />Xử lý</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReportAction(r.id, "dismiss")} className="rounded-lg"><X className="mr-1 h-4 w-4" />Bỏ qua</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredReports.length === 0 && <p className="text-center text-muted-foreground py-8">Không có báo cáo nào</p>}
              </div>
            )}
          </TabsContent>

          {/* Promoted Tab */}
          <TabsContent value="promoted" className="space-y-3">
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
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
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
          </TabsContent>

          {/* Ledger Tab */}
          <TabsContent value="ledger">
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
          </TabsContent>
        </Tabs>
      </div>

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

      {/* Verdict Modal */}
      <Dialog open={!!activeReport} onOpenChange={(o) => !o && setActiveReport(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />Xử lý báo cáo
            </DialogTitle>
          </DialogHeader>
          {activeReport && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-accent/30 p-4">
                <p className="font-semibold text-foreground">{activeReport.title}</p>
                <p className="text-xs text-muted-foreground mt-1">Lý do: {activeReport.reason}</p>
                <p className="text-xs text-muted-foreground italic mt-1">{activeReport.detail}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Chọn hình thức xử lý</p>
                <RadioGroup value={strikeChoice} onValueChange={handleStrikeChange} className="space-y-2">
                  {strikeOptions.map((o) => (
                    <Label key={o.id} htmlFor={o.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${strikeChoice === o.id ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}>
                      <RadioGroupItem id={o.id} value={o.id} className="mt-1" />
                      <div>
                        <p className="font-medium text-sm text-foreground">{o.label}</p>
                        <p className="text-xs text-muted-foreground">{o.desc}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Nội dung email gửi Mentor</p>
                <Textarea rows={4} value={emailContent} onChange={(e) => setEmailContent(e.target.value)} placeholder="Chọn hình thức xử lý để tự sinh nội dung..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveReport(null)} className="rounded-lg">Hủy</Button>
            <Button disabled={!strikeChoice || updateReportStatus.isPending} onClick={submitVerdict} className="gradient-primary border-0 text-primary-foreground rounded-lg">
              {updateReportStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" />Xác nhận & Gửi</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
