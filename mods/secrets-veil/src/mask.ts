// secrets-veil: mask.ts - pure secret masking logic
// Reused from commit 30720692 (buildTable, mask, DEFAULT_PATTERNS, wouldMask)
// with one new layer added: high-entropy token masking. The layer is opt-in
// per table via buildTable options, so existing callers keep exact behavior.

import type { MaskTable, MaskTableEntry, MaskSpan, MaskResult, EntropyConfig } from "./types";

/**
 * High-entropy layer constants.
 *
 * A token counts as a possible secret when it is at least
 * ENTROPY_MIN_LENGTH characters from [A-Za-z0-9+/=_-] and its Shannon
 * entropy per character is at or above ENTROPY_THRESHOLD.
 *
 * Why 4.3 bits per char:
 * - Any string over a 16-symbol alphabet (hex) has entropy at most
 *   log2(16) = 4.0, and a UUID (hex plus dash) at most log2(17) = 4.09.
 *   Both are below 4.3 ALWAYS, by counting, not on average: a 40-char git
 *   sha, a 64-char sha256 and every UUID can never be masked by this layer.
 * - Measured on this machine (2026-09-16, 200k samples): a uniform random
 *   32-char token over the 67-symbol veil alphabet has median entropy 4.60
 *   bits/char (5th percentile 4.35), so most random tokens cross 4.3.
 * - Ordinary lowercase words and camelCase identifiers measured 2.9 to 4.0
 *   bits/char, below the threshold. Paths, branch names and URLs reach the
 *   bar only when scored as one mixed-alphabet run, which the tokenizer rule
 *   in mask() prevents: ordinary separator runs are split before scoring.
 * The residual false negatives (very low diversity random tokens) are the
 * safe direction: the veil misses some tokens rather than masking shas.
 */
export const ENTROPY_MIN_LENGTH = 20;
export const ENTROPY_THRESHOLD = 4.3;
export const ENTROPY_ALPHABET = "[A-Za-z0-9+/=_-]";

/**
 * Subresource Integrity value: public in every package-lock.json on the
 * registry and in this repository, never a secret. A run that is exactly
 * 'sha1-', 'sha256-', 'sha384-' or 'sha512-' followed by base64 (plus any
 * padding) is exempt from the entropy layer entirely (FIX ROUND of #4189).
 */
export const SRI_VALUE_RE = /^sha(?:1|256|384|512)-[A-Za-z0-9+/=]+$/;

/**
 * Shannon entropy of a string, in bits per character, over its empirical
 * character distribution. Empty strings have entropy 0.
 */
