import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReportType = Database["public"]["Enums"]["report_type"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];

export type ReportAttachment = {
  id: string;
  report_id: string;
  file_url: string;
  file_path: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
};

export type ReportProfileRef = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
};

export type ReportCourseRef = {
  id: string;
  title: string;
  mentor_id: string;
  category: string;
  image_url: string | null;
};

export type LearnerReport = {
  id: string;
  type: ReportType;
  title: string;
  reason: string;
  detail: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  course_id: string | null;
  booking_id: string | null;
  transaction_id: string | null;
  comment_id: string | null;
  reviewed_target_snapshot: unknown;
  status: ReportStatus;
  admin_verdict: string | null;
  admin_email: string | null;
  resolved_at: string | null;
  created_at: string;
  attachments: ReportAttachment[];
  reported_user: ReportProfileRef | null;
  course: ReportCourseRef | null;
};

export type SubmitReportPayload = {
  type: ReportType;
  title: string;
  reason: string;
  detail: string;
  reporterId: string;
  reportedUserId?: string | null;
  courseId?: string | null;
  bookingId?: string | null;
  transactionId?: string | null;
  commentId?: string | null;
  files?: File[];
};

const REPORT_EVIDENCE_BUCKET = "report-evidence";
const MAX_REPORT_FILES = 5;
const MAX_REPORT_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_REPORT_FILE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const URL_PATTERN = /^https?:\/\//i;

export const reportTypeLabels: Record<ReportType, string> = {
  course: "Khóa học",
  mentor: "Mentor",
  comment: "Bình luận",
  payment: "Thanh toán",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  pending: "Chờ xử lý",
  resolved: "Đã xử lý",
  dismissed: "Bỏ qua",
  appealed: "Đang xem xét lại",
};

export const reportStatusClasses: Record<ReportStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  resolved: "bg-success/10 text-success border-success/20",
  dismissed: "bg-muted text-muted-foreground border-muted",
  appealed: "bg-primary/10 text-primary border-primary/20",
};

function safeFileName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || "evidence";
  const safeBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "evidence";

  return ext ? `${safeBase}.${ext.toLowerCase()}` : safeBase;
}

function validateReportFiles(files: File[] = []) {
  if (files.length > MAX_REPORT_FILES) {
    throw new Error("Bạn chỉ có thể tải lên tối đa 5 ảnh bằng chứng.");
  }

  for (const file of files) {
    if (!ALLOWED_REPORT_FILE_TYPES.has(file.type)) {
      throw new Error("Bằng chứng chỉ hỗ trợ PNG, JPG/JPEG hoặc WEBP.");
    }
    if (file.size > MAX_REPORT_FILE_SIZE) {
      throw new Error("Mỗi ảnh bằng chứng không được vượt quá 5MB.");
    }
  }
}

async function resolveAttachmentUrl(attachment: ReportAttachment): Promise<ReportAttachment> {
  const storedPath = attachment.file_path || attachment.file_url;
  if (!storedPath || URL_PATTERN.test(storedPath)) return attachment;

  const { data } = await supabase.storage
    .from(REPORT_EVIDENCE_BUCKET)
    .createSignedUrl(storedPath, 60 * 60);

  return {
    ...attachment,
    file_path: storedPath,
    file_url: data?.signedUrl ?? attachment.file_url,
  };
}

async function uploadReportAttachments(reportId: string, files: File[]) {
  validateReportFiles(files);
  if (files.length === 0) return [];

  const attachments = [];

  for (const [index, file] of files.entries()) {
    const path = `reports/${reportId}/${Date.now()}-${index}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(REPORT_EVIDENCE_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    attachments.push({
      report_id: reportId,
      file_url: path,
      file_path: path,
      file_type: file.type,
      file_name: file.name,
    });
  }

  const { error } = await supabase.from("report_attachments").insert(attachments);
  if (error) throw error;

  return attachments;
}

export function useSubmitReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitReportPayload) => {
      const title = payload.title.trim();
      const reason = payload.reason.trim();
      const detail = payload.detail.trim();
      const files = payload.files ?? [];

      if (!payload.reporterId) throw new Error("Vui lòng đăng nhập để gửi báo cáo.");
      if (!title) throw new Error("Vui lòng nhập tiêu đề báo cáo.");
      if (!reason) throw new Error("Vui lòng chọn lý do báo cáo.");
      if (detail.length < 20) throw new Error("Nội dung chi tiết cần ít nhất 20 ký tự.");
      if (!["course", "mentor", "comment", "payment"].includes(payload.type)) {
        throw new Error("Loại báo cáo không hợp lệ.");
      }

      validateReportFiles(files);

      const reportedUserId = payload.reportedUserId ?? null;

      if (reportedUserId && reportedUserId === payload.reporterId) {
        throw new Error("Bạn không thể báo cáo chính mình.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Vui lòng đăng nhập để gửi báo cáo.");

      const { data, error } = await supabase.functions.invoke("learner-report-actions", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          action: "create_report",
          type: payload.type,
          title,
          reason,
          detail,
          courseId: payload.courseId,
          reportedUserId: payload.reportedUserId,
          bookingId: payload.bookingId,
          transactionId: payload.transactionId,
          commentId: payload.commentId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const report = data.report;
      await uploadReportAttachments(report.id, files);
      return report;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["learner-reports", variables.reporterId] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });
}

export function useLearnerReports(userId: string | undefined) {
  return useQuery({
    queryKey: ["learner-reports", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: reportRows, error } = await supabase
        .from("reports")
        .select("*")
        .eq("reporter_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = reportRows ?? [];
      if (rows.length === 0) return [] as LearnerReport[];

      const reportIds = rows.map((report) => report.id);
      const courseIds = Array.from(new Set(rows.map((report) => report.course_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set(rows.map((report) => report.reported_user_id).filter(Boolean))) as string[];

      const [attachmentsResult, coursesResult, profilesResult] = await Promise.all([
        supabase
          .from("report_attachments")
          .select("*")
          .in("report_id", reportIds)
          .order("created_at", { ascending: true }),
        courseIds.length
          ? supabase
              .from("courses")
              .select("id, title, mentor_id, category, image_url")
              .in("id", courseIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase
              .from("profiles")
              .select("user_id, name, email, avatar_url, role")
              .in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (attachmentsResult.error) throw attachmentsResult.error;
      if (coursesResult.error) throw coursesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const resolvedAttachments = await Promise.all(
        ((attachmentsResult.data ?? []) as ReportAttachment[]).map(resolveAttachmentUrl),
      );
      const attachmentsByReport = new Map<string, ReportAttachment[]>();
      resolvedAttachments.forEach((attachment) => {
        attachmentsByReport.set(attachment.report_id, [...(attachmentsByReport.get(attachment.report_id) ?? []), attachment]);
      });

      const courseById = new Map((coursesResult.data ?? []).map((course: any) => [course.id, course as ReportCourseRef]));
      const profileById = new Map((profilesResult.data ?? []).map((profile: any) => [profile.user_id, profile as ReportProfileRef]));

      return rows.map((report) => ({
        ...report,
        attachments: attachmentsByReport.get(report.id) ?? [],
        course: report.course_id ? courseById.get(report.course_id) ?? null : null,
        reported_user: report.reported_user_id ? profileById.get(report.reported_user_id) ?? null : null,
      })) as LearnerReport[];
    },
  });
}
