import { useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  type DecisionAction,
  type ProfileRef,
  type ProofStatus,
  type VerificationProof,
  type VerificationRequest,
  type VerificationStatus,
  useAdminMentorVerificationApi,
  useAdminMentorVerificationRequests,
} from "@/hooks/useAdminMentorVerifications";

type NoteDialogState =
  | {
      kind: "proof";
      title: string;
      proof: VerificationProof;
      reviewStatus: ProofStatus;
      noteRequired: boolean;
    }
  | {
      kind: "decision";
      title: string;
      action: DecisionAction;
    };

const filters: Array<{ value: VerificationStatus; label: string }> = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã xác minh" },
  { value: "revision_requested", label: "Cần bổ sung" },
  { value: "rejected", label: "Bị từ chối" },
  { value: "revoked", label: "Đã thu hồi" },
];

const statusLabels: Record<string, string> = {
  pending: "Đang chờ duyệt",
  approved: "Đã xác minh",
  revision_requested: "Cần bổ sung",
  revision_required: "Cần bổ sung",
  rejected: "Bị từ chối",
  revoked: "Đã thu hồi",
  draft: "Đang bổ sung",
  unverified: "Chưa xác minh",
};

const proofStatusLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  revision_requested: "Cần bổ sung",
  revision_required: "Cần bổ sung",
  rejected: "Từ chối",
};

const proofTypeLabels: Record<string, string> = {
  social: "Mạng xã hội",
  certificate: "Chứng chỉ / bằng cấp",
  portfolio: "Portfolio",
  teaching_evidence: "Minh chứng giảng dạy",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";

const normalizeStatus = (status?: string | null) =>
  status === "revision_required" ? "revision_requested" : status || "pending";

const safeText = "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]";

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const tone =
    normalized === "approved"
      ? "border-success/20 bg-success/10 text-success"
      : normalized === "pending"
        ? "border-warning/20 bg-warning/10 text-warning"
        : normalized === "revision_requested"
          ? "border-primary/20 bg-primary/10 text-primary"
          : normalized === "revoked" || normalized === "rejected"
            ? "border-destructive/20 bg-destructive/10 text-destructive"
            : "border-border bg-muted text-muted-foreground";

  return <Badge variant="outline" className={`rounded-full ${tone}`}>{statusLabels[normalized] ?? normalized}</Badge>;
}

function ProofStatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status);
  const tone =
    normalized === "approved"
      ? "border-success/20 bg-success/10 text-success"
      : normalized === "revision_requested"
        ? "border-primary/20 bg-primary/10 text-primary"
        : normalized === "rejected"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-warning/20 bg-warning/10 text-warning";

  return <Badge variant="outline" className={`rounded-full ${tone}`}>{proofStatusLabels[normalized] ?? normalized}</Badge>;
}

function buildChecklist(profile: ProfileRef | null) {
  return [
    { label: "Họ tên thật", complete: Boolean(profile?.real_name?.trim() || profile?.name?.trim()) },
    { label: "Ảnh đại diện", complete: Boolean(profile?.avatar_url?.trim()) },
    { label: "Số điện thoại", complete: Boolean(profile?.phone?.trim()) },
    { label: "Bio từ 80 ký tự trở lên", complete: (profile?.bio?.trim().length ?? 0) >= 80 },
    { label: "Lĩnh vực giảng dạy", complete: (profile?.teaching_fields?.length ?? 0) > 0 },
    { label: "Số năm kinh nghiệm", complete: profile?.experience_years !== null && profile?.experience_years !== undefined && Number(profile.experience_years) >= 0 },
  ];
}

function getInitials(name?: string | null) {
  return (name || "VET").slice(0, 2).toUpperCase();
}

