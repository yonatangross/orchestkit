#!/usr/bin/env node
// ============================================================================
// Stage 1 moves: ork:skill-fitness and ork:audit-full-mapreduce still launch
// ============================================================================
// WHAT THIS GUARDS
//
//   audit-full and bare-eval moved to the opt-in ork-extras plugin (trim stage 1).
//   Their workflow scripts stay registered in core ork (manifests/ork.json), so
//   the by-name launches ork:skill-fitness and ork:audit-full-mapreduce must keep
//   working with the skill directories gone from core. Every case below reads the
//   files and runs the BUILT script from plugins/ork/workflows with a stubbed
//   agent():
//
//   1. Registration: both scripts are in manifests/ork.json workflows, the core
//      plugin ships them in workflows/, and core plugin.json points at that dir.
//   2. The move: the seven skills are absent from plugins/ork/skills and present
//      in plugins/ork-extras/skills, and the skill dirs the workflows came from
//      are the ones that moved.
//   3. Launch: each built script runs to a result with a stub agent, under the
//      name its meta declares, with no read of a path inside the moved skill dir.
//   4. Control: a script copy that throws on start fails case 3 (the harness can fail).
// ============================================================================

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(path.join(REPO, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const MOVED = ['audit-activation', 'audit-full', 'bare-eval', 'careful', 'freeze', 'prompt-focus', 'swarm-migrate'];
const WORKFLOWS = [
  { name: 'skill-fitness', file: 'skill-fitness.js', from: 'src/skills/bare-eval/workflows/skill-fitness.js' },
  { name: 'audit-full-mapreduce', file: 'audit-full-mapreduce.js', from: 'src/skills/audit-full/workflows/audit-full-mapreduce.js' },
];

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const compile = (src) => new AsyncFunction('args', 'agent', 'phase', 'log', 'pipeline', 'parallel', src.replace(/^export const meta/m, 'const meta'));
const parallel = async (thunks) => Promise.all(thunks.map((t) => (typeof t === 'function' ? t() : t)));

async function pipeline(items, ...stages) {
  return Promise.all(
    items.map(async (item, i) => {
      let v = item;
      try {
        for (let s = 0; s < stages.length; s++) v = await (s === 0 ? stages[s](item, item, i) : stages[s](v, item, i));
        return v;
      } catch {
        return null;
      }
    }),
  );
}

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(e && e.message).split('\n').join('\n       ')}`);
  }
}

console.log('extras-moved-workflows');

await test('both workflows are registered in the core manifest and the core plugin ships them', async () => {
  const wf = json('manifests/ork.json').workflows;
  for (const w of WORKFLOWS) {
    assert.ok(wf.includes(w.from.replace(/^src\//, '')), `${w.name}: not in manifests/ork.json workflows`);
    assert.ok(existsSync(path.join(REPO, 'plugins/ork/workflows', w.file)), `${w.name}: plugins/ork/workflows/${w.file} missing`);
  }
  const pluginJson = json('plugins/ork/.claude-plugin/plugin.json');
  assert.equal(pluginJson.workflows, './workflows/', 'core plugin.json must point at ./workflows/');
});

await test('the seven skills left core and sit in ork-extras, and ork-extras does not carry the workflows', async () => {
  const skillsExclude = json('manifests/ork.json').skillsExclude;
  const extras = json('manifests/ork-extras.json');
  for (const m of MOVED) {
    assert.ok(skillsExclude.includes(m), `${m}: not excluded from core`);
    assert.ok(extras.skills.includes(m), `${m}: not in the ork-extras manifest`);
    assert.ok(!existsSync(path.join(REPO, 'plugins/ork/skills', m)), `${m}: still built into core`);
    assert.ok(existsSync(path.join(REPO, 'plugins/ork-extras/skills', m, 'SKILL.md')), `${m}: not built into ork-extras`);
    assert.ok(existsSync(path.join(REPO, 'src/skills', m, 'SKILL.md')), `${m}: source file deleted`);
  }
  assert.ok(!extras.workflows, 'ork-extras must not register a second copy of the workflows');
});

await test('built scripts declare the names the by-name launch uses', async () => {
  for (const w of WORKFLOWS) {
    const built = read(`plugins/ork/workflows/${w.file}`);
    assert.match(built, new RegExp(`name:\\s*["']${w.name}["']`), `${w.file}: meta.name is not ${w.name}`);
    assert.equal(built.replace(/\r/g, ''), read(w.from).replace(/\r/g, ''), `${w.file}: built copy differs from source (run npm run build)`);
  }
});

