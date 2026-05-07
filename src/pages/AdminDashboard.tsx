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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const pendingMentors = [
  { id: "m1", name: "Hoàng Minh", email: "hoang@mail.com", specialty: "Piano", date: "08/03/2026" },
  { id: "m2", name: "Lan Anh", email: "lan@mail.com", specialty: "Tiếng Nhật", date: "07/03/2026" },
];

const pendingCourses = [
  { id: "c1", title: "Khóa học Piano Jazz", mentor: "Hoàng Minh", category: "Âm nhạc", price: 300000, status: "pending" as const, createdAt: "08/03/2026", description: "Khóa học Piano Jazz dành cho người có nền tảng cơ bản" },
  { id: "c2", title: "Tiếng Nhật N3", mentor: "Lan Anh", category: "Ngoại ngữ", price: 400000, status: "pending" as const, createdAt: "07/03/2026", description: "Luyện thi JLPT N3 hiệu quả" },
  { id: "c3", title: "Lập trình React", mentor: "Đức Anh", category: "Công nghệ", price: 500000, status: "approved" as const, createdAt: "06/03/2026", description: "Fullstack React & TypeScript" },
  { id: "c4", title: "Yoga cơ bản", mentor: "Thanh Hà", category: "Sức khỏe", price: 200000, status: "rejected" as const, createdAt: "05/03/2026", description: "Yoga cho người mới bắt đầu" },
];

type ReportItem = {
  id: string; title: string; type: "course" | "mentor" | "comment" | "payment";
  reason: string; reporter: string; reportedUser: string; reports: number;
  date: string; status: "pending" | "resolved" | "dismissed" | "appealed"; detail: string;
  mentorStrikes: number;
};

const reportedItems: ReportItem[] = [
  { id: "r1", title: "Khóa học đáng ngờ XYZ", type: "course", reason: "Nội dung không phù hợp", reporter: "Nguyễn Văn A", reportedUser: "Trần B", reports: 5, date: "08/03/2026", status: "pending", detail: "Khóa học chứa nội dung sao chép từ nguồn khác mà không ghi nguồn", mentorStrikes: 1 },
  { id: "r2", title: "Mentor giả mạo ABC", type: "mentor", reason: "Thông tin sai lệch", reporter: "Lê C", reportedUser: "Phạm D", reports: 3, date: "07/03/2026", status: "pending", detail: "Mentor tự xưng có bằng cấp nhưng không có bằng chứng", mentorStrikes: 0 },
  { id: "r3", title: "Bình luận xúc phạm", type: "comment", reason: "Ngôn từ thù ghét", reporter: "Hoàng E", reportedUser: "Vũ F", reports: 8, date: "06/03/2026", status: "resolved", detail: "Bình luận chứa lời lẽ xúc phạm và phân biệt", mentorStrikes: 2 },
  { id: "r4", title: "Lừa đảo thanh toán", type: "payment", reason: "Gian lận tài chính", reporter: "Đỗ G", reportedUser: "Bùi H", reports: 12, date: "05/03/2026", status: "dismissed", detail: "Mentor thu tiền ngoài hệ thống và không hoàn trả", mentorStrikes: 2 },
  { id: "r5", title: "Khiếu nại quyết định gỡ bài", type: "course", reason: "Mentor kháng cáo", reporter: "Mentor Trần B", reportedUser: "Admin", reports: 1, date: "09/03/2026", status: "appealed", detail: "Mentor cho rằng nội dung bị gỡ là hợp lệ và yêu cầu xem xét lại", mentorStrikes: 1 },
];

const promotedListings = [
  { id: "p1", title: "Guitar Acoustic cho người mới", mentor: "Minh Tuấn", fee: 15000, days: 3, status: "active" },
  { id: "p2", title: "Lập trình Web Fullstack", mentor: "Đức Anh", fee: 15000, days: 3, status: "expired" },
];

type PayoutOrder = { code: string; date: string; gross: number };
type PayoutRequest = {
  id: string;
  mentor: string;
  amount: number;
  date: string;
  bank: string;
  account: string;
  holder: string;
  orders: PayoutOrder[];
  status: "pending" | "paid";
};

