import assert from "node:assert/strict";
import {
  COST_MISMATCH_MAX_REL,
  EVALS_API_KEY_ENV,
  assertMeteredMatchesLedger,
  getModelPricing,
  ledgerCostUsd,
  loadVocabPricing,
  naiveLedgerCostUsd,
  normalizeModelId,
  normalizeUsage,
  parseMeteredUsdFlag,
  relativeCostDiff,
  requireEvalsApiKey,
  sumUsage,
} from "../../scripts/lib/eval-cost-ledger.mjs";
import {
  JUDGE_PREAMBLE,
  buildJudgePrompt,
  createAnthropicClient,
  isFailedVerdict,
  judgeOnce,
  parseVerdict,
  rejudgeExitCode,
  textFromMessage,
} from "../../scripts/lib/eval-judge-sdk.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pricing = loadVocabPricing();
const opus55 = getModelPricing("claude-opus-5-5", pricing);
const opus5 = getModelPricing("claude-opus-5", pricing);

assert.equal(opus55.input_per_mtok, 4.0);
assert.equal(opus55.output_per_mtok, 20.0);
assert.equal(opus55.cache_read_per_mtok, 0.2);
assert.equal(opus55.cache_write_per_mtok, 5.0);
assert.equal(opus5.input_per_mtok, 5.0);

assert.equal(normalizeModelId("claude-opus-5-5[1m]"), "claude-opus-5-5");
assert.equal(normalizeModelId("claude-opus-5-5-20260901"), "claude-opus-5-5");

{
  // HOLD #4466: first-prefix used to bill these as Opus 5 ($5/$25), 27.1% high.
  const tagged = getModelPricing("claude-opus-5-5[1m]", pricing);
  const dated = getModelPricing("claude-opus-5-5-20260901", pricing);
  assert.equal(tagged.input_per_mtok, 4.0);
  assert.equal(tagged.output_per_mtok, 20.0);
  assert.equal(dated.input_per_mtok, 4.0);
  assert.equal(dated.cache_write_per_mtok, 5.0);
  const usage = {
    input_tokens: 100_000,
    output_tokens: 100_000,
    cache_creation_input_tokens: 100_000,
    cache_read_input_tokens: 100_000,
  };
  // 0.1 MTok each at Opus 5.5 ($4/$20/$5/$0.2) = $2.92; Opus 5 = $3.675.
  const right = ledgerCostUsd("claude-opus-5-5[1m]", usage, pricing);
  const wrongOpus5 = ledgerCostUsd("claude-opus-5", usage, pricing);
  assert.ok(Math.abs(right.total - 2.92) < 1e-9);
  assert.ok(Math.abs(wrongOpus5.total - 3.675) < 1e-9);
  assert.equal(right.total, ledgerCostUsd("claude-opus-5-5-20260901", usage, pricing).total);
  assert.ok(right.total !== wrongOpus5.total);
}