async function launch(file, args, mutate = (s) => s) {
  const src = mutate(read(`plugins/ork/workflows/${file}`));
  const prompts = [];
  const agent = async (prompt, opts) => {
    prompts.push(String(prompt));
    // A permissive stub: every schema field a script might read is present.
    return {
      status: 'DONE', skill: 'x', freshness: 8, clarity: 8, structure: 8, top_issue: 'none',
      findings: [], summary: 'stub', exists: false, severity: 'none', citation: '', command: '', reason: 'stub',
    };
  };
  const result = await compile(src)(args, agent, () => {}, () => {}, pipeline, parallel);
  return { result, prompts };
}

await test('ork:skill-fitness runs from the core plugin copy and reads skill text from the source tree, not the moved dir', async () => {
  const { result, prompts } = await launch('skill-fitness.js', ['assess', 'bare-eval']);
  assert.equal(result.scored_count, 2);
  assert.ok(prompts.every((p) => /Read src\/skills\/[a-z-]+\/SKILL\.md \(repo-relative/.test(p)));
  assert.ok(prompts.some((p) => p.includes('src/skills/bare-eval/SKILL.md')), 'a moved skill is still scored from src/skills');
});

await test('ork:audit-full-mapreduce runs from the core plugin copy to a result', async () => {
  const { result } = await launch('audit-full-mapreduce.js', { shards: ['apps/api', 'apps/web'], mode: 'full', effort: 'high' });
  assert.ok(result && typeof result === 'object', 'no result object');
});

await test('audit-full runs from ork-extras: its two core files are byte copies inside the skill and SKILL.md and its refutation binding read nothing from core', async () => {
  const pairs = [
    ['src/shared/rules/adversarial-refutation.md', 'src/skills/audit-full/references/adversarial-refutation-engine.md'],
    ['src/skills/chain-patterns/rules/push-notification-on-completion.md', 'src/skills/audit-full/references/push-notification-on-completion.md'],
  ];
  for (const [core, copy] of pairs) assert.equal(read(copy), read(core), `${copy} drifted from ${core}`);
  const text = ['SKILL.md', 'references/adversarial-refutation.md'].map((f) => read(`src/skills/audit-full/${f}`)).join('\n');
  assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT\}\/(shared|skills\/chain-patterns)\//, 'audit-full still reads a core-only path');
});

await test('audit-activation run from ork-extras finds the core agents catalog instead of failing on a missing agents/', async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'aa-'));
  mkdirSync(path.join(tmp, '.claude', 'logs'), { recursive: true });
  writeFileSync(path.join(tmp, '.claude', 'logs', 'subagent-spawns.jsonl'), '');
  const script = path.join(REPO, 'plugins/ork-extras/skills/audit-activation/scripts/collect-activation-audit.mjs');
  assert.ok(!existsSync(path.join(REPO, 'plugins/ork-extras/agents')), 'ork-extras must still ship no agents');
  const out = execFileSync('node', [script, '--json', '--telemetry-root', tmp], { encoding: 'utf8' });
  assert.ok(JSON.parse(out), 'no JSON from the collector');
  assert.throws(() => execFileSync('node', [script, '--json', '--catalog-root', path.join(tmp, 'nope'), '--telemetry-root', tmp], { encoding: 'utf8', stdio: 'pipe' }), /catalog unreadable|Command failed/, 'control: a bad --catalog-root must fail');
});

await test('control: a script that throws on start fails the launch case', async () => {
  await assert.rejects(launch('skill-fitness.js', ['assess'], (s) => `throw new Error('planted');\n${s}`), /planted/);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
