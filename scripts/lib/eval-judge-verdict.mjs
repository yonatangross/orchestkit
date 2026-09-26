/**
 * Pure judge verdict helpers (no Anthropic SDK).
 * Unit tests import from here so CI jobs without @anthropic-ai/sdk still pass.
 */
export const JUDGE_PREAMBLE =
  "You are grading the output of a coding agent against a criterion.\n" +
  "Respond with exactly one word: PASS or FAIL.";

export function buildJudgePrompt(criterion, evidence) {
  return (
    `${JUDGE_PREAMBLE}\n\n` +
    `Criterion:\n${criterion}\n\n` +
    `Output to grade:\n${evidence}`
  );
}

export function parseVerdict(text) {
  const word = String(text ?? "")
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase() ?? "";
  if (word === "PASS" || word === "FAIL") return word;
  return `ODD:${String(text ?? "").trim().slice(0, 40)}`;
}

/** ERR: (API/transport) or ODD: (unparseable) must fail the rejudge run. */
export function isFailedVerdict(verdict) {
  const v = String(verdict ?? "");
  return v.startsWith("ERR:") || v.startsWith("ODD:");
}

export function rejudgeExitCode({ results = [], disagreements = [] } = {}) {
  if (disagreements.length > 0) return 1;
  if (results.some(isFailedVerdict)) return 1;
  return 0;
}

export function textFromMessage(message) {
  const blocks = message?.content ?? [];
  const parts = [];
  for (const b of blocks) {
    if (b?.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("").trim();
}
