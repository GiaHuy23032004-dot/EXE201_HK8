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
  Star,
  Trophy,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  type BadgeAction,
  type DecisionAction,
  type ProfileRef,
  type ProofStatus,
  type TrustBadge,
  type TrustBadgeType,
  type VerificationProof,
  type VerificationRequest,
  type VerificationStatus,
  useAdminMentorVerificationApi,
  useAdminMentorVerificationDetail,
  useAdminMentorVerificationRequests,
} from "@/hooks/useAdminMentorVerifications";
import { cn } from "@/lib/utils";

type NoteDialogState =
  | { kind: "decision"; title: string; action: DecisionAction; mentorId: string }
  | { kind: "proof"; title: string; proof: VerificationProof; reviewStatus: ProofStatus; mentorId: string }
  | { kind: "avatar"; title: string; itemType: "avatar"; reviewStatus: ProofStatus; mentorId: string }
  | { kind: "badge"; title: string; action: BadgeAction; badgeType: TrustBadgeType; mentorId: string; noteRequired: boolean };

const filters: Array<{ value: VerificationStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "revision_requested", label: "Cần bổ sung" },
  { value: "rejected", label: "Từ chối" },
  { value: "revoked", label: "Đã thu hồi" },
];

const statusLabels: Record<string, string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  revision_requested: "Cần bổ sung",
  revision_required: "Cần bổ sung",
  rejected: "Từ chối",
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

const badgeMeta: Record<TrustBadgeType, { label: string; description: string; icon: typeof BadgeCheck }> = {
  vet_verified: {
    label: "Đã xác minh bởi VET",
    description: "Hồ sơ mentor đã được VET kiểm tra.",
    icon: ShieldCheck,
  },
  certificate_verified: {
    label: "Chứng chỉ đã đối chiếu",
    description: "Bằng cấp hoặc chứng chỉ đã được Admin kiểm tra.",
    icon: BadgeCheck,
  },
  portfolio_verified: {
    label: "Portfolio đã kiểm tra",
    description: "Portfolio hoặc sản phẩm cá nhân đã được xem xét.",
    icon: FileText,
  },
  trusted_mentor: {
    label: "Mentor uy tín",
    description: "Mentor có chất lượng hoạt động tốt và đáng tin cậy.",
    icon: Trophy,
  },
};

const safeText = "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]";

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa có");
const formatShortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có");
const normalizeStatus = (status?: string | null) => (status === "revision_required" ? "revision_requested" : status || "pending");
const getInitials = (name?: string | null) => (name || "VT").slice(0, 2).toUpperCase();
const activeBadges = (badges?: TrustBadge[]) => (badges ?? []).filter((badge) => badge.status === "active");
const isActiveStrike = (strike: { expires_at: string | null }) => !strike.expires_at || new Date(strike.expires_at).getTime() > Date.now();

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

function getApprovalRequirements(request: VerificationRequest) {
  const proofs = request.proofs ?? [];
  const profileComplete = buildChecklist(request.profile).every((item) => item.complete);
  const distinctTypes = new Set(proofs.map((proof) => proof.proof_type).filter(Boolean)).size;
  const approvedProofs = proofs.filter((proof) => normalizeStatus(proof.status || proof.review_status) === "approved").length;
  return {
    profileComplete,
    hasEnoughProofs: proofs.length >= 2,
    hasDistinctTypes: distinctTypes >= 2,
    hasApprovedProofs: approvedProofs >= 2,
    canApprove: profileComplete && proofs.length >= 2 && distinctTypes >= 2 && approvedProofs >= 2,
  };
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const tone =
    normalized === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "revision_requested"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : normalized === "rejected" || normalized === "revoked"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-border bg-muted text-muted-foreground";

  return <Badge variant="outline" className={cn("rounded-full", tone)}>{statusLabels[normalized] ?? normalized}</Badge>;
}

function ProofStatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status);
  const tone =
    normalized === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "revision_requested"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : normalized === "rejected"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return <Badge variant="outline" className={cn("rounded-full", tone)}>{proofStatusLabels[normalized] ?? normalized}</Badge>;
}