export default function AdminMentorVerifications() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<VerificationStatus>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<NoteDialogState | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [bioExpanded, setBioExpanded] = useState(false);
  const { invokeAction, refreshVerificationQueries } = useAdminMentorVerificationApi();
  const { data: requests = [], isLoading, isError, error, refetch } = useAdminMentorVerificationRequests(filter);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      [
        request.profile?.name,
        request.profile?.email,
        request.profile?.phone,
        request.profile?.real_name,
        request.profile?.mentor_headline,
        ...(request.profile?.teaching_fields ?? []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [requests, search]);

  const openDetail = async (mentorId: string) => {
    setDetailLoadingId(mentorId);
    try {
      const data = await invokeAction({ action: "get_detail", mentorId });
      setSelected(data.request as VerificationRequest);
      setBioExpanded(false);
    } catch (error) {
      toast({ title: "Lỗi", description: error instanceof Error ? error.message : "Không thể tải hồ sơ.", variant: "destructive" });
    } finally {
      setDetailLoadingId(null);
    }
  };

  const runAction = async (body: Record<string, unknown>, successTitle: string) => {
    if (!selected) return;
    setActionLoading(String(body.action));
    try {
      const data = await invokeAction({ mentorId: selected.mentor_id, ...body });
      await refreshVerificationQueries();
      setSelected(data.request as VerificationRequest);
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xử lý.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const requirements = selected ? getApprovalRequirements(selected) : null;

  const approveVerification = async () => {
    if (!selected || !requirements) return;
    if (!requirements.canApprove) {
      toast({ title: "Mentor chưa đủ điều kiện xác minh.", variant: "destructive" });
      return;
    }
    await runAction({ action: "approve_verification", note: "Đã duyệt hồ sơ xác minh." }, "Đã duyệt xác minh mentor.");
  };

  const submitNoteDialog = async () => {
    if (!noteDialog) return;
    if (!noteValue.trim()) {
      toast({ title: "Vui lòng nhập ghi chú.", variant: "destructive" });
      return;
    }

    if (noteDialog.kind === "proof") {
      await runAction({
        action: "review_evidence",
        proofId: noteDialog.proof.id,
        reviewStatus: noteDialog.reviewStatus,
        note: noteValue.trim(),
      }, noteDialog.reviewStatus === "rejected" ? "Đã từ chối bằng chứng." : "Đã yêu cầu bổ sung bằng chứng.");
    } else {
      const success =
        noteDialog.action === "request_revision"
          ? "Đã gửi yêu cầu bổ sung cho mentor."
          : noteDialog.action === "reject_verification"
            ? "Đã từ chối xác minh mentor."
            : "Đã thu hồi xác minh mentor.";
      await runAction({ action: noteDialog.action, reason: noteValue.trim() }, success);
    }

    setNoteDialog(null);
    setNoteValue("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Mentor Verification</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Duyệt hồ sơ mentor, kiểm tra bằng chứng và quyết định trạng thái xác minh.
        </p>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Tìm theo tên, email, số điện thoại, lĩnh vực..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button
                  key={item.value}
                  variant={filter === item.value ? "default" : "outline"}
                  size="sm"
                  className={`rounded-xl ${filter === item.value ? "gradient-primary border-0 text-primary-foreground" : ""}`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Không thể tải danh sách xác minh</p>
          <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Vui lòng thử lại."}</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void refetch()}>Thử lại</Button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-card">
          <UserCheck className="mb-3 h-12 w-12 text-muted" />
          <p className="font-semibold text-foreground">Không có hồ sơ phù hợp</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="rounded-2xl shadow-card">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <Avatar className="h-14 w-14 rounded-2xl">
                    <AvatarImage src={request.profile?.avatar_url || undefined} />
                    <AvatarFallback className="rounded-2xl">{getInitials(request.profile?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={`font-semibold text-foreground ${safeText}`}>{request.profile?.name || "Mentor chưa có tên"}</h2>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className={`mt-1 text-sm text-muted-foreground ${safeText}`}>{request.profile?.email || "Chưa có email"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Gửi: {formatDate(request.submitted_at)}</Badge>
                      <Badge variant="outline">{request.evidence_count ?? request.proofs?.length ?? 0} bằng chứng</Badge>
                      <Badge variant="outline">{request.approved_proof_count ?? request.proofs?.filter((proof) => normalizeStatus(proof.status || proof.review_status) === "approved").length ?? 0} đã duyệt</Badge>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-xl" onClick={() => void openDetail(request.mentor_id)}>
                    {detailLoadingId === request.mentor_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    Xem chi tiết
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-[1200px] overflow-y-auto overflow-x-hidden rounded-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Chi tiết xác minh Mentor
                  <StatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-5">
                  <ProfileSummaryCard
                    request={selected}
                    bioExpanded={bioExpanded}
                    onToggleBio={() => setBioExpanded((current) => !current)}
                  />
                  <ProfileChecklistCard profile={selected.profile} />
                  <ProofList
                    proofs={selected.proofs ?? []}
                    actionLoading={actionLoading}
                    onApprove={(proof) => void runAction({
                      action: "review_evidence",
                      proofId: proof.id,
                      reviewStatus: "approved",
                      note: proof.admin_note || "",
                    }, "Đã duyệt bằng chứng.")}
                    onNeedsRevision={(proof) => {
                      setNoteDialog({ kind: "proof", title: "Yêu cầu bổ sung bằng chứng", proof, reviewStatus: "revision_requested", noteRequired: true });
                      setNoteValue(proof.admin_note || "");
                    }}
                    onReject={(proof) => {
                      setNoteDialog({ kind: "proof", title: "Từ chối bằng chứng", proof, reviewStatus: "rejected", noteRequired: true });
                      setNoteValue(proof.admin_note || "");
                    }}
                    onAddNote={(proof) => {
                      setNoteDialog({ kind: "proof", title: "Ghi chú bằng chứng", proof, reviewStatus: normalizeStatus(proof.status || proof.review_status) as ProofStatus, noteRequired: true });
                      setNoteValue(proof.admin_note || "");
                    }}
                  />
                </div>

                <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
                  <PublicPreview request={selected} />
                  <DecisionPanel
                    request={selected}
                    requirements={requirements}
                    actionLoading={actionLoading}
                    onApprove={() => void approveVerification()}
                    onRequestRevision={() => {
                      setNoteDialog({ kind: "decision", title: "Yêu cầu bổ sung hồ sơ", action: "request_revision" });
                      setNoteValue(selected.admin_note || "");
                    }}
                    onReject={() => {
                      setNoteDialog({ kind: "decision", title: "Từ chối xác minh mentor", action: "reject_verification" });
                      setNoteValue(selected.admin_note || "");
                    }}
                    onRevoke={() => {
                      setNoteDialog({ kind: "decision", title: "Thu hồi xác minh mentor", action: "revoke_verification" });
                      setNoteValue("");
                    }}
                  />
                </aside>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteDialog} onOpenChange={(open) => {
        if (!open) {
          setNoteDialog(null);
          setNoteValue("");
        }
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{noteDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Ghi chú Admin</Label>
            <Textarea
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              placeholder="Nhập lý do hoặc yêu cầu bổ sung..."
              className="min-h-28 rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => {
              setNoteDialog(null);
              setNoteValue("");
            }}>
              Hủy
            </Button>
            <Button className="gradient-primary rounded-xl border-0 text-primary-foreground" disabled={!!actionLoading} onClick={() => void submitNoteDialog()}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileSummaryCard({
  request,
  bioExpanded,
  onToggleBio,
}: {
  request: VerificationRequest;
  bioExpanded: boolean;
  onToggleBio: () => void;
}) {
  const profile = request.profile;
  const missing = (value: unknown) => !value || (typeof value === "string" && value.trim().length === 0);
  const bioLong = (profile?.bio?.length ?? 0) > 180;

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Thông tin mentor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Avatar className="h-20 w-20 rounded-2xl">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="rounded-2xl">{getInitials(profile?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className={`text-lg font-bold text-foreground ${safeText}`}>{profile?.name || "Mentor chưa có tên"}</h2>
            <p className={`text-sm text-muted-foreground ${safeText}`}>{profile?.email || "Chưa có email"}</p>
            <FieldLine label="Số điện thoại" value={profile?.phone} />
            <FieldLine label="Tiêu đề" value={profile?.mentor_headline} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Bio</p>
            {missing(profile?.bio) && <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Thiếu thông tin</Badge>}
          </div>
          <p className={`text-sm text-muted-foreground ${safeText} ${bioExpanded ? "" : "line-clamp-3"}`}>
            {profile?.bio || "Chưa có bio."}
          </p>
          {bioLong && (
            <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-primary" onClick={onToggleBio}>
              {bioExpanded ? "Thu gọn" : "Xem thêm"}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(profile?.teaching_fields ?? []).length > 0
            ? profile?.teaching_fields?.map((field) => <Badge key={field} variant="secondary">{field}</Badge>)
            : <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Thiếu lĩnh vực giảng dạy</Badge>}
          <Badge variant="outline">{profile?.experience_years ?? 0} năm kinh nghiệm</Badge>
          {profile?.city ? <Badge variant="outline">{profile.city}</Badge> : <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Thiếu thành phố</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {value?.trim() ? (
        <span className={`text-foreground ${safeText}`}>{value}</span>
      ) : (
        <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Thiếu thông tin</Badge>
      )}
    </div>
  );
}

function ProfileChecklistCard({ profile }: { profile: ProfileRef | null }) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Checklist hồ sơ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {buildChecklist(profile).map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
              {item.complete ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}
              <span className={item.complete ? "font-medium text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProofList({
  proofs,
  actionLoading,
  onApprove,
  onNeedsRevision,
  onReject,
  onAddNote,
}: {
  proofs: VerificationProof[];
  actionLoading: string | null;
  onApprove: (proof: VerificationProof) => void;
  onNeedsRevision: (proof: VerificationProof) => void;
  onReject: (proof: VerificationProof) => void;
  onAddNote: (proof: VerificationProof) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Bằng chứng tin cậy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proofs.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Mentor chưa thêm bằng chứng.
          </div>
        ) : proofs.map((proof) => (
          <ProofCard
            key={proof.id}
            proof={proof}
            actionLoading={actionLoading}
            onApprove={() => onApprove(proof)}
            onNeedsRevision={() => onNeedsRevision(proof)}
            onReject={() => onReject(proof)}
            onAddNote={() => onAddNote(proof)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ProofCard({
  proof,
  actionLoading,
  onApprove,
  onNeedsRevision,
  onReject,
  onAddNote,
}: {
  proof: VerificationProof;
  actionLoading: string | null;
  onApprove: () => void;
  onNeedsRevision: () => void;
  onReject: () => void;
  onAddNote: () => void;
}) {
  const status = normalizeStatus(proof.status || proof.review_status);
  const fileName = proof.file_name || proof.file_path?.split("/").pop() || "Tệp đính kèm";
  const isImage = proof.file_mime_type?.startsWith("image/");
  const isPdf = proof.file_mime_type === "application/pdf";

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{proofTypeLabels[proof.proof_type] ?? proof.proof_type}</Badge>
            <ProofStatusBadge status={status} />
          </div>
          <p className={`font-semibold text-foreground ${safeText}`}>{proof.title}</p>
          {(proof.issuer || proof.issued_year) && (
            <p className="text-xs text-muted-foreground">
              {[proof.issuer, proof.issued_year].filter(Boolean).join(" · ")}
            </p>
          )}
          {proof.description && <p className={`line-clamp-2 text-sm text-muted-foreground ${safeText}`}>{proof.description}</p>}
          {proof.admin_note && (
            <p className={`rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground ${safeText}`}>Admin note: {proof.admin_note}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {proof.url && (
              <a href={proof.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="rounded-xl">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Mở URL
                </Button>
              </a>
            )}
            {proof.signed_file_url && (
              <a href={proof.signed_file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="rounded-xl">
                  {isImage ? <ImageIcon className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
                  {isPdf ? "Mở PDF" : fileName}
                </Button>
              </a>
            )}
          </div>
          {isImage && proof.signed_file_url && (
            <img src={proof.signed_file_url} alt={fileName} className="mt-2 h-24 w-36 rounded-xl border object-cover" />
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:w-48">
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading || status === "approved"} onClick={onApprove}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Duyệt
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={onNeedsRevision}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Bổ sung
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={onReject}>
            <XCircle className="mr-1 h-4 w-4" />
            Từ chối
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" disabled={!!actionLoading} onClick={onAddNote}>
            Ghi chú
          </Button>
        </div>
      </div>
    </div>
  );
}

function PublicPreview({ request }: { request: VerificationRequest }) {
  const verified = normalizeStatus(request.status) === "approved";
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Public preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarImage src={request.profile?.avatar_url || undefined} />
              <AvatarFallback className="rounded-xl">{getInitials(request.profile?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className={`font-semibold text-foreground ${safeText}`}>{request.profile?.name || "Mentor"}</p>
              <p className={`text-xs text-muted-foreground ${safeText}`}>{request.profile?.mentor_headline || "Mentor trên VET"}</p>
            </div>
          </div>
          <div className="mt-3">
            {verified ? (
              <Badge className="rounded-full border-0 bg-success/10 text-success">
                <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                Verified Mentor
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full">Chưa có badge công khai</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionPanel({
  request,
  requirements,
  actionLoading,
  onApprove,
  onRequestRevision,
  onReject,
  onRevoke,
}: {
  request: VerificationRequest;
  requirements: ReturnType<typeof getApprovalRequirements> | null;
  actionLoading: string | null;
  onApprove: () => void;
  onRequestRevision: () => void;
  onReject: () => void;
  onRevoke: () => void;
}) {
  const status = normalizeStatus(request.status);
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Quyết định</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Trạng thái</span>
          <StatusBadge status={status} />
        </div>

        {status === "pending" && (
          <>
            <div className="space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
              <RequirementLine complete={requirements?.profileComplete ?? false} label="Checklist hồ sơ đầy đủ" />
              <RequirementLine complete={requirements?.hasEnoughProofs ?? false} label="Ít nhất 2 bằng chứng" />
              <RequirementLine complete={requirements?.hasDistinctTypes ?? false} label="Ít nhất 2 loại bằng chứng" />
              <RequirementLine complete={requirements?.hasApprovedProofs ?? false} label="Ít nhất 2 bằng chứng đã duyệt" />
            </div>
            <Button className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90" disabled={!!actionLoading} onClick={onApprove}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Approve verification
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={!!actionLoading} onClick={onRequestRevision}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Request revision
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={!!actionLoading} onClick={onReject}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject verification
            </Button>
          </>
        )}

        {status === "approved" && (
          <Button variant="destructive" className="w-full rounded-xl" disabled={!!actionLoading} onClick={onRevoke}>
            <Ban className="mr-2 h-4 w-4" />
            Revoke verification
          </Button>
        )}

        {status === "revision_requested" && <StatusMessage text="Hồ sơ đang chờ mentor bổ sung." />}
        {status === "rejected" && <StatusMessage text="Hồ sơ đã bị từ chối." />}
        {status === "revoked" && <StatusMessage text="Xác minh đã bị thu hồi." />}

        {request.admin_note && (
          <>
            <Separator />
            <p className={`rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground ${safeText}`}>{request.admin_note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RequirementLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {complete ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}
      <span className={complete ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function StatusMessage({ text }: { text: string }) {
  return <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">{text}</div>;
}

function getApprovalRequirements(request: VerificationRequest) {
  const checklist = buildChecklist(request.profile);
  const proofs = request.proofs ?? [];
  const distinctTypes = new Set(proofs.map((proof) => proof.proof_type)).size;
  const approvedProofs = proofs.filter((proof) => normalizeStatus(proof.status || proof.review_status) === "approved").length;
  const profileComplete = checklist.every((item) => item.complete);
  return {
    profileComplete,
    hasEnoughProofs: proofs.length >= 2,
    hasDistinctTypes: distinctTypes >= 2,
    hasApprovedProofs: approvedProofs >= 2,
    canApprove: profileComplete && proofs.length >= 2 && distinctTypes >= 2 && approvedProofs >= 2,
  };
}
