#!/usr/bin/env node
// Re-judge stored agent outputs against the CURRENT llm graders, offline.
//
// Why: agent turns are 98% of an eval's spend. run.json already holds every
// agent output under graders[].evidence, so a rubric can be recalibrated for
// cents without re-running a single agent. The judge prompt mirrors the one in
// the Claude Code binary: one criterion, one word back, PASS or FAIL.
//
// Judge path (orchestkit#4461): Anthropic Messages SDK with rubric + evidence
// only. Never `claude -p` (that wrote ~132k of CC context as cache_creation).
//
// Auth: requires ORK_EVALS_API_KEY. Refuses ANTHROPIC_API_KEY fallback.
// The key is passed only to the SDK client; never exported into the process
// env for a Claude Code session (#4466 HOLD).
//
// Cost: accumulates cache_creation + cache_read at vocab prices. Pass
// --metered-usd <n> (Console figure) to fail when ledger differs by >20%.
// A present but non-numeric --metered-usd fails loudly (never silent-skip).
//
// Usage:
//   ORK_EVALS_API_KEY=sk-... node scripts/rejudge-eval-outputs.mjs <run.json> \
//     [hand-verdicts.json] [--judge claude-opus-5-5] [-j 4] [--case <prefix>] \
//     [--metered-usd 3.24]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  assertMeteredMatchesLedger,
  getModelPricing,
  ledgerCostUsd,
  loadVocabPricing,
  parseMeteredUsdFlag,
  requireEvalsApiKey,
  sumUsage,
} from "./lib/eval-cost-ledger.mjs";
import {
  buildJudgePrompt,
  createAnthropicClient,
  judgeOnce,
} from "./lib/eval-judge-sdk.mjs";
import { rejudgeExitCode, assertHasJudgeJobs } from "./lib/eval-judge-verdict.mjs";

const args = process.argv.slice(2);
const runPath = args.find((a) => a.endsWith("run.json"));
const handPath = args.find((a) => /verdicts.*\.json$/.test(a));
const judge = args.includes("--judge")
  ? args[args.indexOf("--judge") + 1]
  : "claude-opus-5-5";
const conc = args.includes("-j")
  ? Number(args[args.indexOf("-j") + 1])
  : 4;
const caseFilter = args.includes("--case")
  ? args[args.indexOf("--case") + 1]
  : null;

let apiKey;
try {
  apiKey = requireEvalsApiKey();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

let metered;
try {
  metered = parseMeteredUsdFlag(args);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (!runPath) {
  console.error("need a run.json path");
  process.exit(1);
}

const run = JSON.parse(readFileSync(runPath, "utf8"));
const hand = handPath ? JSON.parse(readFileSync(handPath, "utf8")) : null;
const pricing = loadVocabPricing();
// Fail before any paid call when the judge id has no price row.
getModelPricing(judge, pricing);
const client = createAnthropicClient(apiKey);

function llmGraders(caseName) {
  const dir = join("evals", caseName, "graders");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const t = readFileSync(join(dir, f), "utf8");
      const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
      if (!fm || !/^type:\s*llm/m.test(fm[1])) return null;
      return { name: f.replace(/\.md$/, ""), criterion: fm[2].trim() };
    })
    .filter(Boolean);
}
function evidenceOf(c, arm) {
  for (const r of c.arms[arm] ?? [])
    for (const g of r.graders ?? []) if (g.evidence) return g.evidence;
  return null;
}

async function ask(prompt) {
  try {
    const { verdict, usage } = await judgeOnce({
      client,
      model: judge,
      prompt,
    });
    return { verdict, usage };
  } catch (err) {
    const msg = (err?.message || String(err)).split("\n")[0].slice(0, 60);
    return { verdict: `ERR:${msg}`, usage: null };
  }
}

const jobs = [];
for (const c of run.cases)
  for (const arm of ["with", "without"]) {
    if (caseFilter && !c.name.startsWith(caseFilter)) continue;
    const ev = evidenceOf(c, arm);
    if (!ev) continue;
    for (const g of llmGraders(c.name))
      jobs.push({
        case: c.name,
        arm,
        grader: g.name,
        prompt: buildJudgePrompt(g.criterion, ev),
      });
  }
try {
  assertHasJudgeJobs(jobs);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.error(
  `${jobs.length} judge calls on ${judge} via Anthropic SDK, concurrency ${conc}`,
);
const results = new Array(jobs.length);
const usages = [];
let next = 0;
await Promise.all(
  Array.from({ length: conc }, async () => {
    while (next < jobs.length) {
      const i = next++;
      const r = await ask(jobs[i].prompt);
      results[i] = r.verdict;
      if (r.usage) usages.push(r.usage);
    }
  }),
);

let agree = 0,
  total = 0;
const disagreements = [];
console.log("| Case | Arm | Claim | Judge | Hand | |");
console.log("|---|---|---|---|---|---|");
jobs.forEach((j, i) => {
  const h = hand?.[j.case]?.[j.arm]?.[j.grader] ?? "";
  let mark = "";
  if (h) {
    total++;
    if (h === results[i]) {
      agree++;
      mark = "ok";
    } else {
      mark = "DISAGREE";
      disagreements.push(
        `${j.case} ${j.arm} ${j.grader}: judge ${results[i]}, hand ${h}`,
      );
    }
  }
  console.log(
    `| \`${j.case}\` | ${j.arm} | ${j.grader} | ${results[i]} | ${h || "n/a"} | ${mark} |`,
  );
});
if (hand) {
  console.log(
    `\n**Agreement: ${agree}/${total}** (${total ? Math.round((100 * agree) / total) : 0}%).`,
  );
  if (disagreements.length) {
    console.log("\nDisagreements:");
    for (const d of disagreements) console.log(`- ${d}`);
  }
}

const tokens = sumUsage(usages);
const ledger = ledgerCostUsd(judge, tokens, pricing);
console.error(
  `ledger: $${ledger.total.toFixed(4)} ` +
    `(in=${tokens.input} out=${tokens.output} ` +
    `cache_creation=${tokens.cache_creation} cache_read=${tokens.cache_read})`,
);
if (metered.present) {
  try {
    const rel = assertMeteredMatchesLedger(metered.value, ledger.total);
    console.error(
      `metered $${metered.value.toFixed(4)} within ${(rel * 100).toFixed(1)}% of ledger`,
    );
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const code = rejudgeExitCode({ results, disagreements });
if (code !== 0) {
  const bad = results.filter(
    (v) => String(v).startsWith("ERR:") || String(v).startsWith("ODD:"),
  );
  if (bad.length) {
    console.error(
      `${bad.length} judge call(s) returned ERR or ODD; failing the run`,
    );
  }
}
process.exit(code);
