import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionPaymentSession {
  success: boolean;
  reused: boolean;
  mode: "vietqr" | "manual";
  payment_id: string;
  reference_code: string;
  amount: number;
  qr_url: string | null;
  qr_data: string | null;
  bank_account: string | null;
  bank_name: string | null;
  message: string | null;
}

export interface SubscriptionPayment {
  payment_id: string;
  reference_code: string;
  amount: number;
  payment_status: string;
  provider: string | null;
  created_at: string | null;
  paid_at: string | null;
}

type RpcPaymentRow = Partial<SubscriptionPayment> & {
  id?: string | null;
  status?: string | null;
  completed_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePayment(row: RpcPaymentRow): SubscriptionPayment {
  return {
    payment_id: String(row.payment_id ?? row.id ?? ""),
    reference_code: String(row.reference_code ?? ""),
    amount: toNumber(row.amount),
    payment_status: String(row.payment_status ?? row.status ?? "pending").toLowerCase(),
    provider: row.provider ?? null,
    created_at: row.created_at ?? null,
    paid_at: row.paid_at ?? row.completed_at ?? null,
  };
}

function normalizeSession(data: any): SubscriptionPaymentSession {
  return {
    success: Boolean(data?.success),
    reused: Boolean(data?.reused),
    mode: data?.mode === "vietqr" ? "vietqr" : "manual",
    payment_id: String(data?.payment_id ?? ""),
    reference_code: String(data?.reference_code ?? ""),
    amount: toNumber(data?.amount),
    qr_url: data?.qr_url ?? null,
    qr_data: data?.qr_data ?? null,
    bank_account: data?.bank_account ?? null,
    bank_name: data?.bank_name ?? null,
    message: data?.message ?? null,
  };
}

export function useSubscriptionPayments() {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["my-subscription-payments", userId],
    enabled: !!userId && !authLoading,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_subscription_payments");
      if (error) {
        console.error("get_my_subscription_payments RPC error:", error);
        return [] as SubscriptionPayment[];
      }

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows
        .map((row) => normalizePayment(row as RpcPaymentRow))
        .filter((payment) => payment.payment_id || payment.reference_code);
    },
  });

  const payments = query.data ?? [];
  const latestPayments = useMemo(() => payments.slice(0, 5), [payments]);

  return {
    payments,
    latestPayments,
    isLoading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}

export function useCreateSubscriptionPayment() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async ({ planCode = "vet_plus" }: { planCode?: "vet_plus" } = {}) => {
      if (!session?.user) {
        throw new Error("Vui lòng đăng nhập để nâng cấp VET Plus.");
      }

      const { data, error } = await supabase.functions.invoke("create-subscription-payment", {
        body: { plan_code: planCode },
      });

      if (error) throw error;

      if (!data?.success) {
        const message = data?.message || data?.error || "Không thể tạo phiên thanh toán VET Plus.";
        const subscriptionError = new Error(message) as Error & { code?: string };
        subscriptionError.code = data?.code;
        throw subscriptionError;
      }

      return normalizeSession(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-subscription-payments", userId] });
    },
  });
}
