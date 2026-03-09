import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockCourses, mockMentors } from "@/data/mockData";
import { Calendar, Clock, Phone, CreditCard, Wallet, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

const timeSlots = [
  { id: "1", day: "Thứ 2, 10/03", time: "09:00 - 11:00" },
  { id: "2", day: "Thứ 4, 12/03", time: "09:00 - 11:00" },
  { id: "3", day: "Thứ 6, 14/03", time: "14:00 - 16:00" },
  { id: "4", day: "Thứ 7, 15/03", time: "08:00 - 10:00" },
];

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = mockCourses.find((c) => c.id === id) || mockCourses[0];
  const mentor = mockMentors.find((m) => m.name === course.mentorName) || mockMentors[0];
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState<"later" | "platform">("later");
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
  };

  return (
    <MainLayout>
      <div className="container max-w-3xl py-6">
        <Link to={`/course/${course.id}`} className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" />Quay lại khóa học
        </Link>

        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-20 text-center"
            >
              <div className="mb-6 rounded-full bg-success/10 p-6">
                <CheckCircle2 className="h-16 w-16 text-success" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">Đặt lịch thành công!</h2>
              <p className="mb-6 text-muted-foreground">Mentor sẽ xác nhận đặt lịch của bạn trong thời gian sớm nhất.</p>
              <div className="flex gap-3">
                <Link to="/learner/dashboard">
                  <Button className="gradient-primary border-0 text-primary-foreground rounded-xl">
                    Xem lịch đã đặt
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" className="rounded-xl">Về trang chủ</Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="mb-6 text-2xl font-bold text-foreground">Đặt lịch học</h1>

              {/* Course summary */}
              <div className="mb-6 flex gap-4 rounded-2xl border bg-card p-4">
                <img src={course.image} alt={course.title} className="h-20 w-20 rounded-xl object-cover" />
                <div>
                  <h3 className="font-semibold text-card-foreground">{course.title}</h3>
                  <p className="text-sm text-muted-foreground">Mentor: {mentor.name}</p>
                  <p className="mt-1 text-lg font-bold text-primary">{course.price.toLocaleString("vi-VN")}đ/buổi</p>
                </div>
              </div>

              {/* Time slot */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Calendar className="h-5 w-5 text-primary" />Chọn lịch học
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        selectedSlot === slot.id
                          ? "border-primary bg-accent shadow-card"
                          : "bg-card hover:border-primary/30"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{slot.day}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />{slot.time}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Phone className="h-5 w-5 text-primary" />Số điện thoại liên hệ
                </h2>
                <Input
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Payment */}
              <div className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />Phương thức thanh toán
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPayment("later")}
                    className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                      payment === "later" ? "border-primary bg-accent" : "bg-card hover:border-primary/30"
                    }`}
                  >
                    <Wallet className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Trả sau</p>
                      <p className="text-xs text-muted-foreground">Thanh toán trực tiếp</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPayment("platform")}
                    className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                      payment === "platform" ? "border-primary bg-accent" : "bg-card hover:border-primary/30"
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-secondary" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Online</p>
                      <p className="text-xs text-muted-foreground">Qua nền tảng</p>
                    </div>
                  </button>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Summary */}
              <div className="mb-6 rounded-2xl border bg-muted/30 p-6">
                <h3 className="mb-4 font-semibold text-foreground">Tóm tắt đặt lịch</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Khóa học</span><span className="text-foreground">{course.title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mentor</span><span className="text-foreground">{mentor.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lịch học</span><span className="text-foreground">{selectedSlot ? timeSlots.find(s => s.id === selectedSlot)?.day : "Chưa chọn"}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-bold"><span>Tổng cộng</span><span className="text-primary">{course.price.toLocaleString("vi-VN")}đ</span></div>
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={!selectedSlot || !phone}
                className="w-full gradient-primary border-0 text-primary-foreground py-6 rounded-xl text-base"
              >
                Xác nhận đặt lịch
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
