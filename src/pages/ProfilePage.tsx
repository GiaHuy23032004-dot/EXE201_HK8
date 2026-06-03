import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  Map,
  MapPin,
  Phone,
  Save,
  Search,
  User,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUploadImage } from "@/hooks/use-upload";
import {
  useLearnerProfile,
  useLearnerStats,
  useUpdateLearnerAvatar,
  useUpdateLearnerProfile,
} from "@/hooks/useLearnerProfile";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const getInitials = (name?: string | null) => {
  const value = name?.trim() || "VET";
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const normalize = (value?: string | null) => value?.trim() ?? "";

export default function ProfilePage() {
  const { user, session, isLoggedIn, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploading } = useUploadImage();
  const userId = session?.user?.id;

  const profileQuery = useLearnerProfile(userId);
  const updateProfile = useUpdateLearnerProfile();
  const updateAvatar = useUpdateLearnerAvatar();
  const { data: stats } = useLearnerStats(userId);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    bio: "",
    avatar_url: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    const profile = profileQuery.data;
    setForm({
      name: normalize(profile?.name ?? user?.name),
      phone: normalize(profile?.phone ?? user?.phone),
      address: normalize(profile?.address ?? user?.address),
      bio: normalize(profile?.bio ?? user?.bio),
      avatar_url: normalize(profile?.avatar_url ?? user?.avatar),
    });
  }, [profileQuery.data, user?.address, user?.avatar, user?.bio, user?.name, user?.phone]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!isLoading && !isLoggedIn) {
    return <Navigate to="/auth" replace />;
  }

  const email = profileQuery.data?.email || user?.email || "";
  const currentAvatar = avatarPreview || form.avatar_url;
  const initials = getInitials(form.name || email);
  const saving = updateProfile.isPending;
  const avatarSaving = uploading || updateAvatar.isPending;
  const address = form.address.trim();

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const goToSearchNearAddress = () => {
    if (!address) return;
    navigate(`/search?location=${encodeURIComponent(address)}`);
  };

  const goToMapNearAddress = () => {
    if (!address) return;
    navigate(`/map?location=${encodeURIComponent(address)}`);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      toast({
        title: "Ảnh đại diện không hợp lệ",
        description: "Vui lòng chọn ảnh PNG, JPG, JPEG hoặc WEBP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast({
        title: "Ảnh quá lớn",
        description: "Ảnh đại diện tối đa 5MB.",
        variant: "destructive",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(previewUrl);

    const uploadedUrl = await uploadImage(file, "avatars", userId);
    if (!uploadedUrl) {
      toast({
        title: "Không thể tải ảnh đại diện",
        description: "Nếu bucket avatars chưa được cấu hình, bạn vẫn có thể dùng avatar chữ cái tạm thời.",
        variant: "destructive",
      });
      setAvatarPreview(null);
      return;
    }

    try {
      await updateAvatar.mutateAsync({ userId, avatarUrl: uploadedUrl });
      setField("avatar_url", uploadedUrl);
      await refreshProfile();
      toast({ title: "Đã cập nhật ảnh đại diện." });
    } catch (error) {
      toast({
        title: "Không thể lưu ảnh đại diện",
        description: error instanceof Error ? error.message : "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Vui lòng nhập họ và tên.", variant: "destructive" });
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, "");
    const shouldWarnPhone = Boolean(form.phone.trim()) && phoneDigits.length < 8;

    try {
      await updateProfile.mutateAsync({
        userId,
        name,
        phone: form.phone,
        address: form.address,
        bio: form.bio,
        previousAddress: profileQuery.data?.address,
      });

      await refreshProfile();

      toast({
        title: "Đã lưu thay đổi",
        description: shouldWarnPhone
          ? "Hồ sơ đã được lưu. Số điện thoại có vẻ hơi ngắn, bạn có thể kiểm tra lại khi cần."
          : "Thông tin cá nhân đã được cập nhật.",
      });
    } catch (error) {
      toast({
        title: "Không thể lưu hồ sơ",
        description: error instanceof Error ? error.message : "Vui lòng thử lại sau.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hồ sơ cá nhân</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý thông tin cá nhân và khu vực học mong muốn của bạn.
            </p>
          </div>

          {isLoading || profileQuery.isLoading ? (
            <Card className="rounded-2xl shadow-card">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-5">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-56 rounded-2xl" />
              </CardContent>
            </Card>
          ) : profileQuery.isError ? (
            <Card className="rounded-2xl border-destructive/20 bg-destructive/5 shadow-card">
              <CardContent className="space-y-3 p-6">
                <p className="font-semibold text-destructive">Không thể tải hồ sơ cá nhân.</p>
                <p className="text-sm text-muted-foreground">
                  {profileQuery.error instanceof Error ? profileQuery.error.message : "Vui lòng thử tải lại trang."}
                </p>
                <Button variant="outline" onClick={() => profileQuery.refetch()} className="rounded-xl">
                  Tải lại hồ sơ
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-2xl shadow-card">
              <CardContent className="p-0">
                <div className="border-b bg-gradient-to-r from-primary/10 via-background to-accent/20 p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative w-fit">
                      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                        <AvatarImage src={currentAvatar || undefined} />
                        <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarSaving}
                        className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-70"
                        aria-label="Đổi ảnh đại diện"
                      >
                        {avatarSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="min-w-0 max-w-full break-words text-xl font-bold text-foreground">
                          {form.name || "Người học VET"}
                        </h2>
                        <Badge className="rounded-full border-0 bg-primary/10 text-primary">Người học</Badge>
                      </div>
                      <p className="mt-1 min-w-0 max-w-full break-words text-sm text-muted-foreground">{email}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Nhấn biểu tượng camera để đổi ảnh đại diện. Hỗ trợ PNG, JPG, JPEG, WEBP tối đa 5MB.
                      </p>
                    </div>
                  </div>

                  {stats && (
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { icon: Clock, label: "Sắp tới", value: stats.upcoming, color: "text-secondary" },
                        { icon: CheckCircle2, label: "Hoàn thành", value: stats.completed, color: "text-success" },
                        { icon: GraduationCap, label: "Tổng buổi", value: stats.total, color: "text-primary" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border bg-background/80 p-3 text-center shadow-sm">
                          <item.icon className={`mx-auto mb-1 h-5 w-5 ${item.color}`} />
                          <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6 p-6">
                  <ProfileSection
                    icon={<User className="h-4 w-4 text-primary" />}
                    title="Thông tin tài khoản"
                    description="Tên hiển thị và email đăng nhập của bạn trên VET."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Họ và tên" required>
                        <Input
                          value={form.name}
                          onChange={(event) => setField("name", event.target.value)}
                          placeholder="Nhập họ và tên"
                          className="rounded-xl"
                        />
                      </Field>
                      <Field label="Email">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={email} disabled className="rounded-xl bg-muted pl-9" />
                        </div>
                      </Field>
                    </div>
                  </ProfileSection>

                  <Separator />

                  <ProfileSection
                    icon={<Phone className="h-4 w-4 text-primary" />}
                    title="Thông tin liên hệ"
                    description="Số điện thoại là tùy chọn, giúp mentor liên hệ khi cần xác nhận buổi học."
                  >
                    <Field label="Số điện thoại">
                      <Input
                        value={form.phone}
                        onChange={(event) => setField("phone", event.target.value)}
                        placeholder="Ví dụ: 0901 234 567"
                        className="rounded-xl"
                      />
                    </Field>
                  </ProfileSection>

                  <Separator />

                  <ProfileSection
                    icon={<MapPin className="h-4 w-4 text-primary" />}
                    title="Địa chỉ / khu vực học mong muốn"
                    description="Không bắt buộc. VET sẽ dùng thông tin này để gợi ý khóa học offline gần bạn."
                  >
                    <div className="space-y-3">
                      <Field label="Địa chỉ / khu vực học mong muốn">
                        <Input
                          value={form.address}
                          onChange={(event) => setField("address", event.target.value)}
                          placeholder="Ví dụ: Quận 1, TP.HCM hoặc 123 Nguyễn Huệ, Quận 1"
                          className="rounded-xl"
                        />
                      </Field>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant={address ? "outline" : "secondary"}
                          disabled={!address}
                          onClick={goToSearchNearAddress}
                          className="justify-start rounded-xl"
                        >
                          <Search className="mr-2 h-4 w-4" />
                          {address ? "Tìm khóa học gần địa chỉ này" : "Nhập khu vực để tìm gần bạn"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!address}
                          onClick={goToMapNearAddress}
                          className="justify-start rounded-xl"
                        >
                          <Map className="mr-2 h-4 w-4" />
                          Xem trên bản đồ
                        </Button>
                      </div>
                    </div>
                  </ProfileSection>

                  <Separator />

                  <ProfileSection
                    icon={<BookOpen className="h-4 w-4 text-primary" />}
                    title="Giới thiệu bản thân"
                    description="Một vài dòng ngắn giúp mentor hiểu mục tiêu học tập của bạn."
                  >
                    <Field label="Giới thiệu">
                      <Textarea
                        value={form.bio}
                        onChange={(event) => setField("bio", event.target.value)}
                        placeholder="Viết vài dòng về bản thân, mục tiêu học tập hoặc môn bạn đang quan tâm..."
                        className="min-h-32 rounded-xl"
                      />
                    </Field>
                  </ProfileSection>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="gradient-primary gap-2 rounded-xl border-0 text-primary-foreground"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function ProfileSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="pl-0 md:pl-12">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
