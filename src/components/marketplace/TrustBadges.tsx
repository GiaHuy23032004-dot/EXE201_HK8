import { Award, BadgeCheck, FileCheck2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PublicMentorTrustBadge, PublicTrustBadgeType } from "@/hooks/usePublicMentorVerification";

const badgeMeta: Record<PublicTrustBadgeType, {
  label: string;
  description: string;
  className: string;
  icon: LucideIcon;
}> = {
  vet_verified: {
    label: "Đã xác minh bởi VET",
    description: "VET đã kiểm tra hồ sơ và bằng chứng chuyên môn của mentor này.",
    className: "border-success/20 bg-success/10 text-success",
    icon: BadgeCheck,
  },
  certificate_verified: {
    label: "Chứng chỉ đã đối chiếu",
    description: "Chứng chỉ hoặc bằng cấp đã được Admin đối chiếu.",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: FileCheck2,
  },
  portfolio_verified: {
    label: "Portfolio đã kiểm tra",
    description: "Portfolio hoặc sản phẩm cá nhân đã được kiểm tra.",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: Award,
  },
  trusted_mentor: {
    label: "Mentor uy tín",
    description: "Mentor có lịch sử hoạt động tốt và được VET ghi nhận.",
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: ShieldCheck,
  },
};

const badgeOrder: PublicTrustBadgeType[] = [
  "vet_verified",
  "certificate_verified",
  "portfolio_verified",
  "trusted_mentor",
];

export function TrustBadges({
  badges,
  compact = false,
  className = "",
}: {
  badges: PublicMentorTrustBadge[];
  compact?: boolean;
  className?: string;
}) {
  const visibleBadges = badgeOrder
    .map((badgeType) => badges.find((badge) => badge.badge_type === badgeType))
    .filter((badge): badge is PublicMentorTrustBadge => Boolean(badge));

  if (visibleBadges.length === 0) return null;

  return (
    <div className={`flex min-w-0 flex-wrap gap-1.5 ${className}`}>
      {visibleBadges.map((badge) => {
        const meta = badgeMeta[badge.badge_type];
        const Icon = meta.icon;

        return (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`min-w-0 max-w-full rounded-full gap-1 ${meta.className} ${compact ? "px-2 py-0.5 text-[10px]" : ""}`}
              >
                <Icon className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
                <span className="truncate">{compact ? meta.label.replace(" bởi VET", "") : meta.label}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
