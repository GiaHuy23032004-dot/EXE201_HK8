import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorCourses } from "@/hooks/use-courses";
import { useMentorBookings, useUpdateBookingStatus } from "@/hooks/use-bookings";
import { useMentorWallet, useWalletTransactions, useMentorTransactions, useCreateWithdrawal } from "@/hooks/use-wallet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, BookOpen, Calendar, DollarSign, Star, Users, Eye,
  Check, X, Wallet, Clock, ArrowDownToLine, TrendingDown,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const FEE_RATE = 0.15;
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

const typeBadge = (t: string) => {
  if (t === "online")  return <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Online</Badge>;
  if (t === "offline") return <Badge className="bg-secondary/10 text-secondary border-0 text-[10px]">Offline</Badge>;
  return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Sản phẩm</Badge>;
};

const kindLabel = (kind: string) => {
  if (kind === "sale")     return { label: "Bán khóa học", icon: <ArrowDownLeft className="h-3 w-3" />, cls: "bg-success/10 text-success" };
  if (kind === "withdraw") return { label: "Rút tiền",     icon: <ArrowUpRight  className="h-3 w-3" />, cls: "bg-primary/10 text-primary" };
  return                          { label: "Bị hoàn tiền", icon: <RotateCcw     className="h-3 w-3" />, cls: "bg-destructive/10 text-destructive" };
};

