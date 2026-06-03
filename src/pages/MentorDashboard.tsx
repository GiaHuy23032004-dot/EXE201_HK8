import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorCourses } from "@/hooks/use-courses";
import { useMentorBookings, useUpdateBookingStatus } from "@/hooks/use-bookings";
import { useMentorWallet, useWalletTransactions, useMentorTransactions, useCreateWithdrawal } from "@/hooks/use-wallet";
import { useMentorVerification, type MentorVerificationStatus } from "@/hooks/useMentorVerification";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, BookOpen, Calendar, DollarSign, Star, Users,
  Check, X, Wallet, Clock, ArrowDownToLine, TrendingDown,
  ArrowUpRight, ArrowDownLeft, RotateCcw, Loader2,
  TrendingUp, Eye, ChevronRight, AlertCircle, BadgeCheck, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const FEE_RATE = 0.15;
const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

interface ChartTransaction {
  amount: number;
  created_at: string;
}

interface DashboardReview {
  rating: number;
}

interface WalletTransactionPreview {
  id: string;
  delta: number;
  description: string | null;
}

interface DashboardStatCard {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  action?: ReactNode;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Chờ xác nhận", cls: "bg-warning/10 text-warning border-0" },
  upcoming:  { label: "Đã xác nhận",  cls: "bg-primary/10 text-primary border-0" },
  completed: { label: "Hoàn thành",   cls: "bg-success/10 text-success border-0" },
  declined:  { label: "Đã từ chối",   cls: "bg-destructive/10 text-destructive border-0" },
  cancelled: { label: "Đã hủy",       cls: "bg-muted text-muted-foreground border-0" },
};

const verificationBannerCopy: Record<Exclude<MentorVerificationStatus, "approved">, {
  title: string;
  description: string;
  button?: string;
}> = {
  unverified: {
    title: "Hoàn tất xác minh để tăng độ tin cậy",
    description: "Bổ sung hồ sơ và bằng chứng chuyên môn để nhận huy hiệu Verified Mentor.",
    button: "Xác minh ngay",
  },
  draft: {
    title: "Hồ sơ xác minh chưa hoàn tất",
    description: "Bạn có thể tiếp tục bổ sung thông tin trước khi gửi duyệt.",
    button: "Tiếp tục xác minh",
  },
  pending: {
    title: "Hồ sơ đang chờ duyệt",
    description: "Admin đang xem xét hồ sơ xác minh của bạn.",
  },
  rejected: {
    title: "Hồ sơ cần bổ sung",
    description: "Hồ sơ cần bổ sung thêm thông tin.",
    button: "Bổ sung hồ sơ",
  },
  revision_requested: {
    title: "Hồ sơ cần chỉnh sửa",
    description: "Admin đã yêu cầu chỉnh sửa một số thông tin trong hồ sơ xác minh.",
    button: "Bổ sung hồ sơ",
  },
  revoked: {
    title: "Xác minh đã bị thu hồi",
    description: "Trạng thái Verified Mentor không còn hiệu lực. Vui lòng xem ghi chú hoặc liên hệ Admin nếu cần.",
  },
};

// Build a simple monthly revenue chart from transactions
function buildChartData(txns: ChartTransaction[]) {
  const map: Record<string, number> = {};
  txns.forEach((t) => {
    const d = new Date(t.created_at);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    map[key] = (map[key] ?? 0) + (t.amount * (1 - FEE_RATE));
  });
  return Object.entries(map)
    .slice(-6)
    .map(([month, revenue]) => ({ month, revenue }));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}

