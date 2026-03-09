import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockReviews } from "@/data/mockData";
import { Calendar, Clock, CheckCircle2, Star, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const bookings = [
  { id: "1", course: mockCourses[0], status: "pending", date: "10/03/2026", time: "09:00 - 11:00" },
  { id: "2", course: mockCourses[1], status: "upcoming", date: "12/03/2026", time: "14:00 - 16:00" },
  { id: "3", course: mockCourses[2], status: "upcoming", date: "15/03/2026", time: "08:00 - 10:00" },
  { id: "4", course: mockCourses[3], status: "completed", date: "05/03/2026", time: "09:00 - 11:00" },
  { id: "5", course: mockCourses[4], status: "completed", date: "01/03/2026", time: "14:00 - 16:00" },
];

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xác nhận", color: "bg-warning/10 text-warning" },
  upcoming: { label: "Sắp tới", color: "bg-secondary/10 text-secondary" },
  completed: { label: "Hoàn thành", color: "bg-success/10 text-success" },
};

function BookingItem({ booking }: { booking: typeof bookings[0] }) {
  const s = statusMap[booking.status];
  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-4 shadow-card">
      <img src={booking.course.image} alt={booking.course.title} className="h-20 w-20 rounded-xl object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground line-clamp-1">{booking.course.title}</h3>
          <Badge className={`${s.color} text-xs border-0 whitespace-nowrap`}>{s.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Mentor: {booking.course.mentorName}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{booking.date}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.time}</span>
        </div>
        {booking.status === "completed" && (
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs rounded-lg">
            <Star className="mr-1 h-3 w-3" />Đánh giá
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LearnerDashboard() {
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter((b) => b.status === "upcoming");
  const completed = bookings.filter((b) => b.status === "completed");

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard Học viên</h1>
          <p className="text-muted-foreground text-sm mt-1">Quản lý lịch học và đánh giá của bạn</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-card text-center">
            <p className="text-2xl font-bold text-primary">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Chờ xác nhận</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-card text-center">
            <p className="text-2xl font-bold text-secondary">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Sắp tới</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-card text-center">
            <p className="text-2xl font-bold text-success">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Hoàn thành</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-card text-center">
            <p className="text-2xl font-bold text-foreground">{mockReviews.length}</p>
            <p className="text-xs text-muted-foreground">Đánh giá</p>
          </div>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">Chờ xác nhận ({pending.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Sắp tới ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed">Hoàn thành ({completed.length})</TabsTrigger>
            <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pending.map((b) => <BookingItem key={b.id} booking={b} />)}
            {pending.length === 0 && <p className="text-center text-muted-foreground py-8">Không có đặt lịch nào đang chờ</p>}
          </TabsContent>
          <TabsContent value="upcoming" className="space-y-3">
            {upcoming.map((b) => <BookingItem key={b.id} booking={b} />)}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3">
            {completed.map((b) => <BookingItem key={b.id} booking={b} />)}
          </TabsContent>
          <TabsContent value="reviews" className="space-y-3">
            {mockReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-warning text-warning" : "text-muted"}`} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
                <p className="text-xs text-muted-foreground mt-2">{r.date}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
