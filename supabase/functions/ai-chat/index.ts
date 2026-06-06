import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHAT_CREDIT_COST = 1;

type ReserveResult = {
  ok?: boolean;
  success?: boolean;
  usage_log_id?: string | null;
  usageLogId?: string | null;
  id?: string | null;
  reason?: string | null;
  error?: string | null;
  credits_remaining?: number | null;
  creditsRemaining?: number | null;
  ai_credits_remaining?: number | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReserveResult(value: unknown) {
  const row = firstRow(value as ReserveResult | ReserveResult[]) ?? {};
  const creditsRemaining = Number(
    row.credits_remaining ?? row.creditsRemaining ?? row.ai_credits_remaining ?? 0,
  );

  return {
    ok: row.ok === true || row.success === true,
    usageLogId: row.usage_log_id ?? row.usageLogId ?? row.id ?? null,
    reason: row.reason ?? row.error ?? "insufficient_credits",
    creditsRemaining: Number.isFinite(creditsRemaining) ? creditsRemaining : 0,
  };
}

async function getAuthedSupabase(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Vui lòng đăng nhập để dùng AI." }, 401),
      supabase: null,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: jsonResponse({ error: true, message: "Supabase environment is not configured." }, 500),
      supabase: null,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { error } = await supabase.auth.getUser(jwt);
  if (error) {
    return {
      error: jsonResponse({ error: true, code: "AUTH_REQUIRED", message: "Phiên đăng nhập không hợp lệ." }, 401),
      supabase: null,
    };
  }

  return { error: null, supabase };
}

async function reserveAiUsage(
  supabase: ReturnType<typeof createClient>,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    feature: "chat",
    credits: CHAT_CREDIT_COST,
    prompt_preview: promptPreview.slice(0, 500),
    metadata,
  });

  if (error) throw error;

  const result = normalizeReserveResult(data);
  if (!result.ok) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: true,
          code: "AI_CREDIT_REQUIRED",
          reason: result.reason,
          creditsRemaining: result.creditsRemaining,
          upgradeUrl: "/pricing",
        },
        402,
      ),
      usageLogId: null,
    };
  }

  return { ok: true, response: null, usageLogId: result.usageLogId };
}

async function finalizeAiUsage(
  supabase: ReturnType<typeof createClient>,
  usageLogId: string | null,
  status: "success" | "failed",
  errorMessage: string | null,
) {
  if (!usageLogId) return;
  const { error } = await supabase.rpc("finalize_ai_usage", {
    usage_log_id: usageLogId,
    status,
    error_message: errorMessage,
  });
  if (error) console.error("finalize_ai_usage error:", error);
}

function getPromptPreview(messages: Array<{ role?: string; content?: string }>) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return String(lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "");
}

function streamWithFinalizer(
  body: ReadableStream<Uint8Array>,
  supabase: ReturnType<typeof createClient>,
  usageLogId: string | null,
) {
  const reader = body.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        await finalizeAiUsage(supabase, usageLogId, "success", null);
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream error";
        await finalizeAiUsage(supabase, usageLogId, "failed", message);
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      await finalizeAiUsage(supabase, usageLogId, "failed", "Client cancelled stream");
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const { messages } = await req.json();
    const safeMessages = Array.isArray(messages) ? messages : [];
    const promptPreview = getPromptPreview(safeMessages);

    const { error: authError, supabase } = await getAuthedSupabase(req);
    if (authError || !supabase) {
      return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    }
    supabaseForFinalize = supabase;

    const reservation = await reserveAiUsage(supabase, promptPreview, {
      function: "ai-chat",
      feature: "chat",
      messageCount: safeMessages.length,
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Bạn là EduBot - trợ lý AI thông minh của EduMarket, nền tảng giáo dục kết nối người học và mentor.

Nhiệm vụ:
- Giúp người dùng tìm khóa học phù hợp
- Gợi ý mentor dựa trên nhu cầu
- Tư vấn lộ trình học tập
- Trả lời câu hỏi về nền tảng

Danh mục khóa học hợp lệ của VET:
- Cờ & Tư duy chiến thuật (slug: mind-sports)
- Tiếng Anh công việc & học tập (slug: career-english)
- Thể thao hiện đại (slug: modern-sports)
- Barista & Đồ uống (slug: barista-beverage)
- Nội dung, MC & Thuyết trình (slug: content-speaking)
- AI & Công cụ làm việc (slug: ai-productivity)

Nếu cần nhắc tới category trong câu trả lời hoặc gợi ý có cấu trúc, chỉ dùng một trong 6 slug hợp lệ trên.

Phong cách: Thân thiện, ngắn gọn, dùng emoji phù hợp. Trả lời bằng tiếng Việt. Giữ câu trả lời dưới 150 từ.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await finalizeAiUsage(supabase, usageLogId, "failed", errorText);

      if (response.status === 429) {
        return jsonResponse({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }, 429);
      }
      if (response.status === 402) {
        return jsonResponse({ error: "Hệ thống AI tạm hết credit, vui lòng thử lại sau." }, 402);
      }
      console.error("AI gateway error:", response.status, errorText);
      return jsonResponse({ error: "AI gateway error" }, 500);
    }

    if (!response.body) {
      await finalizeAiUsage(supabase, usageLogId, "failed", "AI gateway returned empty stream");
      return jsonResponse({ error: "AI gateway returned empty stream" }, 500);
    }

    return new Response(streamWithFinalizer(response.body, supabase, usageLogId), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    if (supabaseForFinalize && usageLogId) {
      await finalizeAiUsage(
        supabaseForFinalize,
        usageLogId,
        "failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
