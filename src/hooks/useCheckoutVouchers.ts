import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SubscriptionVoucher } from "@/constants/subscription";

export interface VoucherPreview {
  ok: boolean;
  reason: string | null;
  voucher_id: string | null;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  min_booking_amount?: number;
}

type RpcVoucherRow = Partial<SubscriptionVoucher> & {
  id?: string | null;
  voucher_code?: string | null;
  discount_amount?: number | string | null;
  minimum_booking_amount?: number | string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeVoucher(row: RpcVoucherRow): SubscriptionVoucher {
  return {
    voucher_id: String(row.voucher_id ?? row.id ?? ""),
    code: String(row.code ?? row.voucher_code ?? ""),
    amount: toNumber(row.amount ?? row.discount_amount, 30000),
    min_booking_amount: toNumber(row.min_booking_amount ?? row.minimum_booking_amount, 300000),
    status: String(row.status ?? "unused").toLowerCase(),
    booking_id: row.booking_id ?? null,
    used_at: row.used_at ?? null,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at ?? null,
  };
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isRpcLookupError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

async function callRpcWithFallback<TData = unknown>(
  functionName: string,
  primaryParams: Record<string, unknown>,
  fallbackParams?: Record<string, unknown>,
) {
  const primaryResult = await (supabase as any).rpc(functionName, primaryParams);
  if (!primaryResult.error || !fallbackParams || !isRpcLookupError(primaryResult.error)) {
    return primaryResult as { data: TData | null; error: any };
  }

  console.error(`${functionName} primary RPC params failed; retrying compatibility params:`, primaryResult.error);
  return await (supabase as any).rpc(functionName, fallbackParams) as { data: TData | null; error: any };
}

function normalizePreview(value: unknown, fallbackAmount: number): VoucherPreview {
  const row = firstRow(value as Record<string, unknown> | Record<string, unknown>[]) ?? {};
  const ok = row.ok === true || row.success === true || row.valid === true;
  const discount = toNumber(row.discount_amount ?? row.discountAmount ?? row.amount, 0);
  const original = toNumber(row.original_amount ?? row.originalAmount ?? row.booking_amount, fallbackAmount);
  const final = toNumber(row.final_amount ?? row.finalAmount ?? row.payable_amount, Math.max(0, original - discount));

  return {
    ok,
    reason: typeof row.reason === "string" ? row.reason : typeof row.error === "string" ? row.error : null,
    voucher_id: typeof row.voucher_id === "string" ? row.voucher_id : null,
    discount_amount: discount,
    original_amount: original,
    final_amount: Math.max(0, final),
    min_booking_amount: row.min_booking_amount !== undefined ? toNumber(row.min_booking_amount, 300000) : undefined,
  };
}

export function useAvailableSubscriptionVouchers(bookingAmount: number, enabled = true) {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["my-available-subscription-vouchers", userId, bookingAmount],
    enabled: !!userId && !authLoading && enabled,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await callRpcWithFallback("get_my_available_subscription_vouchers", {
        _booking_amount: bookingAmount,
      }, {
        booking_amount: bookingAmount,
      });

      if (error) {
        console.error("get_my_available_subscription_vouchers RPC error:", error);
        return [] as SubscriptionVoucher[];
      }

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows.map((row) => normalizeVoucher(row as RpcVoucherRow)).filter((voucher) => voucher.voucher_id || voucher.code);
    },
  });
}

export function usePreviewSubscriptionVoucher() {
  return useMutation({
    mutationFn: async ({ voucherId, bookingAmount }: { voucherId: string; bookingAmount: number }) => {
      const { data, error } = await callRpcWithFallback("preview_subscription_voucher", {
        _voucher_id: voucherId,
        _booking_amount: bookingAmount,
      }, {
        booking_amount: bookingAmount,
        voucher_id: voucherId,
      });
      if (error) {
        console.error("preview_subscription_voucher RPC error:", error);
        throw new Error("Không thể kiểm tra voucher lúc này. Vui lòng thử lại.");
      }
      return normalizePreview(data, bookingAmount);
    },
  });
}

export function useApplySubscriptionVoucherToBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voucherId, bookingId }: { voucherId: string; bookingId: string }) => {
      const { data, error } = await callRpcWithFallback("apply_subscription_voucher_to_booking", {
        _voucher_id: voucherId,
        _booking_id: bookingId,
      }, {
        voucher_id: voucherId,
        booking_id: bookingId,
      });
      if (error) {
        console.error("apply_subscription_voucher_to_booking RPC error:", error);
        throw new Error("Không thể áp dụng voucher lúc này. Vui lòng thử lại.");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-subscription-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["my-available-subscription-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["learner-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["learner-booking", variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ["learner-receipt", variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ["learner-receipt"] });
    },
  });
}

export function useRemoveSubscriptionVoucherFromBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId }: { bookingId: string }) => {
      const { data, error } = await callRpcWithFallback("remove_subscription_voucher_from_booking", {
        _booking_id: bookingId,
      }, {
        booking_id: bookingId,
      });
      if (error) {
        console.error("remove_subscription_voucher_from_booking RPC error:", error);
        throw new Error("Không thể gỡ voucher lúc này. Vui lòng thử lại.");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-subscription-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["my-available-subscription-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["learner-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["learner-booking", variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ["learner-receipt", variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ["learner-receipt"] });
    },
  });
}