{
  let threw = null;
  try {
    getModelPricing("claude", pricing);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.match(threw.message, /no pricing row/);
}

{
  const key = requireEvalsApiKey({ [EVALS_API_KEY_ENV]: " sk-evals-test " });
  assert.equal(key, "sk-evals-test");
}

{
  let threw = null;
  try {
    requireEvalsApiKey({ ANTHROPIC_API_KEY: "sk-shared" });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.code, "ORK_EVALS_KEY_MISSING");
  assert.match(threw.message, /ORK_EVALS_API_KEY/);
  assert.match(threw.message, /ANTHROPIC_API_KEY/);
}

{
  let threw = null;
  try {
    requireEvalsApiKey({ [EVALS_API_KEY_ENV]: "   ", ANTHROPIC_API_KEY: "sk-x" });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.code, "ORK_EVALS_KEY_MISSING");
}

{
  const u = normalizeUsage({
    input_tokens: 100,
    output_tokens: 10,
    cache_creation_input_tokens: 132000,
    cache_read_input_tokens: 0,
  });
  assert.deepEqual(u, {
    input: 100,
    output: 10,
    cache_creation: 132000,
    cache_read: 0,
  });
}

{
  const usage = {
    input_tokens: 27000,
    output_tokens: 27000,
    cache_creation_input_tokens: 9_210_000,
    cache_read_input_tokens: 0,
  };
  const full = ledgerCostUsd("claude-opus-5-5", usage, pricing);
  const naive = naiveLedgerCostUsd("claude-opus-5-5", usage, pricing);
  assert.ok(full.total > 40);
  assert.ok(naive.total < 5);
  assert.ok(full.total / naive.total > 10);
  let threw = null;
  try {
    assertMeteredMatchesLedger(full.total, naive.total);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.code, "ORK_EVAL_COST_MISMATCH");
  assert.ok(threw.relativeDiff > COST_MISMATCH_MAX_REL);
}

{
  const usage = sumUsage([
    { input_tokens: 500, output_tokens: 5, cache_creation_input_tokens: 4000, cache_read_input_tokens: 0 },
    { input_tokens: 500, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 4000 },
  ]);
  assert.deepEqual(usage, {
    input: 1000,
    output: 10,
    cache_creation: 4000,
    cache_read: 4000,
  });
  const ledger = ledgerCostUsd("claude-opus-5-5", usage, pricing);
  const metered = ledger.total * 1.05;
  const rel = assertMeteredMatchesLedger(metered, ledger.total);
  assert.ok(rel > 0 && rel < COST_MISMATCH_MAX_REL);
  assert.ok(relativeCostDiff(ledger.total * 1.1, ledger.total) < COST_MISMATCH_MAX_REL);
  assert.ok(relativeCostDiff(ledger.total * 1.3, ledger.total) > COST_MISMATCH_MAX_REL);
}

{
  assert.deepEqual(parseMeteredUsdFlag([]), { present: false, value: null });
  assert.deepEqual(parseMeteredUsdFlag(["--metered-usd", "3.24"]), {
    present: true,
    value: 3.24,
  });
  let threw = null;
  try {
    parseMeteredUsdFlag(["--metered-usd", "NaN"]);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.code, "ORK_EVAL_METERED_USD_INVALID");
  threw = null;
  try {
    parseMeteredUsdFlag(["--metered-usd"]);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw);
  assert.equal(threw.code, "ORK_EVAL_METERED_USD_INVALID");
}

{
  assert.equal(parseVerdict("PASS"), "PASS");
  assert.equal(parseVerdict("FAIL\nmore"), "FAIL");
  assert.match(parseVerdict("maybe"), /^ODD:/);
  assert.equal(isFailedVerdict("ERR:401"), true);
  assert.equal(isFailedVerdict("ODD:huh"), true);
  assert.equal(isFailedVerdict("PASS"), false);
  assert.equal(rejudgeExitCode({ results: ["PASS", "FAIL"], disagreements: [] }), 0);
  assert.equal(rejudgeExitCode({ results: ["ERR:x"], disagreements: [] }), 1);
  assert.equal(rejudgeExitCode({ results: ["ODD:x"], disagreements: [] }), 1);
  assert.equal(
    rejudgeExitCode({ results: ["PASS"], disagreements: ["a"] }),
    1,
  );
}

{
  const prompt = buildJudgePrompt("must say hello", "hello world");
  assert.ok(prompt.startsWith(JUDGE_PREAMBLE));
  assert.match(prompt, /Criterion:\nmust say hello/);
  assert.match(prompt, /Output to grade:\nhello world/);
  assert.equal(prompt.includes("CLAUDE.md"), false);
  assert.ok(prompt.length < 500);
}

{
  assert.equal(
    textFromMessage({ content: [{ type: "text", text: "PASS" }] }),
    "PASS",
  );
}

{
  const calls = [];
  const fakeCtor = function FakeAnthropic(opts) {
    assert.equal(opts.apiKey, "sk-evals");
    this.messages = {
      create: async (body) => {
        calls.push(body);
        assert.equal(body.model, "claude-opus-5-5");
        assert.equal(body.max_tokens, 16);
        assert.equal(body.messages.length, 1);
        assert.equal(body.messages[0].role, "user");
        assert.ok(body.messages[0].content.includes("Criterion:"));
        return {
          content: [{ type: "text", text: "PASS" }],
          usage: {
            input_tokens: 200,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        };
      },
    };
  };
  const client = createAnthropicClient("sk-evals", fakeCtor);
  const { verdict, usage } = await judgeOnce({
    client,
    model: "claude-opus-5-5",
    prompt: buildJudgePrompt("ok", "ok"),
  });
  assert.equal(verdict, "PASS");
  assert.deepEqual(usage, {
    input: 200,
    output: 1,
    cache_creation: 0,
    cache_read: 0,
  });
  assert.equal(calls.length, 1);
}

{
  const sh = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../scripts/run-plugin-eval.sh"),
    "utf8",
  );
  assert.equal(/export ANTHROPIC_API_KEY=/.test(sh), false);
  assert.match(sh, /ORK_EVALS_API_KEY/);
  assert.match(sh, /Max OAuth/);
}

console.log("ok: test-eval-cost-ledger");
