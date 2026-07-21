import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LedgerTypeFilter =
  | "all"
  | "inflow"
  | "refund"
  | "payout_paid"
  | "payout_pending"
  | "payout_rejected"
  | "payment_failed";

export type AdminLedgerSummary = {
  totalInflow: number;
  platformFee: number;
  mentorNet: number;
  payoutPaid: number;
  payoutPending: number;
  refundedAmount: number;
  failedAmount: number;
  demoTransactionCount?: number;
  realTransactionCount?: number;
  successTransactionCount?: number;
  mismatchedSuccessCount?: number;
};

export type AdminLedgerEntry = {
  id: string;
  source: "transaction" | "withdrawal";
  type: "inflow" | "refund" | "payment_failed" | "payout_paid" | "payout_pending" | "payout_rejected";
  reference: string | null;
  senderName: string | null;
  senderEmail: string | null;
  receiverName: string | null;
  receiverEmail: string | null;
  courseTitle: string | null;
  amount: number;
  platformFee: number | null;
  netAmount: number | null;
  status: string;
  note: string | null;
  createdAt: string;
  isDemo: boolean;
  hasMismatch?: boolean;
  mismatchAmount?: number;
};

type LedgerResponse = {
  success?: boolean;
  error?: string;
  summary?: AdminLedgerSummary;
  entries?: AdminLedgerEntry[];
  totalCount?: number;
  warnings?: string[];
};

export type AdminLedgerFilters = {
  from?: string;
  to?: string;
  type?: LedgerTypeFilter;
  search?: string;
};

export const adminLedgerKeys = {
  all: ["admin-ledger"] as const,
  list: (filters: AdminLedgerFilters) => ["admin-ledger", "list", filters] as const,
};

export function useAdminLedgerApi() {
  const { session } = useAuth();

  const invokeLedgerAction = useCallback(
    async (body: Record<string, unknown>) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Missing admin session");

      const { data, error } = await supabase.functions.invoke<LedgerResponse>("admin-ledger-actions", {
        body,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (import.meta.env.DEV) {
        console.log("admin-ledger-actions response", { body, data, error });
      }

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Không thể tải sổ cái dòng tiền.");
      }

      return data ?? {};
    },
    [session?.access_token],
  );

  return {
    accessToken: session?.access_token,
    invokeLedgerAction,
  };
}

export function useAdminLedger(filters: AdminLedgerFilters) {
  const { accessToken, invokeLedgerAction } = useAdminLedgerApi();

  return useQuery({
    queryKey: adminLedgerKeys.list(filters),
    enabled: !!accessToken,
    queryFn: async () => {
      const data = await invokeLedgerAction({
        action: "list_ledger_entries",
        filters,
      });

      return {
        summary: data.summary ?? {
          totalInflow: 0,
          platformFee: 0,
          mentorNet: 0,
          payoutPaid: 0,
          payoutPending: 0,
          refundedAmount: 0,
          failedAmount: 0,
        },
        entries: data.entries ?? [],
        totalCount: data.totalCount ?? data.entries?.length ?? 0,
        warnings: data.warnings ?? [],
      };
    },
  });
}
