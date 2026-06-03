/**
 * Learner profile data access.
 *
 * Keeps the remote learner profile/stats behavior and the local map-location
 * fields used by the nearby course experience.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerProfile {
  user_id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  location_updated_at: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  is_blocked: boolean | null;
  created_at: string | null;
}

export interface UpdateLearnerProfilePayload {
  userId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  previousAddress?: string | null;
}

type UpdateLearnerAvatarPayload =
  | { userId: string; avatarUrl: string; file?: never }
  | { userId: string; file: File; avatarUrl?: never };

const PROFILE_SELECT =
  "user_id, name, username, email, phone, address, district, city, location_updated_at, avatar_url, bio, role, is_blocked, created_at";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const getFileExtension = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension || "jpg";
};

async function uploadLearnerAvatar(userId: string, file: File) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Ảnh đại diện tối đa 5MB.");
  }

  const path = `${userId}/avatar-${Date.now()}.${getFileExtension(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function useLearnerProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["learner-profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return data as LearnerProfile | null;
    },
  });
}

export function useUpdateLearnerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      name,
      phone,
      address,
      district,
      city,
      bio,
      avatar_url,
      previousAddress,
    }: UpdateLearnerProfilePayload) => {
      const normalizedAddress = normalizeOptional(address);
      const normalizedPreviousAddress = normalizeOptional(previousAddress);
      const addressChanged = normalizedAddress !== normalizedPreviousAddress;

      const updates = {
        name: name.trim(),
        phone: normalizeOptional(phone),
        address: normalizedAddress,
        bio: normalizeOptional(bio),
        ...(district !== undefined ? { district: normalizeOptional(district) } : {}),
        ...(city !== undefined ? { city: normalizeOptional(city) } : {}),
        ...(avatar_url !== undefined ? { avatar_url: normalizeOptional(avatar_url) } : {}),
        ...(addressChanged && normalizedAddress ? { location_updated_at: new Date().toISOString() } : {}),
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select(PROFILE_SELECT)
        .single();

      if (error) throw error;
      return data as LearnerProfile;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["learner-profile", variables.userId] });
    },
  });
}

export function useUpdateLearnerAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateLearnerAvatarPayload) => {
      const avatarUrl = "avatarUrl" in payload ? payload.avatarUrl : await uploadLearnerAvatar(payload.userId, payload.file);

      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", payload.userId)
        .select(PROFILE_SELECT)
        .single();

      if (error) throw error;
      return data as LearnerProfile;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["learner-profile", variables.userId] });
    },
  });
}

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

export function useLearnerStats(learnerId: string | undefined) {
  return useQuery({
    queryKey: ["learner-stats", learnerId],
    enabled: Boolean(learnerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("status")
        .eq("learner_id", learnerId!);

      if (error) throw error;

      const bookings = data ?? [];
      return {
        total: bookings.length,
        pending: bookings.filter((booking) => booking.status === "pending").length,
        upcoming: bookings.filter((booking) => booking.status === "upcoming").length,
        completed: bookings.filter((booking) => booking.status === "completed").length,
        cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
      };
    },
  });
}
