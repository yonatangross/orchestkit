/**
 * Pure output builders and string utilities — zero side effects, zero I/O.
 *
 * Phase 2 of the common.ts decomposition. Every export here is a pure function:
 * it depends only on its arguments (and the HookResult / HookInput types),
 * never on node:fs, node:path, node:child_process, process.env, or any
 * external module.  This makes the entire file trivially testable and
 * tree-shakeable.
 */

import type { HookResult, HookInput } from '../types.js';

// -----------------------------------------------------------------------------
// Output Builders (CC 2.1.7+ compliant)
// -----------------------------------------------------------------------------

/**
 * Output silent success - hook completed without errors, no user-visible output
 */
export function outputSilentSuccess(): HookResult {
  return { continue: true, suppressOutput: true };
}

/**
 * Output silent allow - permission hook approves silently
 */
export function outputSilentAllow(): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { permissionDecision: 'allow' },
  };
}

/**
 * Output block - stops the operation with an error
 */
export function outputBlock(reason: string): HookResult {
  return {
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Output with additionalContext - injects context before tool execution (CC 2.1.9)
 * For PostToolUse hooks (hookEventName optional)
 * #865: Empty/whitespace-only content is silently dropped to save tokens.
 */
export function outputWithContext(ctx: string): HookResult {
  if (!ctx || !ctx.trim()) return outputSilentSuccess();
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  };
}

/**
 * Output with additionalContext for UserPromptSubmit hooks (CC 2.1.9)
 * hookEventName is REQUIRED for UserPromptSubmit
 * #865: Empty/whitespace-only content is silently dropped to save tokens.
 */
export function outputPromptContext(ctx: string): HookResult {
  if (!ctx || !ctx.trim()) return outputSilentSuccess();
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  };
}

/**
 * Output with additionalContext + sessionTitle for UserPromptSubmit hooks (CC 2.1.94)
 *
 * Sets the display name shown in the prompt bar and remote sessions.
 * If ctx is empty, returns a title-only result so hooks can set a title
 * without injecting context. If title is empty/whitespace, falls back to
 * outputPromptContext (no title update).
 *
 * CC 2.1.94 introduced hookSpecificOutput.sessionTitle for UserPromptSubmit
 * hooks. Useful for surfacing branch, effort level, or active skill in the
 * title bar so long-running sessions are identifiable in the prompt bar,
 * --resume picker, and /remote-control session list.
 */
export function outputPromptContextWithTitle(ctx: string, title: string): HookResult {
  const trimmedTitle = title?.trim();
  // No title — fall back to plain context injection
  if (!trimmedTitle) return outputPromptContext(ctx);

  // Title-only (no context) — still valid per CC 2.1.94 spec
  if (!ctx || !ctx.trim()) {
    return {
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        sessionTitle: trimmedTitle,
      },
    };
  }

  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
      sessionTitle: trimmedTitle,
    },
  };
}

/**
 * Output with user notification + Claude context (CC 2.1.9+)
 * Issue #278: Dual-channel output for three-tier UX
 *
 * @param userMessage - Brief message shown to user via systemMessage (optional)
 * @param claudeContext - Full context for Claude via additionalContext (optional)
 * @returns HookResult with appropriate channels set
 *
 * Usage:
 * - Both set: User sees notification, Claude gets context
 * - Only claudeContext: Silent injection (Claude-only)
 * - Only userMessage: User notification without context
 */
export function outputWithNotification(
  userMessage: string | undefined,
  claudeContext: string | undefined
): HookResult {
  const result: HookResult = {
    continue: true,
    suppressOutput: true,
  };

  // #865: Only surface if non-empty (mirrors claudeContext guard)
  if (userMessage?.trim()) {
    result.systemMessage = userMessage;
  }

  // #865: Only inject if claudeContext is non-empty
  if (claudeContext?.trim()) {
    result.hookSpecificOutput = {
      hookEventName: 'UserPromptSubmit',
      additionalContext: claudeContext,
    };
  }

  return result;
}

/**
 * Output allow with additionalContext - permission hook approves with context (CC 2.1.9)
 */
export function outputAllowWithContext(ctx: string, systemMessage?: string): HookResult {
  const result: HookResult = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
      permissionDecision: 'allow',
    },
  };

  if (systemMessage) {
    result.systemMessage = systemMessage;
  } else {
    result.suppressOutput = true;
  }

  return result;
}

/**
 * Output error message - only use when there's an actual problem
 */
export function outputError(message: string): HookResult {
  return { continue: true, systemMessage: message };
}

/**
 * Output warning message via JSON stdout -- visible to both user and Claude (CC 2.1.7+).
 * Use this when Claude needs to see and act on the warning (e.g., cost advice, quality gates).
 * For user-only warnings where Claude should NOT see the message, use outputStderrWarning.
 */
export function outputWarning(message: string): HookResult {
  return { continue: true, systemMessage: `\u26a0 ${message}` };
}

/**
 * Output deny with feedback logging (CC 2.1.7)
 */
