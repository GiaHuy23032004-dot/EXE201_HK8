import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FREE_SUBSCRIPTION,
  MySubscription,
  SUBSCRIPTION_PLAN_BY_CODE,
  normalizeSubscriptionPlanCode,
} from "@/constants/subscription";

type RpcSubscriptionRow = Partial<MySubscription> & {
  id?: string | null;
  plan?: string | null;
  code?: string | null;
  name?: string | null;
  features?: string[] | Record<string, unknown> | string | null;
};

function toNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeFeatures(value: RpcSubscriptionRow["features"], fallback: string[]) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value ? [value] : fallback;
    }
  }
  if (value && typeof value === "object") {
    const maybeFeatures = (value as { features?: unknown }).features;
    if (Array.isArray(maybeFeatures)) return maybeFeatures.map(String);
  }
  return fallback;
}

function normalizeSubscription(row: RpcSubscriptionRow | null | undefined): MySubscription {
  if (!row) return FREE_SUBSCRIPTION;

  const planCode = normalizeSubscriptionPlanCode(row.plan_code ?? row.plan ?? row.code);
  const plan = SUBSCRIPTION_PLAN_BY_CODE[planCode];
  const isPlus = Boolean(row.is_plus ?? planCode === "vet_plus");

  return {
    subscription_id: row.subscription_id ?? row.id ?? null,
    plan_code: planCode,
    plan_name: row.plan_name ?? row.name ?? plan.name,
    status: row.status ?? "active",
    is_plus: isPlus,
    price: toNumber(row.price, plan.price),
    billing_interval: row.billing_interval ?? plan.billingInterval,
    current_period_start: row.current_period_start ?? null,
    current_period_end: row.current_period_end ?? null,
    ai_credits_remaining: toNumber(row.ai_credits_remaining, plan.aiCreditsPerMonth),
    ai_credits_per_month: toNumber(row.ai_credits_per_month, plan.aiCreditsPerMonth),
    voucher_count: toNumber(row.voucher_count, plan.voucherCount),
    voucher_amount: toNumber(row.voucher_amount, plan.voucherAmount),
    voucher_min_booking_amount: toNumber(row.voucher_min_booking_amount, plan.voucherMinBookingAmount),
    features: normalizeFeatures(row.features, plan.features),
  };
}

export function useSubscription() {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["my-subscription", userId],
    enabled: !!userId && !authLoading,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_subscription");
      if (error) {
        console.error("get_my_subscription RPC error:", error);
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return normalizeSubscription(row);
    },
  });

  const subscription = useMemo(
    () => query.data ?? FREE_SUBSCRIPTION,
    [query.data],
  );

  return {
    subscription,
    isLoading: authLoading || query.isLoading,
    error: query.error,
    isPlus: subscription.is_plus,
    planCode: subscription.plan_code,
    aiCreditsRemaining: subscription.ai_credits_remaining,
    refetch: query.refetch,
  };
}
