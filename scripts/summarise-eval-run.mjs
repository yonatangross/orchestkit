#!/usr/bin/env node
// Turn the newest evals/results/<ts>/run.json into a markdown delta table and
// act as the CI gate (exit 1 on a defensible regression, never on noise).
//
// Field names were read off a real run.json from this repo, not a schema doc:
// cases[].aggregates carries score / scoreWithout / delta (delta may be
// absent when an arm never ran), the suite carries meanDelta, and each arm run
// carries costUsd, judgeCostUsd, turns, skippedPaidGraders.
//
// Gating rules, and why:
//   - Refuse to gate a partial run. A cost-ceiling run is not a measurement.
//   - Headline meanDelta is over FIRE cases only. A should-not-fire case
//     carries a tool_used min:0 max:0 grader that is a free pass in both arms,
//     so its delta is one llm grader and it inflates the mean.
//   - A positive delta on a negative is a WARNING, not a win: it means the
//     plugin changed an answer it should have left alone (style contamination).
//   - Per-case floor is -0.34, not -0.2. One judge flip on a weight-1 grader in
//     a 1.5-weight case across 3 runs moves the mean by 0.22, inside noise.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RESULTS = process.argv[2] ?? "evals/results";
const CASE_FLOOR = -0.34;
if (!existsSync(RESULTS)) { console.error(`no results at ${RESULTS}/`); process.exit(1); }

const runs = readdirSync(RESULTS).filter((d) => existsSync(join(RESULTS, d, "run.json"))).sort();
if (runs.length === 0) { console.error(`no run.json under ${RESULTS}/`); process.exit(1); }
const dir = join(RESULTS, runs.at(-1));
const d = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const models = existsSync(join(dir, "models.txt")) ? readFileSync(join(dir, "models.txt"), "utf8").trim().replace(/\n/g, " · ") : "models not recorded";

const pct = (n) => (n === null || n === undefined ? "n/a" : `${Math.round(n * 100)}%`);
const signed = (n) => (n === null || n === undefined ? "n/a" : (n > 0 ? "+" : "") + `${Math.round(n * 100)}`);
const usd = (n) => `$${(n ?? 0).toFixed(2)}`;
// Cases never carry their tags in the report; recover skill and kind from the
// directory name rather than inventing a grouping.
const skillOf = (n) => (/^1/.test(n) ? "commit" : /^2/.test(n) ? "prd-to-goal" : /^3/.test(n) ? "glyph" : "other");
const isNegative = (n) => /should-not-fire/.test(n);

let agentCost = 0, judgeCost = 0, errored = 0;
const skipped = new Set();
const armStats = (arm) => {
  const rs = arm ?? [];
  return { cost: rs.reduce((a, r) => a + (r.costUsd ?? 0), 0), turns: rs.length ? (rs.reduce((a, r) => a + (r.turns ?? 0), 0) / rs.length).toFixed(1) : "n/a" };
};
for (const c of d.cases) for (const arm of Object.values(c.arms)) for (const r of arm) {
  agentCost += r.costUsd ?? 0; judgeCost += r.judgeCostUsd ?? 0; if (r.error) errored++;
  if (r.skippedPaidGraders) skipped.add(c.name);
}

const L = [];
L.push(`## Plugin eval: ${d.suite.ablation} ablation`);
L.push("");
L.push(`Claude Code ${d.claudeVersion} · ${d.cases.length} cases · ${d.durationSeconds}s · ${usd(d.costUsd)} · ${models}`);
if (d.partial) L.push(`\n**PARTIAL RUN.** ${d.partialReason ?? "the run did not finish"}. Not gated; every number below is incomplete.`);
if (errored > 0) L.push(`\n**${errored} run(s) failed to start or errored.** A failed run scores 0, which is not the same as a bad answer.`);
if (skipped.size > 0) L.push(`\n**${skipped.size} case(s) had paid graders SKIPPED at the cost ceiling**, recorded as fails: ${[...skipped].map((n) => `\`${n}\``).join(", ")}. Budget artefact, not a measurement.`);
L.push("");
L.push("| Skill | Case | Kind | With | Without | Delta | Cost with | Cost w/o | Turns with | Turns w/o |");
L.push("|---|---|---|---|---|---|---|---|---|---|");

const fire = [], neg = [];
for (const c of [...d.cases].sort((a, b) => a.name.localeCompare(b.name))) {
  const a = c.aggregates ?? {};
  const w = armStats(c.arms.with), wo = armStats(c.arms.without);
  const kind = isNegative(c.name) ? "negative" : "fire";
  (kind === "fire" ? fire : neg).push(c);
  L.push(`| ${skillOf(c.name)} | \`${c.name}\` | ${kind} | ${pct(a.score)} | ${pct(a.scoreWithout)} | ${signed(a.delta)} | ${usd(w.cost)} | ${usd(wo.cost)} | ${w.turns} | ${wo.turns} |`);
}

const deltas = (cs) => cs.map((c) => c.aggregates?.delta).filter((x) => typeof x === "number");
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fireMean = mean(deltas(fire)), negMean = mean(deltas(neg));

L.push("");
L.push(`**Fire-case mean delta ${signed(fireMean)} points** over ${deltas(fire).length} measured fire case(s). Negatives are reported separately and expected at 0: mean ${signed(negMean)} over ${deltas(neg).length}. The tool's own all-case meanDelta is ${signed(d.aggregates.meanDelta)}.`);
L.push("");
L.push(`Agent spend ${usd(agentCost)}, judge spend ${usd(judgeCost)}.`);

const regressions = fire.filter((c) => typeof c.aggregates?.delta === "number" && c.aggregates.delta < CASE_FLOOR);
const contaminated = neg.filter((c) => typeof c.aggregates?.delta === "number" && c.aggregates.delta !== 0);
const failingClaims = [];
for (const c of d.cases) for (const [arm, rs] of Object.entries(c.arms)) for (const r of rs) for (const g of r.graders ?? []) {
  if (g.scored !== false && g.passed === false && !r.error) failingClaims.push(`\`${c.name}\` ${arm}: ${g.name}`);
}

if (regressions.length) {
  L.push(""); L.push(`### The plugin scored LOWER on ${regressions.length} fire case(s), beyond the noise floor`);
  for (const c of regressions) L.push(`- \`${c.name}\`: ${signed(c.aggregates.delta)} points.`);
}
if (contaminated.length) {
  L.push(""); L.push(`### Warning: ${contaminated.length} should-not-fire case(s) moved with the plugin`);
  L.push("A non-zero delta on a negative means the plugin changed an answer it should have left alone. Read the with-arm output before calling it a win.");
  for (const c of contaminated) L.push(`- \`${c.name}\`: ${signed(c.aggregates.delta)} points.`);
}
if (failingClaims.length) {
  L.push(""); L.push(`### Failing graders (${failingClaims.length})`);
  for (const f of failingClaims) L.push(`- ${f}`);
}

let exit = 0;
if (!d.partial) {
  if (regressions.length) exit = 1;
  if (fireMean !== null && fireMean < 0) exit = 1;
}
L.push("");
L.push(exit === 0 ? (d.partial ? "Gate: not applied (partial run)." : "Gate: pass.") : "Gate: FAIL (fire-case regression beyond the noise floor, or negative fire-case mean).");
console.log(L.join("\n"));
process.exit(exit);
