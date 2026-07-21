import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

type WithdrawalAction =
  | "list_withdrawals"
  | "get_withdrawal_detail"
  | "mark_paid_simple"
  | "reject_withdrawal_simple"
  | "approve_paid"
  | "reject_withdrawal"
  | "get_withdrawal_metrics"
  | "get_audit_logs";

const isSchemaCacheColumnError = (error: any) => {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "PGRST204" || message.includes("schema cache") || message.includes("column");
};

const getProfiles = async (client: any, mentorIds: string[]) => {
  const ids = Array.from(new Set(mentorIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("profiles")
    .select("user_id, name, email, phone, avatar_url, role, is_blocked, created_at")
    .in("user_id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((profile: any) => [profile.user_id, profile]));
};

const getWallets = async (client: any, mentorIds: string[]) => {
  const ids = Array.from(new Set(mentorIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("mentor_wallets")
    .select("id, mentor_id, balance, held_balance, total_earned, updated_at")
    .in("mentor_id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((wallet: any) => [wallet.mentor_id, wallet]));
};

const getAuditLogs = async (client: any, requestId: string) => {
  const { data, error } = await client
    .from("withdrawal_audit_logs")
    .select("id, withdrawal_request_id, mentor_id, action, amount, old_status, new_status, performed_by, note, metadata, created_at")
    .eq("withdrawal_request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("withdrawal audit logs unavailable:", {
      code: error.code,
      message: error.message,
    });
    return [];
  }

  return data ?? [];
};

const enrichWithdrawals = async (client: any, withdrawals: any[], includeDetail = false) => {
  const mentorIds = withdrawals.map((item) => item.mentor_id).filter(Boolean);
  const [profileById, walletByMentor] = await Promise.all([
    getProfiles(client, mentorIds),
    includeDetail ? getWallets(client, mentorIds) : Promise.resolve(new Map<string, any>()),
  ]);

  return Promise.all(withdrawals.map(async (withdrawal) => ({
    ...withdrawal,
    mentor: profileById.get(withdrawal.mentor_id) ?? null,
    wallet: includeDetail ? walletByMentor.get(withdrawal.mentor_id) ?? null : null,
    audit_logs: includeDetail ? await getAuditLogs(client, withdrawal.id) : undefined,
  })));
};

const getWithdrawalDetail = async (client: any, requestId: string) => {
  const { data, error } = await client
    .from("withdrawal_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [detail] = await enrichWithdrawals(client, [data], true);
  return detail;
};

const getMetrics = async (client: any) => {
  const { data, error } = await client
    .from("withdrawal_requests")
    .select("amount, status");

  if (error) throw error;
  const rows = data ?? [];
  const pending = rows.filter((row: any) => row.status === "pending");
  const paid = rows.filter((row: any) => row.status === "paid");
  const rejected = rows.filter((row: any) => row.status === "rejected");

  return {
    total: rows.length,
    pending: pending.length,
    pending_amount: pending.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0),
    paid: paid.length,
    paid_amount: paid.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0),
    rejected: rejected.length,
  };
};

const loadPendingWithdrawal = async (client: any, requestId: string) => {
  const { data, error } = await client
    .from("withdrawal_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { error: json({ error: "Không tìm thấy yêu cầu rút tiền." }, 404), withdrawal: null };
  if (data.status !== "pending") {
    return {
      error: json({ error: "Yêu cầu này đã được xử lý và không thể cập nhật lại." }, 409),
      withdrawal: null,
    };
  }

  return { error: null, withdrawal: data };
};

const updatePendingWithdrawal = async (
  client: any,
  requestId: string,
  preferredPayload: Record<string, unknown>,
  fallbackPayload: Record<string, unknown>,
) => {
  let result = await client
    .from("withdrawal_requests")
    .update(preferredPayload)
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (result.error && isSchemaCacheColumnError(result.error)) {
    result = await client
      .from("withdrawal_requests")
      .update(fallbackPayload)
      .eq("id", requestId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
  }

  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error("Yêu cầu này đã được xử lý và không thể cập nhật lại.");
  }

  return result.data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = getBearerToken(req);
    if (!jwt) return json({ error: "Missing authorization token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server env not configured" }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    const currentUser = userData.user;
    if (userError || !currentUser) return json({ error: "Invalid authorization token" }, 401);

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) throw adminRoleError;
    if (adminRole?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as WithdrawalAction | undefined;
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const paidReference = typeof body.paidReference === "string" ? body.paidReference.trim() : "";
    const rejectedReason = typeof body.rejectedReason === "string" ? body.rejectedReason.trim() : "";
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "list_withdrawals") {
      const { data, error } = await adminClient
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ withdrawals: await enrichWithdrawals(adminClient, data ?? []), metrics: await getMetrics(adminClient) });
    }

    if (action === "get_withdrawal_metrics") {
      return json({ metrics: await getMetrics(adminClient) });
    }

    if (!requestId) return json({ error: "Missing requestId" }, 400);

    if (action === "get_withdrawal_detail") {
      const detail = await getWithdrawalDetail(adminClient, requestId);
      if (!detail) return json({ error: "Withdrawal request not found" }, 404);
      return json({ withdrawal: detail });
    }

    if (action === "get_audit_logs") {
      return json({ auditLogs: await getAuditLogs(adminClient, requestId) });
    }

    if (action === "mark_paid_simple" || action === "approve_paid") {
      const pending = await loadPendingWithdrawal(adminClient, requestId);
      if (pending.error) return pending.error;

      const processedAt = new Date().toISOString();
      const preferredPayload = {
        status: "paid",
        processed_at: processedAt,
        processed_by: currentUser.id,
        paid_reference: paidReference || null,
        processed_reference: paidReference || null,
        admin_note: adminNote || null,
      };
      const fallbackPayload = {
        status: "paid",
        processed_at: processedAt,
        processed_reference: paidReference || null,
        admin_note: adminNote || null,
      };

      const updated = await updatePendingWithdrawal(adminClient, requestId, preferredPayload, fallbackPayload);
      return json({ success: true, withdrawal: await getWithdrawalDetail(adminClient, updated.id) });
    }

    if (action === "reject_withdrawal_simple" || action === "reject_withdrawal") {
      if (!rejectedReason) return json({ error: "Vui lòng nhập lý do từ chối." }, 400);

      const pending = await loadPendingWithdrawal(adminClient, requestId);
      if (pending.error) return pending.error;

      const processedAt = new Date().toISOString();
      const preferredPayload = {
        status: "rejected",
        processed_at: processedAt,
        processed_by: currentUser.id,
        rejected_reason: rejectedReason,
        rejection_reason: rejectedReason,
        admin_note: adminNote || null,
      };
      const fallbackPayload = {
        status: "rejected",
        processed_at: processedAt,
        rejection_reason: rejectedReason,
        admin_note: adminNote || null,
      };

      const updated = await updatePendingWithdrawal(adminClient, requestId, preferredPayload, fallbackPayload);
      return json({ success: true, withdrawal: await getWithdrawalDetail(adminClient, updated.id) });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-withdrawal-actions error:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      details: (error as any)?.details,
    });
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