export function outputDeny(reason: string): HookResult {
  return {
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Output ask - escalate to user for confirmation (CC 2.1.69)
 * For gray-zone commands that are dangerous but sometimes legitimate.
 * CC shows a permission prompt instead of silently blocking.
 */
export function outputAsk(reason: string): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Output defer - pauses headless session for later --resume (CC 2.1.89)
 * PreToolUse returns {decision:"defer"} to pause -p mode execution
 */
export function outputDefer(reason: string): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'defer',
      permissionDecisionReason: reason,
    },
  };
}

/**
 * Output with updatedInput - modifies tool input before execution (CC 2.1.25)
 * Canonical way to modify tool inputs from PreToolUse hooks
 */
export function outputWithUpdatedInput(updatedInput: Record<string, unknown>): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput,
    },
  };
}

// -----------------------------------------------------------------------------
// Context Extraction
// -----------------------------------------------------------------------------

/**
 * Extract additionalContext from a hook result.
 * Handles both the correct hookSpecificOutput.additionalContext format
 * and the legacy bare systemMessage format.
 *
 * Issue #682: Deduplicated from 5 dispatchers into shared utility.
 */
export function extractContext(result: HookResult): string | null {
  // Standard format: hookSpecificOutput.additionalContext
  if (result.hookSpecificOutput?.additionalContext) {
    return result.hookSpecificOutput.additionalContext as string;
  }

  // Legacy format: bare systemMessage (antipattern-detector bug)
  if (result.systemMessage && typeof result.systemMessage === 'string') {
    return result.systemMessage;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Token Estimation (pure math)
// -----------------------------------------------------------------------------

/**
 * Content-aware token estimation (~80% accuracy without external tokenizer).
 * Code-heavy content averages ~2.8 chars/token; prose ~3.5 chars/token.
 */
export function estimateTokenCount(content: string): number {
  if (!content) return 0;
  const codeIndicators = (content.match(/[{};()=><]/g) || []).length;
  const codeRatio = codeIndicators / content.length;
  const charsPerToken = codeRatio > 0.03 ? 2.8 : 3.5;
  return Math.ceil(content.length / charsPerToken);
}

// -----------------------------------------------------------------------------
// Budgeted Output
// -----------------------------------------------------------------------------

/**
 * Output prompt context with token budget awareness.
 * Checks if the category is over budget before injecting.
 * Falls back to silent success when budget exhausted.
 *
 * Accepts budget checker and tracker as parameters to stay pure.
 * If not provided, falls back to unchecked injection.
 *
 * Note: budget exhaustion is a normal code path, not an error --
 * no logging is performed here to keep the function side-effect-free.
 */
export function outputPromptContextBudgeted(
  ctx: string,
  hookName: string,
  category: string,
  budgetChecker?: { isOverBudget: (cat: string) => boolean },
  tokenTracker?: { trackTokenUsage: (hook: string, cat: string, tokens: number) => void },
): HookResult {
  const tokens = estimateTokenCount(ctx);

  if (budgetChecker?.isOverBudget(category)) {
    return outputSilentSuccess();
  }

  if (tokenTracker) {
    tokenTracker.trackTokenUsage(hookName, category, tokens);
  }

  return outputPromptContext(ctx);
}

// -----------------------------------------------------------------------------
// Text / String Utilities (zero dependencies)
// -----------------------------------------------------------------------------

/**
 * Normalize line endings from CRLF to LF for cross-platform compatibility.
 * Windows uses \r\n (CRLF) while Unix uses \n (LF).
 * This is critical for parsing YAML frontmatter where we match '---' exactly.
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Normalize command: remove line continuations and collapse whitespace
 * Prevents bypassing detection with backslash-newline tricks (CC 2.1.6 fix)
 *
 * @deprecated Use normalizeSingle() from normalize-command.ts instead -- it also
 * expands hex/octal escapes and strips quotes, which is strictly better.
 * Kept only for backward compatibility with external consumers.
 */
export function normalizeCommand(command: string): string {
  return command
    .replace(/\\\s*[\r\n]+/g, ' ') // Remove line continuations
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Escape string for use in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * FNV-1a 32-bit hash -- fast, non-cryptographic hash for delta detection.
 * Used to skip writing rules files when content hasn't changed.
 */
export function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// -----------------------------------------------------------------------------
// ReDoS-Safe String Matching
// -----------------------------------------------------------------------------

/**
 * Check if any single line contains all specified substrings (ReDoS-safe O(n)).
 * Use instead of polynomial regexes like /A.*B.*C/.test(content).
 */
export function lineContainsAll(content: string, ...terms: string[]): boolean {
  return content.split('\n').some(line => terms.every(t => line.includes(t)));
}

/**
 * Check if any single line contains all specified substrings (case-insensitive, ReDoS-safe O(n)).
 */
export function lineContainsAllCI(content: string, ...terms: string[]): boolean {
  return content.split('\n').some(line => {
    const lower = line.toLowerCase();
    return terms.every(t => lower.includes(t.toLowerCase()));
  });
}

// -----------------------------------------------------------------------------
// Input Helpers (pure)
// -----------------------------------------------------------------------------

/**
 * Get field from hook input using optional chaining
 */
export function getField<T>(input: HookInput, path: string): T | undefined {
  const parts = path.replace(/^\./, '').split('.');
  let value: unknown = input;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }

  return value as T;
}