export default function MentorDashboard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const mentorId = session?.user?.id;

  const { data: courses  = [], isLoading: coursesLoading  } = useMentorCourses(mentorId);
  const { data: bookings = [], isLoading: bookingsLoading } = useMentorBookings(mentorId);
  const { data: wallet }                                    = useMentorWallet(mentorId);
  const { data: walletTxns = [] }                           = useWalletTransactions(mentorId);
  const { data: txns = [] }                                 = useMentorTransactions(mentorId);
  const { data: verificationContext }                       = useMentorVerification(mentorId);
  const updateStatus   = useUpdateBookingStatus();
  const createWithdraw = useCreateWithdrawal();

  const [withdrawOpen,   setWithdrawOpen]   = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [bankName,       setBankName]       = useState("");
  const [bankAccount,    setBankAccount]    = useState("");
  const [bankHolder,     setBankHolder]     = useState("");

  const { data: reviews = [] } = useQuery<DashboardReview[]>({
    queryKey: ["mentor-dashboard-reviews", mentorId],
    enabled: courses.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, learner:profiles!reviews_learner_id_fkey(name, avatar_url)")
        .in("course_id", courses.map((c) => c.id))
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as DashboardReview[];
    },
  });

  const pendingBookings  = bookings.filter((b) => b.status === "pending");
  const recentBookings   = bookings.slice(0, 5);
  const totalStudents    = courses.reduce((s, c) => s + c.students_count, 0);
  const avgRating        = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";
  const totalRevenue     = wallet?.total_earned ?? 0;
  const available        = wallet?.balance      ?? 0;
  const held             = wallet?.held_balance ?? 0;
  const chartData        = buildChartData(txns as ChartTransaction[]);
  const verification = verificationContext?.verification;
  const verificationStatus = verification?.status ?? "unverified";
  const showVerificationBanner = verificationStatus !== "approved";
  const verificationCopy = showVerificationBanner
    ? verificationBannerCopy[verificationStatus as Exclude<MentorVerificationStatus, "approved">]
    : null;

  const handleBookingAction = async (id: string, action: "upcoming" | "declined") => {
    if (!mentorId) return;
    await updateStatus.mutateAsync({ id, status: action, mentorId });
    toast({ title: action === "upcoming" ? "✅ Đã chấp nhận booking" : "❌ Đã từ chối booking" });
  };

  const openWithdraw = () => {
    navigate("/mentor/wallet?tab=withdraw");
  };

  const confirmWithdraw = async () => {
    if (!mentorId || !bankName || !bankAccount || !bankHolder) {
      toast({ title: "Vui lòng điền đầy đủ thông tin ngân hàng", variant: "destructive" });
      return;
    }
    try {
      await createWithdraw.mutateAsync({
        mentor_id: mentorId, amount: withdrawAmount,
        bank_name: bankName, bank_account: bankAccount, bank_holder: bankHolder,
      });
      setWithdrawOpen(false);
      toast({ title: "Yêu cầu rút tiền đã gửi", description: `${fmt(withdrawAmount)} sẽ được chuyển trong 24-48h.` });
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const statCards: DashboardStatCard[] = [
    {
      icon: DollarSign,
      label: "Tổng doanh thu",
      value: fmt(totalRevenue),
      sub: `Khả dụng: ${fmt(available)}`,
      color: "text-success",
      bg: "bg-success/10",
      action: available > 0 ? (
        <button onClick={openWithdraw} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <ArrowDownToLine className="h-3 w-3" /> Rút tiền
        </button>
      ) : undefined,
    },
    {
      icon: Users,
      label: "Tổng học viên",
      value: totalStudents,
      sub: `${courses.length} khóa học`,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: BookOpen,
      label: "Khóa học đang hoạt động",
      value: courses.filter((c) => c.status === "approved").length,
      sub: `${courses.filter((c) => c.status === "pending").length} chờ duyệt`,
      color: "text-secondary-foreground",
      bg: "bg-accent",
    },
    {
      icon: Star,
      label: "Đánh giá trung bình",
      value: avgRating,
      sub: `${reviews.length} lượt đánh giá`,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <MentorLayout>
      <div className="p-6 lg:p-8 space-y-8">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Tổng quan</h1>
              {verificationStatus === "approved" && (
                <Badge className="gap-1 rounded-full border-0 bg-success/10 text-success">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified Mentor
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Chào mừng trở lại! Đây là tình hình hoạt động của bạn.
            </p>
          </div>
        </div>

        {showVerificationBanner && verificationCopy && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{verificationCopy.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {verificationStatus === "rejected" && verification?.admin_note
                  ? verification.admin_note
                  : verificationCopy.description}
              </p>
            </div>
            {verificationCopy.button && (
              <Link to="/mentor/profile?tab=verification">
                <Button
                  className="rounded-xl border-0 text-primary-foreground gradient-primary"
                >
                  {verificationCopy.button}
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Pending bookings alert ── */}
        {pendingBookings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <p className="text-sm font-medium text-foreground">
              Bạn có <span className="text-warning font-bold">{pendingBookings.length}</span> booking đang chờ xác nhận.
            </p>
            <Link to="/mentor/dashboard#bookings" className="ml-auto text-xs font-semibold text-primary hover:underline whitespace-nowrap">
              Xem ngay →
            </Link>
          </motion.div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xl ${s.bg} p-2.5`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              {s.sub && <p className="mt-1 text-[11px] text-muted-foreground/70">{s.sub}</p>}
              {s.action}
            </motion.div>
          ))}
        </div>

        {/* ── Revenue chart + Wallet summary ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Doanh thu theo tháng</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Sau khi trừ phí nền tảng 15%</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(200 95% 48%)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="hsl(200 95% 48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 92%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215 14% 46%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215 14% 46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Thực nhận"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 20% 92%)", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(200 95% 48%)" strokeWidth={2} fill="url(#revenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/40">
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu doanh thu</p>
              </div>
            )}
          </div>

          {/* Wallet summary */}
          <div className="rounded-2xl border bg-card p-6 shadow-card flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-semibold text-foreground">Ví của tôi</h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "Tổng đã kiếm",   value: fmt(totalRevenue), cls: "text-foreground" },
                { label: "Phí nền tảng (15%)", value: `−${fmt(totalRevenue * FEE_RATE)}`, cls: "text-destructive/80" },
                { label: "Đang tạm giữ",   value: fmt(held),         cls: "text-warning" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-semibold ${row.cls}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Khả dụng</span>
                <span className="text-lg font-extrabold text-primary">{fmt(available)}</span>
              </div>
            </div>

            <Button
              onClick={openWithdraw}
              disabled={available <= 0}
              className="mt-auto gradient-primary border-0 text-primary-foreground rounded-xl"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Rút tiền
            </Button>

            {walletTxns.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Giao dịch gần đây</p>
                {(walletTxns as WalletTransactionPreview[]).slice(0, 3).map((w) => {
                  const positive = w.delta > 0;
                  return (
                    <div key={w.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full p-1 ${positive ? "bg-success/10" : "bg-destructive/10"}`}>
                          {positive
                            ? <ArrowDownLeft className="h-3 w-3 text-success" />
                            : <ArrowUpRight  className="h-3 w-3 text-destructive" />}
                        </div>
                        <span className="text-muted-foreground truncate max-w-[120px]">{w.description}</span>
                      </div>
                      <span className={`font-semibold ${positive ? "text-success" : "text-destructive"}`}>
                        {positive ? "+" : "−"}{Math.abs(w.delta).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent bookings ── */}
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden" id="bookings">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Booking gần đây</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Các buổi học sắp tới và đang chờ xác nhận</p>
            </div>
            <Link to="/mentor/dashboard" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {bookingsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : recentBookings.length > 0 ? (
            <div className="divide-y divide-border/60">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={b.learner?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                      {b.learner?.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {b.learner?.name ?? "Học viên"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{b.course?.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {new Date(b.booking_date).toLocaleDateString("vi-VN")} • {b.start_time} – {b.end_time}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="hidden text-sm font-bold text-primary sm:block">
                      {b.total_price.toLocaleString("vi-VN")}đ
                    </p>
                    {b.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleBookingAction(b.id, "upcoming")}
                          disabled={updateStatus.isPending}
                          className="gradient-primary border-0 text-primary-foreground rounded-lg h-8 px-3 text-xs"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />Chấp nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBookingAction(b.id, "declined")}
                          disabled={updateStatus.isPending}
                          className="rounded-lg h-8 px-3 text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Badge className={statusConfig[b.status]?.cls ?? ""}>
                        {statusConfig[b.status]?.label ?? b.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <Calendar className="h-10 w-10 text-muted mb-3" />
              <p className="font-semibold text-foreground">Chưa có booking nào</p>
              <p className="mt-1 text-sm text-muted-foreground">Học viên sẽ xuất hiện ở đây khi đặt lịch</p>
            </div>
          )}
        </div>

        {/* ── My courses quick view ── */}
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Khóa học của tôi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{courses.length} khóa học</p>
            </div>
            <Link to="/mentor/create-course" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Thêm mới
            </Link>
          </div>

          {coursesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : courses.length > 0 ? (
            <div className="divide-y divide-border/60">
              {courses.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <img
                    src={c.image_url ?? "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&h=80&fit=crop"}
                    alt={c.title}
                    className="h-14 w-20 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />{c.rating}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{c.students_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />{c.review_count}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-primary">{c.price.toLocaleString("vi-VN")}đ</p>
                    <Badge
                      className={
                        c.status === "approved"
                          ? "bg-success/10 text-success border-0 text-[10px] mt-1"
                          : c.status === "pending"
                          ? "bg-warning/10 text-warning border-0 text-[10px] mt-1"
                          : "bg-destructive/10 text-destructive border-0 text-[10px] mt-1"
                      }
                    >
                      {c.status === "approved" ? "Đã duyệt" : c.status === "pending" ? "Chờ duyệt" : "Từ chối"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted mb-3" />
              <p className="font-semibold text-foreground">Chưa có khóa học nào</p>
              <Link to="/mentor/create-course">
                <Button className="mt-4 gradient-primary border-0 text-primary-foreground rounded-xl">
                  Tạo khóa học đầu tiên
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Withdraw Modal ── */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              Rút tiền về ngân hàng
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số dư khả dụng</span>
                <span className="font-bold text-primary">{fmt(available)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Số tiền muốn rút</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Math.min(available, Math.max(0, Number(e.target.value))))}
              />
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
            <p className="text-[11px] text-muted-foreground italic">
              Tiền sẽ được chuyển trong 24-48h làm việc.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} className="rounded-lg">
              Hủy
            </Button>
            <Button
              onClick={confirmWithdraw}
              disabled={withdrawAmount <= 0 || createWithdraw.isPending}
              className="gradient-primary border-0 text-primary-foreground rounded-lg"
            >
              {createWithdraw.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : `Xác nhận rút ${fmt(withdrawAmount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MentorLayout>
  );
}
