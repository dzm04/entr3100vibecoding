export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
};

function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readTokenUsage(usage: {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  prompt_tokens_details?: { cached_tokens?: unknown } | null;
  completion_tokens_details?: { reasoning_tokens?: unknown } | null;
} | null | undefined): TokenUsage {
  return {
    inputTokens: tokenCount(usage?.prompt_tokens),
    outputTokens: tokenCount(usage?.completion_tokens),
    cachedInputTokens: tokenCount(usage?.prompt_tokens_details?.cached_tokens),
    reasoningTokens: tokenCount(usage?.completion_tokens_details?.reasoning_tokens),
  };
}
