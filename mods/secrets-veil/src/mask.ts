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
 * Minimum mean chunk length for a mixed-case segment to count as camelCase
 * or PascalCase and therefore word-like (FIX ROUND B of HOLD 4189).
 * Human compound identifiers chunk into 3+ character words (ReviewPR ->
 * Review,PR mean 4; CTAOverlay -> CTA,Overlay mean 5), while random base64
 * alternates case every 1 to 2 characters (mean chunk 1 to 2).
 */
export const CAMELCASE_MIN_MEAN_CHUNK = 3;

const CAMEL_CHUNK_RE = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g;

/**
 * Mean chunk length of a camelCase/PascalCase segment, or 0 when the chunk
 * regex does not tile the segment completely. Chunks are uppercase runs not
 * followed by lowercase, optional single uppercase plus a lowercase run,
 * and digit runs: ReviewPR -> Review,PR; CTAOverlay -> CTA,Overlay;
 * aB3dE6fG -> a,B,3,d,E,6,f,G.
 */
export function camelChunkMeanLength(seg: string): number {
  let covered = 0;
  let count = 0;
  for (const m of seg.matchAll(CAMEL_CHUNK_RE)) {
    covered += m[0].length;
    count++;
  }
  if (count === 0 || covered !== seg.length) return 0;
  return seg.length / count;
}

/**
 * Word-likeness of a separator-split segment (HOLD 4189, fix round 3).
 *
 * A segment is WORD-LIKE when it is 7 characters or fewer (short pieces
 * cannot hide a secret on their own), or when it reads like a human word:
 * letters of a single case (all lower or all upper), digits only, lowercase
 * letters mixed with digits with no uppercase (hex, slugs), or a camelCase
 * or PascalCase compound whose chunks average 3+ characters (FIX ROUND B:
 * ReviewPR, ShowcaseDemo, CTAOverlay are identifier words, not secret
 * bodies; masking docs/site/public/thumbnails/CIN-ReviewPR.png and
 * orchestkit-demos/src/components/terminal-flow/CTAOverlay.tsx was a
 * precision bug). It is RANDOM-LOOKING when it is 8+ characters mixing
 * upper and lower case, or mixing upper case with digits, without long
 * word chunks: that is the signature of base64url and base64 secret
 * bodies, which never appear in paths, branch names or URLs.
 *
 * A segment containing any character outside [A-Za-z0-9] is neither and
 * returns false, so a run holding one keeps its whole-run treatment.
 */
export function isWordLikeSegment(seg: string): boolean {
  if (seg.length === 0) return true; // empty piece from a boundary split
  if (seg.length <= 7) return true; // short segments are never random
  let hasUpper = false;
  let hasLower = false;
  let hasDigit = false;
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i];
    if (ch >= "a" && ch <= "z") {
      hasLower = true;
    } else if (ch >= "A" && ch <= "Z") {
      hasUpper = true;
    } else if (ch >= "0" && ch <= "9") {
      hasDigit = true;
    } else {
      return false;
    }
  }
  if (hasUpper && hasLower) {
    // mixed case, 8+: word-like only as a camelCase/PascalCase compound
    // (FIX ROUND B); random base64 alternates case too often to chunk long
    return camelChunkMeanLength(seg) >= CAMELCASE_MIN_MEAN_CHUNK;
  }
  if (hasUpper && hasDigit) {
    // upper case with digits, 8+: same chunk test (CTA2024 -> 3.5, word;
    // Ab3dE6fG -> 1.7, random)
    return camelChunkMeanLength(seg) >= CAMELCASE_MIN_MEAN_CHUNK;
  }
  return true;
}

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
  "sk_live_",
  "rk_live_",
  "AKIA",
  "Bearer ",
  "-----BEGIN ",
];

/**
 * Push a span when the value crosses the entropy bar (length floor and
 * threshold). Shared by the whole-run and per-segment paths; the length
 * check runs first so short values skip entropy scoring entirely (perf).
 */
function pushIfHighEntropy(
  matches: Array<{ start: number; end: number; value: string; name?: string }>,
  start: number,
  value: string,
  entropy: EntropyConfig
): void {
  if (
    value.length >= entropy.minLength &&
    shannonEntropy(value) >= entropy.thresholdBitsPerChar
  ) {
    matches.push({ start, end: start + value.length, value });
  }
}

