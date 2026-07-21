import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicTrustBadgeType =
  | "vet_verified"
  | "certificate_verified"
  | "portfolio_verified"
  | "trusted_mentor";

export interface PublicMentorTrustBadge {
  id: string;
  mentor_id: string;
  badge_type: PublicTrustBadgeType;
  status: "active";
  public_visible: true;
}

const PUBLIC_BADGE_TYPES = new Set<PublicTrustBadgeType>([
  "vet_verified",
  "certificate_verified",
  "portfolio_verified",
  "trusted_mentor",
]);

function normalizeMentorIds(mentorIds: Array<string | null | undefined>) {
  return Array.from(new Set(mentorIds.filter((mentorId): mentorId is string => Boolean(mentorId)))).sort();
}

function toPublicBadge(row: {
  id: string;
  mentor_id: string;
  badge_type: string;
  status: string;
  public_visible: boolean;
}): PublicMentorTrustBadge | null {
  if (!PUBLIC_BADGE_TYPES.has(row.badge_type as PublicTrustBadgeType)) return null;
  if (row.status !== "active" || row.public_visible !== true) return null;

  return {
    id: row.id,
    mentor_id: row.mentor_id,
    badge_type: row.badge_type as PublicTrustBadgeType,
    status: "active",
    public_visible: true,
  };
}

async function fetchPublicTrustBadges(mentorIds: string[]) {
  const badgeMap = new Map<string, PublicMentorTrustBadge[]>();
  if (mentorIds.length === 0) return badgeMap;

  const { data: badgeRows, error: badgeError } = await supabase
    .from("mentor_trust_badges")
    .select("id, mentor_id, badge_type, status, public_visible")
    .in("mentor_id", mentorIds)
    .eq("status", "active")
    .eq("public_visible", true);

  if (badgeError) throw badgeError;

  (badgeRows ?? []).forEach((row) => {
    const badge = toPublicBadge(row);
    if (!badge) return;
    badgeMap.set(badge.mentor_id, [...(badgeMap.get(badge.mentor_id) ?? []), badge]);
  });

  return badgeMap;
}

export function usePublicMentorVerification(mentorId: string | null | undefined) {
  return useQuery({
    queryKey: ["public-mentor-verification", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const badgeMap = await fetchPublicTrustBadges([mentorId!]);
      const badges = badgeMap.get(mentorId!) ?? [];
      return {
        verified: badges.some((badge) => badge.badge_type === "vet_verified"),
        badges,
      };
    },
  });
}

export function usePublicMentorTrustBadgeMap(mentorIds: Array<string | null | undefined>) {
  const uniqueIds = normalizeMentorIds(mentorIds);

  return useQuery({
    queryKey: ["public-mentor-trust-badges", uniqueIds],
    enabled: uniqueIds.length > 0,
    queryFn: () => fetchPublicTrustBadges(uniqueIds),
  });
}

export function usePublicMentorVerificationMap(mentorIds: Array<string | null | undefined>) {
  const uniqueIds = normalizeMentorIds(mentorIds);

  return useQuery({
    queryKey: ["public-mentor-verifications", uniqueIds],
    enabled: uniqueIds.length > 0,
    queryFn: async () => {
      const badgeMap = await fetchPublicTrustBadges(uniqueIds);
      return new Set(
        Array.from(badgeMap.entries())
          .filter(([, badges]) => badges.some((badge) => badge.badge_type === "vet_verified"))
          .map(([mentorId]) => mentorId),
      );
    },
  });
}
