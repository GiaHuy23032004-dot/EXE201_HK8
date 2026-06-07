import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

function getRandomReferenceCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `VETSUB-${suffix}`;
}

async function getVetPlusPlan(client: ReturnType<typeof createClient>) {
  const byCode = await client
    .from("subscription_plans")
    .select("*")
    .eq("code", "vet_plus")
    .maybeSingle();

  if (!byCode.error && byCode.data) return byCode.data;

  const byPlanCode = await client
    .from("subscription_plans")
    .select("*")
    .eq("plan_code", "vet_plus")
    .maybeSingle();

  if (byPlanCode.error || !byPlanCode.data) {
    console.error("subscription_plans lookup error:", byCode.error?.message ?? byPlanCode.error?.message);
    return null;
  }

  return byPlanCode.data;
}

async function createUniqueReferenceCode(client: ReturnType<typeof createClient>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const referenceCode = getRandomReferenceCode();
    const { data, error } = await client
      .from("subscription_payments")
      .select("reference_code")
      .eq("reference_code", referenceCode)
      .maybeSingle();

    if (error) {
      console.error("reference lookup error:", error.message);
      throw new Error("Không thể tạo mã thanh toán.");
    }

    if (!data) return referenceCode;
  }

  throw new Error("Không thể tạo mã thanh toán duy nhất.");
}

function isActiveSubscription(subscription: Record<string, unknown> | null) {
  if (!subscription) return false;
  if (String(subscription.status ?? "").toLowerCase() !== "active") return false;

  const periodEnd = subscription.current_period_end ?? subscription.expires_at ?? null;
  if (!periodEnd) return true;

  const endDate = new Date(String(periodEnd));
  if (Number.isNaN(endDate.getTime())) return true;
  return endDate.getTime() > Date.now();
}

function buildPaymentSession(payment: Record<string, unknown>, reused = false) {
  const amount = Number(payment.amount ?? 99000);
  const referenceCode = String(payment.reference_code ?? "");
  const bankAccountNo = Deno.env.get("SEPAY_BANK_ACCOUNT_NO") ?? "";
  const bankName = Deno.env.get("SEPAY_BANK_NAME") ?? "MB";
  const bankBin = Deno.env.get("SEPAY_BANK_BIN") ?? "970422";

  let qrUrl: string | null = null;
  if (bankAccountNo && referenceCode && Number.isFinite(amount) && amount > 0) {
    qrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(referenceCode)}&accountName=${encodeURIComponent("DOAN GIA HUY")}`;
  }

  return {
    success: true,
    reused,
    mode: qrUrl ? "vietqr" : "manual",
    payment_id: payment.payment_id ?? payment.id ?? null,
    reference_code: referenceCode,
    amount,
    qr_url: qrUrl,
    qr_data: null,
    bank_account: bankAccountNo || null,
    bank_name: bankName,
    message: `Chuyển khoản với nội dung: ${referenceCode}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const client = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const planCode = String(body.plan_code ?? "vet_plus").trim().toLowerCase();

    if (planCode !== "vet_plus") {
      return jsonResponse({
        success: false,
        code: "UNSUPPORTED_PLAN",
        message: "Phase này chỉ hỗ trợ gói VET Plus.",
      }, 400);
    }

    const plan = await getVetPlusPlan(client);
    if (!plan) {
      return jsonResponse({
        success: false,
        code: "PLAN_NOT_FOUND",
        message: "Không tìm thấy gói VET Plus.",
      }, 404);
    }

    const planId = String((plan as any).id ?? (plan as any).plan_id ?? "");
    const amount = Number((plan as any).price ?? 99000);

    if (!planId || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({
        success: false,
        code: "INVALID_PLAN",
        message: "Thông tin gói VET Plus không hợp lệ.",
      }, 500);
    }

    const { data: activeSubscription, error: activeError } = await client
      .from("learner_subscriptions")
      .select("*")
      .eq("learner_id", user.id)
      .eq("plan_id", planId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("active subscription lookup error:", activeError.message);
      return jsonResponse({
        success: false,
        code: "SUBSCRIPTION_LOOKUP_FAILED",
        message: "Không thể kiểm tra trạng thái gói hiện tại.",
      }, 500);
    }

    if (isActiveSubscription(activeSubscription as Record<string, unknown> | null)) {
      return jsonResponse({
        success: false,
        code: "ALREADY_ACTIVE",
        message: "Bạn đang sử dụng VET Plus.",
      });
    }

    const recentPendingThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentPendingPayment, error: pendingError } = await client
      .from("subscription_payments")
      .select("*")
      .eq("learner_id", user.id)
      .eq("plan_id", planId)
      .eq("payment_status", "pending")
      .gte("created_at", recentPendingThreshold)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error("pending subscription payment lookup error:", pendingError.message);
      return jsonResponse({
        success: false,
        code: "PENDING_PAYMENT_LOOKUP_FAILED",
        message: "Không thể kiểm tra yêu cầu thanh toán đang chờ.",
      }, 500);
    }

    if (recentPendingPayment) {
      return jsonResponse(buildPaymentSession(recentPendingPayment as Record<string, unknown>, true));
    }

    const referenceCode = await createUniqueReferenceCode(client);
    const { data: payment, error: paymentError } = await client
      .from("subscription_payments")
      .insert({
        learner_id: user.id,
        plan_id: planId,
        amount,
        payment_method: "bank_transfer",
        payment_status: "pending",
        provider: "sepay",
        reference_code: referenceCode,
      })
      .select("*")
      .single();

    if (paymentError || !payment) {
      console.error("subscription payment insert error:", paymentError?.message);
      return jsonResponse({
        success: false,
        code: "PAYMENT_CREATE_FAILED",
        message: "Không thể tạo phiên thanh toán VET Plus.",
      }, 500);
    }

    return jsonResponse(buildPaymentSession(payment as Record<string, unknown>, false));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể tạo phiên thanh toán VET Plus.";
    console.error("create-subscription-payment error:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