/**
 * Score one '='-split piece of a run, from run[pieceStart] to run[pieceEnd].
 * The piece splits at '/', '-' and '_' only when every resulting segment is
 * word-like (isWordLikeSegment); otherwise the piece is scored whole. This
 * is the round-3 rule that restored recall on base64url secret shapes
 * (HOLD 5697167579) while keeping paths and branch names split.
 */
function scorePiece(
  matches: Array<{ start: number; end: number; value: string; name?: string }>,
  absStart: number,
  run: string,
  pieceStart: number,
  pieceEnd: number,
  entropy: EntropyConfig
): void {
  const piece = run.slice(pieceStart, pieceEnd);
  let segStart = -1;
  for (let i = 0; i <= piece.length; i++) {
    const ch = i < piece.length ? piece[i] : "/"; // sentinel flushes the tail
    if (ch === "/" || ch === "-" || ch === "_") {
      if (segStart !== -1 && !isWordLikeSegment(piece.slice(segStart, i))) {
        // a random-looking segment: the whole piece stays unsplit
        pushIfHighEntropy(matches, absStart, piece, entropy);
        return;
      }
      segStart = -1;
    } else if (segStart === -1) {
      segStart = i;
    }
  }
  // every segment word-like: score each on its own
  segStart = -1;
  for (let i = 0; i <= piece.length; i++) {
    const ch = i < piece.length ? piece[i] : "/";
    if (ch === "/" || ch === "-" || ch === "_") {
      if (segStart !== -1) {
        pushIfHighEntropy(matches, absStart + segStart, piece.slice(segStart, i), entropy);
        segStart = -1;
      }
    } else if (segStart === -1) {
      segStart = i;
    }
  }
}

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
        // Every occurrence, overlapping ones included: a copy that starts
        // inside another must not leave a fragment visible. indexOf keeps
        // this linear; the spans are unioned below.
        searchPos = idx + 1;
      }
    } else {
      // Pattern prefix match
      let searchPos = 0;
      // One forward search for "-----END ": the nearest END at or after a
      // BEGIN only moves forward, so a cached position (or "none left") is
      // reused instead of re-searching from every BEGIN (quadratic on many
      // BEGINs with no END).
      let endMarkerAt = -2; // -2: not searched yet; -1: none after endSearchFrom
      let endSearchFrom = 0;
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
          if (endMarkerAt === -2 || (endMarkerAt !== -1 && endMarkerAt < idx)) {
            endSearchFrom = idx;
            endMarkerAt = maskedText.indexOf("-----END ", idx);
          }
          const endMarker = endMarkerAt !== -1 && idx >= endSearchFrom ? endMarkerAt : -1;
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
        // Resume at the end of this match, never one character later: any
        // later prefix hit inside [idx, end) would end at the same run end,
        // so it is already covered, and the overlap step below unions spans
        // instead of dropping them. Restarting inside the run was quadratic.
        searchPos = Math.max(end, idx + 1);
      }
    }
  }

  // High-entropy token layer (opt-in per table).
  //
  // Tokenizer rule (HOLD 4189, fix round 3): a run is scored WHOLE when it
  // contains '+' anywhere, or '=' only as trailing padding, or when a
  // separator split would NOT leave every segment word-like; otherwise it
  // splits and each segment is scored on its own. A run matching
  // SRI_VALUE_RE is skipped entirely.
  //
  // Why: '+' and '=' padding occur in base64 value runs (an AWS secret
  // access key is 40 chars of [A-Za-z0-9/+], and standard base64 ends in
  // '=') but never in path, branch or URL segments, so they mark a run as a
  // value rather than a location. A mid-run '=' is the opposite: URLs like
  // ?ref=<branch> put a branch name after '=' (#4189 FIX ROUND), so it
  // always splits like a key=value boundary. Round 2 also split every '-'
  // and '_' unconditionally, but those characters are ordinary alphabet in
  // base64url, which is what JWTs, OpenAI project keys, Google keys and
  // most modern tokens use: the split cut real secrets into segments under
  // the 20-char floor and recall collapsed (measured in HOLD 5697167579:
  // JWT 99.6% -> 13.8%, sk-proj- 100 -> 43.4). The character mix now
  // decides: '-', '_' and '/' split only when every resulting segment is
  // word-like (paths, branch names, slugs), and a run with any random-
  // looking segment is scored whole (secrets). Both directions are pinned
  // in tests/entropy-corpus.test.ts: the repo-output corpus (paths,
  // branches, URLs, npm integrity lines) must mask 0 spans (mutation M5),
  // and 500 seeded samples per real secret shape must mask at >= 98%
  // (>= 95% for the two threshold-limited shapes) (mutation M4).
  const entropy = table.entropy;
  if (entropy) {
    const tokenRe = new RegExp(`${ENTROPY_ALPHABET}{${entropy.minLength},}`, "g");
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(maskedText)) !== null) {
      const run = m[0];
      if (SRI_VALUE_RE.test(run)) {
        // public integrity hash, never a secret
        continue;
      }
      if (run.indexOf("+") !== -1 || /^[^=]+=+$/.test(run)) {
        // base64-like run: '+' anywhere, or '=' only as trailing padding;
        // score it whole
        pushIfHighEntropy(matches, m.index, run, entropy);
      } else {
        // ordinary run: a mid-run '=' always splits (key=value, round 2);
        // each piece then splits at '/', '-', '_' only when every segment
        // is word-like, else the piece is scored whole
        let pieceStart = 0;
        for (let i = 0; i <= run.length; i++) {
          if (i === run.length || run[i] === "=") {
            if (i > pieceStart) {
              scorePiece(matches, m.index + pieceStart, run, pieceStart, i, entropy);
            }
            pieceStart = i + 1;
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

  // Union overlapping or touching matches. Dropping a match that starts
  // inside an earlier one lost its tail whenever it reached further (a
  // named value ending inside a prefix token, two overlapping named values,
  // an entropy piece next to a prefix hit), leaving part of a secret
  // visible. A merged span covers everything any layer matched.
  const merged: Array<{ start: number; end: number; name?: string; names: number }> = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start <= last.end) {
      if (match.end > last.end) last.end = match.end;
      if (match.name !== undefined && match.name !== last.name) last.names += 1;
    } else {
      merged.push({ start: match.start, end: match.end, name: match.name, names: match.name === undefined ? 0 : 1 });
    }
  }

  // Build the masked text in one pass: slices and bullets joined once
  // (per-span slice + concat + unshift was quadratic on many spans).
  const parts: string[] = [];
  let cursor = 0;
  for (const span of merged) {
    parts.push(text.slice(cursor, span.start));
    parts.push("\u2022".repeat(Math.min(8, span.end - span.start)));
    cursor = span.end;
    spans.push({
      start: span.start,
      end: span.end,
      value: text.slice(span.start, span.end),
      // A span merged from several named values names none of them.
      name: span.names === 1 ? span.name : undefined,
    });
  }
  parts.push(text.slice(cursor));
  maskedText = parts.join("");

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
  // means the value is a base64-like run and is scored whole. Otherwise a
  // mid-run '=' always splits (round 2), and each piece splits at '/', '-'
  // and '_' only when every segment is word-like (round 3), else the piece
  // is scored whole. SRI values are public and never mask.
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
    let pieceStart = 0;
    for (let i = 0; i <= value.length; i++) {
      if (i === value.length || value[i] === "=") {
        if (i > pieceStart) {
          const piece = value.slice(pieceStart, i);
          let segStart = -1;
          let allWordLike = true;
          for (let j = 0; j <= piece.length; j++) {
            const ch = j < piece.length ? piece[j] : "/";
            if (ch === "/" || ch === "-" || ch === "_") {
              if (segStart !== -1 && !isWordLikeSegment(piece.slice(segStart, j))) {
                allWordLike = false;
                break;
              }
              segStart = -1;
            } else if (segStart === -1) {
              segStart = j;
            }
          }
          if (allWordLike) {
            segStart = -1;
            for (let j = 0; j <= piece.length; j++) {
              const ch = j < piece.length ? piece[j] : "/";
              if (ch === "/" || ch === "-" || ch === "_") {
                if (segStart !== -1) {
                  const seg = piece.slice(segStart, j);
                  if (
                    seg.length >= entropy.minLength &&
                    shannonEntropy(seg) >= entropy.thresholdBitsPerChar
                  ) {
                    return true;
                  }
                  segStart = -1;
                }
              } else if (segStart === -1) {
                segStart = j;
              }
            }
          } else if (
            piece.length >= entropy.minLength &&
            shannonEntropy(piece) >= entropy.thresholdBitsPerChar
          ) {
            return true;
          }
        }
        pieceStart = i + 1;
      }
    }
  }
  return false;
}
