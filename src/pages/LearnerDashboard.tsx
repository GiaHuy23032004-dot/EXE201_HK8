import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockReviews } from "@/data/mockData";
import { Calendar, Clock, Star, GraduationCap, Heart, Search, BookOpen, Receipt, Download, CheckCircle2, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

const bookings = [
  { id: "1", course: mockCourses[0], status: "pending", date: "10/03/2026", time: "09:00 - 11:00" },
  { id: "2", course: mockCourses[1], status: "upcoming", date: "12/03/2026", time: "14:00 - 16:00" },
  { id: "3", course: mockCourses[2], status: "upcoming", date: "15/03/2026", time: "08:00 - 10:00" },
  { id: "4", course: mockCourses[3], status: "completed", date: "05/03/2026", time: "09:00 - 11:00" },
  { id: "5", course: mockCourses[4], status: "completed", date: "01/03/2026", time: "14:00 - 16:00" },
];

const savedCourses = mockCourses.slice(1, 5);

type Billing = {
  id: string; date: string; desc: string; amount: number;
  method: "Thẻ tín dụng" | "Chuyển khoản" | "Ví điện tử";
  status: "success" | "refunded";
};

const billingHistory: Billing[] = [
  { id: "TXN-1284", date: "06/03/2026", desc: mockCourses[0].title, amount: 350000, method: "Thẻ tín dụng", status: "success" },
  { id: "TXN-1271", date: "01/03/2026", desc: mockCourses[1].title, amount: 500000, method: "Chuyển khoản", status: "success" },
  { id: "TXN-1245", date: "22/02/2026", desc: mockCourses[2].title, amount: 280000, method: "Ví điện tử", status: "refunded" },
  { id: "TXN-1219", date: "15/02/2026", desc: mockCourses[3].title, amount: 420000, method: "Thẻ tín dụng", status: "success" },
  { id: "TXN-1198", date: "08/02/2026", desc: mockCourses[4].title, amount: 600000, method: "Chuyển khoản", status: "success" },
];

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xác nhận", color: "bg-warning/10 text-warning border-warning/20" },
  upcoming: { label: "Sắp tới", color: "bg-secondary/10 text-secondary border-secondary/20" },
  completed: { label: "Hoàn thành", color: "bg-success/10 text-success border-success/20" },
};

function BookingItem({ booking }: { booking: typeof bookings[0] }) {
  const s = statusMap[booking.status];
  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-4 shadow-card">
      <img src={booking.course.image} alt={booking.course.title} className="h-20 w-20 rounded-xl object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground line-clamp-1">{booking.course.title}</h3>
          <Badge className={`${s.color} text-xs whitespace-nowrap`}>{s.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Mentor: {booking.course.mentorName}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{booking.date}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.time}</span>
        </div>
        {booking.status === "completed" && (
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs rounded-lg">
            <Star className="mr-1 h-3 w-3" />Đánh giá khóa học
          </Button>
        )}
        {booking.status === "upcoming" && (
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs rounded-lg text-destructive hover:text-destructive">
            Hủy đặt lịch
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LearnerDashboard() {
  const { user } = useAuth();
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter((b) => b.status === "upcoming");
  const completed = bookings.filter((b) => b.status === "completed");

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Chào {user?.name?.split(" ").pop() || "bạn"} 👋
              </h1>
              <p className="text-muted-foreground text-sm">Trang học viên – quản lý lịch học & tiến trình</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Chờ xác nhận", value: pending.length, color: "text-warning" },
            { label: "Sắp diễn ra", value: upcoming.length, color: "text-secondary" },
            { label: "Đã hoàn thành", value: completed.length, color: "text-success" },
            { label: "Đánh giá đã viết", value: mockReviews.length, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-card text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="upcoming" className="flex-1">Sắp tới ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">Chờ duyệt ({pending.length})</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Hoàn thành ({completed.length})</TabsTrigger>
            <TabsTrigger value="saved" className="flex-1">Đã lưu</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1">Đánh giá</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {upcoming.map((b) => <BookingItem key={b.id} booking={b} />)}
            {upcoming.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <Calendar className="h-12 w-12 text-muted mb-3" />
                <p className="font-semibold text-foreground">Chưa có lịch học nào</p>
                <Link to="/search">
                  <Button className="mt-4 gradient-primary border-0 text-primary-foreground">
                    <Search className="mr-2 h-4 w-4" />Tìm khóa học
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {pending.map((b) => <BookingItem key={b.id} booking={b} />)}
            {pending.length === 0 && <p className="text-center text-muted-foreground py-8">Không có đặt lịch nào đang chờ</p>}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completed.map((b) => <BookingItem key={b.id} booking={b} />)}
          </TabsContent>

          <TabsContent value="saved" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Các khóa học bạn đã lưu để xem sau</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {savedCourses.map((c) => (
                <Link to={`/course/${c.id}`} key={c.id}>
                  <div className="flex gap-3 rounded-2xl border bg-card p-3 shadow-card hover:border-primary transition-colors">
                    <img src={c.image} alt={c.title} className="h-16 w-16 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-card-foreground line-clamp-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.mentorName}</p>
                      <p className="text-sm font-bold text-primary mt-1">{c.price.toLocaleString("vi-VN")}đ</p>
                    </div>
                    <Heart className="h-4 w-4 text-destructive fill-destructive shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">Các đánh giá bạn đã viết</p>
            {mockReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`} />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{r.date}</span>
                </div>
                <p className="text-sm text-foreground">{r.comment}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* CTA - Tìm thêm khóa học */}
        <div className="mt-8 rounded-2xl gradient-hero-mesh border p-6 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-semibold text-foreground">Khám phá thêm khóa học</p>
          <p className="text-xs text-muted-foreground mt-1">Hơn 15,000 khóa học đang chờ bạn</p>
          <Link to="/search">
            <Button className="mt-4 gradient-primary border-0 text-primary-foreground">
              Tìm kiếm ngay
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