const initialPayouts: PayoutRequest[] = [
  {
    id: "po1", mentor: "Minh Tuấn", amount: 1955000, date: "08/03/2026",
    bank: "Vietcombank", account: "0123456789", holder: "NGUYEN MINH TUAN",
    status: "pending",
    orders: [
      { code: "OD-1042", date: "20/02/2026", gross: 500000 },
      { code: "OD-1051", date: "21/02/2026", gross: 800000 },
      { code: "OD-1078", date: "23/02/2026", gross: 1000000 },
    ],
  },
  {
    id: "po2", mentor: "Lan Anh", amount: 1020000, date: "07/03/2026",
    bank: "Techcombank", account: "9988776655", holder: "TRAN LAN ANH",
    status: "pending",
    orders: [
      { code: "OD-1033", date: "18/02/2026", gross: 600000 },
      { code: "OD-1060", date: "22/02/2026", gross: 600000 },
    ],
  },
];

type LedgerEntry = {
  id: string; date: string; from: string; to: string;
  kind: "in" | "payout" | "commission" | "refund";
  gross: number; commission: number;
};

const ledgerData: LedgerEntry[] = [
  { id: "TXN-3001", date: "08/03/2026 10:21", from: "Học viên Nguyễn A", to: "Hệ thống", kind: "in", gross: 500000, commission: 75000 },
  { id: "TXN-3002", date: "08/03/2026 11:05", from: "Học viên Trần B", to: "Hệ thống", kind: "in", gross: 350000, commission: 52500 },
  { id: "PO-1042",  date: "08/03/2026 14:30", from: "Hệ thống", to: "Mentor Minh Tuấn", kind: "payout", gross: 1955000, commission: 0 },
  { id: "TXN-3003", date: "07/03/2026 09:18", from: "Học viên Lê C", to: "Hệ thống", kind: "in", gross: 800000, commission: 120000 },
  { id: "RF-0072",  date: "06/03/2026 18:45", from: "Hệ thống", to: "Học viên Lê Minh", kind: "refund", gross: 425000, commission: -63750 },
  { id: "PO-1039",  date: "05/03/2026 10:00", from: "Hệ thống", to: "Mentor Lan Anh", kind: "payout", gross: 1020000, commission: 0 },
  { id: "TXN-2998", date: "04/03/2026 16:40", from: "Học viên Phạm D", to: "Hệ thống", kind: "in", gross: 1200000, commission: 180000 },
];

// Analytics data
const monthlyRevenue = [
  { month: "T10", revenue: 85, bookings: 620, users: 4200 },
  { month: "T11", revenue: 92, bookings: 710, users: 4800 },
  { month: "T12", revenue: 78, bookings: 580, users: 5100 },
  { month: "T1", revenue: 105, bookings: 820, users: 5900 },
  { month: "T2", revenue: 118, bookings: 950, users: 6400 },
  { month: "T3", revenue: 120, bookings: 1020, users: 7200 },
];

const categoryData = [
  { name: "Ngoại ngữ", value: 35 },
  { name: "Âm nhạc", value: 25 },
  { name: "Công nghệ", value: 20 },
  { name: "Sức khỏe", value: 12 },
  { name: "Khác", value: 8 },
];

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

