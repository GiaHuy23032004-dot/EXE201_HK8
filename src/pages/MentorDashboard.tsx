import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockReviews } from "@/data/mockData";
import { Plus, BookOpen, Calendar, DollarSign, Star, Users, Eye, Check, X, Wallet, Clock, ArrowDownToLine, TrendingDown, ArrowUpRight, ArrowDownLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const bookingRequests = [
  { id: "1", learner: "Ngọc Trâm", course: "Guitar Acoustic cho người mới", date: "10/03/2026", time: "09:00", status: "new" },
  { id: "2", learner: "Văn Hải", course: "Guitar Acoustic cho người mới", date: "12/03/2026", time: "14:00", status: "new" },
  { id: "3", learner: "Thanh Nga", course: "Guitar Acoustic cho người mới", date: "15/03/2026", time: "08:00", status: "accepted" },
];

type Txn = {
  id: string;
  course: string;
  image: string;
  type: "online" | "offline" | "product";
  gross: number;
  daysAgo: number;
};

const transactions: Txn[] = [
  { id: "t1", course: "Guitar Acoustic — Buổi 1", image: mockCourses[0].image, type: "online", gross: 350000, daysAgo: 2 },
  { id: "t2", course: "Guitar Acoustic — Buổi 2", image: mockCourses[0].image, type: "offline", gross: 500000, daysAgo: 4 },
  { id: "t3", course: "Sách hướng dẫn Guitar (PDF)", image: mockCourses[1].image, type: "product", gross: 120000, daysAgo: 9 },
  { id: "t4", course: "Lớp Guitar nhóm — Tháng 2", image: mockCourses[1].image, type: "offline", gross: 1200000, daysAgo: 14 },
  { id: "t5", course: "Guitar Acoustic — Buổi 3", image: mockCourses[0].image, type: "online", gross: 350000, daysAgo: 22 },
  { id: "t6", course: "Khóa 1-1 nâng cao", image: mockCourses[0].image, type: "online", gross: 800000, daysAgo: 30 },
];

const FEE_RATE = 0.15;

const typeBadge = (t: Txn["type"]) => {
  if (t === "online") return <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Online</Badge>;
  if (t === "offline") return <Badge className="bg-secondary/10 text-secondary border-0 text-[10px]">Offline</Badge>;
  return <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Sản phẩm</Badge>;
};

export default function MentorDashboard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState(bookingRequests);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const myCourses = mockCourses.slice(0, 3);

  const stats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.gross, 0);
    const fee = total * FEE_RATE;
    const held = transactions.filter(t => t.daysAgo < 7).reduce((s, t) => s + t.gross * (1 - FEE_RATE), 0);
    const available = transactions.filter(t => t.daysAgo >= 7).reduce((s, t) => s + t.gross * (1 - FEE_RATE), 0);
    return { total, fee, held, available };
  }, []);

  const [withdrawAmount, setWithdrawAmount] = useState(stats.available);

  const handleAction = (id: string, action: "accept" | "decline") => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: action === "accept" ? "accepted" : "declined" } : r));
  };

  const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

  const openWithdraw = () => {
    setWithdrawAmount(stats.available);
    setWithdrawOpen(true);
  };

  const confirmWithdraw = () => {
    setWithdrawOpen(false);
    toast({ title: "Yêu cầu rút tiền đã gửi", description: `Số tiền ${fmt(withdrawAmount)} sẽ được chuyển trong 24-48h làm việc.` });
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
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-accent p-2"><BookOpen className="h-5 w-5 text-accent-foreground" /></div>
              <span className="text-xs text-muted-foreground">Khóa học</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{myCourses.length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-secondary/10 p-2"><Calendar className="h-5 w-5 text-secondary" /></div>
              <span className="text-xs text-muted-foreground">Booking mới</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{requests.filter(r => r.status === "new").length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-success/10 p-2"><DollarSign className="h-5 w-5 text-success" /></div>
              <span className="text-xs text-muted-foreground">Doanh thu</span>
            </div>
            <p className="text-2xl font-bold text-foreground">4.2M</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-warning/10 p-2"><Star className="h-5 w-5 text-warning" /></div>
              <span className="text-xs text-muted-foreground">Đánh giá</span>
            </div>
            <p className="text-2xl font-bold text-foreground">4.9</p>
          </div>
        </div>

        <Tabs defaultValue="courses">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="courses">Khóa học</TabsTrigger>
            <TabsTrigger value="bookings">Đặt lịch</TabsTrigger>
            <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
            <TabsTrigger value="revenue">💰 Ví & Doanh thu</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-3">
            {myCourses.map((c) => (
              <div key={c.id} className="flex gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <img src={c.image} alt={c.title} className="h-24 w-32 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-card-foreground">{c.title}</h3>
                    <Badge variant="secondary" className="text-xs">{c.format}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{c.rating}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.studentsCount} học viên</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.reviewCount} đánh giá</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-primary">{c.price.toLocaleString("vi-VN")}đ/buổi</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground">{r.learner}</p>
                  <p className="text-xs text-muted-foreground">{r.course}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.date} • {r.time}</p>
                </div>
                {r.status === "new" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAction(r.id, "accept")} className="gradient-primary border-0 text-primary-foreground rounded-lg">
                      <Check className="mr-1 h-4 w-4" />Chấp nhận
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "decline")} className="rounded-lg">
                      <X className="mr-1 h-4 w-4" />Từ chối
                    </Button>
                  </div>
                ) : (
                  <Badge className={r.status === "accepted" ? "bg-success/10 text-success border-0" : "bg-destructive/10 text-destructive border-0"}>
                    {r.status === "accepted" ? "Đã chấp nhận" : "Đã từ chối"}
                  </Badge>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3">
            {mockReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3 mb-2">
                  <img src={r.userAvatar} alt={r.userName} className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{r.userName}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
              </div>
            ))}
          </TabsContent>

          {/* Revenue & Wallet */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Top stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-4 w-4 text-primary" /></div>
                  <span className="text-xs text-muted-foreground">Tổng doanh thu</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(stats.total)}</p>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-destructive/10 p-2"><TrendingDown className="h-4 w-4 text-destructive" /></div>
                  <span className="text-xs text-muted-foreground">Phí nền tảng (15%)</span>
                </div>
                <p className="text-2xl font-bold text-destructive/90">−{fmt(stats.fee)}</p>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-warning/10 p-2"><Clock className="h-4 w-4 text-warning" /></div>
                  <span className="text-xs text-muted-foreground">Đang tạm giữ</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(stats.held)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Chờ qua mốc 7 ngày</p>
              </div>

              <div className="rounded-2xl border-2 border-secondary/40 bg-gradient-to-br from-secondary/5 to-primary/5 p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-lg bg-secondary/15 p-2"><Wallet className="h-4 w-4 text-secondary" /></div>
                  <span className="text-xs text-muted-foreground">Số dư khả dụng</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xl font-extrabold text-secondary">{fmt(stats.available)}</p>
                  <Button size="sm" onClick={openWithdraw} disabled={stats.available <= 0} className="gradient-primary border-0 text-primary-foreground rounded-lg shrink-0">
                    <ArrowDownToLine className="mr-1 h-4 w-4" />Rút tiền
                  </Button>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <div className="p-5 border-b">
                <h3 className="font-semibold text-foreground">Chi tiết doanh thu</h3>
                <p className="text-xs text-muted-foreground mt-1">Lịch sử các giao dịch và trạng thái thanh toán</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bài đăng</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Giá gốc</TableHead>
                    <TableHead className="text-right">Khấu trừ (15%)</TableHead>
                    <TableHead className="text-right">Thực nhận</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const fee = t.gross * FEE_RATE;
                    const net = t.gross - fee;
                    const held = t.daysAgo < 7;
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={t.image} alt={t.course} className="h-9 w-9 rounded-full object-cover" />
                            <span className="text-sm font-medium text-foreground">{t.course}</span>
                          </div>
                        </TableCell>
                        <TableCell>{typeBadge(t.type)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(t.gross)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive/80">−{fmt(fee)}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-secondary">{fmt(net)}</TableCell>
                        <TableCell>
                          {held ? (
                            <Badge className="bg-warning/10 text-warning border-0 text-[10px] gap-1"><Clock className="h-3 w-3" />Đang tạm giữ</Badge>
                          ) : (
                            <Badge className="bg-success/10 text-success border-0 text-[10px] gap-1"><Check className="h-3 w-3" />Đã vào ví</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Số dư khả dụng</span><span className="font-bold text-secondary">{fmt(stats.available)}</span></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Số tiền muốn rút</Label>
              <Input
                id="amount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Math.min(stats.available, Math.max(0, Number(e.target.value))))}
              />
              <p className="text-[11px] text-muted-foreground italic">Tiền sẽ được chuyển vào ngân hàng đã đăng ký trong 24-48h làm việc.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} className="rounded-lg">Hủy</Button>
            <Button onClick={confirmWithdraw} disabled={withdrawAmount <= 0} className="gradient-primary border-0 text-primary-foreground rounded-lg">
              Xác nhận rút {fmt(withdrawAmount)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
