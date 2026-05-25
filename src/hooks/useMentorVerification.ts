import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MentorProfile } from "@/hooks/useMentorProfile";
import {
  isValidProofItem,
  type MentorVerificationProof,
} from "@/hooks/useMentorVerificationProofs";

export type MentorVerificationStatus = "unverified" | "draft" | "pending" | "approved" | "rejected";

export interface MentorVerification {
  id: string;
  mentor_id: string;
  status: MentorVerificationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileChecklistItem {
  key: string;
  label: string;
  complete: boolean;
}

export interface VerificationCompletion {
  profileItems: ProfileChecklistItem[];
  profileComplete: boolean;
  completedProfileItems: number;
  totalProfileItems: number;
  distinctProofTypes: number;
  validProofCount: number;
  proofsComplete: boolean;
  canSubmit: boolean;
}

interface VerificationQueryResult {
  profile: MentorProfile;
  verification: MentorVerification;
  completion: VerificationCompletion;
}

const VALID_STATUSES: MentorVerificationStatus[] = [
  "unverified",
  "draft",
  "pending",
  "approved",
  "rejected",
];
const SUBMITTABLE_STATUSES: MentorVerificationStatus[] = ["unverified", "draft", "rejected"];

function devLog(label: string, value: unknown) {
  if (import.meta.env.DEV) {
    console.log(label, value);
  }
}

function devLogError(label: string, value: unknown) {
  if (import.meta.env.DEV) {
    console.log(label, value);
  }
}

function normalizeVerificationStatus(status: string | null | undefined): MentorVerificationStatus {
  return VALID_STATUSES.includes(status as MentorVerificationStatus)
    ? (status as MentorVerificationStatus)
    : "unverified";
}

function toSafeVerification(
  row: Partial<MentorVerification> & { mentor_id?: string },
  userId: string,
): MentorVerification {
  return {
    id: row.id ?? "",
    mentor_id: row.mentor_id ?? userId,
    status: normalizeVerificationStatus(row.status),
    submitted_at: row.submitted_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    admin_note: row.admin_note ?? null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function buildProfileChecklist(profile: MentorProfile): ProfileChecklistItem[] {
  return [
    {
      key: "real_name",
      label: "Họ tên thật",
      complete: Boolean(profile.real_name?.trim() || profile.name?.trim()),
    },
    { key: "avatar_url", label: "Ảnh đại diện", complete: Boolean(profile.avatar_url?.trim()) },
    { key: "phone", label: "Số điện thoại", complete: Boolean(profile.phone?.trim()) },
    {
      key: "bio",
      label: "Bio từ 80 ký tự trở lên",
      complete: (profile.bio?.trim().length ?? 0) >= 80,
    },
    {
      key: "teaching_fields",
      label: "Lĩnh vực giảng dạy",
      complete: (profile.teaching_fields?.length ?? 0) >= 1,
    },
    {
      key: "experience_years",
      label: "Số năm kinh nghiệm",
      complete: profile.experience_years !== null && profile.experience_years >= 0,
    },
  ];
}

function buildCompletion(
  profile: MentorProfile,
  proofs: MentorVerificationProof[],
  status: MentorVerificationStatus,
): VerificationCompletion {
  const profileItems = buildProfileChecklist(profile);
  const validProofs = proofs.filter(isValidProofItem);
  const distinctProofTypes = new Set(validProofs.map((proof) => proof.proof_type)).size;
  const validProofCount = validProofs.length;
  const profileComplete = profileItems.every((item) => item.complete);
  const proofsComplete = distinctProofTypes >= 2;

  return {
    profileItems,
    profileComplete,
    completedProfileItems: profileItems.filter((item) => item.complete).length,
    totalProfileItems: profileItems.length,
    distinctProofTypes,
    validProofCount,
    proofsComplete,
    canSubmit: profileComplete && proofsComplete && SUBMITTABLE_STATUSES.includes(status),
  };
}

async function fetchProfile(userId: string) {
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
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data as MentorProfile;
}

async function getVerificationRow(userId: string) {
  const { data, error } = await supabase
    .from("mentor_verifications")
    .select("*")
    .eq("mentor_id", userId)
    .maybeSingle();

  devLog("mentor verification", data);
  if (error) devLogError("verification error", error);

  if (error) throw error;
  return data ? toSafeVerification(data as MentorVerification, userId) : null;
}

async function ensureVerification(userId: string, profile: MentorProfile) {
  const existing = await getVerificationRow(userId);
  if (existing) return existing;

  if (profile.role !== "mentor") {
    return toSafeVerification({ mentor_id: userId, status: "unverified" }, userId);
  }

  const { data: created, error } = await supabase
    .from("mentor_verifications")
    .insert({ mentor_id: userId, status: "unverified" })
    .select("*")
    .single();

  if (error) {
    devLogError("verification error", error);
    const refetched = await getVerificationRow(userId);
    if (refetched) return refetched;
    throw error;
  }

  devLog("mentor verification", created);
  return (await getVerificationRow(userId)) ?? toSafeVerification(created as MentorVerification, userId);
}

async function fetchVerificationContext(userId: string): Promise<VerificationQueryResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const currentUserId = authData.user?.id;
  if (!currentUserId) throw new Error("Vui lòng đăng nhập.");

  const profile = await fetchProfile(currentUserId);
  devLog("mentor profile", profile);

  const verification = await ensureVerification(currentUserId, profile);

  const { data: proofs, error: proofError } = await supabase
    .from("mentor_verification_proofs")
    .select("id, mentor_id, proof_type, title, url, file_path, description, metadata, created_at, updated_at")
    .eq("mentor_id", currentUserId);

  if (proofError) {
    devLogError("verification error", proofError);
  }

  return {
    profile,
    verification,
    completion: buildCompletion(profile, (proofs ?? []) as MentorVerificationProof[], verification.status),
  };
}

export function useMentorVerification(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mentor-verification", userId],
    enabled: !!userId,
    queryFn: () => fetchVerificationContext(userId!),
  });

  const submitVerification = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      const context = await fetchVerificationContext(userId);
      const currentUserId = context.profile.user_id;

      if (!context.completion.profileComplete) {
        throw new Error("Hồ sơ của bạn chưa đủ điều kiện gửi xác minh.");
      }
      if (!context.completion.proofsComplete) {
        throw new Error("Bạn cần thêm ít nhất 2 bằng chứng hợp lệ.");
      }
      if (!SUBMITTABLE_STATUSES.includes(context.verification.status)) {
        throw new Error("Trạng thái hồ sơ hiện tại không thể gửi xác minh.");
      }

      const { data, error } = await supabase
        .from("mentor_verifications")
        .update({ status: "pending", submitted_at: new Date().toISOString() })
        .eq("mentor_id", currentUserId)
        .in("status", SUBMITTABLE_STATUSES)
        .select("*")
        .single();

      if (error) throw error;
      return toSafeVerification(data as MentorVerification, currentUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification-proofs", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-profile", userId] });
    },
  });

  return {
    ...query,
    profile: query.data?.profile,
    verification: query.data?.verification,
    status: query.data?.verification.status ?? "unverified",
    isVerified: query.data?.verification.status === "approved",
    checklist: query.data?.completion,
    canSubmit: query.data?.completion.canSubmit ?? false,
    loading: query.isLoading,
    error: query.error,
    submitVerification,
  };
}

export const VERIFICATION_STATUS_LABELS: Record<MentorVerificationStatus, string> = {
  unverified: "Chưa xác minh",
  draft: "Đang bổ sung",
  pending: "Đang chờ duyệt",
  approved: "Đã xác minh",
  rejected: "Cần bổ sung",
};
