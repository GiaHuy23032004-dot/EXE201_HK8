import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePublicMentorVerification(mentorId: string | null | undefined) {
  return useQuery({
    queryKey: ["public-mentor-verification", mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_verifications")
        .select("mentor_id")
        .eq("mentor_id", mentorId!)
        .eq("status", "approved")
        .maybeSingle();

      if (error) throw error;
      return { verified: Boolean(data) };
    },
  });
}

export function usePublicMentorVerificationMap(mentorIds: Array<string | null | undefined>) {
  const uniqueIds = Array.from(
    new Set(mentorIds.filter((mentorId): mentorId is string => Boolean(mentorId))),
  );

  return useQuery({
    queryKey: ["public-mentor-verifications", uniqueIds],
    enabled: uniqueIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_verifications")
        .select("mentor_id")
        .eq("status", "approved")
        .in("mentor_id", uniqueIds);

      if (error) throw error;
      return new Set((data ?? []).map((row) => row.mentor_id));
    },
  });
}
