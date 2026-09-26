import assert from "node:assert/strict";
import {
  COST_MISMATCH_MAX_REL,
  EVALS_API_KEY_ENV,
  assertMeteredMatchesLedger,
  getModelPricing,
  ledgerCostUsd,
  loadVocabPricing,
  naiveLedgerCostUsd,
  normalizeUsage,
  relativeCostDiff,
  requireEvalsApiKey,
  sumUsage,
} from "../../scripts/lib/eval-cost-ledger.mjs";
import {
  JUDGE_PREAMBLE,
  buildJudgePrompt,
  createAnthropicClient,
  judgeOnce,
  parseVerdict,
  textFromMessage,
} from "../../scripts/lib/eval-judge-sdk.mjs";

const pricing = loadVocabPricing();
const opus = getModelPricing("claude-opus-5-5", pricing);

assert.equal(opus.input_per_mtok, 4.0);
assert.equal(opus.output_per_mtok, 20.0);
assert.equal(opus.cache_read_per_mtok, 0.2);
assert.equal(opus.cache_write_per_mtok, 5.0);

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
  const metered = ledger.total;
  const rel = assertMeteredMatchesLedger(metered, ledger.total);
  assert.equal(rel, 0);
  assert.ok(relativeCostDiff(metered * 1.1, ledger.total) < COST_MISMATCH_MAX_REL);
  assert.ok(relativeCostDiff(metered * 1.3, ledger.total) > COST_MISMATCH_MAX_REL);
}

{
  assert.equal(parseVerdict("PASS"), "PASS");
  assert.equal(parseVerdict("FAIL\nmore"), "FAIL");
  assert.match(parseVerdict("maybe"), /^ODD:/);
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

console.log("ok: test-eval-cost-ledger");
