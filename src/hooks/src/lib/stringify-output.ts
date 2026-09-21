/**
 * Stringify tool_output for scanning. Read returns string; Bash returns
 * {stdout, stderr, interrupted} on real PostToolUse payloads (#4217), or
 * historically a string; Grep can return array. Returns null if uncoercable.
 *
 * Shared by skill/redact-secrets and posttool/secret-handler so object-shaped
 * Bash output is never coerced to "[object Object]" before RegExp.test.
 */
export function stringifyOutput(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (output == null) return null;
  if (Array.isArray(output)) {
    try {
      return output.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
    } catch {
      return null;
    }
  }
  // Bash PostToolUse shape: scan stdout and stderr explicitly (#4217).
  if (typeof output === 'object') {
    const o = output as Record<string, unknown>;
    if (typeof o.stdout === 'string' || typeof o.stderr === 'string') {
      const stdout = typeof o.stdout === 'string' ? o.stdout : '';
      const stderr = typeof o.stderr === 'string' ? o.stderr : '';
      return `${stdout}\n${stderr}`;
    }
  }
  try {
    return JSON.stringify(output);
  } catch {
    return null;
  }
}
