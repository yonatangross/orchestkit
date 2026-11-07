#!/usr/bin/env node
// skill-checklist: a deterministic fitness checklist for ork skills.
//
// The quality loop scores skills with fresh LLM graders (skill-fitness.js).
// Two fresh graders differ by 2 to 3 points per skill on identical files
// (round 2, 2026-11-07), so a round's gain hides in their noise. This script
// counts the defects a grader keeps finding, the same way every time:
//
//   missing_refs   a path cited outside code fences that resolves nowhere
//                  in what ships (skill dir, src/skills, src)       -2 each
//   no_not_for     the description has no ". Not for " boundary      -2
//   stale_cc_tags  a heading tagged "CC 2.1.N" with N below the
//                  CLAUDE.md floor, or an "older CC" fallback line   -1 each, max -3
//   count_clashes  one noun (dimensions, phases, sections) stated
//                  with two different numbers                       -2 each
//   over_cap       SKILL.md longer than 500 lines                    -2
//
// Score = 10 minus deductions, never below 0.
//
// Usage: node scripts/eval/skill-checklist.mjs [--json] <skill> [<skill> ...]

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const COUNT_NOUNS = ['dimensions', 'phases', 'sections'];
// A cited path, optionally followed by arguments inside the same backticks
// (`scripts/render-ascii.sh key-value`), or a Read("...") call.
const REF_RE = /`((?:\.\.\/)*[A-Za-z0-9_][\w.-]*\/[\w./-]*\.(?:md|sh|json|mjs|js|py|ya?ml))(?: [^`]*)?`|Read\("([^"]+)"\)/g;

export function readFloor(repoRoot) {
  const text = readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
  const m = /Claude Code\*\*: >= 2\.1\.(\d+)/.exec(text);
  if (!m) throw new Error('could not read the CC floor from CLAUDE.md');
  return Number(m[1]);
}

// Lines outside fenced code blocks, with their 1-based line numbers.
function proseLines(text) {
  const out = [];
  let fenced = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return; }
    if (!fenced) out.push({ n: i + 1, line });
  });
  return out;
}

// Resolve only against what the plugin ships (plugins/ork holds skills,
// shared, agents, hooks, workflows, all built from src/). A repo-root path
// such as scripts/render-ascii.sh exists for contributors but not for users.
// A src/... path is repo-relative to shipped content, so it resolves at the
// repo root. tests/ and .github/ paths cite the gate that guards a rule for
// contributors; they are context, not an instruction, and are not checked.
function resolves(ref, skillDir, repoRoot) {
  if (/^(tests|\.github)\//.test(ref)) return true;
  if (ref.startsWith('src/')) return existsSync(path.join(repoRoot, ref));
  const roots = [skillDir, path.join(repoRoot, 'src', 'skills'), path.join(repoRoot, 'src')];
  return roots.some((r) => existsSync(path.join(r, ref)));
}

export function checkSkill(skillDir, repoRoot, floor) {
  const file = path.join(skillDir, 'SKILL.md');
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const prose = proseLines(text);
  const findings = [];

  // missing_refs
  const seen = new Set();
  for (const { n, line } of prose) {
    for (const m of line.matchAll(REF_RE)) {
      const ref = m[1] || m[2];
      if (!ref || seen.has(ref)) continue;
      if (/[*<>{}$]/.test(ref) || ref.startsWith('.') && !ref.startsWith('..') || ref.startsWith('http')) continue;
      seen.add(ref);
      if (!resolves(ref, skillDir, repoRoot)) findings.push({ rule: 'missing_refs', line: n, detail: ref, cost: 2 });
    }
  }

  // no_not_for
  const desc = lines.find((l) => l.startsWith('description:')) || '';
  if (!/\. Not for /.test(desc)) findings.push({ rule: 'no_not_for', line: lines.indexOf(desc) + 1, detail: 'description has no ". Not for " boundary', cost: 2 });

  // stale_cc_tags
  let ccCost = 0;
  for (const { n, line } of prose) {
    const heading = /^#{1,6} .*\bCC 2\.1\.(\d+)/.exec(line);
    const older = /fallback for older CC|for older CC versions/i.test(line);
    if ((heading && Number(heading[1]) < floor) || older) {
      const cost = ccCost < 3 ? 1 : 0;
      ccCost += cost;
      findings.push({ rule: 'stale_cc_tags', line: n, detail: line.trim().slice(0, 80), cost });
    }
  }

  // count_clashes
  for (const noun of COUNT_NOUNS) {
    const re = new RegExp(`\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')}) ${noun}\\b`, 'gi');
    const values = new Map();
    for (const { n, line } of prose) {
      for (const m of line.matchAll(re)) {
        const v = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()];
        if (!values.has(v)) values.set(v, n);
      }
    }
    if (values.size > 1) {
      const detail = [...values].map(([v, n]) => `${v} at :${n}`).join(', ');
      findings.push({ rule: 'count_clashes', line: [...values.values()][1], detail: `${noun}: ${detail}`, cost: 2 });
    }
  }

  // over_cap
  if (lines.length > 500) findings.push({ rule: 'over_cap', line: lines.length, detail: `${lines.length} lines`, cost: 2 });

  const score = Math.max(0, 10 - findings.reduce((a, f) => a + f.cost, 0));
  return { skill: path.basename(skillDir), score, findings };
}

function main(argv) {
  const json = argv.includes('--json');
  const skills = argv.filter((a) => !a.startsWith('--'));
  if (!skills.length) {
    console.error('usage: skill-checklist.mjs [--json] <skill> [<skill> ...]');
    process.exit(2);
  }
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const floor = readFloor(repoRoot);
  const results = skills.map((s) => checkSkill(path.join(repoRoot, 'src', 'skills', s), repoRoot, floor));
  const mean = Math.round((results.reduce((a, r) => a + r.score, 0) / results.length) * 10) / 10;
  if (json) {
    console.log(JSON.stringify({ floor, mean, results }, null, 2));
    return;
  }
  for (const r of [...results].sort((a, b) => a.score - b.score)) {
    console.log(`${String(r.score).padStart(2)}  ${r.skill}`);
    for (const f of r.findings) console.log(`      -${f.cost} ${f.rule} :${f.line} ${f.detail}`);
  }
  console.log(`mean ${mean} of 10 over ${results.length} skills (CC floor 2.1.${floor})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2));
}
