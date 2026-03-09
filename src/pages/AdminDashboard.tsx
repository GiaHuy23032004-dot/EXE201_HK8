import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockMentors } from "@/data/mockData";
import { Users, BookOpen, DollarSign, TrendingUp, Shield, AlertTriangle, Check, X, Eye, BarChart3, Flag, Megaphone, UserX, UserCheck, Crown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const pendingMentors = [
  { id: "m1", name: "Hoàng Minh", email: "hoang@mail.com", specialty: "Piano", date: "08/03/2026" },
  { id: "m2", name: "Lan Anh", email: "lan@mail.com", specialty: "Tiếng Nhật", date: "07/03/2026" },
];

const pendingCourses = [
  { id: "c1", title: "Khóa học Piano Jazz", mentor: "Hoàng Minh", category: "Âm nhạc", price: 300000 },
  { id: "c2", title: "Tiếng Nhật N3", mentor: "Lan Anh", category: "Ngoại ngữ", price: 400000 },
];

const reportedListings = [
  { id: "r1", title: "Khóa học đáng ngờ XYZ", reason: "Nội dung không phù hợp", reports: 5 },
  { id: "r2", title: "Mentor giả mạo ABC", reason: "Thông tin sai lệch", reports: 3 },
];

const promotedListings = [
  { id: "p1", title: "Guitar Acoustic cho người mới", mentor: "Minh Tuấn", fee: 15000, days: 3, status: "active" },
  { id: "p2", title: "Lập trình Web Fullstack", mentor: "Đức Anh", fee: 15000, days: 3, status: "expired" },
];

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

        <Tabs defaultValue="mentors">
          <TabsList className="mb-6">
            <TabsTrigger value="mentors">Duyệt Mentor ({mentors.length})</TabsTrigger>
            <TabsTrigger value="courses">Duyệt khóa học ({courses.length})</TabsTrigger>
            <TabsTrigger value="reported">Báo cáo ({reportedListings.length})</TabsTrigger>
            <TabsTrigger value="promoted">Tin quảng cáo</TabsTrigger>
            <TabsTrigger value="transactions">Giao dịch</TabsTrigger>
          </TabsList>

          <TabsContent value="mentors" className="space-y-3">
            {mentors.map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-lg font-bold text-accent-foreground">
                  {m.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email} • {m.specialty}</p>
                  <p className="text-xs text-muted-foreground">Đăng ký: {m.date}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setMentors(mentors.filter(x => x.id !== m.id))} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                    <Check className="mr-1 h-4 w-4" />Duyệt
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMentors(mentors.filter(x => x.id !== m.id))} className="rounded-lg">
                    <X className="mr-1 h-4 w-4" />Từ chối
                  </Button>
                </div>
              </div>
            ))}
            {mentors.length === 0 && <p className="text-center text-muted-foreground py-8">Không có mentor nào đang chờ duyệt</p>}
          </TabsContent>

          <TabsContent value="courses" className="space-y-3">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground">Mentor: {c.mentor} • {c.category}</p>
                  <p className="text-sm font-bold text-primary mt-1">{c.price.toLocaleString("vi-VN")}đ/buổi</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg"><Eye className="mr-1 h-4 w-4" />Xem</Button>
                  <Button size="sm" onClick={() => setCourses(courses.filter(x => x.id !== c.id))} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                    <Check className="mr-1 h-4 w-4" />Duyệt
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCourses(courses.filter(x => x.id !== c.id))} className="rounded-lg">
                    <X className="mr-1 h-4 w-4" />Từ chối
                  </Button>
                </div>
              </div>
            ))}
            {courses.length === 0 && <p className="text-center text-muted-foreground py-8">Không có khóa học nào đang chờ duyệt</p>}
          </TabsContent>

          <TabsContent value="reported" className="space-y-3">
            {reportedListings.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="rounded-xl bg-destructive/10 p-3">
                  <Flag className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.reason} • {r.reports} báo cáo</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg"><Eye className="mr-1 h-4 w-4" />Xem</Button>
                  <Button size="sm" variant="destructive" className="rounded-lg">Gỡ bài</Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="promoted" className="space-y-3">
            {promotedListings.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="rounded-xl bg-warning/10 p-3">
                  <Megaphone className="h-5 w-5 text-warning" />
                </div>
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

          <TabsContent value="transactions">
            <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
              <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted" />
              <p className="font-semibold text-foreground">Biểu đồ giao dịch</p>
              <p className="text-sm text-muted-foreground mt-1">Tổng doanh thu tháng này: 120,000,000 VNĐ</p>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-lg font-bold text-primary">85M</p>
                  <p className="text-xs text-muted-foreground">Hoa hồng booking</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-lg font-bold text-warning">25M</p>
                  <p className="text-xs text-muted-foreground">Tin quảng cáo</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-lg font-bold text-secondary">10M</p>
                  <p className="text-xs text-muted-foreground">Phí danh mục</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
