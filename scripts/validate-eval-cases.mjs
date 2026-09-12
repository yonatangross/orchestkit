#!/usr/bin/env node
// Deterministic, offline validation of the evals/ suite.
//
// Makes ZERO LLM calls, so it is safe on a pull_request trigger. The scored
// run (scripts/run-plugin-eval.sh) makes real calls and is workflow_dispatch
// only, per the repo policy that real LLM calls never run automatically in CI.
//
// Checks the floor invariants from the eval command's own authoring guide:
//   - every case has prompt.md with runs >= 3
//   - every case has >= 1 outcome grader (tool_used alone does not count,
//     because a tool_used: Skill grader is excluded from the score)
//   - the suite has >= 1 should-NOT-fire case (a tool_used with min: 0, max: 0)
//   - a should-NOT-fire grader sets arm: both, else it is display-only and
//     silently stops guarding anything
//   - grader type is one of the six the runner accepts
//   - no absolute path or ~/ in a prompt or grader (cases run in a sandbox cwd)
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? "evals";
const GRADER_TYPES = ["regex", "tool_order", "tool_used", "file_exists", "llm", "baseline"];
const errors = [];
const warns = [];

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

function checkNoAbsolutePaths(label, body) {
  for (const [re, what] of [[/(^|\s)\/(Users|home|tmp|private|var)\//, "an absolute path"], [/(^|\s)~\//, "a ~/ path"]]) {
    if (re.test(body)) errors.push(`${label}: contains ${what}; cases run in a sandbox cwd`);
  }
}

if (!existsSync(ROOT)) {
  console.error(`no eval suite at ${ROOT}/`);
  process.exit(1);
}

const caseDirs = readdirSync(ROOT)
  .filter((n) => n !== "results" && n !== "mocks")
  .filter((n) => statSync(join(ROOT, n)).isDirectory())
  .sort();

if (caseDirs.length === 0) errors.push(`${ROOT}/ has no case directories`);

let negativeCases = 0;

for (const name of caseDirs) {
  const dir = join(ROOT, name);
  const promptPath = join(dir, "prompt.md");
  const casePath = join(dir, "case.yaml");

  if (!existsSync(promptPath) && !existsSync(casePath)) {
    errors.push(`${name}: has neither prompt.md nor case.yaml`);
    continue;
  }
  if (existsSync(promptPath)) {
    const text = readFileSync(promptPath, "utf8");
    const fm = frontmatter(text);
    if (!fm) errors.push(`${name}/prompt.md: missing YAML frontmatter`);
    else {
      const runs = Number(fm.runs ?? 3);
      if (!Number.isInteger(runs) || runs < 3) errors.push(`${name}/prompt.md: runs is ${fm.runs}; the floor is 3, single runs are noise`);
      if (!fm.timeout_seconds) warns.push(`${name}/prompt.md: no timeout_seconds; an under-set budget reads as a 0 score`);
      if (!fm.allowed_tools) warns.push(`${name}/prompt.md: no allowed_tools; only the read-only set is available`);
      if (!fm.tags) warns.push(`${name}/prompt.md: no tags; --tag cannot scope a run to this case's skill`);
    }
    checkNoAbsolutePaths(`${name}/prompt.md`, text);
  }

  const gdir = join(dir, "graders");
  if (!existsSync(gdir)) { errors.push(`${name}: no graders/ directory`); continue; }
  const graders = readdirSync(gdir).filter((f) => f.endsWith(".md")).sort();
  if (graders.length === 0) { errors.push(`${name}: graders/ is empty`); continue; }

  let outcomeGraders = 0;
  for (const g of graders) {
    const text = readFileSync(join(gdir, g), "utf8");
    const fm = frontmatter(text);
    const label = `${name}/graders/${g}`;
    if (!fm) { errors.push(`${label}: missing YAML frontmatter`); continue; }
    if (!fm.type) { errors.push(`${label}: no type:`); continue; }
    if (!GRADER_TYPES.includes(fm.type)) { errors.push(`${label}: type "${fm.type}" is not one of ${GRADER_TYPES.join(", ")}`); continue; }
    checkNoAbsolutePaths(label, text);

    if (fm.type === "tool_used") {
      const min = fm.min === undefined ? 1 : Number(fm.min);
      const max = fm.max === undefined ? undefined : Number(fm.max);
      if (min === 0 && max === 0) {
        negativeCases++;
        if (fm.arm !== "both") errors.push(`${label}: a must-not-fire grader needs arm: both, otherwise it is display-only under ablation and guards nothing`);
      }
    } else {
      outcomeGraders++;
      if (fm.type === "llm" && text.replace(/^---[\s\S]*?---/, "").trim().length < 40) {
        errors.push(`${label}: llm rubric body is too short to be a checkable claim`);
      }
    }
  }
  if (outcomeGraders === 0) {
    errors.push(`${name}: has no outcome grader. A tool_used: Skill grader is excluded from the score in both arms, so a case graded only on it can never move the delta`);
  }
}

if (negativeCases === 0) {
  errors.push(`the suite has no should-NOT-fire case. Without one it cannot catch over-triggering, which is the commoner real failure`);
}

for (const w of warns) console.log(`warn  ${w}`);
for (const e of errors) console.error(`FAIL  ${e}`);
console.log(`\n${caseDirs.length} case(s), ${negativeCases} should-not-fire grader(s), ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length === 0 ? 0 : 1);
