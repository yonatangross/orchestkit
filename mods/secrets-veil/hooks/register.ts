/**
 * Hook registration for secrets-veil (literal-only design).
 *
 * A secret that appears in a tool result is masked before the model reads it.
 *
 * Events:
 * - session.start: read the 21 vendor variable names, one literal $.env.get
 *   call site per name, and arm the mask table (named values + shape
 *   patterns + high-entropy tokens). If zero named values resolve, emit one
 *   $.ui.notice: the veil runs on value patterns and entropy only.
 * - tool.call: run the tool via next(), then deep-mask every string in the
 *   result (plain text, result.stdout, and any nested field). When at least
 *   one value was masked, say so where the human can see it: one $.ui.toast
 *   and one $.ui.status line with the count and the UTF-8 byte counts
 *   (bytes of the covered values in, bytes of the bullets out), plus the
 *   same numbers to the debug log via $.ui.log. The numbers never include a
 *   masked value, so the proof reveals nothing.
 *
 * There is no reveal path: no ui.render, no ui.press, no command.register,
 * no hover. Once covered, a value stays covered for the session.
 * Negative pins: no process.run, no http.fetch, no store.*.
 *
 * The 21 names below are the widely known vendor variable names and are the
 * only names this mod reads. A deployment's own variable names cannot be
 * listed in a public mod; see README.md. The validator records env reads
 * statically, so every read must be a string literal at its call site
 * (measured: a variable argument is refused, probe B, rc=1, 2026-09-16).
 */

import { buildTable, mask, DEFAULT_PATTERNS } from "../src/mask.js";
import type { DollarAPI, MaskTable, ToolCallEvent, ToolCallResult } from "../src/types.js";

/** A named value shorter than this is not worth a table entry. */
const MIN_NAMED_VALUE_LENGTH = 8;

/** Synthetic id for the session.start notice (there is no toolUseId yet). */
const NOTICE_ID = "secrets-veil";

/** Module-scope state (per session): the armed mask table. */
let table: MaskTable | null = null;

/** Module-scope state (per session): values masked since session.start. */
let maskedThisSession = 0;

/** What one tool result's masking did, in counts and UTF-8 bytes. */
export interface MaskStats {
  /** Number of values covered. */
  values: number;
  /** UTF-8 bytes of the covered values. */
  bytesIn: number;
  /** UTF-8 bytes of the bullets that replaced them. */
  bytesOut: number;
}

const encoder = new TextEncoder();

/** UTF-8 byte length of a string. */
export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Deep-mask every string in a tool result. Strings are masked in place in a
 * fresh structure; numbers, booleans and nulls pass through untouched.
 * Covers plain text results (result), structured results (result.stdout,
 * result.stderr) and any nested field. Adds what it covered to stats.
 */
function maskDeep(value: unknown, activeTable: MaskTable, covered: Set<string>): unknown {
  if (typeof value === "string") {
    const masked = mask(value, activeTable);
    for (const span of masked.spans) {
      covered.add(value.slice(span.start, span.end));
    }
    return masked.text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskDeep(item, activeTable, covered));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = maskDeep(val, activeTable, covered);
    }
    return out;
  }
  return value;
}

/**
 * Count the distinct values covered in one result. A tool result can carry
 * the same output twice (a Bash result has it in stdout and in text), so a
 * value is counted once however many fields it appeared in.
 */
export function statsOf(covered: Set<string>): MaskStats {
  const stats: MaskStats = { values: 0, bytesIn: 0, bytesOut: 0 };
  for (const value of covered) {
    stats.values += 1;
    stats.bytesIn += utf8Bytes(value);
    stats.bytesOut += utf8Bytes("•".repeat(Math.min(8, value.length)));
  }
  return stats;
}

/** The toast line for one masked tool result (Claude Code prefixes the plugin name). */
export function toastText(stats: MaskStats, tool: string): string {
  const noun = stats.values === 1 ? "value" : "values";
  return `masked ${stats.values} ${noun} in ${tool}, ${stats.bytesIn} bytes in, ${stats.bytesOut} bytes out`;
}

/**
 * Read the 21 vendor names, one literal $.env.get call site per name (the
 * validator records env reads statically). Keep a value only when it is at
 * least MIN_NAMED_VALUE_LENGTH characters; a rejected read counts as absent.
 */
