import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { booking_id, amount } = body;

    if (!booking_id || !amount) {
      return new Response(JSON.stringify({ error: "Missing booking_id or amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Lấy booking + course info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, mentor_id, course_id, learner_id, status, course:courses(title, format)")
      .eq("id", booking_id)
      .eq("learner_id", user.id)
      .single();

    if (bookingError || !booking) {
      console.error("Booking error:", bookingError?.message);
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Tạo reference code
    const PAYMENT_PREFIX = Deno.env.get("SEPAY_PAYMENT_PREFIX") ?? "VET";
    const refCode = `${PAYMENT_PREFIX}-${booking_id.slice(0, 8).toUpperCase()}`;

    // Tạo transaction record trước (status pending)
    const platformFee = Math.round(amount * 0.15);
    const courseFormat = (booking.course as any)?.format ?? "offline";

    // Upsert transaction (tránh tạo 2 lần)
    const { data: existingTxn } = await supabase
      .from("transactions")
      .select("id, reference_code, status")
      .eq("booking_id", booking_id)
      .maybeSingle();

    let txnId = existingTxn?.id;
    let finalRefCode = existingTxn?.reference_code ?? refCode;

    if (!existingTxn) {
      const { data: newTxn, error: txnError } = await supabase
        .from("transactions")
        .insert({
          booking_id,
          learner_id: user.id,
          mentor_id: booking.mentor_id,
          course_id: booking.course_id,
          amount,
          platform_fee: platformFee,
          net_amount: amount - platformFee,
          payment_method: "platform",
          txn_type: courseFormat === "online" ? "online" : "offline",
          status: "pending",
          reference_code: refCode,
        })
        .select("id")
        .single();

      if (txnError) {
        console.error("Transaction error:", txnError.message);
        // Return manual mode with ref code anyway
      } else {
        txnId = newTxn?.id;
      }
    }

    // Thử kết nối SePay API (Sandbox)
    const SEPAY_CLIENT_ID = Deno.env.get("SEPAY_CLIENT_ID") ?? "";
    const SEPAY_CLIENT_SECRET = Deno.env.get("SEPAY_CLIENT_SECRET") ?? "";
    const BANK_ACCOUNT_NO = Deno.env.get("SEPAY_BANK_ACCOUNT_NO") ?? "";
    const BANK_NAME = Deno.env.get("SEPAY_BANK_NAME") ?? "MB";

    let qrData = null;
    let qrUrl = null;

    if (SEPAY_CLIENT_ID && SEPAY_CLIENT_SECRET) {
      try {
        // Tạo VietQR QR code từ thông tin tài khoản ngân hàng
        // Format: bank_code|account_no|amount|description
        const BANK_BIN = Deno.env.get("SEPAY_BANK_BIN") ?? "970422"; // MB Bank BIN
        const vietQrData = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(finalRefCode)}&accountName=${encodeURIComponent("DOAN GIA HUY")}`;
        qrUrl = vietQrData;
      } catch (e) {
        console.log("SePay QR failed, using VietQR fallback");
      }
    }

    // Fallback: dùng VietQR public API
    if (!qrUrl && BANK_ACCOUNT_NO) {
      const BANK_BIN = Deno.env.get("SEPAY_BANK_BIN") ?? "970422";
      qrUrl = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(finalRefCode)}&accountName=${encodeURIComponent("DOAN GIA HUY")}`;
    }

    return new Response(JSON.stringify({
      success: true,
      mode: qrUrl ? "vietqr" : "manual",
      reference_code: finalRefCode,
      amount,
      transaction_id: txnId,
      qr_url: qrUrl,
      bank_account: BANK_ACCOUNT_NO,
      bank_name: BANK_NAME,
      message: `Chuyển khoản với nội dung: ${finalRefCode}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("create-payment error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
