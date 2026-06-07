import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getId = (row: Record<string, unknown>) =>
  String(row.id ?? row.payment_id ?? row.subscription_id ?? row.voucher_id ?? "");

const getPlanCode = (plan: Record<string, unknown> | undefined) =>
  String(plan?.code ?? plan?.plan_code ?? "").toLowerCase();

const getPlanName = (plan: Record<string, unknown> | undefined) => {
  const name = plan?.name ?? plan?.plan_name;
  return name ? String(name) : getPlanCode(plan) || "VET Plus";
};

const getPaymentStatus = (row: Record<string, unknown>) =>
  String(row.payment_status ?? row.status ?? "pending").toLowerCase();

const getProfile = (profiles: Map<string, Record<string, unknown>>, userId: string) =>
  profiles.get(userId) ?? {};

const isSuccessStatus = (status: string) => ["success", "paid", "completed"].includes(status);
const isPendingStatus = (status: string) => status === "pending";
const isFailedStatus = (status: string) => ["failed", "cancelled", "canceled", "expired"].includes(status);

const isActiveSubscription = (subscription: Record<string, unknown>) => {
  if (String(subscription.status ?? "").toLowerCase() !== "active") return false;
  const periodEnd = subscription.current_period_end ?? subscription.expires_at;
  if (!periodEnd) return true;
  const date = new Date(String(periodEnd));
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() > Date.now();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = getBearerToken(req);
    if (!jwt) {
      return json({ error: "Missing authorization token" }, 401);
    }

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

    if (userError || !currentUser) {
      return json({ error: "Invalid authorization token" }, 401);
    }

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) {
      console.error("admin-subscriptions admin role lookup error:", adminRoleError);
      return json({ error: adminRoleError.message }, 500);
    }

    if (adminRole?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const [
      profilesRes,
      plansRes,
      subscriptionsRes,
      paymentsRes,
      vouchersRes,
      webhookEventsRes,
    ] = await Promise.all([
      adminClient.from("profiles").select("user_id, name, email, avatar_url"),
      adminClient.from("subscription_plans").select("*"),
      adminClient.from("learner_subscriptions").select("*").order("created_at", { ascending: false }),
      adminClient.from("subscription_payments").select("*").order("created_at", { ascending: false }),
      adminClient.from("subscription_vouchers").select("*"),
      adminClient.from("payment_webhook_events").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const errors = [
      profilesRes.error,
      plansRes.error,
      subscriptionsRes.error,
      paymentsRes.error,
      vouchersRes.error,
      webhookEventsRes.error,
    ].filter(Boolean);

    if (errors.length) {
      const message = errors.map((error) => error?.message).join("; ");
      console.error("admin-subscriptions query error:", message);
      return json({ error: message }, 500);
    }

    const profiles = new Map<string, Record<string, unknown>>();
    ((profilesRes.data ?? []) as Record<string, unknown>[]).forEach((profile) => {
      profiles.set(String(profile.user_id), profile);
    });

    const plansById = new Map<string, Record<string, unknown>>();
    const plansByCode = new Map<string, Record<string, unknown>>();
    ((plansRes.data ?? []) as Record<string, unknown>[]).forEach((plan) => {
      const id = getId(plan);
      const code = getPlanCode(plan);
      if (id) plansById.set(id, plan);
      if (code) plansByCode.set(code, plan);
    });

    const vouchers = ((vouchersRes.data ?? []) as Record<string, unknown>[]);
    const voucherStatsByLearner = new Map<string, { total: number; unused: number; used: number }>();
    let unusedVouchers = 0;
    let usedVouchers = 0;

    vouchers.forEach((voucher) => {
      const learnerId = String(voucher.learner_id ?? voucher.user_id ?? "");
      if (!learnerId) return;

      const status = String(voucher.status ?? "").toLowerCase();
      const isUsed = status === "used" || Boolean(voucher.used_at || voucher.booking_id);
      const isUnused = !isUsed && status !== "expired";
      const current = voucherStatsByLearner.get(learnerId) ?? { total: 0, unused: 0, used: 0 };

      current.total += 1;
      if (isUsed) {
        current.used += 1;
        usedVouchers += 1;
      } else if (isUnused) {
        current.unused += 1;
        unusedVouchers += 1;
      }

      voucherStatsByLearner.set(learnerId, current);
    });

    const rawSubscriptions = ((subscriptionsRes.data ?? []) as Record<string, unknown>[]);
    const subscriptions = rawSubscriptions.map((subscription) => {
      const learnerId = String(subscription.learner_id ?? subscription.user_id ?? "");
      const profile = getProfile(profiles, learnerId);
      const plan = plansById.get(String(subscription.plan_id ?? "")) ??
        plansByCode.get(String(subscription.plan_code ?? "vet_plus")) ??
        plansByCode.get("vet_plus");
      const voucherStats = voucherStatsByLearner.get(learnerId) ?? { total: 0, unused: 0, used: 0 };

      return {
        learner_id: learnerId,
        learner_name: profile.name ?? "Learner",
        learner_email: profile.email ?? null,
        plan_code: String((subscription.plan_code ?? getPlanCode(plan)) || "vet_plus"),
        plan_name: String(subscription.plan_name ?? getPlanName(plan)),
        status: String(subscription.status ?? "active"),
        current_period_start: subscription.current_period_start ?? null,
        current_period_end: subscription.current_period_end ?? subscription.expires_at ?? null,
        ai_credits_remaining: toNumber(subscription.ai_credits_remaining),
        created_at: subscription.created_at ?? null,
        voucher_count: voucherStats.total,
        unused_voucher_count: voucherStats.unused,
        used_voucher_count: voucherStats.used,
      };
    });

    const payments = ((paymentsRes.data ?? []) as Record<string, unknown>[]).map((payment) => {
      const learnerId = String(payment.learner_id ?? payment.user_id ?? "");
      const profile = getProfile(profiles, learnerId);

      return {
        payment_id: getId(payment),
        learner_id: learnerId,
        learner_name: profile.name ?? "Learner",
        learner_email: profile.email ?? null,
        reference_code: payment.reference_code ?? null,
        amount: toNumber(payment.amount),
        payment_status: getPaymentStatus(payment),
        provider: payment.provider ?? null,
        payment_method: payment.payment_method ?? null,
        created_at: payment.created_at ?? null,
        paid_at: payment.paid_at ?? null,
        completed_at: payment.completed_at ?? null,
      };
    });

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const totalRevenue = payments
      .filter((payment) => isSuccessStatus(payment.payment_status))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const monthlyRevenue = payments
      .filter((payment) => isSuccessStatus(payment.payment_status))
      .filter((payment) => {
        const timestamp = payment.paid_at ?? payment.completed_at ?? payment.created_at;
        if (!timestamp) return false;
        const date = new Date(String(timestamp));
        return Number.isFinite(date.getTime()) && date >= currentMonthStart;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    const activePlusUsers = rawSubscriptions.filter((subscription) => {
      const plan = plansById.get(String(subscription.plan_id ?? "")) ??
        plansByCode.get(String(subscription.plan_code ?? "vet_plus")) ??
        plansByCode.get("vet_plus");
      const planCode = String(subscription.plan_code ?? getPlanCode(plan) ?? "vet_plus");
      return planCode === "vet_plus" && isActiveSubscription(subscription);
    }).length;

    const totalAiCreditsRemaining = rawSubscriptions
      .filter(isActiveSubscription)
      .reduce((sum, subscription) => sum + toNumber(subscription.ai_credits_remaining), 0);

    const webhookEvents = ((webhookEventsRes.data ?? []) as Record<string, unknown>[]).map((event) => ({
      id: getId(event),
      provider: event.provider ?? null,
      event_key: event.event_key ?? null,
      payment_type: event.payment_type ?? null,
      reference_code: event.reference_code ?? null,
      amount: toNumber(event.amount),
      status: event.status ?? null,
      reason: event.reason ?? null,
      created_at: event.created_at ?? null,
      processed_at: event.processed_at ?? null,
    }));

    return json({
      summary: {
        totalRevenue,
        monthlyRevenue,
        activePlusUsers,
        pendingPayments: payments.filter((payment) => isPendingStatus(payment.payment_status)).length,
        successPayments: payments.filter((payment) => isSuccessStatus(payment.payment_status)).length,
        failedPayments: payments.filter((payment) => isFailedStatus(payment.payment_status)).length,
        totalAiCreditsRemaining,
        unusedVouchers,
        usedVouchers,
      },
      subscriptions,
      payments: payments.slice(0, 100),
      webhookEvents,
    });
  } catch (error) {
    console.error("admin-subscriptions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
