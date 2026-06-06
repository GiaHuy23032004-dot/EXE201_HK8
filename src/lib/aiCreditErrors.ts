export interface AiCreditRequiredPayload {
  error: true;
  code: "AI_CREDIT_REQUIRED";
  reason?: string;
  creditsRemaining?: number;
  upgradeUrl?: string;
}

export function isAiCreditRequiredPayload(value: unknown): value is AiCreditRequiredPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { code?: unknown }).code === "AI_CREDIT_REQUIRED",
  );
}

export async function readFunctionErrorPayload(error: unknown): Promise<unknown> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== "object") return null;

  const response = context as Response;
  try {
    if (typeof response.clone === "function") {
      return await response.clone().json();
    }
    if (typeof response.json === "function") {
      return await response.json();
    }
  } catch {
    return null;
  }

  return null;
}
