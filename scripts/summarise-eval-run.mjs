#!/usr/bin/env node
// Turn the newest evals/results/<ts>/run.json into a markdown delta table.
//
// Field names below were read off a real run.json from this repo, not from a
// schema doc: cases[].aggregates carries score / scoreWithout / delta, and the
// suite carries meanDelta. Each arm run carries costUsd and judgeCostUsd
// separately, so judge spend is reported on its own line.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RESULTS = process.argv[2] ?? "evals/results";
if (!existsSync(RESULTS)) { console.error(`no results at ${RESULTS}/`); process.exit(1); }

const runs = readdirSync(RESULTS).filter((d) => existsSync(join(RESULTS, d, "run.json"))).sort();
if (runs.length === 0) { console.error(`no run.json under ${RESULTS}/`); process.exit(1); }
const path = join(RESULTS, runs.at(-1), "run.json");
const d = JSON.parse(readFileSync(path, "utf8"));

const pct = (n) => (n === null || n === undefined ? "n/a" : `${Math.round(n * 100)}%`);
const signed = (n) => (n > 0 ? `+${Math.round(n * 100)}` : `${Math.round(n * 100)}`);

// Cases never carry their tags in the report, so recover the skill from the
// case directory name rather than inventing a grouping.
const skillOf = (name) => (/^1/.test(name) ? "commit" : /^2/.test(name) ? "prd-to-goal" : /^3/.test(name) ? "glyph" : "other");

let agentCost = 0, judgeCost = 0, errored = 0;
for (const c of d.cases) for (const arm of Object.values(c.arms)) for (const r of arm) {
  agentCost += r.costUsd ?? 0; judgeCost += r.judgeCostUsd ?? 0; if (r.error) errored++;
}

const lines = [];
lines.push(`## Plugin eval: ${d.suite.ablation} ablation`);
lines.push("");
lines.push(`Claude Code ${d.claudeVersion} · ${d.cases.length} cases · ${d.durationSeconds}s · $${(d.costUsd ?? 0).toFixed(2)}`);
if (d.partial) lines.push(`\n**PARTIAL RUN.** ${d.partialReason ?? "the run did not finish"}. Treat every number below as incomplete.`);
if (errored > 0) lines.push(`\n**${errored} run(s) failed to start or errored.** A failed run scores 0, which is not the same as a bad answer. Check the traces before reading the deltas.`);
lines.push("");
lines.push("| Skill | Case | With | Without | Delta |");
lines.push("|---|---|---|---|---|");

for (const c of [...d.cases].sort((a, b) => a.name.localeCompare(b.name))) {
  const a = c.aggregates ?? {};
  lines.push(`| ${skillOf(c.name)} | \`${c.name}\` | ${pct(a.score)} | ${pct(a.scoreWithout)} | ${signed(a.delta ?? 0)} |`);
}

lines.push("");
lines.push(`**Mean delta ${signed(d.aggregates.meanDelta ?? 0)} points.** Overall score ${pct(d.aggregates.overallScore)}, ${d.aggregates.casesPassed}/${d.aggregates.casesTotal} cases at or above threshold ${d.suite.threshold}.`);
lines.push("");
lines.push(`Agent spend $${agentCost.toFixed(2)}, judge spend $${judgeCost.toFixed(2)}.`);

const regressions = d.cases.filter((c) => (c.aggregates?.delta ?? 0) < 0);
if (regressions.length > 0) {
  lines.push("");
  lines.push(`### The plugin scored LOWER on ${regressions.length} case(s)`);
  for (const c of regressions) lines.push(`- \`${c.name}\`: ${signed(c.aggregates.delta)} points. The plugin made this answer worse, not better.`);
} else {
  lines.push("");
  lines.push("No case scored lower with the plugin than without it.");
}

console.log(lines.join("\n"));
