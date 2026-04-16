/**
 * Context window detection and budget scaling helpers.
 *
 * All OrchestKit hooks express budgets as a percentage of the model's
 * context window, not as absolute token counts. This protects budgets
 * against tokenizer changes (Opus 4.7 maps the same input to 1.0–1.35×
 * more tokens than 4.6, for example) and against context-window variance
 * (200K default vs. 1M with 1M-context flag).
 *
 * Usage:
 *   import { getContextWindowTokens, scaleByContextWindow } from '../lib/context-window.js';
 *   const budget = scaleByContextWindow(1200); // 1200 at 1M baseline → scaled at other sizes
 */

/** Default baseline context window used when CLAUDE_MAX_CONTEXT is unset. */
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 1_000_000;

/**
 * Read the current context window in tokens from env, falling back to the
 * 1M default. Centralises the `CLAUDE_MAX_CONTEXT` env-var lookup.
 */
export function getContextWindowTokens(): number {
  const raw = process.env.CLAUDE_MAX_CONTEXT;
  if (!raw) return DEFAULT_CONTEXT_WINDOW_TOKENS;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CONTEXT_WINDOW_TOKENS;
  return parsed;
}

/**
 * Scale a baseline token budget (calibrated at 1M context) by the current
 * context window. Returns a rounded integer.
 *
 * Example:
 *   scaleByContextWindow(1200) at 1M → 1200
 *   scaleByContextWindow(1200) at 200K → 240
 */
export function scaleByContextWindow(baselineAtOneMillion: number): number {
  const scale = getContextWindowTokens() / DEFAULT_CONTEXT_WINDOW_TOKENS;
  return Math.round(baselineAtOneMillion * scale);
}

/**
 * Convert an absolute token count to a percentage of the current context
 * window. Returns 0-100 clamped.
 */
export function tokensAsContextPct(tokens: number): number {
  if (tokens <= 0) return 0;
  const pct = (tokens / getContextWindowTokens()) * 100;
  if (pct > 100) return 100;
  return pct;
}