export default function AdminMentorVerifications() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<VerificationStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<NoteDialogState | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [bioExpanded, setBioExpanded] = useState(false);

  const { invokeAction, refreshVerificationQueries } = useAdminMentorVerificationApi();
  const listQuery = useAdminMentorVerificationRequests("all");
  const detailQuery = useAdminMentorVerificationDetail(selectedMentorId, Boolean(selectedMentorId));
  const allRequests = listQuery.data ?? [];
  const selected = detailQuery.data ?? null;

  const metrics = useMemo(() => {
    const countStatus = (status: string) => allRequests.filter((request) => normalizeStatus(request.status) === status).length;
    return {
      pending: countStatus("pending"),
      approved: countStatus("approved"),
      revision: countStatus("revision_requested"),
      rejected: countStatus("rejected"),
      revoked: countStatus("revoked"),
      trustedBadgeMentors: allRequests.filter((request) => activeBadges(request.trust_badges).some((badge) => badge.badge_type === "trusted_mentor")).length,
      activeStrikeMentors: allRequests.filter((request) => (request.active_strike_count ?? 0) > 0).length,
    };
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRequests.filter((request) => {
      if (filter !== "all" && normalizeStatus(request.status) !== filter) return false;
      if (!term) return true;

      return [
        request.profile?.name,
        request.profile?.email,
        request.profile?.phone,
        request.profile?.real_name,
        request.profile?.mentor_headline,
        ...(request.profile?.teaching_fields ?? []),
        ...(request.proofs ?? []).flatMap((proof) => [proof.title, proof.issuer, proof.description]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [allRequests, filter, search]);

  const runAction = async (body: Record<string, unknown>, successTitle: string) => {
    setActionLoading(String(body.action));
    try {
      await invokeAction(body);
      await refreshVerificationQueries();
      if (selectedMentorId) await detailQuery.refetch();
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xử lý thao tác.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = (mentorId: string) => {
    setSelectedMentorId(mentorId);
    setBioExpanded(false);
  };

  const approveVerification = async (request: VerificationRequest) => {
    const requirements = getApprovalRequirements(request);
    if (!requirements.canApprove) {
      toast({ title: "Mentor chưa đủ điều kiện xác minh.", variant: "destructive" });
      return;
    }
    await runAction(
      { action: "approve_verification", mentorId: request.mentor_id, note: "Đã duyệt hồ sơ xác minh." },
      "Đã duyệt xác minh mentor.",
    );
  };

  const submitNoteDialog = async () => {
    if (!noteDialog) return;
    if (noteDialog.kind !== "badge" || noteDialog.noteRequired) {
      if (!noteValue.trim()) {
        toast({ title: "Vui lòng nhập ghi chú/lý do.", variant: "destructive" });
        return;
      }
    }

    if (noteDialog.kind === "decision") {
      await runAction(
        { action: noteDialog.action, mentorId: noteDialog.mentorId, reason: noteValue.trim() },
        noteDialog.action === "request_revision"
          ? "Đã yêu cầu mentor bổ sung hồ sơ."
          : noteDialog.action === "reject_verification"
            ? "Đã từ chối xác minh mentor."
            : "Đã thu hồi xác minh mentor.",
      );
    }

    if (noteDialog.kind === "proof") {
      await runAction(
        {
          action: "review_evidence",
          mentorId: noteDialog.mentorId,
          proofId: noteDialog.proof.id,
          reviewStatus: noteDialog.reviewStatus,
          note: noteValue.trim(),
        },
        noteDialog.reviewStatus === "approved"
          ? "Đã duyệt bằng chứng."
          : noteDialog.reviewStatus === "rejected"
            ? "Đã từ chối bằng chứng."
            : "Đã yêu cầu bổ sung bằng chứng.",
      );
    }

    if (noteDialog.kind === "avatar") {
      await runAction(
        {
          action: "review_profile_item",
          mentorId: noteDialog.mentorId,
          itemType: "avatar",
          reviewStatus: noteDialog.reviewStatus,
          note: noteValue.trim(),
        },
        noteDialog.reviewStatus === "approved" ? "Đã duyệt ảnh đại diện." : "Đã cập nhật trạng thái ảnh đại diện.",
      );
    }

    if (noteDialog.kind === "badge") {
      await runAction(
        {
          action: noteDialog.action,
          mentorId: noteDialog.mentorId,
          badgeType: noteDialog.badgeType,
          reason: noteValue.trim() || undefined,
        },
        noteDialog.action === "grant_badge"
          ? "Đã cấp huy hiệu."
          : noteDialog.action === "restore_badge"
            ? "Đã khôi phục huy hiệu."
            : noteDialog.action === "suspend_badge"
              ? "Đã tạm dừng huy hiệu."
              : "Đã thu hồi huy hiệu.",
      );
    }

    setNoteDialog(null);
    setNoteValue("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Xác minh Mentor</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Duyệt hồ sơ uy tín, bằng chứng và huy hiệu hiển thị cho học viên.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {[
          ["Chờ duyệt", metrics.pending],
          ["Đã duyệt", metrics.approved],
          ["Cần bổ sung", metrics.revision],
          ["Từ chối", metrics.rejected],
          ["Đã thu hồi", metrics.revoked],
          ["Mentor có badge uy tín", metrics.trustedBadgeMentors],
          ["Mentor có strike hiệu lực", metrics.activeStrikeMentors],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-xl pl-10"
                placeholder="Tìm mentor, email, lĩnh vực, chứng chỉ..."
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
                  className={cn("h-9 rounded-full px-4 text-xs", filter === item.value ? "gradient-primary border-0 text-primary-foreground" : "")}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
          </div>
        </div>
      ) : listQuery.isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Không thể tải danh sách xác minh</p>
          <p className="mt-1 text-sm text-muted-foreground">{listQuery.error instanceof Error ? listQuery.error.message : "Vui lòng thử lại."}</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void listQuery.refetch()}>Thử lại</Button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-sm">
          <UserCheck className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-semibold text-foreground">Không có hồ sơ phù hợp</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="min-w-[260px]">Mentor</TableHead>
                  <TableHead>Trạng thái xác minh</TableHead>
                  <TableHead>Bằng chứng đã gửi</TableHead>
                  <TableHead>Badge hiện tại</TableHead>
                  <TableHead>Strike active</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const requirements = getApprovalRequirements(request);
                  return (
                    <TableRow key={request.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(request.mentor_id)}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-11 w-11 rounded-xl">
                            <AvatarImage src={request.profile?.avatar_url || undefined} />
                            <AvatarFallback className="rounded-xl">{getInitials(request.profile?.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className={`font-semibold text-foreground ${safeText}`}>{request.profile?.name || "Mentor chưa có tên"}</p>
                            <p className={`text-xs text-muted-foreground ${safeText}`}>{request.profile?.email || "Chưa có email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={request.status} /></TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{request.evidence_count ?? request.proofs?.length ?? 0}</div>
                        <p className="text-xs text-muted-foreground">{request.approved_proof_count ?? 0} đã duyệt</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {activeBadges(request.trust_badges).length > 0
                            ? activeBadges(request.trust_badges).map((badge) => (
                                <Badge key={`${request.mentor_id}-${badge.badge_type}`} variant="outline" className="rounded-full text-[11px]">
                                  {badgeMeta[badge.badge_type as TrustBadgeType]?.label ?? badge.badge_type}
                                </Badge>
                              ))
                            : <span className="text-xs text-muted-foreground">Chưa có badge</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("rounded-full", request.active_strike_count > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "")}>
                          {request.active_strike_count ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatShortDate(request.submitted_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openDetail(request.mentor_id)}>
                            <Eye className="mr-1 h-4 w-4" />Xem chi tiết
                          </Button>
                          {normalizeStatus(request.status) === "pending" && requirements.canApprove && (
                            <Button size="sm" className="gradient-primary rounded-xl border-0 text-primary-foreground" disabled={!!actionLoading} onClick={() => void approveVerification(request)}>
                              <BadgeCheck className="mr-1 h-4 w-4" />Duyệt nhanh
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Sheet open={!!selectedMentorId} onOpenChange={(open) => !open && setSelectedMentorId(null)}>
        <SheetContent side="right" className="w-[96vw] overflow-y-auto sm:max-w-5xl">
          <SheetHeader>
            <SheetTitle>Chi tiết xác minh Mentor</SheetTitle>
            <SheetDescription>Kiểm tra hồ sơ, bằng chứng, lịch sử an toàn và huy hiệu công khai trước khi ra quyết định.</SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-60 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          ) : detailQuery.isError ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-semibold">Không thể tải chi tiết hồ sơ</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void detailQuery.refetch()}>Thử lại</Button>
            </div>
          ) : selected ? (
            <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-5">
                <ProfileOverview request={selected} bioExpanded={bioExpanded} onToggleBio={() => setBioExpanded((value) => !value)} />
                <ProfileChecklist profile={selected.profile} />
                <EvidenceReview
                  request={selected}
                  actionLoading={actionLoading}
                  onAvatarReview={(reviewStatus) => {
                    setNoteDialog({ kind: "avatar", title: reviewStatus === "approved" ? "Duyệt ảnh đại diện" : "Cập nhật ảnh đại diện", itemType: "avatar", reviewStatus, mentorId: selected.mentor_id });
                    setNoteValue(reviewStatus === "approved" ? "Ảnh đại diện hợp lệ." : "");
                  }}
                  onProofReview={(proof, reviewStatus) => {
                    setNoteDialog({
                      kind: "proof",
                      title: reviewStatus === "approved" ? "Duyệt bằng chứng" : reviewStatus === "rejected" ? "Từ chối bằng chứng" : "Yêu cầu bổ sung bằng chứng",
                      proof,
                      reviewStatus,
                      mentorId: selected.mentor_id,
                    });
                    setNoteValue(reviewStatus === "approved" ? proof.admin_note || "Bằng chứng hợp lệ." : proof.admin_note || "");
                  }}
                />
                <TrustSafetyContext request={selected} />
              </div>

              <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
                <PublicPreview request={selected} />
                <DecisionPanel
                  request={selected}
                  actionLoading={actionLoading}
                  onApprove={() => void approveVerification(selected)}
                  onDecision={(action) => {
                    setNoteDialog({
                      kind: "decision",
                      title:
                        action === "request_revision"
                          ? "Yêu cầu bổ sung hồ sơ"
                          : action === "reject_verification"
                            ? "Từ chối xác minh"
                            : "Thu hồi xác minh",
                      action,
                      mentorId: selected.mentor_id,
                    });
                    setNoteValue(selected.admin_note || "");
                  }}
                />
                <TrustBadgeManager
                  request={selected}
                  actionLoading={actionLoading}
                  onBadgeAction={(action, badgeType, noteRequired) => {
                    if (!noteRequired) {
                      void runAction({ action, mentorId: selected.mentor_id, badgeType }, action === "grant_badge" ? "Đã cấp huy hiệu." : "Đã khôi phục huy hiệu.");
                      return;
                    }
                    setNoteDialog({
                      kind: "badge",
                      title:
                        action === "suspend_badge"
                          ? "Tạm dừng huy hiệu"
                          : "Thu hồi huy hiệu",
                      action,
                      badgeType,
                      mentorId: selected.mentor_id,
                      noteRequired,
                    });
                    setNoteValue("");
                  }}
                />
              </aside>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

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
            <Label>Ghi chú / lý do</Label>
            <Textarea
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              placeholder="Nhập lý do, yêu cầu bổ sung hoặc nội dung giải thích cho mentor..."
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

function ProfileOverview({ request, bioExpanded, onToggleBio }: { request: VerificationRequest; bioExpanded: boolean; onToggleBio: () => void }) {
  const profile = request.profile;
  const bioLong = (profile?.bio?.length ?? 0) > 180;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Avatar className="h-20 w-20 rounded-2xl">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="rounded-2xl">{getInitials(profile?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-xl font-bold text-foreground ${safeText}`}>{profile?.name || "Mentor chưa có tên"}</h2>
              <StatusBadge status={request.status} />
            </div>
            <p className={`mt-1 text-sm text-muted-foreground ${safeText}`}>{profile?.email || "Chưa có email"}</p>
            <p className={`mt-2 text-sm font-medium text-foreground ${safeText}`}>{profile?.mentor_headline || "Chưa có tiêu đề mentor"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Role: mentor</Badge>
              <Badge variant="outline">{profile?.experience_years ?? 0} năm kinh nghiệm</Badge>
              {profile?.phone ? <Badge variant="outline">{profile.phone}</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Thiếu số điện thoại</Badge>}
              {profile?.city && <Badge variant="outline">{profile.city}</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-1 text-sm font-semibold">Bio</p>
          <p className={cn("text-sm text-muted-foreground", safeText, bioExpanded ? "" : "line-clamp-3")}>
            {profile?.bio || "Chưa có bio."}
          </p>
          {bioLong && (
            <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={onToggleBio}>
              {bioExpanded ? "Thu gọn" : "Xem thêm"}
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(profile?.teaching_fields ?? []).length > 0
            ? profile?.teaching_fields?.map((field) => <Badge key={field} variant="secondary">{field}</Badge>)
            : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Thiếu lĩnh vực giảng dạy</Badge>}
          {profile?.portfolio_url && (
            <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">
              <Badge variant="outline" className="gap-1">Portfolio <ExternalLink className="h-3 w-3" /></Badge>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileChecklist({ profile }: { profile: ProfileRef | null }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <h3 className="font-semibold text-foreground">Checklist hồ sơ</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {buildChecklist(profile).map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
              {item.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
              <span className={item.complete ? "font-medium text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceReview({
  request,
  actionLoading,
  onAvatarReview,
  onProofReview,
}: {
  request: VerificationRequest;
  actionLoading: string | null;
  onAvatarReview: (status: ProofStatus) => void;
  onProofReview: (proof: VerificationProof, status: ProofStatus) => void;
}) {
  const avatarItem = (request.verification_items ?? []).find((item) => item.item_type === "avatar" || item.type === "avatar") as { review_status?: string; admin_note?: string | null } | undefined;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="font-semibold text-foreground">Bằng chứng đã gửi</h3>
          <p className="text-sm text-muted-foreground">Chỉ Admin xem tài liệu riêng tư. Learner chỉ thấy badge công khai đã duyệt.</p>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 rounded-xl">
                <AvatarImage src={request.profile?.avatar_url || undefined} />
                <AvatarFallback className="rounded-xl">{getInitials(request.profile?.name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Ảnh đại diện</Badge>
                  <ProofStatusBadge status={avatarItem?.review_status ?? "pending"} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Ảnh đại diện thuộc checklist hồ sơ, không hiển thị như tài liệu riêng.</p>
                {avatarItem?.admin_note && <p className="mt-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{avatarItem.admin_note}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onAvatarReview("approved")}>Duyệt</Button>
              <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onAvatarReview("revision_requested")}>Bổ sung</Button>
              <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onAvatarReview("rejected")}>Từ chối</Button>
            </div>
          </div>
        </div>

        {(request.proofs ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">Mentor chưa thêm bằng chứng.</div>
        ) : request.proofs.map((proof) => (
          <ProofCard key={proof.id} proof={proof} actionLoading={actionLoading} onReview={(status) => onProofReview(proof, status)} />
        ))}
      </CardContent>
    </Card>
  );
}

function ProofCard({ proof, actionLoading, onReview }: { proof: VerificationProof; actionLoading: string | null; onReview: (status: ProofStatus) => void }) {
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
          {(proof.issuer || proof.issued_year) && <p className="text-xs text-muted-foreground">{[proof.issuer, proof.issued_year].filter(Boolean).join(" · ")}</p>}
          {proof.description && <p className={`line-clamp-2 text-sm text-muted-foreground ${safeText}`}>{proof.description}</p>}
          {proof.admin_note && <p className={`rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground ${safeText}`}>Admin note: {proof.admin_note}</p>}
          <div className="flex flex-wrap gap-2">
            {proof.url && (
              <a href={proof.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="rounded-xl"><ExternalLink className="mr-2 h-4 w-4" />Mở URL</Button>
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
          {isImage && proof.signed_file_url && <img src={proof.signed_file_url} alt={fileName} className="mt-2 h-24 w-36 rounded-xl border object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2 lg:w-44">
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading || status === "approved"} onClick={() => onReview("approved")}>Duyệt</Button>
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onReview("revision_requested")}>Bổ sung</Button>
          <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onReview("rejected")}>Từ chối</Button>
        </div>
      </div>
    </div>
  );
}

function TrustSafetyContext({ request }: { request: VerificationRequest }) {
  const summary = request.summary ?? {};
  const activeStrikeCount = (request.mentor_strikes ?? []).filter(isActiveStrike).length;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold text-foreground">Trust & safety context</h3>
          <p className="text-sm text-muted-foreground">Thông tin hỗ trợ thẩm định, không tự động thu hồi badge theo report count.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Khóa đã tạo" value={summary.courses_count ?? request.courses?.length ?? 0} />
          <MiniStat label="Booking hoàn thành" value={summary.completed_bookings_count ?? 0} />
          <MiniStat label="Rating trung bình" value={(summary.average_rating ?? 0).toFixed(1)} />
          <MiniStat label="Report về mentor" value={summary.reports_count ?? request.reports?.length ?? 0} />
        </div>
        <div className="rounded-2xl border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Lịch sử vi phạm Mentor</p>
            <Badge variant="outline" className={cn("rounded-full", activeStrikeCount >= 2 ? "border-rose-200 bg-rose-50 text-rose-700" : "")}>{activeStrikeCount}/3 active</Badge>
          </div>
          {(request.mentor_strikes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có strike đã xác nhận.</p>
          ) : (
            <div className="space-y-2">
              {(request.mentor_strikes ?? []).slice(0, 3).map((strike) => (
                <div key={strike.id} className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">Gậy {strike.level} · {isActiveStrike(strike) ? "Đang hiệu lực" : "Đã hết hiệu lực"}</p>
                  <p className="text-muted-foreground">{strike.reason || "Không có lý do"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <ContextList title="Khóa học của mentor" empty="Chưa có khóa học." rows={(request.courses ?? []).slice(0, 5).map((course) => `${course.title} · ${statusLabels[course.status] ?? course.status}`)} />
          <ContextList title="Report gần đây" empty="Chưa có report." rows={(request.reports ?? []).slice(0, 5).map((report) => `${report.title || report.reason || "Report"} · ${statusLabels[report.status || ""] ?? report.status}`)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function ContextList({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="mb-2 font-medium">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="space-y-2">
          {rows.map((row) => <p key={row} className={`rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground ${safeText}`}>{row}</p>)}
        </div>
      )}
    </div>
  );
}

function PublicPreview({ request }: { request: VerificationRequest }) {
  const badges = activeBadges(request.trust_badges);
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <h3 className="font-semibold text-foreground">Public preview</h3>
        <div className="mt-3 rounded-2xl border bg-muted/30 p-4">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.length > 0 ? badges.map((badge) => {
              const meta = badgeMeta[badge.badge_type as TrustBadgeType];
              return <Badge key={badge.badge_type} className="rounded-full border-0 bg-emerald-100 text-emerald-700">{meta?.label ?? badge.badge_type}</Badge>;
            }) : <Badge variant="outline" className="rounded-full">Chưa có badge công khai</Badge>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Learner chỉ thấy badge active và mô tả công khai, không thấy file xác minh riêng tư.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionPanel({ request, actionLoading, onApprove, onDecision }: { request: VerificationRequest; actionLoading: string | null; onApprove: () => void; onDecision: (action: DecisionAction) => void }) {
  const status = normalizeStatus(request.status);
  const requirements = getApprovalRequirements(request);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">Quyết định xác minh</h3>
          <StatusBadge status={status} />
        </div>

        {status === "pending" && (
          <>
            <div className="space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
              <RequirementLine complete={requirements.profileComplete} label="Checklist hồ sơ đầy đủ" />
              <RequirementLine complete={requirements.hasEnoughProofs} label="Ít nhất 2 bằng chứng" />
              <RequirementLine complete={requirements.hasDistinctTypes} label="Ít nhất 2 loại bằng chứng" />
              <RequirementLine complete={requirements.hasApprovedProofs} label="Ít nhất 2 bằng chứng đã duyệt" />
            </div>
            <Button className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={!!actionLoading} onClick={onApprove}>
              <BadgeCheck className="mr-2 h-4 w-4" />Approve verification
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={!!actionLoading} onClick={() => onDecision("request_revision")}>
              <RotateCcw className="mr-2 h-4 w-4" />Request revision
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={!!actionLoading} onClick={() => onDecision("reject_verification")}>
              <XCircle className="mr-2 h-4 w-4" />Reject verification
            </Button>
          </>
        )}

        {status === "approved" && (
          <Button variant="destructive" className="w-full rounded-xl" disabled={!!actionLoading} onClick={() => onDecision("revoke_verification")}>
            <Ban className="mr-2 h-4 w-4" />Revoke verification
          </Button>
        )}
        {status === "revision_requested" && <StatusMessage text="Hồ sơ đang chờ mentor bổ sung." />}
        {status === "rejected" && <StatusMessage text="Hồ sơ đã bị từ chối." />}
        {status === "revoked" && <StatusMessage text="Xác minh đã bị thu hồi." />}
        {request.admin_note && <p className={`rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground ${safeText}`}>{request.admin_note}</p>}
      </CardContent>
    </Card>
  );
}

function RequirementLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
      <span className={complete ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function StatusMessage({ text }: { text: string }) {
  return <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">{text}</div>;
}

function TrustBadgeManager({
  request,
  actionLoading,
  onBadgeAction,
}: {
  request: VerificationRequest;
  actionLoading: string | null;
  onBadgeAction: (action: BadgeAction, badgeType: TrustBadgeType, noteRequired: boolean) => void;
}) {
  const badgeByType = new Map((request.trust_badges ?? []).map((badge) => [badge.badge_type, badge]));

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="font-semibold text-foreground">Trust badges</h3>
          <p className="text-sm text-muted-foreground">Chỉ badge active được hiển thị công khai cho learner.</p>
        </div>
        {(Object.keys(badgeMeta) as TrustBadgeType[]).map((badgeType) => {
          const meta = badgeMeta[badgeType];
          const Icon = meta.icon;
          const badge = badgeByType.get(badgeType);
          const status = badge?.status ?? "missing";
          return (
            <div key={badgeType} className="rounded-2xl border p-3">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{meta.label}</p>
                    <Badge variant="outline" className={cn("rounded-full", status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "suspended" ? "border-amber-200 bg-amber-50 text-amber-700" : status === "revoked" ? "border-rose-200 bg-rose-50 text-rose-700" : "")}>{status === "missing" ? "Chưa cấp" : status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(!badge || status === "missing") && <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onBadgeAction("grant_badge", badgeType, false)}>Cấp badge</Button>}
                {status === "active" && (
                  <>
                    <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onBadgeAction("suspend_badge", badgeType, true)}>Tạm dừng</Button>
                    <Button size="sm" variant="outline" className="rounded-xl text-destructive hover:text-destructive" disabled={!!actionLoading} onClick={() => onBadgeAction("revoke_badge", badgeType, true)}>Thu hồi</Button>
                  </>
                )}
                {(status === "suspended" || status === "revoked") && <Button size="sm" variant="outline" className="rounded-xl" disabled={!!actionLoading} onClick={() => onBadgeAction("restore_badge", badgeType, false)}>Khôi phục</Button>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
