import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, BookOpen, DollarSign, TrendingUp, Shield, Check, X, Eye, BarChart3, Flag, Megaphone, UserX, UserCheck, Crown, Loader2, Search, Trash2, AlertCircle, CheckCircle2, EyeOff, FileText, UserCircle2, History, Send, AlertTriangle, Gavel } from "lucide-react";
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
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "resolved" | "dismissed">("all");
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

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
      default: return null;
    }
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
              {(["all", "pending", "resolved", "dismissed"] as const).map((f) => (
                <Button key={f} size="sm" variant={reportFilter === f ? "default" : "outline"} className={`rounded-lg text-xs ${reportFilter === f ? "gradient-primary border-0 text-primary-foreground" : ""}`} onClick={() => setReportFilter(f)}>
                  {f === "all" ? "Tất cả" : f === "pending" ? "Chờ xử lý" : f === "resolved" ? "Đã xử lý" : "Bỏ qua"}
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
                      </div>
                      <p className="text-xs text-muted-foreground">Lý do: {r.reason}</p>
                      <p className="text-xs text-muted-foreground">Người báo cáo: {r.reporter} → Bị báo cáo: {r.reportedUser}</p>
                      <p className="text-xs text-muted-foreground mt-1 italic">{r.detail}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.date}</p>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => handleReportAction(r.id, "resolve")} className="gradient-primary border-0 text-primary-foreground rounded-lg"><CheckCircle2 className="mr-1 h-4 w-4" />Xử lý</Button>
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
        </Tabs>
      </div>
    </MainLayout>
  );
}
