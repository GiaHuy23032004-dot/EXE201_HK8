import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MentorProfile } from "@/hooks/useMentorProfile";
import { isValidProofItem, type MentorVerificationProof } from "@/hooks/useMentorVerificationProofs";

interface VerificationPreviewProps {
  profile: MentorProfile;
  proofs: MentorVerificationProof[];
}

export function VerificationPreview({ profile, proofs }: VerificationPreviewProps) {
  const validProofCount = proofs.filter(isValidProofItem).length;
  const name = profile.real_name || profile.name || "Mentor";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle>Hồ sơ sẽ gửi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">{profile.mentor_headline || "Chưa có tiêu đề mentor"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile.city || "Chưa có thành phố"} · {profile.experience_years ?? 0} năm kinh nghiệm
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(profile.teaching_fields ?? []).map((field) => (
            <Badge key={field} variant="secondary" className="rounded-full">
              {field}
            </Badge>
          ))}
        </div>

        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {profile.bio || "Chưa có bio."}
        </div>

        <div className="rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">Tài liệu</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {validProofCount} tài liệu hợp lệ
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