export default function MentorDashboard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const mentorId = session?.user?.id;

  const { data: courses = [],      isLoading: coursesLoading  } = useMentorCourses(mentorId);
  const { data: bookings = [],     isLoading: bookingsLoading } = useMentorBookings(mentorId);
  const { data: wallet }                                        = useMentorWallet(mentorId);
  const { data: walletTxns = [] }                               = useWalletTransactions(mentorId);
  const { data: txns = [] }                                     = useMentorTransactions(mentorId);
  const updateStatus   = useUpdateBookingStatus();
  const createWithdraw = useCreateWithdrawal();

  const [withdrawOpen,   setWithdrawOpen]   = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [bankName,       setBankName]       = useState(wallet?.bank_name   || "");
  const [bankAccount,    setBankAccount]    = useState(wallet?.bank_account || "");
  const [bankHolder,     setBankHolder]     = useState(wallet?.bank_holder  || "");

  // Reviews cho tất cả courses của mentor
  const { data: reviews = [] } = useQuery({
    queryKey: ["mentor-dashboard-reviews", mentorId],
    enabled: courses.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, learner:profiles!reviews_learner_id_fkey(name, avatar_url)")
        .in("course_id", courses.map((c) => c.id))
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  const totalRevenue = wallet?.total_earned ?? 0;
  const available    = wallet?.balance      ?? 0;
  const held         = wallet?.held_balance ?? 0;

  const handleBookingAction = async (id: string, action: "upcoming" | "declined") => {
    if (!mentorId) return;
    await updateStatus.mutateAsync({ id, status: action, mentorId });
    toast({ title: action === "upcoming" ? "Đã chấp nhận booking" : "Đã từ chối booking" });
  };

  const openWithdraw = () => {
    setWithdrawAmount(available);
    setBankName(wallet?.bank_name   || "");
    setBankAccount(wallet?.bank_account || "");
    setBankHolder(wallet?.bank_holder  || "");
    setWithdrawOpen(true);
  };

  const confirmWithdraw = async () => {
    if (!mentorId || !bankName || !bankAccount || !bankHolder) {
      toast({ title: "Vui lòng điền đầy đủ thông tin ngân hàng", variant: "destructive" });
      return;
    }
    try {
      await createWithdraw.mutateAsync({ mentor_id: mentorId, amount: withdrawAmount, bank_name: bankName, bank_account: bankAccount, bank_holder: bankHolder });
      setWithdrawOpen(false);
      toast({ title: "Yêu cầu rút tiền đã gửi", description: `${fmt(withdrawAmount)} sẽ được chuyển trong 24-48h làm việc.` });
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Mentor</h1>
            <p className="text-sm text-muted-foreground mt-1">Quản lý khóa học và đặt lịch</p>
          </div>
          <Link to="/mentor/create-course">
            <Button className="gradient-primary border-0 text-primary-foreground rounded-xl">
              <Plus className="mr-2 h-4 w-4" />Tạo khóa học mới
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: BookOpen,   label: "Khóa học",   value: courses.length,          color: "text-accent-foreground", bg: "bg-accent" },
            { icon: Calendar,   label: "Booking mới", value: pendingBookings.length,  color: "text-secondary",         bg: "bg-secondary/10" },
            { icon: DollarSign, label: "Doanh thu",   value: fmt(totalRevenue),       color: "text-success",           bg: "bg-success/10" },
            { icon: Star,       label: "Đánh giá",    value: avgRating,               color: "text-warning",           bg: "bg-warning/10" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className={`rounded-xl ${s.bg} p-2`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="courses">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="courses">Khóa học</TabsTrigger>
            <TabsTrigger value="bookings">Đặt lịch ({pendingBookings.length})</TabsTrigger>
            <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
            <TabsTrigger value="revenue">💰 Ví & Doanh thu</TabsTrigger>
          </TabsList>

          {/* COURSES TAB */}
          <TabsContent value="courses" className="space-y-3">
            {coursesLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : courses.length > 0 ? courses.map((c) => (
                <div key={c.id} className="flex gap-4 rounded-2xl border bg-card p-4 shadow-card">
                  <img src={c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"} alt={c.title} className="h-24 w-32 rounded-xl object-cover" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-card-foreground">{c.title}</h3>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">{c.format}</Badge>
                        <Badge className={c.status === "approved" ? "bg-success/10 text-success border-0 text-xs" : c.status === "pending" ? "bg-warning/10 text-warning border-0 text-xs" : "bg-destructive/10 text-destructive border-0 text-xs"}>
                          {c.status === "approved" ? "Đã duyệt" : c.status === "pending" ? "Chờ duyệt" : "Từ chối"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{c.rating}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.students_count} học viên</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.review_count} đánh giá</span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-primary">{c.price.toLocaleString("vi-VN")}đ/buổi</p>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center py-16 text-center">
                  <BookOpen className="h-12 w-12 text-muted mb-3" />
                  <p className="font-semibold text-foreground">Chưa có khóa học nào</p>
                  <Link to="/mentor/create-course">
                    <Button className="mt-4 gradient-primary border-0 text-primary-foreground">Tạo khóa học đầu tiên</Button>
                  </Link>
                </div>
              )}
          </TabsContent>

          {/* BOOKINGS TAB */}
          <TabsContent value="bookings" className="space-y-3">
            {bookingsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : bookings.length > 0 ? bookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex-1">
                    <p className="font-semibold text-card-foreground">{b.learner?.name || "Học viên"}</p>
                    <p className="text-xs text-muted-foreground">{b.course?.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(b.booking_date).toLocaleDateString("vi-VN")} • {b.start_time} - {b.end_time}
                    </p>
                  </div>
                  {b.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleBookingAction(b.id, "upcoming")} disabled={updateStatus.isPending} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                        <Check className="mr-1 h-4 w-4" />Chấp nhận
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBookingAction(b.id, "declined")} disabled={updateStatus.isPending} className="rounded-lg">
                        <X className="mr-1 h-4 w-4" />Từ chối
                      </Button>
                    </div>
                  ) : (
                    <Badge className={
                      b.status === "upcoming"  ? "bg-secondary/10 text-secondary border-0" :
                      b.status === "completed" ? "bg-success/10 text-success border-0" :
                      b.status === "declined"  ? "bg-destructive/10 text-destructive border-0" :
                      "bg-muted text-muted-foreground border-0"
                    }>
                      {b.status === "upcoming" ? "Đã chấp nhận" : b.status === "completed" ? "Hoàn thành" : b.status === "declined" ? "Đã từ chối" : "Đã hủy"}
                    </Badge>
                  )}
                </div>
              )) : <p className="text-center text-muted-foreground py-8">Chưa có booking nào</p>}
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-3">
            {reviews.length > 0 ? (reviews as any[]).map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3 mb-2">
                  <img src={r.learner?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"} alt={r.learner?.name} className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{r.learner?.name || "Học viên"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("vi-VN")}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    {Array.from({ length: r.rating }).map((_: unknown, i: number) => (
                      <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
              </div>
            )) : <p className="text-center text-muted-foreground py-8">Chưa có đánh giá nào</p>}
          </TabsContent>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-4 w-4 text-primary" /></div>
                  <span className="text-xs text-muted-foreground">Tổng doanh thu</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(totalRevenue)}</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-destructive/10 p-2"><TrendingDown className="h-4 w-4 text-destructive" /></div>
                  <span className="text-xs text-muted-foreground">Phí nền tảng (15%)</span>
                </div>
                <p className="text-2xl font-bold text-destructive/90">−{fmt(totalRevenue * FEE_RATE)}</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-warning/10 p-2"><Clock className="h-4 w-4 text-warning" /></div>
                  <span className="text-xs text-muted-foreground">Đang tạm giữ</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(held)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Chờ qua mốc 7 ngày</p>
              </div>
              <div className="rounded-2xl border-2 border-secondary/40 bg-gradient-to-br from-secondary/5 to-primary/5 p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-secondary/15 p-2"><Wallet className="h-4 w-4 text-secondary" /></div>
                  <span className="text-xs text-muted-foreground">Số dư khả dụng</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xl font-extrabold text-secondary">{fmt(available)}</p>
                  <Button size="sm" onClick={openWithdraw} disabled={available <= 0} className="gradient-primary border-0 text-primary-foreground rounded-lg shrink-0">
                    <ArrowDownToLine className="mr-1 h-4 w-4" />Rút tiền
                  </Button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="sales">
              <TabsList>
                <TabsTrigger value="sales">Chi tiết doanh thu</TabsTrigger>
                <TabsTrigger value="wallet">Lịch sử giao dịch ví</TabsTrigger>
              </TabsList>

              <TabsContent value="sales">
                <div className="rounded-2xl border bg-card shadow-card overflow-hidden mt-2">
                  <div className="p-5 border-b">
                    <h3 className="font-semibold text-foreground">Chi tiết doanh thu</h3>
                    <p className="text-xs text-muted-foreground mt-1">Lịch sử các giao dịch và trạng thái thanh toán</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Khóa học</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead className="text-right">Giá gốc</TableHead>
                        <TableHead className="text-right">Khấu trừ (15%)</TableHead>
                        <TableHead className="text-right">Thực nhận</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txns.length > 0 ? (txns as any[]).map((t) => {
                        const fee = t.amount * FEE_RATE;
                        const net = t.amount - fee;
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img src={t.course?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=60&h=60&fit=crop"} alt="" className="h-9 w-9 rounded-full object-cover" />
                                <span className="text-sm font-medium text-foreground">{t.course?.title || "Khóa học"}</span>
                              </div>
                            </TableCell>
                            <TableCell>{typeBadge(t.txn_type)}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(t.amount)}</TableCell>
                            <TableCell className="text-right text-sm text-destructive/80">−{fmt(fee)}</TableCell>
                            <TableCell className="text-right text-sm font-bold text-secondary">{fmt(net)}</TableCell>
                            <TableCell>
                              <Badge className={t.status === "success" ? "bg-success/10 text-success border-0 text-[10px]" : "bg-warning/10 text-warning border-0 text-[10px]"}>
                                {t.status === "success" ? <><Check className="h-3 w-3 mr-1" />Đã vào ví</> : <><Clock className="h-3 w-3 mr-1" />Đang xử lý</>}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chưa có giao dịch nào</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="wallet">
                <div className="rounded-2xl border bg-card shadow-card overflow-hidden mt-2">
                  <div className="p-5 border-b">
                    <h3 className="font-semibold text-foreground">Lịch sử giao dịch ví</h3>
                    <p className="text-xs text-muted-foreground mt-1">Mọi biến động số dư ví của bạn</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Mã GD</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Nội dung</TableHead>
                        <TableHead className="text-right">Biến động</TableHead>
                        <TableHead className="text-right">Số dư cuối</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTxns.length > 0 ? (walletTxns as any[]).map((w) => {
                        const kl = kindLabel(w.kind);
                        const positive = w.delta > 0;
                        return (
                          <TableRow key={w.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(w.created_at).toLocaleString("vi-VN")}</TableCell>
                            <TableCell className="font-mono text-xs">{w.reference_code || w.id.slice(0, 8)}</TableCell>
                            <TableCell><Badge className={`${kl.cls} border-0 text-[10px] gap-1`}>{kl.icon}{kl.label}</Badge></TableCell>
                            <TableCell className="text-sm max-w-[260px] truncate">{w.description}</TableCell>
                            <TableCell className={`text-right font-bold text-sm ${positive ? "text-success" : "text-destructive"}`}>
                              {positive ? "+ " : "− "}{Math.abs(w.delta).toLocaleString("vi-VN")}đ
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">{w.balance_after.toLocaleString("vi-VN")}đ</TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chưa có giao dịch ví nào</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-secondary" />Rút tiền về ngân hàng
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Số dư khả dụng</span><span className="font-bold text-secondary">{fmt(available)}</span></div>
            </div>
            <div className="space-y-2">
              <Label>Số tiền muốn rút</Label>
              <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(Math.min(available, Math.max(0, Number(e.target.value))))} />
            </div>
            <div className="space-y-2">
              <Label>Ngân hàng</Label>
              <Input placeholder="Vietcombank, Techcombank..." value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input placeholder="0123456789" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground italic">Tiền sẽ được chuyển trong 24-48h làm việc.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} className="rounded-lg">Hủy</Button>
            <Button onClick={confirmWithdraw} disabled={withdrawAmount <= 0 || createWithdraw.isPending} className="gradient-primary border-0 text-primary-foreground rounded-lg">
              {createWithdraw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Xác nhận rút ${fmt(withdrawAmount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
