import { useState } from "react";
import { AlertTriangle, FilePlus2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { MentorVerificationStatus } from "@/hooks/useMentorVerification";
import {
  isEditableVerificationStatus,
  isValidProofItem,
  useMentorVerificationProofs,
  type MentorVerificationProof,
  type ProofFormValues,
} from "@/hooks/useMentorVerificationProofs";
import { ProofCard } from "@/components/mentor/settings/ProofCard";
import { ProofFormDialog } from "@/components/mentor/settings/ProofFormDialog";

interface TrustProofManagerProps {
  userId: string;
  status: MentorVerificationStatus;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Đã xảy ra lỗi không xác định.");
  }
  return "Đã xảy ra lỗi không xác định.";
}

export function TrustProofManager({ userId, status }: TrustProofManagerProps) {
  const { toast } = useToast();
  const proofsQuery = useMentorVerificationProofs(userId, status);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProof, setEditingProof] = useState<MentorVerificationProof | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MentorVerificationProof | null>(null);

  const proofs = proofsQuery.data ?? [];
  const distinctProofTypes = new Set(proofs.filter(isValidProofItem).map((proof) => proof.proof_type)).size;
  const readOnly = !isEditableVerificationStatus(status);
  const isBusy = proofsQuery.createProof.isPending || proofsQuery.updateProof.isPending || proofsQuery.deleteProof.isPending;

  const handleSubmit = async (values: ProofFormValues, editing?: MentorVerificationProof | null) => {
    try {
      if (editing) {
        await proofsQuery.updateProof.mutateAsync({ id: editing.id, values, currentFilePath: editing.file_path });
        toast({ title: "Đã cập nhật bằng chứng" });
      } else {
        await proofsQuery.createProof.mutateAsync(values);
        toast({ title: "Đã thêm bằng chứng" });
      }
      setDialogOpen(false);
      setEditingProof(null);
    } catch (error: unknown) {
      toast({
        title: "Không thể lưu bằng chứng",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await proofsQuery.deleteProof.mutateAsync(deleteTarget);
      toast({ title: "Đã xóa bằng chứng" });
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast({
        title: "Không thể xóa bằng chứng",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            Bằng chứng tin cậy
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Bạn cần thêm ít nhất 2 loại bằng chứng khác nhau.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingProof(null);
            setDialogOpen(true);
          }}
          disabled={readOnly}
          className="rounded-xl border-0 text-primary-foreground gradient-primary"
        >
          Thêm bằng chứng
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "pending" && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Hồ sơ đang chờ duyệt, bạn không thể chỉnh sửa bằng chứng.
          </div>
        )}

        {status === "approved" && (
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">
            Hồ sơ đã được xác minh.
          </div>
        )}

        {status !== "pending" && status !== "approved" && readOnly && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Trạng thái hồ sơ hiện tại không cho phép chỉnh sửa bằng chứng.
          </div>
        )}

        {proofsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : proofsQuery.isError ? (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {getErrorMessage(proofsQuery.error)}
          </div>
        ) : proofs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center">
            <FilePlus2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">Chưa có bằng chứng nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Thêm mạng xã hội nghề nghiệp, chứng chỉ, portfolio hoặc minh chứng giảng dạy.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {proofs.map((proof) => (
              <ProofCard
                key={proof.id}
                proof={proof}
                disabled={readOnly}
                onEdit={(nextProof) => {
                  setEditingProof(nextProof);
                  setDialogOpen(true);
                }}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}

        {distinctProofTypes < 2 && proofs.length > 0 && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Bạn cần thêm ít nhất 2 loại bằng chứng khác nhau.
          </div>
        )}
      </CardContent>

      <ProofFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingProof(null);
        }}
        editing={editingProof}
        isBusy={isBusy}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bằng chứng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa "{deleteTarget?.title}". Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={proofsQuery.deleteProof.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {proofsQuery.deleteProof.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
