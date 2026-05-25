import { ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PROOF_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  isSupportedProofType,
  type MentorVerificationProof,
  type ProofType,
  type SocialPlatform,
} from "@/hooks/useMentorVerificationProofs";

interface ProofCardProps {
  proof: MentorVerificationProof;
  disabled?: boolean;
  onEdit: (proof: MentorVerificationProof) => void;
  onDelete: (proof: MentorVerificationProof) => void;
}

function getFileName(path: string) {
  return path.split("/").pop() ?? path;
}

function getTypeLabel(type: string) {
  return isSupportedProofType(type) ? PROOF_TYPE_LABELS[type as ProofType] : "Bằng chứng không còn hỗ trợ";
}

function getSubtitle(proof: MentorVerificationProof) {
  const metadata = proof.metadata ?? {};

  if (proof.proof_type === "social") {
    const platform = metadata.platform as SocialPlatform | undefined;
    return platform ? SOCIAL_PLATFORM_LABELS[platform] ?? platform : "Mạng xã hội";
  }

  if (proof.proof_type === "certificate") {
    const parts = [metadata.issuer, metadata.issued_year ? String(metadata.issued_year) : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Chứng chỉ / bằng cấp";
  }

  if (proof.proof_type === "portfolio") {
    return "Portfolio / sản phẩm cá nhân";
  }

  return "Loại bằng chứng cũ";
}

export function ProofCard({ proof, disabled, onEdit, onDelete }: ProofCardProps) {
  const metadata = proof.metadata ?? {};
  const title = metadata.title || proof.title;
  const url = metadata.url || proof.url;
  const filePath = metadata.file_url || proof.file_path;

  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2 rounded-full">
              {getTypeLabel(proof.proof_type)}
            </Badge>
            <h3 className="truncate font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{getSubtitle(proof)}</p>
            {(metadata.description || proof.description) && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {metadata.description || proof.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              onClick={() => onEdit(proof)}
              className="h-8 w-8 rounded-xl"
              title="Chỉnh sửa"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              onClick={() => onDelete(proof)}
              className="h-8 w-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Xóa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{url}</span>
            </a>
          )}
          {filePath && (
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{getFileName(filePath)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
