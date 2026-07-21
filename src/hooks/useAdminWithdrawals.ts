import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WithdrawalStatus = "pending" | "paid" | "rejected";

export type AdminWithdrawalMentor = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  role?: string | null;
  is_blocked?: boolean | null;
  created_at?: string | null;
};

export type AdminWithdrawalWallet = {
  id: string;
  mentor_id: string;
  balance: number;
  held_balance: number;
  total_earned: number;
  updated_at: string | null;
};

export type WithdrawalAuditLog = {
  id: string;
  withdrawal_request_id: string;
  mentor_id: string;
  action: string;
  amount: number | null;
  old_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminWithdrawal = {
  id: string;
  mentor_id: string;
  payout_method_id?: string | null;
  reference_code?: string | null;
  amount: number;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  status: WithdrawalStatus;
  admin_note: string | null;
  rejection_reason?: string | null;
  rejected_reason?: string | null;
  processed_reference?: string | null;
  paid_reference?: string | null;
  processed_by?: string | null;
  processed_at: string | null;
  requested_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  mentor?: AdminWithdrawalMentor | null;
  wallet?: AdminWithdrawalWallet | null;
  audit_logs?: WithdrawalAuditLog[];
};

export type WithdrawalMetrics = {
  total: number;
  pending: number;
  pending_amount: number;
  paid: number;
  paid_amount: number;
  rejected: number;
};

type WithdrawalResponse = {
  error?: string;
  success?: boolean;
  withdrawals?: AdminWithdrawal[];
  withdrawal?: AdminWithdrawal;
  metrics?: WithdrawalMetrics;
  auditLogs?: WithdrawalAuditLog[];
};

export type MarkPaidWithdrawalPayload = {
  requestId: string;
  paidReference?: string;
  adminNote?: string;
};

export type RejectWithdrawalPayload = {
  requestId: string;
  rejectedReason: string;
  adminNote?: string;
};

export const adminWithdrawalKeys = {
  all: ["admin-withdrawals"] as const,
  list: () => ["admin-withdrawals", "list"] as const,
  detail: (requestId?: string | null) => ["admin-withdrawals", "detail", requestId] as const,
};

export function useAdminWithdrawalApi() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const invokeWithdrawalAction = useCallback(
    async (body: Record<string, unknown>) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Missing admin session");

      const { data, error } = await supabase.functions.invoke<WithdrawalResponse>("admin-withdrawal-actions", {
        body,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (import.meta.env.DEV) {
        console.log("admin-withdrawal-actions response", { body, data, error });
      }

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Không thể xử lý yêu cầu rút tiền.");
      }

      return data ?? {};
    },
    [session?.access_token],
  );

  const refreshWithdrawals = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: adminWithdrawalKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["mentor-withdrawals"] });
  }, [queryClient]);

  return {
    accessToken: session?.access_token,
    invokeWithdrawalAction,
    refreshWithdrawals,
  };
}

export function useAdminWithdrawals() {
  const { accessToken, invokeWithdrawalAction } = useAdminWithdrawalApi();

  return useQuery({
    queryKey: adminWithdrawalKeys.list(),
    enabled: !!accessToken,
    queryFn: async () => {
      const data = await invokeWithdrawalAction({ action: "list_withdrawals" });
      return {
        withdrawals: data.withdrawals ?? [],
        metrics: data.metrics ?? {
          total: 0,
          pending: 0,
          pending_amount: 0,
          paid: 0,
          paid_amount: 0,
          rejected: 0,
        },
      };
    },
  });
}

export function useAdminWithdrawalDetail(requestId?: string | null, enabled = true) {
  const { accessToken, invokeWithdrawalAction } = useAdminWithdrawalApi();

  return useQuery({
    queryKey: adminWithdrawalKeys.detail(requestId),
    enabled: Boolean(accessToken && requestId && enabled),
    queryFn: async () => {
      const data = await invokeWithdrawalAction({ action: "get_withdrawal_detail", requestId });
      return data.withdrawal as AdminWithdrawal;
    },
  });
}

export function useAdminWithdrawalActions() {
  const api = useAdminWithdrawalApi();

  const markPaid = useMutation({
    mutationFn: (payload: MarkPaidWithdrawalPayload) =>
      api.invokeWithdrawalAction({
        action: "mark_paid_simple",
        requestId: payload.requestId,
        paidReference: payload.paidReference,
        adminNote: payload.adminNote,
      }),
    onSuccess: () => {
      void api.refreshWithdrawals();
    },
  });

  const rejectWithdrawal = useMutation({
    mutationFn: (payload: RejectWithdrawalPayload) =>
      api.invokeWithdrawalAction({
        action: "reject_withdrawal_simple",
        requestId: payload.requestId,
        rejectedReason: payload.rejectedReason,
        adminNote: payload.adminNote,
      }),
    onSuccess: () => {
      void api.refreshWithdrawals();
    },
  });

  return {
    ...api,
    markPaid,
    rejectWithdrawal,
  };
}
