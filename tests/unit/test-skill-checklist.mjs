#!/usr/bin/env node
// ============================================================================
// skill-checklist + skill-fitness scorer: offline guards (no LLM)
// ============================================================================
// WHAT THIS GUARDS
//
//   1. scripts/eval/skill-checklist.mjs counts each rule on a synthetic skill:
//      a missing ref, a ref with arguments, a repo-root-only script (not
//      shipped), a tests/ citation (skipped), a fenced example (skipped), no
//      "Not for", a CC heading below the floor, a count stated two ways, and
//      the 500-line cap. A clean skill scores 10.
//   2. src/skills/bare-eval/workflows/skill-fitness.js: the scorer prompt
//      reads the CC floor from CLAUDE.md and names no fixed floor or model
//      (it once said "floor 2.1.220, current model Opus 4.8", quality loop
//      round 2). The workflow runs with a stubbed agent() and still ranks
//      weakest first.
//   3. Each of the loop's 10 skills scores at or above its floor in
//      tests/unit/skill-checklist-floor.json (floors only move up).
// ============================================================================

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSkill, readFloor } from '../../scripts/eval/skill-checklist.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

// ---- 1. checklist rules on a synthetic repo ----------------------------------
const root = mkdtempSync(path.join(tmpdir(), 'skill-checklist-'));
try {
  mkdirSync(path.join(root, 'src', 'skills', 'good', 'references'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'skills', 'bad'), { recursive: true });
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'skills', 'good', 'references', 'a.md'), 'x');
  writeFileSync(path.join(root, 'scripts', 'only-in-repo.sh'), 'x');

  writeFileSync(path.join(root, 'src', 'skills', 'good', 'SKILL.md'), [
    '---',
    'name: good',
    'description: "Does a thing. Use when X. Not for Y (use other)."',
    '---',
    '## Steps',
    'Read `references/a.md` and `../good/references/a.md`. Guarded by `tests/x/test-y.sh`.',
    'It has 7 dimensions, and the table lists seven dimensions.',
    '```bash',
    'cat `.expect/flows/login.yaml` `missing/in-fence.md`',
    '```',
  ].join('\n'));

  writeFileSync(path.join(root, 'src', 'skills', 'bad', 'SKILL.md'), [
    '---',
    'name: bad',
    'description: "Does a thing. Use when X."',
    '---',
    '## Effort (CC 2.1.16)',
    'Run `scripts/missing.sh key-value` and `scripts/only-in-repo.sh`.',
    'Load Read("references/gone.md"). It scores six dimensions; later, 7 dimensions.',
    '```bash',
    'bash "$SKILL_DIR/scripts/x.sh"',
    '```',
    ...Array.from({ length: 500 }, () => 'filler'),
  ].join('\n'));

  const good = checkSkill(path.join(root, 'src', 'skills', 'good'), root, 277);
  expect(good.score === 10, `clean skill scores 10, got ${good.score}: ${JSON.stringify(good.findings)}`);

  const bad = checkSkill(path.join(root, 'src', 'skills', 'bad'), root, 277);
  const rules = bad.findings.map((f) => `${f.rule}:${f.detail.split(' ')[0]}`);
  for (const want of ['missing_refs:scripts/missing.sh', 'missing_refs:scripts/only-in-repo.sh', 'missing_refs:references/gone.md', 'no_not_for:description', 'stale_cc_tags:##', 'count_clashes:dimensions:', 'over_cap:510', 'unset_skill_dir:bash']) {
    expect(rules.includes(want), `bad skill should report ${want}; got ${rules.join(', ')}`);
  }
  expect(bad.score === 0, `bad skill floors at 0, got ${bad.score}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}

// ---- 2. skill-fitness scorer prompt ------------------------------------------
const SCRIPT = path.join(REPO, 'src', 'skills', 'bare-eval', 'workflows', 'skill-fitness.js');
const source = readFileSync(SCRIPT, 'utf8').replace(/^export const meta/m, 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const prompts = [];
const scores = { alpha: [9, 9, 9], beta: [3, 4, 5] };
const run = new AsyncFunction('args', 'agent', 'pipeline', 'phase', 'log', source);
const result = await run(
  ['alpha', 'beta'],
  async (prompt, opts) => {
    prompts.push(prompt);
    const s = opts.label.split(':')[1];
    const [freshness, clarity, structure] = scores[s];
    return { skill: s, freshness, clarity, structure, top_issue: 'none' };
  },
  async (items, fn) => Promise.all(items.map(fn)),
  () => {},
  () => {},
);

expect(prompts.length === 2, `one scorer per skill, got ${prompts.length}`);
for (const p of prompts) {
  expect(/CLAUDE\.md/.test(p), 'scorer prompt must read the CC floor from CLAUDE.md');
  expect(!/floor 2\.1\.\d+/.test(p), 'scorer prompt must not hardcode a CC floor');
  expect(!/Opus 4\.\d/.test(p), 'scorer prompt must not name an Opus 4.x model');
}
expect(result.all[0].skill === 'beta' && result.all[1].skill === 'alpha', `weakest first, got ${result.all.map((r) => r.skill)}`);
expect(result.mean_total === 19.5, `mean of 27 and 12 is 19.5, got ${result.mean_total}`);

// ---- 3. real skills hold their checklist floors -------------------------------
const floorFile = JSON.parse(readFileSync(path.join(REPO, 'tests', 'unit', 'skill-checklist-floor.json'), 'utf8'));
const ccFloor = readFloor(REPO);
for (const [skill, min] of Object.entries(floorFile.floors)) {
  const r = checkSkill(path.join(REPO, 'src', 'skills', skill), REPO, ccFloor);
  expect(r.score >= min, `${skill}: checklist ${r.score} is below its floor ${min}: ${r.findings.map((f) => `${f.rule} :${f.line} ${f.detail}`).join('; ')}`);
}

for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length) process.exit(1);
console.log('PASS: skill-checklist rules and skill-fitness scorer prompt');
