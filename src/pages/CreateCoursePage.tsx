import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useNavigate } from "react-router-dom";
import { Image, MapPin, Monitor, Globe, Clock, DollarSign, FileText, Tag, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { categories } from "@/data/mockData";
import { motion, AnimatePresence } from "framer-motion";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const [format, setFormat] = useState<"online" | "offline">("offline");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  if (submitted) {
    return (
      <MainLayout>
        <div className="container flex flex-col items-center py-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="mb-6 rounded-full bg-success/10 p-6">
              <CheckCircle2 className="h-16 w-16 text-success" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Khóa học đã được tạo!</h2>
            <p className="mb-6 text-muted-foreground">Khóa học của bạn đang chờ duyệt từ quản trị viên.</p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/mentor/dashboard")} className="gradient-primary border-0 text-primary-foreground rounded-xl">
                Về Dashboard
              </Button>
              <Button variant="outline" onClick={() => setSubmitted(false)} className="rounded-xl">Tạo thêm</Button>
            </div>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-3xl py-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Tạo khóa học mới</h1>
        <p className="mb-8 text-sm text-muted-foreground">Điền thông tin để đăng khóa học lên marketplace</p>

        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6">
          {/* Basic info */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />Thông tin cơ bản
            </h2>
            <div>
              <Label>Tên khóa học</Label>
              <Input placeholder="VD: Guitar Acoustic cho người mới bắt đầu" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Danh mục</Label>
              <Select>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mô tả khóa học</Label>
              <Textarea placeholder="Mô tả chi tiết về khóa học, nội dung giảng dạy..." className="mt-1 min-h-[120px] rounded-xl" />
            </div>
          </div>

          {/* Format & Location */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />Hình thức & Địa điểm
            </h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormat("offline")}
                className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${format === "offline" ? "border-primary bg-accent" : "border-border"}`}
              >
                <MapPin className="h-5 w-5 text-primary" />
                <div className="text-left"><p className="text-sm font-medium text-foreground">Offline</p><p className="text-xs text-muted-foreground">Dạy tại địa điểm</p></div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("online")}
                className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${format === "online" ? "border-primary bg-accent" : "border-border"}`}
              >
                <Monitor className="h-5 w-5 text-secondary" />
                <div className="text-left"><p className="text-sm font-medium text-foreground">Online</p><p className="text-xs text-muted-foreground">Dạy qua video call</p></div>
              </button>
            </div>
            {format === "offline" && (
              <div>
                <Label>Địa chỉ lớp học</Label>
                <Input placeholder="Số nhà, đường, quận, thành phố" className="mt-1 rounded-xl" />
              </div>
            )}
            {format === "online" && (
              <div>
                <Label>Link phòng học (Zoom/Meet)</Label>
                <Input placeholder="https://zoom.us/j/..." className="mt-1 rounded-xl" />
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />Lịch dạy
            </h2>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-xl border px-4 py-2 text-sm transition-all ${
                    selectedDays.includes(day) ? "border-primary bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Giờ bắt đầu</Label>
                <Input type="time" className="mt-1 rounded-xl" defaultValue="09:00" />
              </div>
              <div>
                <Label>Giờ kết thúc</Label>
                <Input type="time" className="mt-1 rounded-xl" defaultValue="11:00" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />Giá & Quảng cáo
            </h2>
            <div>
              <Label>Giá mỗi buổi (VNĐ)</Label>
              <Input type="number" placeholder="200000" className="mt-1 rounded-xl" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tin nổi bật</p>
                <p className="text-xs text-muted-foreground">15,000 VNĐ / 3 ngày - Hiển thị ưu tiên</p>
              </div>
              <Switch />
            </div>
          </div>

          {/* Images */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />Hình ảnh
            </h2>
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Kéo thả hoặc click để upload hình ảnh</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG tối đa 5MB</p>
            </div>
          </div>

          <Button type="submit" className="w-full gradient-primary border-0 text-primary-foreground py-6 rounded-xl text-base">
            Đăng khóa học
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
