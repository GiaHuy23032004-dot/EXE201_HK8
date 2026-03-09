import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Mail, Phone, User, BookOpen, Award, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, isLoggedIn, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");

  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

  const initials = user?.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const handleSave = () => {
    updateProfile({ name, phone, bio });
    toast({ title: "Đã cập nhật hồ sơ", description: "Thông tin cá nhân đã được lưu." });
  };

  return (
    <MainLayout>
      <div className="container max-w-3xl py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Hồ sơ cá nhân</h1>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {/* Avatar */}
          <div className="mb-8 flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <span className="mt-1 inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
                {user?.role === "mentor" ? "👨‍🏫 Mentor" : "🎓 Người học"}
              </span>
            </div>
          </div>

          <div className="space-y-5">
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
          </div>

          {user?.role === "mentor" && (
            <div className="mt-6 rounded-xl border bg-accent/30 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground"><Award className="h-4 w-4 text-primary" /> Thông tin Mentor</h3>
              <p className="text-sm text-muted-foreground">Chỉnh sửa chứng chỉ, kinh nghiệm giảng dạy và kỹ năng chuyên môn tại trang Mentor Dashboard.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/mentor/dashboard")}>
                Đi đến Dashboard
              </Button>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} className="gradient-primary border-0 text-primary-foreground gap-2">
              <Save className="h-4 w-4" /> Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
