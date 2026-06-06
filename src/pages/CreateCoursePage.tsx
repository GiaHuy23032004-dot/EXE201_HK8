import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCourse } from "@/hooks/use-courses";
import { Image, MapPin, Monitor, Globe, DollarSign, FileText, Upload, CheckCircle2, Loader2, X, CalendarDays } from "lucide-react";
import { useUploadImage } from "@/hooks/use-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { COURSE_CATEGORY_SELECT_OPTIONS, isValidCourseCategorySlug } from "@/constants/courseCategories";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const createCourse = useCreateCourse();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [format, setFormat] = useState<"online" | "offline">("offline");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [price, setPrice] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [submitted, setSubmitted] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { uploadImage, uploading: imageUploading } = useUploadImage();
  const todayIso = formatLocalDate();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      toast({ title: "Vui lòng đăng nhập", variant: "destructive" });
      return;
    }
    if (!title.trim() || !category || !price) {
      toast({ title: "Vui lòng điền đầy đủ thông tin bắt buộc", variant: "destructive" });
      return;
    }
    if (!isValidCourseCategorySlug(category)) {
      toast({ title: "Vui lòng chọn một danh mục hợp lệ", variant: "destructive" });
      return;
    }
    if (!startDate) {
      toast({ title: "Vui lòng chọn ngày khai giảng", variant: "destructive" });
      return;
    }
    if (startDate < todayIso) {
      toast({ title: "Ngày khai giảng không thể trước hôm nay", variant: "destructive" });
      return;
    }
    if (selectedDays.length === 0) {
      toast({ title: "Vui lòng chọn ít nhất một ngày học trong tuần", variant: "destructive" });
      return;
    }
    if (!startTime || !endTime || endTime <= startTime) {
      toast({ title: "Giờ kết thúc phải sau giờ bắt đầu", variant: "destructive" });
      return;
    }
    if (format === "offline" && !location.trim()) {
      toast({ title: "Vui lòng nhập địa chỉ lớp học", variant: "destructive" });
      return;
    }
    if (format === "online" && !meetingLink.trim()) {
      toast({ title: "Vui lòng nhập link phòng học online", variant: "destructive" });
      return;
    }
    if (Number(price) < 0) {
      toast({ title: "Giá phải là số không âm", variant: "destructive" });
      return;
    }

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const url = await uploadImage(imageFile, "course-images", session.user.id);
        if (url) imageUrl = url;
      }
      await createCourse.mutateAsync({
        mentor_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        format,
        price: Number(price),
        location: format === "offline" ? location.trim() : undefined,
        meeting_link: format === "online" ? meetingLink.trim() : undefined,
        image_url: imageUrl,
        start_date: startDate,
        schedules: selectedDays.map((day) => ({
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
        })),
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Tạo khóa học thất bại", description: err.message, variant: "destructive" });
    }
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
              <Button variant="outline" onClick={() => { setSubmitted(false); setTitle(""); setCategory(""); setDescription(""); setStartDate(""); setPrice(""); setSelectedDays([]); }} className="rounded-xl">
                Tạo thêm
              </Button>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />Thông tin cơ bản
            </h2>
            <div>
              <Label>Tên khóa học <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Guitar Acoustic cho người mới bắt đầu" className="mt-1 rounded-xl" required />
            </div>
            <div>
              <Label>Danh mục <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORY_SELECT_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mô tả khóa học</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả chi tiết về khóa học, nội dung giảng dạy..." className="mt-1 min-h-[120px] rounded-xl" />
            </div>
          </div>

          {/* Start date & Schedule */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />Thời gian khai giảng & lịch học
            </h2>
            <div>
              <Label>Ngày khai giảng <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                min={todayIso}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 rounded-xl"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">Học viên chỉ có thể đặt lịch từ ngày khai giảng trở đi.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <button key={day} type="button" onClick={() => toggleDay(day)}
                  className={`rounded-xl border px-4 py-2 text-sm transition-all ${
                    selectedDays.includes(day) ? "border-primary bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:border-primary/30"
                  }`}>
                  {day}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Giờ bắt đầu</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Giờ kết thúc</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Format & Location */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />Hình thức & Địa điểm
            </h2>
            <div className="flex gap-3">
              <button type="button" onClick={() => setFormat("offline")}
                className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${format === "offline" ? "border-primary bg-accent" : "border-border"}`}>
                <MapPin className="h-5 w-5 text-primary" />
                <div className="text-left"><p className="text-sm font-medium text-foreground">Offline</p><p className="text-xs text-muted-foreground">Dạy tại địa điểm</p></div>
              </button>
              <button type="button" onClick={() => setFormat("online")}
                className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${format === "online" ? "border-primary bg-accent" : "border-border"}`}>
                <Monitor className="h-5 w-5 text-secondary" />
                <div className="text-left"><p className="text-sm font-medium text-foreground">Online</p><p className="text-xs text-muted-foreground">Dạy qua video call</p></div>
              </button>
            </div>
            {format === "offline" && (
              <div>
                <Label>Địa chỉ lớp học</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Số nhà, đường, quận, thành phố" className="mt-1 rounded-xl" />
              </div>
            )}
            {format === "online" && (
              <div>
                <Label>Link phòng học (Zoom/Meet)</Label>
                <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/..." className="mt-1 rounded-xl" />
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />Giá
            </h2>
            <div>
              <Label>Giá mỗi buổi (VNĐ) <span className="text-destructive">*</span></Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="200000" className="mt-1 rounded-xl" required />
            </div>
          </div>

          {/* Images */}
          <div className="rounded-2xl border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />Hình ảnh
            </h2>
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-destructive p-1 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed p-8 text-center hover:border-primary/50 transition-colors">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Kéo thả hoặc click để upload hình ảnh</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP tối đa 5MB</p>
                </div>
              )}
            </label>
          </div>

          <Button type="submit" disabled={createCourse.isPending || imageUploading} className="w-full gradient-primary border-0 text-primary-foreground py-6 rounded-xl text-base">
            {(createCourse.isPending || imageUploading) ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{imageUploading ? "Đang upload ảnh..." : "Đang tạo..."}</> : "Đăng khóa học"}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
