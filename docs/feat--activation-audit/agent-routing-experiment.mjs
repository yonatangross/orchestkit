import { execSync } from 'node:child_process';
import fs from 'node:fs';
const repo = '/Users/yonatangross/coding/yonatangross/orchestkit';
const ORIG_COMMIT = 'd8acb7dba'; // commit BEFORE the WIP description rewrite (original terse descriptions)
const NUM = parseInt(process.argv[2] || '3', 10);

const agents = fs.readdirSync(`${repo}/src/agents`).filter(f => f.endsWith('.md') && !/^(README|INDEX|CONTRIBUTING)\.md$/i.test(f)).map(f => f.replace(/\.md$/, '')).sort();

function descFrom(text) { const m = text.match(/^description:\s*(.*)$/m); return m ? m[1].trim().replace(/^"|"$/g, '') : ''; }
const rewritten = {}, original = {};
for (const a of agents) {
  rewritten[a] = descFrom(fs.readFileSync(`${repo}/src/agents/${a}.md`, 'utf8'));
  try { original[a] = descFrom(execSync(`git -C ${repo} show ${ORIG_COMMIT}:src/agents/${a}.md`, { encoding: 'utf8' })); } catch { original[a] = rewritten[a]; }
}

// test set: task -> correct agent (D=dormant target, F=already-fires)
// HARD set: indirect / lay phrasing with NO agent keywords (discriminating test)
const TESTS = [
  { t: 'Our pages feel sluggish on mobile and the app download is huge.', a: 'frontend-performance-engineer', d: 'D' },
  { t: 'We keep getting paged at 3am and have no idea what is actually breaking.', a: 'monitoring-engineer', d: 'D' },
  { t: "Two developers' branches got tangled and someone's commits seem to have vanished.", a: 'git-operations-engineer', d: 'D' },
  { t: 'Our AI assistant sometimes does things it should not when users paste strange text.', a: 'ai-safety-auditor', d: 'D' },
  { t: 'We want consistent buttons, colors, and spacing across five different product teams.', a: 'design-system-architect', d: 'D' },
  { t: 'We need to turn our help-center articles into something an AI can search semantically.', a: 'data-pipeline-engineer', d: 'D' },
  { t: 'Something in our checkout flow might be leaking customer data.', a: 'security-auditor', d: 'F' },
  { t: 'Our test suite barely covers anything and keeps breaking on unrelated changes.', a: 'test-generator', d: 'F' },
].slice(0, NUM);

function catalog(descs) { return agents.map(a => `${a}: ${descs[a]}`).join('\n'); }
const sleep = (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
function callOnce(prompt) {
  try { return JSON.parse(execSync(`claude -p --output-format json --max-turns 1`, { input: prompt, encoding: 'utf8', maxBuffer: 1024 * 1024, cwd: '/tmp', env: { ...process.env, CLAUDECODE: '' } })); }
  catch (e) { try { return JSON.parse(e.stdout || ''); } catch { return { is_error: true, result: String(e.message || '').slice(0, 120) }; } }
}
function ask(descs, task) {
  const prompt = `You are an agent router. From this catalog of specialist agents (name: description), pick the SINGLE best-matching agent for the task. If none clearly fits, answer general-purpose.\n\nCATALOG:\n${catalog(descs)}\n\nTASK: ${task}\n\nRespond with ONLY JSON: {"agent":"<name>","confidence":0.0-1.0}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const j = callOnce(prompt);
    if (j && !j.is_error) {
      if (process.env.SHOW_COST) console.error(`  [cost $${(j.total_cost_usd || 0).toFixed(3)}]`);
      const m = (j.result || '').match(/"agent"\s*:\s*"?(?:ork:)?([a-z0-9_-]+)/i);
      if (m) return m[1];
    }
    if (attempt < 5) sleep([0, 8000, 20000, 40000, 60000][attempt]);
  }
  return '(error)';
}

const rows = [];
let aHit = 0, bHit = 0, aHitD = 0, bHitD = 0, dN = 0;
for (const test of TESTS) {
  const pa = ask(original, test.t);
  const pb = ask(rewritten, test.t);
  const aok = pa === test.a, bok = pb === test.a;
  if (aok) aHit++; if (bok) bHit++;
  if (test.d === 'D') { dN++; if (aok) aHitD++; if (bok) bHitD++; }
  rows.push({ d: test.d, expected: test.a, A: pa, B: pb, aok, bok });
  console.log(`[${test.d}] expect=${test.a.padEnd(28)} A(orig)=${(pa + (aok ? ' OK' : '')).padEnd(34)} B(rewrite)=${pb}${bok ? ' OK' : ''}`);
}
console.log(`\n=== RESULTS (n=${TESTS.length}) ===`);
console.log(`A (original terse):   ${aHit}/${TESTS.length} correct  (dormant: ${aHitD}/${dN})`);
console.log(`B (use-proactively):  ${bHit}/${TESTS.length} correct  (dormant: ${bHitD}/${dN})`);
console.log(`delta: ${bHit - aHit} overall, ${bHitD - aHitD} on dormant agents`);
