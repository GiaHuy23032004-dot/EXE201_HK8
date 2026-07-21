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

type LedgerTypeFilter =
  | "all"
  | "inflow"
  | "refund"
  | "payout_paid"
  | "payout_pending"
  | "payout_rejected"
  | "payment_failed";

type LedgerEntry = {
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
  searchText?: string;
};

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const toNumber = (value: unknown) => Number(value ?? 0) || 0;

const normalizeText = (value: unknown) => String(value ?? "").trim();

const demoPattern = /\[(?:DEMO[^\]]*)\]|DEMO_DASH|DEMO_DASH_V2|DEMO_DASHBOARD|DEMO_DASHBOARD_SEED|DEMO_DASHBOARD_SEED_V2/i;

const isDemoValue = (...values: Array<string | null | undefined>) =>
  values.some((value) => Boolean(value && demoPattern.test(value)));

const cleanDemoText = (value?: string | null, fallback: string | null = "") => {
  if (!value) return fallback;
  if (demoPattern.test(value)) return fallback || "Giao dịch mẫu";
  return value.replace(/\[(?:DEMO[^\]]*)\]\s*/gi, "").trim() || fallback;
};

const dateInRange = (isoDate: string, from?: string, to?: string) => {
  const time = new Date(isoDate).getTime();
  if (from && time < new Date(`${from}T00:00:00.000Z`).getTime()) return false;
  if (to && time >= new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) return false;
  return true;
};

const getProfiles = async (client: any, userIds: string[]) => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("profiles")
    .select("user_id, name, email")
    .in("user_id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((profile: any) => [profile.user_id, profile]));
};

