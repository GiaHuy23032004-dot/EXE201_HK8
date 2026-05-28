import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateLearnerProfile, useUpdateLearnerAvatar, useLearnerStats } from "@/hooks/useLearnerProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Mail, Phone, User, BookOpen, Award, Save, Loader2, GraduationCap, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, session, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = session?.user?.id;

  const updateProfile = useUpdateLearnerProfile();
  const updateAvatar  = useUpdateLearnerAvatar();
  const { data: stats } = useLearnerStats(userId);

  const [name, setName]   = useState(user?.name  || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio]     = useState(user?.bio   || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

  const initials = user?.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const currentAvatar = avatarPreview || user?.avatar;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setAvatarPreview(URL.createObjectURL(file));
    try {
      await updateAvatar.mutateAsync({ userId, file });
      toast({ title: "Đã cập nhật ảnh đại diện" });
    } catch (err: any) {
      toast({ title: "Upload ảnh thất bại", description: err.message, variant: "destructive" });
      setAvatarPreview(null);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    try {
      await updateProfile.mutateAsync({ userId, name, phone, bio });
      toast({ title: "Đã cập nhật hồ sơ", description: "Thông tin cá nhân đã được lưu." });
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-3xl py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Hồ sơ cá nhân</h1>

        <div className="space-y-6">
          {/* Avatar + thống kê */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-5 mb-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
                  {currentAvatar && <AvatarImage src={currentAvatar} />}
                </Avatar>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={updateAvatar.isPending}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                  {updateAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="mt-1 inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
                  {user?.role === "mentor" ? "👨‍🏫 Mentor" : "🎓 Người học"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">Click icon camera để đổi ảnh</p>
              </div>
            </div>

            {/* Stats học viên */}
            {user?.role !== "mentor" && stats && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Clock, label: "Sắp tới", value: stats.upcoming, color: "text-secondary" },
                  { icon: CheckCircle2, label: "Hoàn thành", value: stats.completed, color: "text-success" },
                  { icon: GraduationCap, label: "Tổng buổi", value: stats.total, color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
                    <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form thông tin */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
            <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
            <div>
              <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Họ và tên</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
              <Input value={user?.email} disabled className="mt-1 bg-muted" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Số điện thoại</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901 234 567" className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Giới thiệu</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Viết vài dòng về bản thân..." className="mt-1" rows={4} />
            </div>

            {user?.role === "mentor" && (
              <div className="rounded-xl border bg-accent/30 p-4">
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <Award className="h-4 w-4 text-primary" /> Thông tin Mentor
                </h3>
                <p className="text-sm text-muted-foreground">Chỉnh sửa chứng chỉ, kinh nghiệm tại trang Mentor Dashboard.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/mentor/profile")}>
                  Đi đến hồ sơ Mentor
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={updateProfile.isPending} className="gradient-primary border-0 text-primary-foreground gap-2">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
