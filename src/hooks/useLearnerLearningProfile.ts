import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerLearningProfile {
  id?: string | null;
  learner_id?: string | null;
  primary_goal: string | null;
  current_level: string | null;
  preferred_categories: string[];
  preferred_format: "online" | "offline" | "any";
  budget_min: number | null;
  budget_max: number | null;
  location_preference: string | null;
  schedule_preference: string | null;
  learning_style: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type LearningProfileFormValues = Omit<
  LearnerLearningProfile,
  "id" | "learner_id" | "created_at" | "updated_at"
>;

const EMPTY_PROFILE: LearnerLearningProfile = {
  primary_goal: "",
  current_level: "",
  preferred_categories: [],
  preferred_format: "any",
  budget_min: null,
  budget_max: null,
  location_preference: "",
  schedule_preference: "",
  learning_style: "",
  notes: "",
};

function normalizeProfile(row: Partial<LearnerLearningProfile> | null | undefined): LearnerLearningProfile {
  if (!row) return EMPTY_PROFILE;
  return {
    id: row.id ?? null,
    learner_id: row.learner_id ?? null,
    primary_goal: row.primary_goal ?? "",
    current_level: row.current_level ?? "",
    preferred_categories: Array.isArray(row.preferred_categories) ? row.preferred_categories : [],
    preferred_format:
      row.preferred_format === "online" || row.preferred_format === "offline" || row.preferred_format === "any"
        ? row.preferred_format
        : "any",
    budget_min: row.budget_min ?? null,
    budget_max: row.budget_max ?? null,
    location_preference: row.location_preference ?? "",
    schedule_preference: row.schedule_preference ?? "",
    learning_style: row.learning_style ?? "",
    notes: row.notes ?? "",
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function useLearnerLearningProfile() {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["learner-learning-profile", userId],
    enabled: !!userId && !authLoading,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_learning_profile");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return normalizeProfile(row);
    },
    placeholderData: EMPTY_PROFILE,
  });
}

export function useUpsertLearnerLearningProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async (values: LearningProfileFormValues) => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      const { data, error } = await (supabase as any).rpc("upsert_my_learning_profile", {
        _primary_goal: values.primary_goal?.trim() || null,
        _current_level: values.current_level?.trim() || null,
        _preferred_categories: values.preferred_categories ?? [],
        _preferred_format: values.preferred_format || "any",
        _budget_min: values.budget_min,
        _budget_max: values.budget_max,
        _location_preference: values.location_preference?.trim() || null,
        _schedule_preference: values.schedule_preference?.trim() || null,
        _learning_style: values.learning_style?.trim() || null,
        _notes: values.notes?.trim() || null,
      });
      if (error) throw error;
      return normalizeProfile(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner-learning-profile", userId] });
    },
  });
}