const getCourses = async (client: any, courseIds: string[]) => {
  const ids = Array.from(new Set(courseIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();

  const { data, error } = await client
    .from("courses")
    .select("id, title")
    .in("id", ids);

  if (error) throw error;
  return new Map((data ?? []).map((course: any) => [course.id, course]));
};

const transactionType = (status: string): LedgerEntry["type"] | null => {
  if (status === "success") return "inflow";
  if (status === "refunded") return "refund";
  if (status === "failed") return "payment_failed";
  return null;
};

const withdrawalType = (status: string): LedgerEntry["type"] | null => {
  if (status === "paid") return "payout_paid";
  if (status === "pending") return "payout_pending";
  if (status === "rejected") return "payout_rejected";
  return null;
};

const matchesTypeFilter = (entry: LedgerEntry, filter: LedgerTypeFilter) => {
  if (filter === "all") return true;
  if (filter === "refund") return entry.type === "refund";
  if (filter === "payment_failed") return entry.type === "payment_failed";
  return entry.type === filter;
};

const matchesSearch = (entry: LedgerEntry, search?: string) => {
  const keyword = normalizeText(search).toLowerCase();
  if (!keyword) return true;

  const searchable = [
    entry.reference,
    entry.senderName,
    entry.senderEmail,
    entry.receiverName,
    entry.receiverEmail,
    entry.courseTitle,
    entry.note,
    entry.status,
    entry.searchText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(keyword);
};

const buildSummary = (entries: LedgerEntry[]) => entries.reduce((summary, entry) => {
  if (entry.type === "inflow" && entry.status === "success") {
    summary.totalInflow += entry.amount;
    summary.platformFee += toNumber(entry.platformFee);
    summary.mentorNet += toNumber(entry.netAmount);
    summary.successTransactionCount += 1;
    if (entry.hasMismatch) summary.mismatchedSuccessCount += 1;
  }

  if (entry.source === "transaction") {
    if (entry.isDemo) summary.demoTransactionCount += 1;
    else summary.realTransactionCount += 1;
  }

  if (entry.type === "refund") {
    summary.refundedAmount += entry.amount;
  }

  if (entry.type === "payment_failed") {
    summary.failedAmount += entry.amount;
  }

  if (entry.type === "payout_paid") {
    summary.payoutPaid += entry.amount;
  }

  if (entry.type === "payout_pending") {
    summary.payoutPending += entry.amount;
  }

  return summary;
}, {
  totalInflow: 0,
  platformFee: 0,
  mentorNet: 0,
  payoutPaid: 0,
  payoutPending: 0,
  refundedAmount: 0,
  failedAmount: 0,
  demoTransactionCount: 0,
  realTransactionCount: 0,
  successTransactionCount: 0,
  mismatchedSuccessCount: 0,
});

const listLedgerEntries = async (client: any, filters: any) => {
  const from = typeof filters?.from === "string" ? filters.from : undefined;
  const to = typeof filters?.to === "string" ? filters.to : undefined;
  const type = (typeof filters?.type === "string" ? filters.type : "all") as LedgerTypeFilter;
  const search = typeof filters?.search === "string" ? filters.search : undefined;

  let transactionsQuery = client
    .from("transactions")
    .select("*")
    .in("status", ["success", "refunded", "failed"]);

  let withdrawalsQuery = client
    .from("withdrawal_requests")
    .select("*")
    .in("status", ["paid", "pending", "rejected"]);

  if (from) {
    transactionsQuery = transactionsQuery.gte("created_at", `${from}T00:00:00.000Z`);
    withdrawalsQuery = withdrawalsQuery.gte("created_at", `${from}T00:00:00.000Z`);
  }

  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    transactionsQuery = transactionsQuery.lt("created_at", end.toISOString());
    withdrawalsQuery = withdrawalsQuery.lt("created_at", end.toISOString());
  }

  const [transactionsResult, withdrawalsResult] = await Promise.all([
    transactionsQuery.order("created_at", { ascending: false }),
    withdrawalsQuery.order("created_at", { ascending: false }),
  ]);

  if (transactionsResult.error) throw transactionsResult.error;
  if (withdrawalsResult.error) throw withdrawalsResult.error;

  const transactions = transactionsResult.data ?? [];
  const withdrawals = withdrawalsResult.data ?? [];

  const userIds = [
    ...transactions.flatMap((transaction: any) => [transaction.learner_id, transaction.mentor_id]),
    ...withdrawals.map((withdrawal: any) => withdrawal.mentor_id),
  ].filter(Boolean);
  const courseIds = transactions.map((transaction: any) => transaction.course_id).filter(Boolean);

  const [profilesById, coursesById] = await Promise.all([
    getProfiles(client, userIds),
    getCourses(client, courseIds),
  ]);

  const transactionEntries: LedgerEntry[] = transactions
    .filter((transaction: any) => dateInRange(transaction.created_at, from, to))
    .map((transaction: any) => {
      const status = String(transaction.status ?? "");
      const type = transactionType(status);
      if (!type) return null;

      const learner = profilesById.get(transaction.learner_id);
      const mentor = profilesById.get(transaction.mentor_id);
      const course = transaction.course_id ? coursesById.get(transaction.course_id) : null;
      const isDemo = isDemoValue(transaction.reference_code, course?.title);
      const amount = toNumber(transaction.amount);
      const platformFee = toNumber(transaction.platform_fee);
      const netAmount = toNumber(transaction.net_amount);
      const mismatchAmount = status === "success" ? amount - (platformFee + netAmount) : 0;
      const hasMismatch = status === "success" && Math.abs(mismatchAmount) > 1;

      return {
        id: transaction.id,
        source: "transaction",
        type,
        reference: transaction.reference_code ?? null,
        senderName: learner?.name ?? null,
        senderEmail: learner?.email ?? null,
        receiverName: mentor?.name ?? null,
        receiverEmail: mentor?.email ?? null,
        courseTitle: cleanDemoText(course?.title, isDemo ? "Giao dịch mẫu" : ""),
        amount,
        platformFee: status === "success" ? platformFee : null,
        netAmount: status === "success" ? netAmount : null,
        status,
        note: isDemo ? "Giao dịch mẫu" : null,
        createdAt: transaction.created_at,
        isDemo,
        hasMismatch,
        mismatchAmount,
        searchText: normalizeText(transaction.reference_code),
      } satisfies LedgerEntry;
    })
    .filter(Boolean) as LedgerEntry[];

  const withdrawalEntries: LedgerEntry[] = withdrawals
    .filter((withdrawal: any) => dateInRange(withdrawal.created_at, from, to))
    .map((withdrawal: any) => {
      const status = String(withdrawal.status ?? "");
      const type = withdrawalType(status);
      if (!type) return null;

      const mentor = profilesById.get(withdrawal.mentor_id);
      const reference = withdrawal.paid_reference || withdrawal.processed_reference || withdrawal.reference_code || null;
      const rawNote = withdrawal.rejected_reason || withdrawal.rejection_reason || withdrawal.admin_note || null;
      const isDemo = isDemoValue(reference, rawNote, mentor?.name, withdrawal.bank_holder);

      return {
        id: withdrawal.id,
        source: "withdrawal",
        type,
        reference,
        senderName: "VET",
        senderEmail: null,
        receiverName: cleanDemoText(mentor?.name, null) || mentor?.email || null,
        receiverEmail: mentor?.email ?? null,
        courseTitle: null,
        amount: toNumber(withdrawal.amount),
        platformFee: null,
        netAmount: null,
        status,
        note: cleanDemoText(rawNote, isDemo ? "Yêu cầu rút tiền mẫu" : ""),
        createdAt: withdrawal.created_at,
        isDemo,
        searchText: [
          withdrawal.bank_holder,
          withdrawal.bank_name,
          withdrawal.reference_code,
          withdrawal.paid_reference,
          withdrawal.processed_reference,
        ].filter(Boolean).join(" "),
      } satisfies LedgerEntry;
    })
    .filter(Boolean) as LedgerEntry[];

  const allDateEntries = [...transactionEntries, ...withdrawalEntries];

  const warnings: string[] = [];
  const summary = buildSummary(allDateEntries);
  const diff = summary.totalInflow - (summary.platformFee + summary.mentorNet);

  if (summary.mismatchedSuccessCount > 0 || Math.abs(diff) > 1) {
    warnings.push("Có giao dịch có amount khác platform_fee + net_amount");
  }

  console.log("admin-ledger debug", {
    from,
    to,
    type,
    search: Boolean(search),
    transactionSuccessCount: summary.successTransactionCount,
    sumAmountSuccess: summary.totalInflow,
    sumPlatformFeeSuccess: summary.platformFee,
    sumNetAmountSuccess: summary.mentorNet,
    payoutPaidSum: summary.payoutPaid,
    payoutPendingSum: summary.payoutPending,
    refundedSum: summary.refundedAmount,
    demoTransactionCount: summary.demoTransactionCount,
    realTransactionCount: summary.realTransactionCount,
    mismatchCount: summary.mismatchedSuccessCount,
    diff,
  });

  const entries = allDateEntries
    .filter((entry) => matchesTypeFilter(entry, type))
    .filter((entry) => matchesSearch(entry, search))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    summary,
    entries,
    totalCount: entries.length,
    warnings,
  };
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
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "list_ledger_entries" || action === "get_ledger_summary" || action === "export_ledger_csv") {
      const result = await listLedgerEntries(adminClient, body.filters ?? {});
      return json({ success: true, ...result });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-ledger-actions error:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      details: (error as any)?.details,
    });
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
