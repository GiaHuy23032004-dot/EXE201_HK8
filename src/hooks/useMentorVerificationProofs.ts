import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { MentorVerificationStatus } from "@/hooks/useMentorVerification";

export type ProofType = "social" | "certificate" | "portfolio" | "teaching_evidence";
export type StoredProofType = ProofType | string;

export type SocialPlatform =
  | "linkedin"
  | "facebook_page"
  | "youtube"
  | "tiktok"
  | "github"
  | "behance"
  | "personal_website"
  | "other";

export interface ProofMetadata {
  type?: ProofType;
  platform?: SocialPlatform | string;
  title?: string;
  issuer?: string;
  issued_year?: number;
  url?: string;
  file_url?: string;
  description?: string;
}

export interface MentorVerificationProof {
  id: string;
  verification_id: string;
  mentor_id: string;
  proof_type: StoredProofType;
  title: string;
  url: string | null;
  file_path: string | null;
  description: string | null;
  issuer: string | null;
  issued_year: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  file_mime_type: string | null;
  metadata: ProofMetadata | null;
  status?: string;
  review_status?: string;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofFormValues {
  proof_type: ProofType | "";
  platform: SocialPlatform | "";
  title: string;
  issuer: string;
  issued_year: string;
  url: string;
  description: string;
  file?: File | null;
}

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  social: "Mạng xã hội nghề nghiệp",
  certificate: "Chứng chỉ / bằng cấp",
  portfolio: "Portfolio / sản phẩm cá nhân",
  teaching_evidence: "Minh chứng giảng dạy",
};

export const PROOF_TYPE_EXAMPLES: Record<ProofType, string> = {
  social: "Chọn nền tảng nghề nghiệp và dán URL hồ sơ hoặc kênh nội dung của bạn.",
  certificate: "Tải lên chứng chỉ, bằng cấp hoặc tài liệu chuyên môn có liên quan.",
  portfolio: "Thêm URL portfolio hoặc tải lên sản phẩm cá nhân tiêu biểu.",
  teaching_evidence: "Thêm hình ảnh, video URL, tài liệu giảng dạy hoặc phản hồi học viên cũ.",
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  facebook_page: "Facebook Page",
  youtube: "YouTube",
  tiktok: "TikTok",
  github: "GitHub",
  behance: "Behance",
  personal_website: "Personal Website",
  other: "Other",
};

export const SUPPORTED_PROOF_TYPES: ProofType[] = ["social", "certificate", "portfolio", "teaching_evidence"];

const IMAGE_AND_PDF_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024;
const EDITABLE_STATUSES: MentorVerificationStatus[] = ["unverified", "draft", "revision_requested", "rejected"];

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadata(value: Json | ProofMetadata | null | undefined): ProofMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ProofMetadata;
}

export function isEditableVerificationStatus(status: MentorVerificationStatus | undefined) {
  return !status || EDITABLE_STATUSES.includes(status);
}

export function isSupportedProofType(value: string | null | undefined): value is ProofType {
  return SUPPORTED_PROOF_TYPES.includes(value as ProofType);
}

export function isValidUrl(value: string | null | undefined) {
  const url = normalizeString(value);
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidProofItem(proof: Pick<MentorVerificationProof, "proof_type" | "title" | "url" | "file_path" | "metadata">) {
  if (!isSupportedProofType(proof.proof_type)) return false;

  const metadata = proof.metadata ?? {};
  const url = metadata.url ?? proof.url;
  const filePath = metadata.file_url ?? proof.file_path;
  const title = metadata.title ?? proof.title;

  if (proof.proof_type === "certificate") {
    return Boolean(title?.trim()) && Boolean(filePath);
  }

  return Boolean(filePath) || isValidUrl(url);
}

function assertEditable(status: MentorVerificationStatus | undefined) {
  if (!isEditableVerificationStatus(status)) {
    throw new Error("Bạn không thể chỉnh sửa bằng chứng khi hồ sơ đang chờ duyệt hoặc đã được xác minh.");
  }
}

function getMaxFileSize(type: ProofType) {
  return MAX_PROOF_FILE_SIZE;
}

function validateFile(file: File, type: ProofType) {
  if (type === "social") {
    throw new Error("Mạng xã hội nghề nghiệp chỉ cần URL, không cần tải tệp.");
  }
  if (!IMAGE_AND_PDF_TYPES.includes(file.type)) {
    throw new Error("Chỉ hỗ trợ PNG, JPG, JPEG, WEBP hoặc PDF.");
  }
  if (file.size > getMaxFileSize(type)) {
    throw new Error("Tệp bằng chứng không được vượt quá 5MB.");
  }
}

function normalizeSupabaseError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error;
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message?: unknown }).message || fallback));
  }
  return new Error(fallback);
}

function safeFileName(fileName: string) {
  const parts = fileName.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || "proof";
  const safeBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "proof";
  return ext ? `${safeBase}.${ext.toLowerCase()}` : safeBase;
}

