import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const aiCreditCosts = {
  course_match: 1,
  advisor: 1,
  search: 1,
  chat: 1,
  compare: 2,
  roadmap: 3,
} as const;

type AiFeature = keyof typeof aiCreditCosts;
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

function resolveFeature(type: unknown): AiFeature {
  const value = String(type ?? "search");
  if (value in aiCreditCosts) return value as AiFeature;
  if (value === "recommend") return "course_match";
  return "search";
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
  feature: AiFeature,
  credits: number,
  promptPreview: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    feature,
    credits,
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let usageLogId: string | null = null;
  let supabaseForFinalize: ReturnType<typeof createClient> | null = null;

  try {
    const { query, type = "search" } = await req.json();
    const feature = resolveFeature(type);
    const credits = aiCreditCosts[feature];
    const prompt = String(query ?? "").trim();

    const { error: authError, supabase } = await getAuthedSupabase(req);
    if (authError || !supabase) {
      return authError ?? jsonResponse({ error: true, message: "Không thể xác thực phiên đăng nhập." }, 401);
    }
    supabaseForFinalize = supabase;

    const reservation = await reserveAiUsage(supabase, feature, credits, prompt, {
      function: "ai-search",
      type,
      feature,
    });
    if (!reservation.ok) return reservation.response!;
    usageLogId = reservation.usageLogId;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    if (type === "search") {
      systemPrompt = `Bạn là trợ lý tìm kiếm AI cho nền tảng giáo dục EduMarket.
Khi người dùng nhập từ khóa tìm kiếm, hãy gợi ý 4-6 khóa học liên quan dưới dạng JSON array.
Mỗi gợi ý bao gồm: title (tên khóa học), category (danh mục), reason (lý do gợi ý ngắn gọn).
Chỉ trả về JSON array, không giải thích thêm.
Danh mục hợp lệ, chỉ được trả về một trong các slug sau:
- mind-sports
- career-english
- modern-sports
- barista-beverage
- content-speaking
- ai-productivity`;
    } else if (type === "recommend") {
      systemPrompt = `Bạn là AI gợi ý khóa học cho EduMarket. Dựa trên sở thích người dùng, hãy gợi ý 4 khóa học phù hợp nhất.
Trả về JSON array với: title, category, reason, matchScore (0-100).
Trường category bắt buộc là một trong 6 slug hợp lệ: mind-sports, career-english, modern-sports, barista-beverage, content-speaking, ai-productivity.
Chỉ trả về JSON array.`;
    }

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
          { role: "user", content: prompt },
        ],
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    await finalizeAiUsage(supabase, usageLogId, "success", null);

    return jsonResponse({ suggestions: content });
  } catch (e) {
    console.error("ai-search error:", e);
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