async function readNamed($: DollarAPI): Promise<Record<string, string>> {
  const named: Record<string, string> = {};

  // One literal call site per vendor name. Keep a value only when it is at
  // least MIN_NAMED_VALUE_LENGTH characters; a rejected read counts as
  // absent, never as a failure of the session.
  const anthropicApiKey = await $.env.get("ANTHROPIC_API_KEY").catch(() => undefined);
  if (anthropicApiKey && anthropicApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.ANTHROPIC_API_KEY = anthropicApiKey;
  const openaiApiKey = await $.env.get("OPENAI_API_KEY").catch(() => undefined);
  if (openaiApiKey && openaiApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.OPENAI_API_KEY = openaiApiKey;
  const geminiApiKey = await $.env.get("GEMINI_API_KEY").catch(() => undefined);
  if (geminiApiKey && geminiApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.GEMINI_API_KEY = geminiApiKey;
  const googleApiKey = await $.env.get("GOOGLE_API_KEY").catch(() => undefined);
  if (googleApiKey && googleApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.GOOGLE_API_KEY = googleApiKey;
  const mistralApiKey = await $.env.get("MISTRAL_API_KEY").catch(() => undefined);
  if (mistralApiKey && mistralApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.MISTRAL_API_KEY = mistralApiKey;
  const groqApiKey = await $.env.get("GROQ_API_KEY").catch(() => undefined);
  if (groqApiKey && groqApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.GROQ_API_KEY = groqApiKey;
  const openrouterApiKey = await $.env.get("OPENROUTER_API_KEY").catch(() => undefined);
  if (openrouterApiKey && openrouterApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.OPENROUTER_API_KEY = openrouterApiKey;
  const hfToken = await $.env.get("HF_TOKEN").catch(() => undefined);
  if (hfToken && hfToken.length >= MIN_NAMED_VALUE_LENGTH) named.HF_TOKEN = hfToken;
  const githubToken = await $.env.get("GITHUB_TOKEN").catch(() => undefined);
  if (githubToken && githubToken.length >= MIN_NAMED_VALUE_LENGTH) named.GITHUB_TOKEN = githubToken;
  const ghToken = await $.env.get("GH_TOKEN").catch(() => undefined);
  if (ghToken && ghToken.length >= MIN_NAMED_VALUE_LENGTH) named.GH_TOKEN = ghToken;
  const gitlabToken = await $.env.get("GITLAB_TOKEN").catch(() => undefined);
  if (gitlabToken && gitlabToken.length >= MIN_NAMED_VALUE_LENGTH) named.GITLAB_TOKEN = gitlabToken;
  const npmToken = await $.env.get("NPM_TOKEN").catch(() => undefined);
  if (npmToken && npmToken.length >= MIN_NAMED_VALUE_LENGTH) named.NPM_TOKEN = npmToken;
  const awsAccessKeyId = await $.env.get("AWS_ACCESS_KEY_ID").catch(() => undefined);
  if (awsAccessKeyId && awsAccessKeyId.length >= MIN_NAMED_VALUE_LENGTH) named.AWS_ACCESS_KEY_ID = awsAccessKeyId;
  const awsSecretAccessKey = await $.env.get("AWS_SECRET_ACCESS_KEY").catch(() => undefined);
  if (awsSecretAccessKey && awsSecretAccessKey.length >= MIN_NAMED_VALUE_LENGTH) named.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey;
  const awsSessionToken = await $.env.get("AWS_SESSION_TOKEN").catch(() => undefined);
  if (awsSessionToken && awsSessionToken.length >= MIN_NAMED_VALUE_LENGTH) named.AWS_SESSION_TOKEN = awsSessionToken;
  const azureOpenaiApiKey = await $.env.get("AZURE_OPENAI_API_KEY").catch(() => undefined);
  if (azureOpenaiApiKey && azureOpenaiApiKey.length >= MIN_NAMED_VALUE_LENGTH) named.AZURE_OPENAI_API_KEY = azureOpenaiApiKey;
  const stripeSecretKey = await $.env.get("STRIPE_SECRET_KEY").catch(() => undefined);
  if (stripeSecretKey && stripeSecretKey.length >= MIN_NAMED_VALUE_LENGTH) named.STRIPE_SECRET_KEY = stripeSecretKey;
  const slackBotToken = await $.env.get("SLACK_BOT_TOKEN").catch(() => undefined);
  if (slackBotToken && slackBotToken.length >= MIN_NAMED_VALUE_LENGTH) named.SLACK_BOT_TOKEN = slackBotToken;
  const vercelToken = await $.env.get("VERCEL_TOKEN").catch(() => undefined);
  if (vercelToken && vercelToken.length >= MIN_NAMED_VALUE_LENGTH) named.VERCEL_TOKEN = vercelToken;
  const cloudflareApiToken = await $.env.get("CLOUDFLARE_API_TOKEN").catch(() => undefined);
  if (cloudflareApiToken && cloudflareApiToken.length >= MIN_NAMED_VALUE_LENGTH) named.CLOUDFLARE_API_TOKEN = cloudflareApiToken;
  const opServiceAccountToken = await $.env.get("OP_SERVICE_ACCOUNT_TOKEN").catch(() => undefined);
  if (opServiceAccountToken && opServiceAccountToken.length >= MIN_NAMED_VALUE_LENGTH) named.OP_SERVICE_ACCOUNT_TOKEN = opServiceAccountToken;

  return named;
}

/**
 * The table of last resort: value shapes and entropy, no named values. Pure,
 * no $ call, so it cannot be refused the way an env read can.
 */
function shapesOnlyTable(): MaskTable {
  return buildTable([], {}, DEFAULT_PATTERNS, { entropy: true });
}

/**
 * Arm the veil where session.start never did: a module enabled or reloaded
 * mid-session can see tool.call before (or without) session.start. Measured
 * on CC 2.1.282 (2026-09-26): a hot reload re-dispatches session.start about
 * a second after "reloaded", so a call in that window found table === null
 * and the old code returned the result UNMASKED. Named reads first; if they
 * fail, shapes and entropy alone. Never null.
 */
async function armLazily($: DollarAPI): Promise<MaskTable> {
  try {
    const named = await readNamed($);
    return buildTable(Object.keys(named), named, DEFAULT_PATTERNS, { entropy: true });
  } catch {
    return shapesOnlyTable();
  }
}

/**
 * Register the secrets-veil hooks.
 */
export function register(on: (event: string, hook: unknown) => void, _options?: unknown): void {
  on("session.start", async ($: DollarAPI, e: { cwd: string }, next: (ev: { cwd: string }) => Promise<unknown>) => {
    const named = await readNamed($);
    const names = Object.keys(named);
    table = buildTable(names, named, DEFAULT_PATTERNS, { entropy: true });
    maskedThisSession = 0;

    // FAIL LOUD on an empty named list. Silence is not allowed: say plainly
    // that only the value shapes and entropy are standing guard.
    if (names.length === 0) {
      try {
        await $.ui.notice(
          NOTICE_ID,
          "secrets-veil: no named secret values resolved from the environment; " +
            "the veil is running on value patterns and entropy only, with no named secrets."
        );
      } catch {
        // Notice refused; masking continues either way.
      }
    }
    return next(e); // a session.start hook must answer (CC 2.1.282 skips a hook that returns nothing)
  });

  on("tool.call", async ($: DollarAPI, e: ToolCallEvent, next?: (ev: ToolCallEvent) => Promise<ToolCallResult>) => {
    // First, let the tool execute.
    const result = next ? ((await next(e)) ?? {}) : {};
    // Never pass a result through unmasked: arm now if session.start has not
    // (a mod enabled or reloaded mid-session), and fail CLOSED if even the
    // shapes-only table cannot be built.
    if (!table) {
      table = await armLazily($);
    }
    let masked: unknown;
    const covered = new Set<string>();
    try {
      masked = maskDeep(result, table, covered);
    } catch {
      return {
        deny: "secrets-veil could not mask this result, so it is withheld rather than shown unmasked.",
      };
    }
    const stats = statsOf(covered);
    if (stats.values > 0) {
      maskedThisSession += stats.values;
      const tool = typeof e?.tool === "string" && e.tool.length > 0 ? e.tool : "a tool result";
      const line = toastText(stats, tool);
      // Each UI call is best effort: a refused surface never unmasks or fails the result.
      try {
        await $.ui.toast(line);
      } catch {
        // Toast refused (no surface, or a host without toasts); the result stays masked.
      }
      try {
        await $.ui.status(`${maskedThisSession} masked this session`);
      } catch {
        // Status refused; the result stays masked.
      }
      try {
        await $.ui.log(`${line}; result ${utf8Bytes(JSON.stringify(result))} bytes before, ${utf8Bytes(JSON.stringify(masked))} bytes after`);
      } catch {
        // Debug log refused; the result stays masked.
      }
    }
    return masked;
  });
}