async function markDraftIfAllowed(userId: string) {
  const { data, error } = await supabase
    .from("mentor_verifications")
    .select("id, status")
    .eq("mentor_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data && (data.status === "pending" || data.status === "approved")) return;

  if (data) {
    const { error: updateError } = await supabase
      .from("mentor_verifications")
      .update({ status: "draft" })
      .eq("mentor_id", userId);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from("mentor_verifications")
    .insert({ mentor_id: userId, status: "draft" });
  if (insertError) throw insertError;
}

async function ensureMentorVerification(userId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw normalizeSupabaseError(authError, "Không thể xác thực người dùng.");
  if (!authData.user?.id) throw new Error("Vui lòng đăng nhập.");
  if (authData.user.id !== userId) throw new Error("Bạn không thể gửi bằng chứng cho mentor khác.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw normalizeSupabaseError(profileError, "Không thể tải hồ sơ mentor.");
  if (profile?.role !== "mentor") throw new Error("Chỉ mentor mới có thể gửi xác minh.");

  const { data: verification, error: verificationError } = await supabase
    .from("mentor_verifications")
    .select("id, mentor_id, status")
    .eq("mentor_id", userId)
    .maybeSingle();

  if (verificationError) throw normalizeSupabaseError(verificationError, "Không thể tải hồ sơ xác minh.");
  if (verification?.id) return verification;

  const { data: created, error: createError } = await supabase
    .from("mentor_verifications")
    .insert({ mentor_id: userId, status: "unverified" })
    .select("id, mentor_id, status")
    .single();

  if (createError) {
    console.error("Ensure verification row error:", createError);
    const { data: refetched, error: refetchError } = await supabase
      .from("mentor_verifications")
      .select("id, mentor_id, status")
      .eq("mentor_id", userId)
      .maybeSingle();
    if (!refetchError && refetched?.id) return refetched;
    throw normalizeSupabaseError(createError, "Không thể tạo hồ sơ xác minh.");
  }

  return created;
}

async function uploadProofFile(userId: string, type: ProofType, file: File) {
  validateFile(file, type);
  const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from("mentor-verification")
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Upload proof file error:", error);
    throw normalizeSupabaseError(error, "Không thể tải tệp bằng chứng.");
  }
  return path;
}

function normalizeIssuedYear(value: string) {
  if (!value.trim()) return null;
  const year = Number(value);
  if (!Number.isInteger(year)) throw new Error("Năm cấp phải là số.");
  return year;
}

function validateProof(values: ProofFormValues, filePath?: string | null) {
  if (!values.proof_type || !isSupportedProofType(values.proof_type)) {
    throw new Error("Vui lòng chọn loại bằng chứng.");
  }
  if (!values.title.trim() && values.proof_type !== "social") {
    throw new Error("Vui lòng nhập tiêu đề bằng chứng.");
  }

  const url = normalizeString(values.url);

  if (values.proof_type === "social") {
    if (!url) throw new Error("URL là bắt buộc với mạng xã hội nghề nghiệp.");
    if (!isValidUrl(url)) throw new Error("URL không hợp lệ.");
    return;
  }

  if (values.proof_type === "certificate") {
    if (!url && !values.file && !filePath) throw new Error("Vui lòng nhập URL hoặc tải lên tệp bằng chứng.");
    if (url && !isValidUrl(url)) throw new Error("URL xác thực không hợp lệ.");
    normalizeIssuedYear(values.issued_year);
    return;
  }

  if (url && !isValidUrl(url)) throw new Error("URL không hợp lệ.");
  normalizeIssuedYear(values.issued_year);
  if (!url && !values.file && !filePath) {
    throw new Error("Vui lòng nhập URL hoặc tải lên tệp bằng chứng.");
  }
}

function getStoredTitle(values: ProofFormValues, filePath?: string | null) {
  if (values.proof_type === "social" && values.platform) {
    return SOCIAL_PLATFORM_LABELS[values.platform] ?? "Mạng xã hội nghề nghiệp";
  }
  if (values.proof_type === "social") return "Mạng xã hội nghề nghiệp";
  if (values.title.trim()) return values.title.trim();
  if (normalizeString(values.url)) {
    return values.proof_type === "teaching_evidence" ? "Minh chứng giảng dạy" : "Portfolio / sản phẩm cá nhân";
  }
  if (filePath) return safeFileName(filePath.split("/").pop() ?? filePath);
  return "Bằng chứng xác minh";
}

function buildMetadata(values: ProofFormValues, filePath: string | null): ProofMetadata {
  const issuedYear = normalizeIssuedYear(values.issued_year);
  return {
    type: values.proof_type || undefined,
    platform: values.proof_type === "social" ? values.platform || undefined : undefined,
    title: normalizeString(values.title) ?? undefined,
    issuer: values.proof_type === "certificate" ? normalizeString(values.issuer) ?? undefined : undefined,
    issued_year: values.proof_type === "certificate" && issuedYear ? issuedYear : undefined,
    url: normalizeString(values.url) ?? undefined,
    file_url: filePath ?? undefined,
    description: normalizeString(values.description) ?? undefined,
  };
}

function normalizeProof(row: MentorVerificationProof): MentorVerificationProof {
  return {
    ...row,
    metadata: normalizeMetadata(row.metadata),
  };
}

export function useMentorVerificationProofs(
  userId: string | undefined,
  verificationStatus: MentorVerificationStatus | undefined,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mentor-verification-proofs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_verification_proofs")
        .select("*")
        .eq("mentor_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as MentorVerificationProof[]).map(normalizeProof);
    },
  });

  const createProof = useMutation({
    mutationFn: async (values: ProofFormValues) => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      assertEditable(verificationStatus);
      validateProof(values);

      const verification = await ensureMentorVerification(userId);
      const filePath = values.file && values.proof_type ? await uploadProofFile(userId, values.proof_type, values.file) : null;
      const metadata = buildMetadata(values, filePath);
      const issuedYear = normalizeIssuedYear(values.issued_year);
      const selectedFile = values.file ?? null;

      const { data, error } = await supabase
        .from("mentor_verification_proofs")
        .insert({
          verification_id: verification.id,
          mentor_id: userId,
          proof_type: values.proof_type as ProofType,
          title: getStoredTitle(values, filePath),
          url: normalizeString(values.url),
          file_path: filePath,
          description: normalizeString(values.description),
          issuer: normalizeString(values.issuer),
          issued_year: issuedYear,
          file_name: selectedFile?.name ?? null,
          file_size_bytes: selectedFile?.size ?? null,
          file_mime_type: selectedFile?.type ?? null,
          metadata: metadata as Json,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Insert proof error:", error);
        if (filePath) {
          await supabase.storage.from("mentor-verification").remove([filePath]);
        }
        throw normalizeSupabaseError(error, "Không thể lưu bằng chứng.");
      }
      await markDraftIfAllowed(userId);
      return normalizeProof(data as MentorVerificationProof);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-verification-proofs", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", userId] });
    },
  });

  const updateProof = useMutation({
    mutationFn: async ({ id, values, currentFilePath }: {
      id: string;
      values: ProofFormValues;
      currentFilePath?: string | null;
    }) => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      assertEditable(verificationStatus);

      const canKeepCurrentFile = values.proof_type === "certificate" || values.proof_type === "portfolio";
      const retainedFilePath = canKeepCurrentFile ? currentFilePath ?? null : null;
      validateProof(values, retainedFilePath);

      const filePath = values.file && values.proof_type
        ? await uploadProofFile(userId, values.proof_type, values.file)
        : retainedFilePath;
      const metadata = buildMetadata(values, filePath);
      const issuedYear = normalizeIssuedYear(values.issued_year);
      const fileUpdates = values.file
        ? {
            file_name: values.file.name,
            file_size_bytes: values.file.size,
            file_mime_type: values.file.type,
          }
        : filePath
          ? {}
          : {
              file_name: null,
              file_size_bytes: null,
              file_mime_type: null,
            };

      const { data, error } = await supabase
        .from("mentor_verification_proofs")
        .update({
          proof_type: values.proof_type as ProofType,
          title: getStoredTitle(values, filePath),
          url: normalizeString(values.url),
          file_path: filePath,
          description: normalizeString(values.description),
          issuer: normalizeString(values.issuer),
          issued_year: issuedYear,
          ...fileUpdates,
          metadata: metadata as Json,
        })
        .eq("id", id)
        .eq("mentor_id", userId)
        .select("*")
        .single();

      if (error) {
        console.error("Update proof error:", error);
        if (values.file && filePath && filePath !== currentFilePath) {
          await supabase.storage.from("mentor-verification").remove([filePath]);
        }
        throw normalizeSupabaseError(error, "Không thể lưu bằng chứng.");
      }

      if (currentFilePath && currentFilePath !== filePath && (!verificationStatus || EDITABLE_STATUSES.includes(verificationStatus))) {
        const { error: storageError } = await supabase.storage
          .from("mentor-verification")
          .remove([currentFilePath]);
        if (storageError) throw storageError;
      }

      await markDraftIfAllowed(userId);
      return normalizeProof(data as MentorVerificationProof);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-verification-proofs", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", userId] });
    },
  });

  const deleteProof = useMutation({
    mutationFn: async (proof: MentorVerificationProof) => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      assertEditable(verificationStatus);

      const { error } = await supabase
        .from("mentor_verification_proofs")
        .delete()
        .eq("id", proof.id)
        .eq("mentor_id", userId);

      if (error) throw error;

      if (proof.file_path && (!verificationStatus || EDITABLE_STATUSES.includes(verificationStatus))) {
        const { error: storageError } = await supabase.storage
          .from("mentor-verification")
          .remove([proof.file_path]);
        if (storageError) throw storageError;
      }

      await markDraftIfAllowed(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor-verification-proofs", userId] });
      queryClient.invalidateQueries({ queryKey: ["mentor-verification", userId] });
    },
  });

  return {
    ...query,
    createProof,
    updateProof,
    deleteProof,
  };
}