export default function AdminDashboard() {
  const [mentors, setMentors] = useState(pendingMentors);
  const [courses, setCourses] = useState(pendingCourses);
  const [reports, setReports] = useState(reportedItems);
  const [courseFilter, setCourseFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "resolved" | "dismissed" | "appealed">("all");
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [strikeChoice, setStrikeChoice] = useState<string>("");
  const [emailContent, setEmailContent] = useState<string>("");
  const [payouts, setPayouts] = useState<PayoutRequest[]>(initialPayouts);
  const [activePayout, setActivePayout] = useState<PayoutRequest | null>(null);
  const { toast } = useToast();

  const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const FEE = 0.15;

  const confirmPayout = () => {
    if (!activePayout) return;
    setPayouts(payouts.map(p => p.id === activePayout.id ? { ...p, status: "paid" } : p));
    toast({ title: "Đã chuyển khoản thành công", description: `Đã thanh toán ${fmtVnd(activePayout.amount)} cho ${activePayout.mentor}.` });
    setActivePayout(null);
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


  const fetchUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list" },
      });
      if (!error && data?.users) {
        setUserList(data.users);
      } else {
        toast({ title: "Lỗi", description: "Không thể tải danh sách người dùng.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể kết nối server.", variant: "destructive" });
    }
    setUserLoading(false);
  }, []);

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    setActionLoading(userId + "_block");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "toggle-block", targetUserId: userId },
      });
      if (!error && data?.success) {
        setUserList((prev) =>
          prev.map((u) => (u.user_id === userId ? { ...u, is_blocked: data.is_blocked } : u))
        );
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
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action, targetUserId: userId, role: "admin" },
      });
      if (!error && data?.success) {
        setUserList((prev) =>
          prev.map((u) => {
            if (u.user_id !== userId) return u;
            const roles = hasAdmin ? u.roles.filter((r) => r !== "admin") : [...u.roles, "admin"];
            return { ...u, roles };
          })
        );
        toast({ title: hasAdmin ? "Đã thu hồi quyền Admin" : "Đã cấp quyền Admin" });
      } else {
        toast({ title: "Lỗi", description: "Không thể thay đổi quyền.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra.", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleCourseAction = (courseId: string, action: "approve" | "reject" | "delete") => {
    if (action === "delete") {
      setCourses(courses.filter(c => c.id !== courseId));
      toast({ title: "Đã xóa khóa học" });
    } else {
      setCourses(courses.map(c => c.id === courseId ? { ...c, status: action === "approve" ? "approved" as const : "rejected" as const } : c));
      toast({ title: action === "approve" ? "Đã duyệt khóa học" : "Đã từ chối khóa học" });
    }
  };

  const handleReportAction = (reportId: string, action: "resolve" | "dismiss") => {
    setReports(reports.map(r => r.id === reportId ? { ...r, status: action === "resolve" ? "resolved" as const : "dismissed" as const } : r));
    toast({ title: action === "resolve" ? "Đã xử lý báo cáo" : "Đã bỏ qua báo cáo" });
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

  const submitVerdict = () => {
    if (!activeReport || !strikeChoice) return;
    const opt = strikeOptions.find((o) => o.id === strikeChoice)!;
    const newStatus = strikeChoice === "ignore" ? "dismissed" as const : "resolved" as const;
    setReports(reports.map(r => r.id === activeReport.id ? { ...r, status: newStatus } : r));
    toast({ title: "Đã gửi phán quyết", description: `${opt.label} → đã gửi email cho mentor.` });
    setActiveReport(null);
  };


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
            { icon: Users, label: "Tổng người dùng", value: "52,340", color: "text-secondary" },
            { icon: BookOpen, label: "Tổng khóa học", value: "15,128", color: "text-primary" },
            { icon: BarChart3, label: "Tổng booking", value: "8,450", color: "text-success" },
            { icon: DollarSign, label: "Doanh thu", value: "1.2B", color: "text-warning" },
            { icon: TrendingUp, label: "Mentor hoạt động", value: "2,513", color: "text-accent-foreground" },
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
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {[
                { label: "Tổng doanh thu tháng", value: "120M VNĐ", change: "+12%", icon: DollarSign },
                { label: "Booking tháng này", value: "1,020", change: "+8%", icon: BarChart3 },
                { label: "Người dùng mới", value: "7,200", change: "+15%", icon: Users },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-2xl border bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <kpi.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-success mt-1">▲ {kpi.change} so với tháng trước</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Revenue Chart */}
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Doanh thu 6 tháng (triệu VNĐ)</h3>
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

              {/* Bookings Chart */}
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

              {/* Category Pie Chart */}
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

              {/* User Growth */}
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

          <TabsContent value="mentors" className="space-y-3">
            {mentors.map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-lg font-bold text-accent-foreground">{m.name[0]}</div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email} • {m.specialty}</p>
                  <p className="text-xs text-muted-foreground">Đăng ký: {m.date}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setMentors(mentors.filter(x => x.id !== m.id))} className="gradient-primary border-0 text-primary-foreground rounded-lg"><Check className="mr-1 h-4 w-4" />Duyệt</Button>
                  <Button size="sm" variant="outline" onClick={() => setMentors(mentors.filter(x => x.id !== m.id))} className="rounded-lg"><X className="mr-1 h-4 w-4" />Từ chối</Button>
                </div>
              </div>
            ))}
            {mentors.length === 0 && <p className="text-center text-muted-foreground py-8">Không có mentor nào đang chờ duyệt</p>}
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
                          <Button size="sm" onClick={() => handleCourseAction(c.id, "approve")} className="gradient-primary border-0 text-primary-foreground rounded-lg"><Check className="mr-1 h-4 w-4" />Duyệt</Button>
                          <Button size="sm" variant="outline" onClick={() => handleCourseAction(c.id, "reject")} className="rounded-lg"><X className="mr-1 h-4 w-4" />Từ chối</Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleCourseAction(c.id, "delete")} className="rounded-lg text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCourses.length === 0 && <p className="text-center text-muted-foreground py-8">Không có khóa học nào</p>}
            </div>
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
            <div className="space-y-3">
              {filteredReports.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-destructive/10 p-3 shrink-0">
                      {reportTypeIcon(r.type)}
                    </div>
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
          </TabsContent>

          <TabsContent value="promoted" className="space-y-3">
            {promotedListings.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="rounded-xl bg-warning/10 p-3"><Megaphone className="h-5 w-5 text-warning" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">Mentor: {p.mentor} • {p.fee.toLocaleString("vi-VN")}đ / {p.days} ngày</p>
                </div>
                <Badge className={p.status === "active" ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                  {p.status === "active" ? "Đang chạy" : "Hết hạn"}
                </Badge>
              </div>
            ))}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead className="text-right">Số tiền yêu cầu</TableHead>
                    <TableHead>Ngày gửi</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.mentor}</TableCell>
                      <TableCell className="text-right font-bold text-secondary">{fmtVnd(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.date}</TableCell>
                      <TableCell>
                        {p.status === "pending"
                          ? <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Chờ xử lý</Badge>
                          : <Badge className="bg-success/10 text-success border-0 text-[10px]">Đã thanh toán</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" ? (
                          <Button size="sm" onClick={() => setActivePayout(p)} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                            <Banknote className="mr-1 h-4 w-4" />Đối soát & Duyệt
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payout Reconciliation Modal */}
      <Dialog open={!!activePayout} onOpenChange={(o) => !o && setActivePayout(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />Đối soát yêu cầu rút tiền — {activePayout?.mentor}
            </DialogTitle>
          </DialogHeader>
          {activePayout && (
            <div className="space-y-5">
              {/* Bank info */}
              <div className="rounded-xl border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Thông tin nhận tiền</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Ngân hàng</p>
                    <p className="font-semibold text-foreground">{activePayout.bank}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Số tài khoản</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground tracking-wider">{activePayout.account}</p>
                      <Button size="sm" variant="outline" className="h-7 px-2 rounded-md" onClick={() => copyAccount(activePayout.account)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Chủ tài khoản</p>
                    <p className="font-semibold text-foreground uppercase">{activePayout.holder}</p>
                  </div>
                </div>
              </div>

              {/* Reconciliation table */}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Bảng đối soát đơn hàng (đã qua 7 ngày, chưa từng rút)</p>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã đơn</TableHead>
                        <TableHead>Ngày mua</TableHead>
                        <TableHead className="text-right">Giá trị</TableHead>
                        <TableHead className="text-right">Hoa hồng (15%)</TableHead>
                        <TableHead className="text-right">Thực trả Mentor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activePayout.orders.map((o) => {
                        const fee = o.gross * FEE;
                        return (
                          <TableRow key={o.code}>
                            <TableCell className="font-mono text-xs">{o.code}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{o.date}</TableCell>
                            <TableCell className="text-right text-sm">{fmtVnd(o.gross)}</TableCell>
                            <TableCell className="text-right text-sm text-destructive/80">−{fmtVnd(fee)}</TableCell>
                            <TableCell className="text-right text-sm font-bold text-secondary">{fmtVnd(o.gross - fee)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Tổng cộng cần chuyển: </span>
              <span className="font-bold text-secondary text-lg">{activePayout ? fmtVnd(activePayout.amount) : ""}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActivePayout(null)} className="rounded-lg">Hủy</Button>
              <Button onClick={confirmPayout} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                <Check className="mr-1 h-4 w-4" />Xác nhận đã chuyển khoản
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verdict Modal — 5-step moderation flow */}
      <Dialog open={!!activeReport} onOpenChange={(o) => !o && setActiveReport(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              Xử lý báo cáo — Quy trình kiểm duyệt
            </DialogTitle>
          </DialogHeader>

          {activeReport && (
            <div className="space-y-5">
              {/* Step 2: Verification */}
              <div className="rounded-xl border bg-accent/30 p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bước 2 — Thẩm định</p>
                    <p className="font-semibold text-foreground">{activeReport.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Lý do: {activeReport.reason}</p>
                    <p className="text-xs text-muted-foreground italic mt-1">{activeReport.detail}</p>
                  </div>
                  <div className="shrink-0 rounded-lg border bg-card p-3 min-w-[180px]">
                    <p className="text-[10px] text-muted-foreground mb-2">Lịch sử vi phạm Mentor: {activeReport.mentorStrikes}/3 lần</p>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className={`h-3 w-3 rounded-full ${n <= activeReport.mentorStrikes ? "bg-destructive" : "bg-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs"><FileText className="h-3.5 w-3.5" />Xem nội dung bài đăng</Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs"><UserCircle2 className="h-3.5 w-3.5" />Xem hồ sơ Mentor</Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs"><History className="h-3.5 w-3.5" />Lịch sử báo cáo của người tố cáo</Button>
                </div>
              </div>

              {/* Step 3: 3-Strike verdict */}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bước 3 — Phán quyết</p>
                <h4 className="font-semibold text-foreground mb-3">Chọn hình thức xử lý (Hệ thống 3 gậy)</h4>
                <RadioGroup value={strikeChoice} onValueChange={handleStrikeChange} className="space-y-2">
                  {strikeOptions.map((o) => {
                    const selected = strikeChoice === o.id;
                    const isDanger = o.tone === "destructive";
                    return (
                      <Label
                        key={o.id}
                        htmlFor={o.id}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          selected
                            ? isDanger
                              ? "border-destructive bg-destructive/5"
                              : "border-primary bg-primary/5"
                            : "hover:bg-accent/40"
                        }`}
                      >
                        <RadioGroupItem id={o.id} value={o.id} className="mt-1" />
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${isDanger ? "text-destructive" : "text-foreground"}`}>{o.label}</p>
                          <p className="text-xs text-muted-foreground">{o.desc}</p>
                        </div>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Step 4: Notification */}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bước 4 — Thông báo</p>
                <h4 className="font-semibold text-foreground mb-2">Nội dung Email sẽ gửi cho Mentor</h4>
                <Textarea
                  rows={5}
                  placeholder="Chọn hình thức xử lý ở trên để hệ thống tự sinh nội dung email…"
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground/80 italic mt-1">
                  Nội dung email sẽ tự động sinh ra dựa trên hình thức phạt bạn chọn ở trên.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setActiveReport(null)}>Hủy thao tác</Button>
            <Button
              className="gradient-primary border-0 text-primary-foreground rounded-lg"
              disabled={!strikeChoice}
              onClick={submitVerdict}
            >
              <Send className="h-4 w-4" />
              Xác nhận & Gửi thông báo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>

  );
}
