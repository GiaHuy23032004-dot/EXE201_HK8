import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockReviews } from "@/data/mockData";
import { Plus, BookOpen, Calendar, DollarSign, Star, TrendingUp, Users, Eye, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const bookingRequests = [
  { id: "1", learner: "Ngọc Trâm", course: "Guitar Acoustic cho người mới", date: "10/03/2026", time: "09:00", status: "new" },
  { id: "2", learner: "Văn Hải", course: "Guitar Acoustic cho người mới", date: "12/03/2026", time: "14:00", status: "new" },
  { id: "3", learner: "Thanh Nga", course: "Guitar Acoustic cho người mới", date: "15/03/2026", time: "08:00", status: "accepted" },
];

export default function MentorDashboard() {
  const [requests, setRequests] = useState(bookingRequests);
  const myCourses = mockCourses.slice(0, 3);

  const handleAction = (id: string, action: "accept" | "decline") => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: action === "accept" ? "accepted" : "declined" } : r));
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
          <TabsList className="mb-6">
            <TabsTrigger value="courses">Khóa học</TabsTrigger>
            <TabsTrigger value="bookings">Đặt lịch</TabsTrigger>
            <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
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
        </Tabs>
      </div>
    </MainLayout>
  );
}
