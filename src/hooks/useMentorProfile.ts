import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MentorProfile {
  user_id: string;
  role: string | null;
  name: string | null;
  real_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  mentor_headline: string | null;
  bio: string | null;
  teaching_fields: string[] | null;
  experience_years: number | null;
  portfolio_url: string | null;
}

export interface UpdateMentorProfilePayload {
  userId: string;
  name: string | null;
  real_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  mentor_headline: string | null;
  bio: string | null;
  teaching_fields: string[];
  experience_years: number | null;
  portfolio_url: string | null;
}

const AVATAR_BUCKET = "avatars";
const AVATAR_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function safeFileName(fileName: string) {
  const parts = fileName.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || "avatar";
  const safeBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "avatar";
  return ext ? `${safeBase}.${ext.toLowerCase()}` : safeBase;
}

function validateAvatarFile(file: File) {
  if (!AVATAR_FILE_TYPES.includes(file.type)) {
    throw new Error("Ảnh đại diện chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.");
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Ảnh đại diện không được vượt quá 5MB.");
  }
}

async function uploadAvatarFile(userId: string, file: File) {
  validateAvatarFile(file);
  const path = `${userId}/avatar-${Date.now()}-${safeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl || path;
}

export function useMentorProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["mentor-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id,
          role,
          name,
          real_name,
          email,
          avatar_url,
          phone,
          city,
          mentor_headline,
          bio,
          teaching_fields,
          experience_years,
          portfolio_url
        `)
        .eq("user_id", userId!)
        .single();

      if (error) throw error;
      return data as MentorProfile;
    },
  });
}

export function useUpdateMentorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      ...payload
    }: UpdateMentorProfilePayload) => {
      const experienceYears = payload.experience_years ?? 0;
      if (experienceYears < 0) {
        throw new Error("Số năm kinh nghiệm phải lớn hơn hoặc bằng 0.");
      }

      const updates = {
        name: normalizeString(payload.name),
        real_name: normalizeString(payload.real_name),
        avatar_url: normalizeString(payload.avatar_url),
        phone: normalizeString(payload.phone),
        city: normalizeString(payload.city),
        mentor_headline: normalizeString(payload.mentor_headline),
        bio: normalizeString(payload.bio),
        teaching_fields: payload.teaching_fields,
        experience_years: experienceYears,
        portfolio_url: normalizeString(payload.portfolio_url),
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select(`
          user_id,
          role,
          name,
          real_name,
          email,
          avatar_url,
          phone,
          city,
          mentor_headline,
          bio,
          teaching_fields,
          experience_years,
          portfolio_url
        `)
        .single();

      if (error) throw error;
      return data as MentorProfile;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-profile", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", variables.userId] });
    },
  });
}

export function useUpdateMentorAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const avatarUrl = await uploadAvatarFile(userId, file);

      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId)
        .select(`
          user_id,
          role,
          name,
          real_name,
          email,
          avatar_url,
          phone,
          city,
          mentor_headline,
          bio,
          teaching_fields,
          experience_years,
          portfolio_url
        `)
        .single();

      if (error) throw error;
      return data as MentorProfile;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mentor-profile", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", variables.userId] });
    },
  });
}