export function shannonEntropy(token: string): number {
  if (token.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of token) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let bits = 0;
  for (const count of freq.values()) {
    const p = count / token.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/**
 * True when a standalone value crosses the entropy bar.
 */
export function isHighEntropyToken(token: string): boolean {
  return (
    token.length >= ENTROPY_MIN_LENGTH &&
    shannonEntropy(token) >= ENTROPY_THRESHOLD
  );
}

/**
 * Build the mask table from named values and shape patterns.
 * Called once at session.start; pure function for testability.
 * @param envNames - list of VAR names whose values were read at session start
 * @param envValues - map of name -> value from $.env.get at session start
 * @param patterns - hardcoded shape patterns (sk-ant-, ghp_, etc.)
 * @param options - set { entropy: true } to also scan for high-entropy tokens
 * @returns MaskTable ready for mask() calls
 */
export function buildTable(
  envNames: readonly string[],
  envValues: Record<string, string>,
  patterns: readonly string[],
  options?: { entropy?: boolean }
): MaskTable {
  const entries: MaskTableEntry[] = [];

  // Add env values >= 8 chars that are non-empty
  for (const name of envNames) {
    const value = envValues[name];
    if (value && value.length >= 8) {
      entries.push({
        type: "env",
        name,
        value,
        pattern: value, // exact match
      });
    }
  }

  // Add shape patterns (prefixes that indicate secrets)
  for (const pattern of patterns) {
    entries.push({
      type: "pattern",
      pattern,
    });
  }

  const entropy: EntropyConfig | null = options?.entropy
    ? { minLength: ENTROPY_MIN_LENGTH, thresholdBitsPerChar: ENTROPY_THRESHOLD }
    : null;

  return { entries, entropy };
}

/**
 * Default secret patterns (prefixes and patterns).
 * Vendor prefixes such as sk-ant-, ghp_, xoxb-, AKIA, Bearer, BEGIN PRIVATE KEY.
 */
export const DEFAULT_PATTERNS: readonly string[] = [
  "sk-ant-",
  "ops_",
  "ghp_",
  "github_pat_",
  "xoxb-",
  "AKIA",
  "Bearer ",
  "-----BEGIN ",
];

/**
 * Mask secrets in text, returning masked text and spans for UI overlay.
 * Pure function; no I/O. Must complete in under 5 ms for 1 MB input.
 * @param text - text to mask
 * @param table - mask table from buildTable()
 * @returns MaskResult with masked text and spans (original positions)
 */
export function mask(text: string, table: MaskTable): MaskResult {
  const spans: MaskSpan[] = [];
  let maskedText = text;

  // Collect all matches with their positions
  const matches: Array<{ start: number; end: number; value: string; name?: string }> = [];

  for (const entry of table.entries) {
    if (entry.type === "env") {
      // Exact match for env values
      let searchPos = 0;
      while (true) {
        const idx = maskedText.indexOf(entry.value, searchPos);
        if (idx === -1) break;
        matches.push({
          start: idx,
          end: idx + entry.value.length,
          value: entry.value,
          name: entry.name,
        });
        searchPos = idx + 1;
      }
    } else {
      // Pattern prefix match
      let searchPos = 0;
      while (true) {
        const idx = maskedText.indexOf(entry.pattern, searchPos);
        if (idx === -1) break;

        // Determine the end of the secret
        let end = idx + entry.pattern.length;

        // For Bearer, extend to end of token (non-whitespace)
        if (entry.pattern === "Bearer ") {
          while (end < maskedText.length && !/\s/.test(maskedText[end])) {
            end++;
          }
          // Require at least 20 chars for Bearer tokens
          if (end - idx < 26) {
            // "Bearer " (7) + 20+ chars
            searchPos = idx + 1;
            continue;
          }
        }

        // For BEGIN ... PRIVATE KEY, find the END marker
        if (entry.pattern === "-----BEGIN ") {
          const endMarker = maskedText.indexOf("-----END ", idx);
          if (endMarker !== -1) {
            const finalDash = maskedText.indexOf("-----", endMarker + 10);
            if (finalDash !== -1) {
              end = finalDash + 5;
            }
          }
        }

        // For other patterns, extend to end of token (non-whitespace)
        if (
          entry.pattern !== "Bearer " &&
          entry.pattern !== "-----BEGIN "
        ) {
          while (end < maskedText.length && !/\s/.test(maskedText[end])) {
            end++;
          }
        }

        matches.push({
          start: idx,
          end,
          value: maskedText.slice(idx, end),
        });
        searchPos = idx + 1;
      }
    }
  }

  // High-entropy token layer (opt-in per table).
  //
  // Tokenizer rule: a run is scored WHOLE when it contains '+' anywhere, or
  // '=' only as trailing padding; any other run is first split at the
  // ordinary separators '/' '-' '_' and at an '=' that is followed by more
  // characters (a key=value separator), and each segment is scored on its
  // own. A run matching SRI_VALUE_RE is skipped entirely.
  //
  // Why: '+' and '=' padding occur in base64 value runs (an AWS secret
  // access key is 40 chars of [A-Za-z0-9/+], and standard base64 ends in
  // '=') but never in path, branch or URL segments, so they mark a run as a
  // value rather than a location. '=' BEFORE the end is the opposite: URLs
  // like ?ref=<branch> put a branch name after '=' (#4189 FIX ROUND), so a
  // mid-run '=' splits like the other separators. Without the split, a whole
  // path or branch name is one token that mixes letters, digits and
  // separators and can cross 4.3 bits/char (#4189 masked 158 lines of git
  // ls-files output). Without the whole-run carve-out, splitting every '/'
  // would cut that same secret into pieces under the 20-char floor and
  // silently skip it. Both directions are proven in
  // tests/entropy-corpus.test.ts: the repo-output corpus (paths, branches,
  // URLs, npm integrity lines) must mask 0 spans, and the synthetic base64
  // and JWT positives must still mask.
  const entropy = table.entropy;
  if (entropy) {
    const tokenRe = new RegExp(`${ENTROPY_ALPHABET}{${entropy.minLength},}`, "g");
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(maskedText)) !== null) {
      if (SRI_VALUE_RE.test(m[0])) {
        // public integrity hash, never a secret
        continue;
      }
      if (/[+]/.test(m[0]) || /^[^=]+=+$/.test(m[0])) {
        // base64-like run: '+' anywhere, or '=' only as trailing padding
        if (shannonEntropy(m[0]) >= entropy.thresholdBitsPerChar) {
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            value: m[0],
          });
        }
      } else {
        // ordinary run: split at separators and key=value '=', score each
        // segment
        const segRe = /[^/_=-]+/g;
        let s: RegExpExecArray | null;
        while ((s = segRe.exec(m[0])) !== null) {
          if (
            s[0].length >= entropy.minLength &&
            shannonEntropy(s[0]) >= entropy.thresholdBitsPerChar
          ) {
            matches.push({
              start: m.index + s.index,
              end: m.index + s.index + s[0].length,
              value: s[0],
            });
          }
        }
      }
    }
  }

  // Sort matches by start position, then by length (longest first for same start)
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end; // longer matches first
  });

  // Remove overlapping matches (keep the first/longest)
  const nonOverlapping: typeof matches = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  // Build masked text and spans (in reverse order to preserve positions)
  nonOverlapping.reverse();
  for (const match of nonOverlapping) {
    const maskedValue = "\u2022".repeat(Math.min(8, match.end - match.start));
    maskedText =
      maskedText.slice(0, match.start) + maskedValue + maskedText.slice(match.end);
    spans.unshift({
      start: match.start,
      end: match.end,
      value: match.value,
      name: match.name,
    });
  }

  return { text: maskedText, spans };
}

/**
 * Check if a value would be masked (used for testing).
 */
export function wouldMask(value: string, table: MaskTable): boolean {
  for (const entry of table.entries) {
    if (entry.type === "env" && entry.value === value) {
      return true;
    }
    if (entry.type === "pattern" && value.startsWith(entry.pattern)) {
      return true;
    }
  }
  // Same tokenizer rule as mask(): '+' anywhere or '=' as trailing padding
  // means the value is a base64-like run and is scored whole; otherwise
  // ordinary separators and a mid-run '=' split it into segments and any
  // high-entropy segment masks. SRI values are public and never mask.
  const entropy = table.entropy;
  if (entropy) {
    if (SRI_VALUE_RE.test(value)) {
      return false;
    }
    if (/[+]/.test(value) || /^[^=]+=+$/.test(value)) {
      return (
        value.length >= entropy.minLength &&
        shannonEntropy(value) >= entropy.thresholdBitsPerChar
      );
    }
    for (const seg of value.split(/[._=/-]+/)) {
      if (
        seg.length >= entropy.minLength &&
        shannonEntropy(seg) >= entropy.thresholdBitsPerChar
      ) {
        return true;
      }
    }
  }
  return false;
}
