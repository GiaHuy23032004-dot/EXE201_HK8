import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionVoucher } from "@/constants/subscription";

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

function isExpired(voucher: SubscriptionVoucher) {
  if (voucher.status === "expired") return true;
  if (!voucher.expires_at) return false;
  const expiresAt = new Date(voucher.expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
}

function isUsed(voucher: SubscriptionVoucher) {
  return voucher.status === "used" || Boolean(voucher.used_at || voucher.booking_id);
}

export function useSubscriptionVouchers() {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["my-subscription-vouchers", userId],
    enabled: !!userId && !authLoading,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_subscription_vouchers");
      if (error) {
        console.error("get_my_subscription_vouchers RPC error:", error);
        return [] as SubscriptionVoucher[];
      }

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows.map((row) => normalizeVoucher(row as RpcVoucherRow)).filter((voucher) => voucher.voucher_id || voucher.code);
    },
  });

  const vouchers = query.data ?? [];

  const grouped = useMemo(() => {
    const expiredVouchers = vouchers.filter(isExpired);
    const usedVouchers = vouchers.filter((voucher) => !isExpired(voucher) && isUsed(voucher));
    const unusedVouchers = vouchers.filter((voucher) => !isExpired(voucher) && !isUsed(voucher));

    return { unusedVouchers, usedVouchers, expiredVouchers };
  }, [vouchers]);

  return {
    vouchers,
    unusedVouchers: grouped.unusedVouchers,
    usedVouchers: grouped.usedVouchers,
    expiredVouchers: grouped.expiredVouchers,
    isLoading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}
