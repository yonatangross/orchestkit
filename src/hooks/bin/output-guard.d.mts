/**
 * TypeScript declarations for output-guard.mjs (#1794 dispatcher output guard).
 *
 * Hand-written because the source is plain .mjs (no transpile step). Keep in
 * sync with output-guard.mjs whenever the public surface changes.
 */

/**
 * Sanitize a hook result before it is written to stdout.
 *
 * Strips `hookEventName` and `additionalContext` from `hookSpecificOutput` on
 * events where CC does not consume them — symmetric counterpart to the
 * isValidPath input guard.
 *
 * Never throws — pass-through on malformed inputs. Bypass with
 * ORCHESTKIT_DISABLE_OUTPUT_GUARD=1.
 *
 * @param result - The raw return value from the hook function.
 * @param firingEvent - The hook_event that triggered execution.
 * @returns The sanitized result — always a plain object safe for JSON.stringify.
 */
export function sanitizeOutput(result: unknown, firingEvent: string): unknown;
