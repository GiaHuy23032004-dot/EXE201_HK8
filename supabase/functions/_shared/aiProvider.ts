export type AiTask = "chat" | "search" | "course_match" | "advisor" | "compare" | "roadmap";
export type AiModelTier = "fast" | "main";

export type AiProviderMessage = {
  role?: "system" | "user" | "assistant" | "model";
  content?: string;
};

export type CallAIOptions = {
  task: AiTask;
  modelTier: AiModelTier;
  systemPrompt?: string;
  messages?: AiProviderMessage[];
  prompt?: string;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
  temperature?: number;
};

export type CallAIResult = {
  text: string;
  raw: unknown;
  provider: "gemini";
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

type GeminiContent = {
  role?: "user" | "model";
  parts: Array<{ text: string }>;
};

function getEnvNumber(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getGeminiModel(modelTier: AiModelTier) {
  const envName = modelTier === "main" ? "GEMINI_MODEL_MAIN" : "GEMINI_MODEL_FAST";
  const model = Deno.env.get(envName);
  if (!model) {
    throw new Error(`Missing ${envName}`);
  }
  return model;
}

function toGeminiRole(role: AiProviderMessage["role"]): "user" | "model" {
  return role === "assistant" || role === "model" ? "model" : "user";
}

function buildGeminiContents(options: CallAIOptions) {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];

  if (options.systemPrompt?.trim()) {
    systemParts.push(options.systemPrompt.trim());
  }

  for (const message of options.messages ?? []) {
    const content = String(message.content ?? "").trim();
    if (!content) continue;
    if (message.role === "system") {
      systemParts.push(content);
      continue;
    }
    contents.push({
      role: toGeminiRole(message.role),
      parts: [{ text: content }],
    });
  }

  const prompt = String(options.prompt ?? "").trim();
  if (!contents.length && prompt) {
    contents.push({ role: "user", parts: [{ text: prompt }] });
  }

  if (!contents.length) {
    throw new Error("AI prompt is empty.");
  }

  return {
    systemInstruction: systemParts.length
      ? { parts: [{ text: systemParts.join("\n\n") }] }
      : undefined,
    contents,
  };
}

function extractGeminiText(raw: Record<string, unknown>) {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];

  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      return String((part as Record<string, unknown>).text ?? "");
    })
    .join("")
    .trim();
}

function extractGeminiUsage(raw: Record<string, unknown>) {
  const usage = raw.usageMetadata as Record<string, unknown> | undefined;
  if (!usage) return undefined;

  const inputTokens = Number(usage.promptTokenCount);
  const outputTokens = Number(usage.candidatesTokenCount);
  const totalTokens = Number(usage.totalTokenCount);

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : undefined,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : undefined,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
  };
}

function getGeminiErrorMessage(status: number, bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string; status?: string; code?: number } };
    const message = parsed.error?.message || parsed.error?.status || bodyText;
    return `Gemini API error ${status}: ${message}`;
  } catch {
    return `Gemini API error ${status}: ${bodyText.slice(0, 300)}`;
  }
}

export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const provider = String(Deno.env.get("AI_PROVIDER") || "").trim().toLowerCase();
  if (provider !== "gemini") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider || "not_configured"}`);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = getGeminiModel(options.modelTier);
  const maxOutputTokens = options.maxOutputTokens ?? getEnvNumber("AI_MAX_OUTPUT_TOKENS", 1200);
  const timeoutMs = getEnvNumber("AI_TIMEOUT_MS", 20000);
  const { contents, systemInstruction } = buildGeminiContents(options);
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
  };
  if (typeof options.temperature === "number") generationConfig.temperature = options.temperature;
  if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;
  if (options.responseSchema) generationConfig.responseSchema = options.responseSchema;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig,
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(getGeminiErrorMessage(response.status, bodyText));
    }

    const raw = JSON.parse(bodyText) as Record<string, unknown>;
    const text = extractGeminiText(raw);
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      text,
      raw,
      provider: "gemini",
      model,
      usage: extractGeminiUsage(raw),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Gemini API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
