export type AdapterSource = "codex" | "cursor" | "claude-code";

export type NormalizedAdapterEvent = {
  source: AdapterSource;
  conversationId: string;
  rawRequest: string;
  contextSummary: string;
};

export function normalizeAdapterEvent(
  source: AdapterSource,
  payload: Record<string, unknown>
): NormalizedAdapterEvent {
  if (source === "codex") {
    return {
      source,
      conversationId: String(payload.conversationId ?? ""),
      rawRequest: String(payload.userMessage ?? ""),
      contextSummary: String(payload.contextSummary ?? "")
    };
  }

  if (source === "cursor") {
    return {
      source,
      conversationId: String(payload.conversationId ?? ""),
      rawRequest: String(payload.prompt ?? ""),
      contextSummary: String(payload.contextSummary ?? "")
    };
  }

  return {
    source,
    conversationId: String(payload.conversationId ?? ""),
    rawRequest: String(payload.userPrompt ?? ""),
    contextSummary: String(payload.contextSummary ?? "")
  };
}
