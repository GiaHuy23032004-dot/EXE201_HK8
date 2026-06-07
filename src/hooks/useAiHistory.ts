import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface AiHistoryItem {
  id: string;
  feature: string;
  credits_used: number;
  status: string;
  prompt_preview: string | null;
  metadata: Record<string, any>;
  created_at: string;
  completed_at: string | null;
  refunded_at: string | null;
}

export type AiHistoryFilter = "all" | "course_match" | "advisor" | "compare" | "roadmap" | "chat_search";

export function useAiHistory(filter: AiHistoryFilter = "all") {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["my-ai-history", userId, filter],
    enabled: !!userId && !authLoading,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_ai_history", {
        _feature: filter,
      });
      if (error) throw error;
      return ((data ?? []) as AiHistoryItem[]).map((item) => ({
        ...item,
        metadata: item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? item.metadata
          : {},
      }));
    },
    placeholderData: [],
  });
}
