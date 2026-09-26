/**
 * Eval cost ledger: price cache_creation and cache_read at vocab rates, and
 * refuse when metered spend and the ledger diverge by more than 20%.
 *
 * Closes orchestkit#4461 (ledger undercounted cache writes ~15x).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EVALS_API_KEY_ENV = "ORK_EVALS_API_KEY";
export const COST_MISMATCH_MAX_REL = 0.2;
export const MTOK = 1_000_000;

const VOCAB_REL = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/hooks/src/lib/models.vocab.json",
);

/**
 * Paid eval / rejudge paths must use a dedicated, spend-capped key.
 * Never fall back to a shared ANTHROPIC_API_KEY (orchestkit#4461).
 */
export function requireEvalsApiKey(env = process.env) {
  const key = env[EVALS_API_KEY_ENV];
  if (typeof key === "string" && key.trim()) return key.trim();
  const err = new Error(
    `paid evals require ${EVALS_API_KEY_ENV} (dedicated, spend-capped). ` +
      `Refusing to fall back to ANTHROPIC_API_KEY.`,
  );
  err.code = "ORK_EVALS_KEY_MISSING";
  throw err;
}

/** Normalize Anthropic usage (SDK or raw) into four ledger buckets. */
export function normalizeUsage(usage = {}) {
  return {
    input: Number(usage.input_tokens ?? usage.input ?? 0) || 0,
    output: Number(usage.output_tokens ?? usage.output ?? 0) || 0,
    cache_creation:
      Number(
        usage.cache_creation_input_tokens ??
          usage.cache_creation ??
          usage.cache_write ??
          0,
      ) || 0,
    cache_read:
      Number(usage.cache_read_input_tokens ?? usage.cache_read ?? 0) || 0,
  };
}

export function sumUsage(usages) {
  const out = { input: 0, output: 0, cache_creation: 0, cache_read: 0 };
  for (const u of usages) {
    const n = normalizeUsage(u);
    out.input += n.input;
    out.output += n.output;
    out.cache_creation += n.cache_creation;
    out.cache_read += n.cache_read;
  }
  return out;
}

export function loadVocabPricing(vocabPath = VOCAB_REL) {
  const vocab = JSON.parse(readFileSync(vocabPath, "utf8"));
  return vocab.pricing ?? {};
}

export function getModelPricing(model, pricingTable) {
  const table = pricingTable ?? loadVocabPricing();
  if (table[model]) return table[model];
  for (const [id, row] of Object.entries(table)) {
    if (model.startsWith(id) || id.startsWith(model)) return row;
  }
  throw new Error(`no pricing row for model ${model} in models.vocab.json`);
}

/**
 * Full ledger cost: input + output + cache_creation (write) + cache_read.
 * The pre-#4461 undercount priced only input + output.
 */
export function ledgerCostUsd(model, usage, pricingTable) {
  const pricing = getModelPricing(model, pricingTable);
  const u = normalizeUsage(usage);
  const input = (u.input / MTOK) * pricing.input_per_mtok;
  const output = (u.output / MTOK) * pricing.output_per_mtok;
  const cacheWrite =
    (u.cache_creation / MTOK) * pricing.cache_write_per_mtok;
  const cacheRead = (u.cache_read / MTOK) * pricing.cache_read_per_mtok;
  return {
    input,
    output,
    cache_creation: cacheWrite,
    cache_read: cacheRead,
    total: input + output + cacheWrite + cacheRead,
    tokens: u,
  };
}

/** Legacy undercount used before #4461 (input + output only). */
export function naiveLedgerCostUsd(model, usage, pricingTable) {
  const pricing = getModelPricing(model, pricingTable);
  const u = normalizeUsage(usage);
  const input = (u.input / MTOK) * pricing.input_per_mtok;
  const output = (u.output / MTOK) * pricing.output_per_mtok;
  return { input, output, total: input + output, tokens: u };
}

export function relativeCostDiff(meteredUsd, ledgerUsd) {
  const m = Number(meteredUsd);
  const l = Number(ledgerUsd);
  if (!Number.isFinite(m) || !Number.isFinite(l)) {
    throw new Error("meteredUsd and ledgerUsd must be finite numbers");
  }
  if (m === 0 && l === 0) return 0;
  const denom = Math.max(Math.abs(m), Math.abs(l), 1e-9);
  return Math.abs(m - l) / denom;
}

/**
 * Fail loudly when Console (metered) and ledger disagree by more than maxRel.
 * Returns the relative diff when within tolerance.
 */
export function assertMeteredMatchesLedger(
  meteredUsd,
  ledgerUsd,
  maxRel = COST_MISMATCH_MAX_REL,
) {
  const rel = relativeCostDiff(meteredUsd, ledgerUsd);
  if (rel > maxRel) {
    const err = new Error(
      `eval cost mismatch: metered $${Number(meteredUsd).toFixed(4)} vs ` +
        `ledger $${Number(ledgerUsd).toFixed(4)} ` +
        `(${(rel * 100).toFixed(1)}% > ${(maxRel * 100).toFixed(0)}% tolerance)`,
    );
    err.code = "ORK_EVAL_COST_MISMATCH";
    err.meteredUsd = Number(meteredUsd);
    err.ledgerUsd = Number(ledgerUsd);
    err.relativeDiff = rel;
    throw err;
  }
  return rel;
}
