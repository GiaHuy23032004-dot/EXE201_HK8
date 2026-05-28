/**
 * useLearnerProfile.ts
 * Toàn bộ logic hồ sơ dành cho Learner
 * - Xem & cập nhật thông tin cá nhân
 * - Upload avatar
 * - Đổi mật khẩu
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerProfile {
  user_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  is_blocked: boolean;
  created_at: string;
}

// ── Lấy profile của learner ───────────────────────────────────────────────────
export function useLearnerProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["learner-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, username, email, phone, avatar_url, bio, role, is_blocked, created_at")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data as LearnerProfile;
    },
  });
}

// ── Cập nhật thông tin cá nhân ────────────────────────────────────────────────
export function useUpdateLearnerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      name,
      phone,
      bio,
    }: {
      userId: string;
      name?: string;
      phone?: string;
      bio?: string;
    }) => {
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone.trim();
      if (bio !== undefined) updates.bio = bio.trim();

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data as LearnerProfile;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["learner-profile", vars.userId] });
    },
  });
}

// ── Upload avatar ─────────────────────────────────────────────────────────────
const AVATAR_BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function useUpdateLearnerAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Chỉ hỗ trợ ảnh JPG, PNG, WebP.");
      }
      if (file.size > MAX_SIZE) {
        throw new Error("Ảnh không được vượt quá 2MB.");
      }

      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId);
      if (updateError) throw updateError;

      return avatarUrl;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["learner-profile", vars.userId] });
    },
  });
}

// ── Đổi mật khẩu ─────────────────────────────────────────────────────────────
export function useChangeLearnerPassword() {
  return useMutation({
    mutationFn: async ({ newPassword }: { newPassword: string }) => {
      if (newPassword.length < 6) {
        throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}

// ── Thống kê học viên ─────────────────────────────────────────────────────────
export function useLearnerStats(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-stats", learnerId],
    enabled: !!learnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("status")
        .eq("learner_id", learnerId!);
      if (error) throw error;

      const bookings = data ?? [];
      return {
        total: bookings.length,
        pending: bookings.filter((b) => b.status === "pending").length,
        upcoming: bookings.filter((b) => b.status === "upcoming").length,
        completed: bookings.filter((b) => b.status === "completed").length,
        cancelled: bookings.filter((b) => b.status === "cancelled").length,
      };
    },
  });
}
