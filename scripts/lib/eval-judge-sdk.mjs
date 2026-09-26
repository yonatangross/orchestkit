/**
 * Direct Anthropic Messages API judge (SDK path). Rubric + item only.
 * Never opens a Claude Code session (orchestkit#4461 cache-write blast).
 *
 * SDK is loaded lazily inside createAnthropicClient so unit tests can import
 * judgeOnce with an injected ctor without installing @anthropic-ai/sdk
 * (HOLD r3 on #4466).
 */
import { createRequire } from "node:module";
import { normalizeUsage } from "./eval-cost-ledger.mjs";
import {
  parseVerdict,
  textFromMessage,
} from "./eval-judge-verdict.mjs";

export {
  JUDGE_PREAMBLE,
  buildJudgePrompt,
  parseVerdict,
  isFailedVerdict,
  rejudgeExitCode,
  textFromMessage,
} from "./eval-judge-verdict.mjs";

const require = createRequire(import.meta.url);

function loadAnthropicCtor() {
  const mod = require("@anthropic-ai/sdk");
  return mod.default ?? mod;
}

export function createAnthropicClient(apiKey, AnthropicCtor) {
  const Ctor = AnthropicCtor ?? loadAnthropicCtor();
  return new Ctor({ apiKey });
}

/**
 * One judge call via messages.create. Prompt must already be rubric-sized.
 * Returns { verdict, usage, raw }.
 */
export async function judgeOnce({ client, model, prompt, maxTokens = 16 }) {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const verdict = parseVerdict(textFromMessage(message));
  const usage = normalizeUsage(message.usage ?? {});
  return { verdict, usage, raw: message };
}
