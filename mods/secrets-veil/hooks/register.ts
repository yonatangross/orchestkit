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
 *   result (plain text, result.stdout, and any nested field).
 *
 * There is no reveal path: no ui.render, no ui.press, no command.register,
 * no hover. Once covered, a value stays covered for the session.
 * Negative pins: no process.run, no http.fetch, no store.*, no ui.log.
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

/**
 * Deep-mask every string in a tool result. Strings are masked in place in a
 * fresh structure; numbers, booleans and nulls pass through untouched.
 * Covers plain text results (result), structured results (result.stdout,
 * result.stderr) and any nested field.
 */
function maskDeep(value: unknown, activeTable: MaskTable): unknown {
  if (typeof value === "string") {
    return mask(value, activeTable).text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskDeep(item, activeTable));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = maskDeep(val, activeTable);
    }
    return out;
  }
  return value;
}

/**
 * Register the secrets-veil hooks.
 */
export function register(on: (event: string, hook: unknown) => void, _options?: unknown): void {
  on("session.start", async ($: DollarAPI) => {
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

    const names = Object.keys(named);
    table = buildTable(names, named, DEFAULT_PATTERNS, { entropy: true });

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
  });

  on("tool.call", async ($: DollarAPI, _e: ToolCallEvent, next?: (ev: ToolCallEvent) => Promise<ToolCallResult>) => {
    // First, let the tool execute.
    const result = next ? ((await next(_e)) ?? {}) : {};
    if (!table) {
      // session.start has not armed the veil yet; pass through unchanged.
      return result;
    }
    return maskDeep(result, table);
  });
}
