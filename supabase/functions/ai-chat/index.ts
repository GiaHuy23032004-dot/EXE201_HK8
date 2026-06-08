import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type CallAIResult } from "../_shared/aiProvider.ts";

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

type ChatMessage = {
  role?: string;
  content?: string;
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
    _feature: "chat",
    _credits: CHAT_CREDIT_COST,
    _prompt_preview: promptPreview.slice(0, 500),
    _metadata: metadata,
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
    _usage_log_id: usageLogId,
    _status: status,
    _error_message: errorMessage,
  });
  if (error) {
    console.error("finalize_ai_usage error:", {
      message: error.message,
      code: error.code,
    });
  }
}

function getServiceSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function updateAiUsageMetadata(
  usageLogId: string | null,
  aiResult: CallAIResult,
  task: string,
) {
  if (!usageLogId) return;
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;

  const { data: existingLog } = await serviceClient
    .from("ai_usage_logs")
    .select("metadata")
    .eq("id", usageLogId)
    .maybeSingle();
  const existingMetadata =
    existingLog?.metadata && typeof existingLog.metadata === "object" && !Array.isArray(existingLog.metadata)
      ? existingLog.metadata as Record<string, unknown>
      : {};

  const { error } = await serviceClient
    .from("ai_usage_logs")
    .update({
      metadata: {
        ...existingMetadata,
        provider: aiResult.provider,
        model: aiResult.model,
        input_tokens: aiResult.usage?.inputTokens ?? null,
        output_tokens: aiResult.usage?.outputTokens ?? null,
        total_tokens: aiResult.usage?.totalTokens ?? null,
        task,
      },
    })
    .eq("id", usageLogId);

  if (error) {
    console.error("ai_usage_logs metadata update error:", {
      message: error.message,
      code: error.code,
    });
  }
}

function getPromptPreview(messages: ChatMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return String(lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "");
}

function createSseResponse(text: string) {
  const encoder = new TextEncoder();
  const payload = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

const systemPrompt = `Bạn là EduBot - trợ lý AI thông minh của VET, nền tảng giáo dục kết nối người học và mentor.

Nhiệm vụ:
- Giúp người dùng tìm khóa học phù hợp.
- Gợi ý mentor dựa trên nhu cầu.
- Tư vấn lộ trình học tập.
- Trả lời câu hỏi về nền tảng.

Danh mục khóa học hợp lệ của VET:
- Cờ & Tư duy chiến thuật (slug: mind-sports)
- Tiếng Anh công việc & học tập (slug: career-english)
- Thể thao hiện đại (slug: modern-sports)
- Barista & Đồ uống (slug: barista-beverage)
- Nội dung, MC & Thuyết trình (slug: content-speaking)
- AI & Công cụ làm việc (slug: ai-productivity)

Nếu cần nhắc tới category trong câu trả lời hoặc gợi ý có cấu trúc, chỉ dùng một trong 6 slug hợp lệ trên.

Phong cách: thân thiện, ngắn gọn, dùng tiếng Việt. Giữ câu trả lời dưới 150 từ.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const { messages } = await req.json();
    const safeMessages: ChatMessage[] = Array.isArray(messages) ? messages : [];
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
      provider: "gemini",
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const aiResult = await callAI({
      task: "chat",
      modelTier: "fast",
      systemPrompt,
      messages: safeMessages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? ""),
      })),
      temperature: 0.7,
    });

    await finalizeAiUsage(supabase, usageLogId, "success", null);
    await updateAiUsageMetadata(usageLogId, aiResult, "chat");

    return new Response(createSseResponse(aiResult.text), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown AI error";
    console.error("ai-chat error:", message);
    if (supabaseForFinalize && usageLogId) {
      await finalizeAiUsage(supabaseForFinalize, usageLogId, "failed", message);
    }
    return jsonResponse({
      error: "Không thể dùng EduBot lúc này. Nếu AI đã lỗi, credit sẽ được hoàn qua hệ thống.",
      details: message,
    }, 500);
  }
});
