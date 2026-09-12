#!/usr/bin/env node
// Re-judge stored agent outputs against the CURRENT llm graders, offline.
//
// Why: agent turns are 98% of an eval's spend. run.json already holds every
// agent output under graders[].evidence, so a rubric can be recalibrated for
// cents without re-running a single agent. The judge prompt mirrors the one in
// the Claude Code binary: one criterion, one word back, PASS or FAIL.
//
// Usage:
//   node scripts/rejudge-eval-outputs.mjs <run.json> [hand-verdicts.json] [--judge claude-opus-5] [-j 4]
//
// With a hand-verdicts file (written BEFORE running this), prints an agreement
// table. The gate for the re-pilot is 100% agreement, or every disagreement
// named and the claim reworded.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";

const args = process.argv.slice(2);
const runPath = args.find((a) => a.endsWith("run.json"));
const handPath = args.find((a) => /verdicts.*\.json$/.test(a));
const judge = args.includes("--judge") ? args[args.indexOf("--judge") + 1] : "claude-opus-5";
const conc = args.includes("-j") ? Number(args[args.indexOf("-j") + 1]) : 4;
if (!runPath) { console.error("need a run.json path"); process.exit(1); }

const run = JSON.parse(readFileSync(runPath, "utf8"));
const hand = handPath ? JSON.parse(readFileSync(handPath, "utf8")) : null;
const JUDGE_PREAMBLE = "You are grading the output of a coding agent against a criterion.\nRespond with exactly one word: PASS or FAIL.";

function llmGraders(caseName) {
  const dir = join("evals", caseName, "graders");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
    const t = readFileSync(join(dir, f), "utf8");
    const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
    if (!fm || !/^type:\s*llm/m.test(fm[1])) return null;
    return { name: f.replace(/\.md$/, ""), criterion: fm[2].trim() };
  }).filter(Boolean);
}
function evidenceOf(c, arm) {
  for (const r of c.arms[arm] ?? []) for (const g of r.graders ?? []) if (g.evidence) return g.evidence;
  return null;
}
function ask(prompt) {
  return new Promise((res) => {
    execFile("claude", ["-p", "--model", judge, "--max-turns", "1", prompt], { maxBuffer: 1 << 20, timeout: 120000 }, (err, stdout, stderr) => {
      const word = (stdout || "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";
      res(err ? `ERR:${(stderr || err.message).split("\n")[0].slice(0, 60)}` : (word === "PASS" || word === "FAIL" ? word : `ODD:${(stdout || "").trim().slice(0, 40)}`));
    });
  });
}

const jobs = [];
for (const c of run.cases) for (const arm of ["with", "without"]) {
  const ev = evidenceOf(c, arm); if (!ev) continue;
  for (const g of llmGraders(c.name)) jobs.push({ case: c.name, arm, grader: g.name, prompt: `${JUDGE_PREAMBLE}\n\nCriterion:\n${g.criterion}\n\nOutput to grade:\n${ev}` });
}
console.error(`${jobs.length} judge calls on ${judge}, concurrency ${conc}`);
const results = new Array(jobs.length);
let next = 0;
await Promise.all(Array.from({ length: conc }, async () => { while (next < jobs.length) { const i = next++; results[i] = await ask(jobs[i].prompt); } }));

let agree = 0, total = 0; const disagreements = [];
console.log("| Case | Arm | Claim | Judge | Hand | |"); console.log("|---|---|---|---|---|---|");
jobs.forEach((j, i) => {
  const h = hand?.[j.case]?.[j.arm]?.[j.grader] ?? "";
  let mark = "";
  if (h) { total++; if (h === results[i]) { agree++; mark = "ok"; } else { mark = "DISAGREE"; disagreements.push(`${j.case} ${j.arm} ${j.grader}: judge ${results[i]}, hand ${h}`); } }
  console.log(`| \`${j.case}\` | ${j.arm} | ${j.grader} | ${results[i]} | ${h || "n/a"} | ${mark} |`);
});
if (hand) {
  console.log(`\n**Agreement: ${agree}/${total}** (${total ? Math.round(100 * agree / total) : 0}%).`);
  if (disagreements.length) { console.log("\nDisagreements:"); for (const d of disagreements) console.log(`- ${d}`); }
}
process.exit(disagreements.length ? 1 : 0);
