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

function parseAmount(value: unknown) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function isPaidStatus(status: unknown) {
  const normalized = String(status ?? "success").trim().toLowerCase();
  return ["success", "completed", "paid", "1"].includes(normalized);
}

function findSubscriptionReference(text: string) {
  const match = text.match(/\bVETSUB-[A-Z0-9]+\b/i);
  return match ? match[0].toUpperCase() : null;
}

function findBookingReference(text: string) {
  const paymentPrefix = Deno.env.get("SEPAY_PAYMENT_PREFIX") ?? "VET";
  const escapedPrefix = paymentPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`\\b${escapedPrefix}-([A-Z0-9]+)\\b`, "i"));
  return match ? `${paymentPrefix}-${match[1]}`.toUpperCase() : null;
}

function normalizeRpcResult(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (typeof row === "boolean") return { ok: row };
  if (row && typeof row === "object") return row as Record<string, unknown>;
  return {};
}

function getRpcReason(result: Record<string, unknown>) {
  return String(result.reason ?? result.code ?? result.message ?? result.status ?? "unknown").toLowerCase();
}

function isSubscriptionRpcSuccess(result: Record<string, unknown>) {
  const reason = getRpcReason(result);
  return result.ok === true || result.success === true || reason === "already_success";
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildEventKey(input: {
  providerOrderId: unknown;
  referenceCode: string | null;
  amount: number;
  referenceText: string;
}) {
  const providerOrderId = String(input.providerOrderId ?? "").trim();
  if (providerOrderId) return `sepay:${providerOrderId}`;

  const rawKey = [
    input.referenceCode ?? "unknown",
    String(input.amount),
    input.referenceText,
  ].join("|");

  return `sepay:${await sha256Hex(rawKey)}`;
}

async function updateWebhookEvent(
  client: ReturnType<typeof createClient>,
  eventKey: string,
  status: "received" | "processed" | "failed" | "ignored",
  reason: string,
) {
  const payload: Record<string, unknown> = { status, reason };
  if (status === "processed") payload.processed_at = new Date().toISOString();

  const { error } = await client
    .from("payment_webhook_events")
    .update(payload)
    .eq("event_key", eventKey);

  if (error) {
    console.error("payment_webhook_events update error:", error.message);
  }
}

async function insertWebhookEvent(
  client: ReturnType<typeof createClient>,
  event: {
    eventKey: string;
    paymentType: "booking" | "subscription" | "unknown";
    referenceCode: string | null;
    amount: number;
    payload: unknown;
  },
) {
  const { error } = await client
    .from("payment_webhook_events")
    .insert({
      provider: "sepay",
      event_key: event.eventKey,
      payment_type: event.paymentType,
      reference_code: event.referenceCode,
      amount: event.amount,
      payload: event.payload,
      status: "received",
    });

  if (!error) return { inserted: true };

  if (error.code === "23505") {
    return { inserted: false, duplicate: true };
  }

  console.error("payment_webhook_events insert error:", error.message);
  return { inserted: false, error };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookApiKey = Deno.env.get("SEPAY_WEBHOOK_API_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const incomingKey = authHeader.replace("Bearer ", "").trim();

    if (webhookApiKey && incomingKey !== webhookApiKey) {
      console.error("Invalid webhook API key");
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const referenceText = String(body.reference_id ?? body.referenceId ?? body.content ?? "");
    const amount = parseAmount(body.amount ?? body.transferAmount);
    const status = body.status ?? body.transactionStatus ?? "success";
    const providerOrderId = body.order_id ?? body.orderId ?? body.transaction_id ?? null;
    const subscriptionRef = findSubscriptionReference(referenceText);
    const bookingRef = subscriptionRef ? null : findBookingReference(referenceText);
    const referenceCode = subscriptionRef ?? bookingRef;
    const paymentType = subscriptionRef ? "subscription" : bookingRef ? "booking" : "unknown";
    const eventKey = await buildEventKey({
      providerOrderId,
      referenceCode,
      amount,
      referenceText,
    });

    const eventResult = await insertWebhookEvent(supabase, {
      eventKey,
      paymentType,
      referenceCode,
      amount,
      payload: body,
    });

    if (eventResult.duplicate) {
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "duplicate_event",
      });
    }

    if (eventResult.error) {
      return jsonResponse({
        success: false,
        message: "Could not record webhook event",
      }, 500);
    }

    if (!isPaidStatus(status)) {
      await updateWebhookEvent(supabase, eventKey, "ignored", `ignored_status:${String(status)}`);
      return jsonResponse({ success: true, message: `Ignored status: ${String(status)}` });
    }

    if (subscriptionRef) {
      const { data, error } = await supabase.rpc("complete_subscription_payment", {
        _reference_code: subscriptionRef,
        _paid_amount: amount,
        _payment_session_id: providerOrderId,
        _provider_payload: body,
      });

      if (error) {
        console.error("complete_subscription_payment RPC error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        const reason = `rpc_error:${error.code || error.message || "unknown"}`;
        await updateWebhookEvent(supabase, eventKey, "failed", reason.slice(0, 240));
        return jsonResponse({
          success: false,
          message: "Subscription payment RPC failed",
        });
      }

      const result = normalizeRpcResult(data);
      const reason = getRpcReason(result);

      if (reason === "already_success") {
        await updateWebhookEvent(supabase, eventKey, "ignored", "already_success");
        return jsonResponse({
          success: true,
          ignored: true,
          reason: "already_success",
          reference_code: subscriptionRef,
        });
      }

      if (isSubscriptionRpcSuccess(result)) {
        await updateWebhookEvent(supabase, eventKey, "processed", reason);
        return jsonResponse({
          success: true,
          message: "Subscription payment processed successfully",
          reference_code: subscriptionRef,
        });
      }

      const eventStatus = reason === "not_found" || reason === "reference_not_found"
        ? "ignored"
        : "failed";
      await updateWebhookEvent(supabase, eventKey, eventStatus, reason);

      return jsonResponse({
        success: false,
        message: "Subscription payment was not completed",
        reason,
      });
    }

    if (!bookingRef) {
      await updateWebhookEvent(supabase, eventKey, "ignored", "reference_not_found_or_unknown");
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "reference_not_found_or_unknown",
      });
    }

    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference_code", bookingRef)
      .maybeSingle();

    if (txnError || !txn) {
      console.error("Transaction not found:", bookingRef);
      await updateWebhookEvent(supabase, eventKey, "ignored", "transaction_not_found");
      return jsonResponse({ success: false, message: "Transaction not found" });
    }

    if (Number(txn.amount) !== amount) {
      await updateWebhookEvent(supabase, eventKey, "failed", "amount_mismatch");
      return jsonResponse({
        success: false,
        message: "Payment amount mismatch",
        reason: "amount_mismatch",
      });
    }

    if (txn.status === "success") {
      await updateWebhookEvent(supabase, eventKey, "ignored", "already_success");
      return jsonResponse({ success: true, ignored: true, reason: "already_success" });
    }

    await supabase
      .from("transactions")
      .update({ status: "success", payment_session_id: providerOrderId })
      .eq("id", txn.id);

    await supabase
      .from("bookings")
      .update({ status: "upcoming" })
      .eq("id", txn.booking_id)
      .eq("status", "pending");

    const netAmount = txn.net_amount ?? (txn.amount - (txn.platform_fee ?? 0));
    const { data: wallet } = await supabase
      .from("mentor_wallets")
      .select("held_balance, total_earned, balance")
      .eq("mentor_id", txn.mentor_id)
      .maybeSingle();

    if (wallet) {
      await supabase
        .from("mentor_wallets")
        .update({
          held_balance: (wallet.held_balance ?? 0) + netAmount,
          total_earned: (wallet.total_earned ?? 0) + netAmount,
        })
        .eq("mentor_id", txn.mentor_id);
    } else {
      await supabase.from("mentor_wallets").insert({
        mentor_id: txn.mentor_id,
        held_balance: netAmount,
        total_earned: netAmount,
        balance: 0,
      });
    }

    const newBalance = (wallet?.held_balance ?? 0) + netAmount;
    await supabase.from("wallet_transactions").insert({
      mentor_id: txn.mentor_id,
      kind: "sale",
      description: `Thanh toán khóa học - ${bookingRef}`,
      delta: netAmount,
      balance_after: newBalance,
      reference_code: bookingRef,
    });

    await updateWebhookEvent(supabase, eventKey, "processed", "booking_payment_success");
    console.log(`Payment processed: ${bookingRef}, amount: ${txn.amount}, net: ${netAmount}`);

    return jsonResponse({ success: true, message: "Payment processed successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Webhook error:", message);
    return jsonResponse({ success: false, error: message });
  }
});
