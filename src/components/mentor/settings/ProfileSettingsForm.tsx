import { useEffect, useMemo, useState } from "react";
import { ImageUp, Loader2, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateMentorAvatar,
  useUpdateMentorProfile,
  type MentorProfile,
  type UpdateMentorProfilePayload,
} from "@/hooks/useMentorProfile";

interface ProfileSettingsFormProps {
  profile: MentorProfile;
}

const FIELD_SUGGESTIONS = ["Guitar", "Piano", "IELTS", "Lập trình", "Yoga", "Nấu ăn", "Thiết kế"];

interface FormState {
  name: string;
  avatar_url: string;
  mentor_headline: string;
  bio: string;
  real_name: string;
  phone: string;
  city: string;
  teaching_fields: string[];
  experience_years: string;
  portfolio_url: string;
}

function profileToForm(profile: MentorProfile): FormState {
  return {
    name: profile.name ?? "",
    avatar_url: profile.avatar_url ?? "",
    mentor_headline: profile.mentor_headline ?? "",
    bio: profile.bio ?? "",
    real_name: profile.real_name ?? "",
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    teaching_fields: profile.teaching_fields ?? [],
    experience_years: String(profile.experience_years ?? 0),
    portfolio_url: profile.portfolio_url ?? "",
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateMentorProfile();
  const updateAvatar = useUpdateMentorAvatar();
  const [form, setForm] = useState<FormState>(() => profileToForm(profile));
  const [fieldInput, setFieldInput] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    setForm(profileToForm(profile));
    setAvatarPreview(null);
    setAvatarFileName("");
    setErrors({});
  }, [profile]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const initials = useMemo(() => {
    const name = form.name || form.real_name || "Mentor";
    return name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [form.name, form.real_name]);

  const set = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const addTeachingField = (value: string) => {
    const next = value.trim();
    if (!next) return;

    setForm((current) => {
      if (current.teaching_fields.some((field) => field.toLowerCase() === next.toLowerCase())) {
        return current;
      }
      return { ...current, teaching_fields: [...current.teaching_fields, next] };
    });
    setFieldInput("");
  };

  const removeTeachingField = (value: string) => {
    setForm((current) => ({
      ...current,
      teaching_fields: current.teaching_fields.filter((field) => field !== value),
    }));
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    const experienceYears = Number(form.experience_years);

    if (!form.name.trim()) next.name = "Tên hiển thị là bắt buộc.";
    if (Number.isNaN(experienceYears) || experienceYears < 0) {
      next.experience_years = "Số năm kinh nghiệm phải lớn hơn hoặc bằng 0.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFileName(file.name);
    setErrors((current) => ({ ...current, avatar_url: undefined }));

    try {
      const updatedProfile = await updateAvatar.mutateAsync({ userId: profile.user_id, file });
      set("avatar_url", updatedProfile.avatar_url ?? "");
      toast({ title: "Đã tải ảnh đại diện" });
    } catch (error: unknown) {
      setErrors((current) => ({ ...current, avatar_url: getErrorMessage(error) }));
      toast({
        title: "Không thể tải ảnh đại diện",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: UpdateMentorProfilePayload = {
      userId: profile.user_id,
      name: form.name,
      avatar_url: form.avatar_url,
      mentor_headline: form.mentor_headline,
      bio: form.bio,
      real_name: form.real_name,
      phone: form.phone,
      city: form.city,
      teaching_fields: form.teaching_fields,
      experience_years: Number(form.experience_years),
      portfolio_url: form.portfolio_url,
    };

    try {
      await updateProfile.mutateAsync(payload);
      toast({ title: "Đã lưu hồ sơ mentor" });
    } catch (error: unknown) {
      toast({
        title: "Không thể lưu hồ sơ",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Hồ sơ cá nhân</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Thông tin công khai</h3>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview || form.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-lg text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label>Ảnh đại diện</Label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40">
                  {updateAvatar.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <ImageUp className="h-5 w-5 text-primary" />
                  )}
                  <span className="truncate">
                    {avatarFileName || "Chọn ảnh PNG, JPG, JPEG hoặc WEBP tối đa 5MB"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={updateAvatar.isPending}
                    onChange={(event) => {
                      void handleAvatarChange(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                {errors.avatar_url ? (
                  <p className="text-xs text-destructive">{errors.avatar_url}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ảnh được tải lên Supabase Storage và lưu vào hồ sơ của bạn.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Tên hiển thị <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  className="rounded-xl"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tiêu đề mentor</Label>
                <Input
                  value={form.mentor_headline}
                  onChange={(event) => set("mentor_headline", event.target.value)}
                  placeholder="VD: Mentor Guitar cho người mới bắt đầu"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Giới thiệu bản thân</Label>
                <Textarea
                  value={form.bio}
                  onChange={(event) => set("bio", event.target.value)}
                  rows={5}
                  placeholder="Chia sẻ kinh nghiệm, phong cách giảng dạy và đối tượng học viên phù hợp..."
                  className="rounded-xl"
                />
                <p className={form.bio.trim().length >= 80 ? "text-xs text-success" : "text-xs text-muted-foreground"}>
                  {form.bio.trim().length}/80 ký tự cho checklist xác minh
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Thông tin tin cậy</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Họ tên thật</Label>
                <Input
                  value={form.real_name}
                  onChange={(event) => set("real_name", event.target.value)}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">Khuyến nghị cho hồ sơ xác minh.</p>
              </div>
              <div className="space-y-2">
                <Label>Số điện thoại</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">Khuyến nghị cho hồ sơ xác minh.</p>
              </div>
              <div className="space-y-2">
                <Label>Thành phố</Label>
                <Input
                  value={form.city}
                  onChange={(event) => set("city", event.target.value)}
                  placeholder="TP.HCM, Hà Nội..."
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Số năm kinh nghiệm</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.experience_years}
                  onChange={(event) => set("experience_years", event.target.value)}
                  className="rounded-xl"
                />
                {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Portfolio / website cá nhân</Label>
                <Input
                  value={form.portfolio_url}
                  onChange={(event) => set("portfolio_url", event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Lĩnh vực giảng dạy</Label>
              <div className="flex gap-2">
                <Input
                  value={fieldInput}
                  onChange={(event) => setFieldInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTeachingField(fieldInput);
                    }
                  }}
                  placeholder="Nhập lĩnh vực rồi bấm thêm"
                  className="rounded-xl"
                />
                <Button type="button" variant="outline" onClick={() => addTeachingField(fieldInput)} className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.teaching_fields.map((field) => (
                  <Badge key={field} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                    {field}
                    <button type="button" onClick={() => removeTeachingField(field)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {FIELD_SUGGESTIONS.filter((field) => !form.teaching_fields.includes(field)).map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => addTeachingField(field)}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <Button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-xl border-0 text-primary-foreground gradient-primary"
          >
            {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Lưu hồ sơ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
