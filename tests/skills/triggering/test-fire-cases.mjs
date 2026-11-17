#!/usr/bin/env node
// ============================================================================
// Natural-trigger fire cases, offline (no model call, no spend)
// ============================================================================
// The nine prompts of evals/40 to 72 name no skill. A model has to pick the skill
// from what the listing shows it. For each prompt this checks:
//
//   1. RANK   the expected skill is the best match among the listing lines "name: description" of every model-facing
//             core skill. The match is a lexical proxy: distinct stemmed content
//             words, weighted by how rare each word is across the listing.
//   2. ROUTE  the ork:auto intent table has a row for the case's intent that
//             points at the expected skill, and the prompt holds at least one
//             of that row's signal phrases.
//
// WHAT IT CANNOT SHOW: that a model calls the Skill tool, or that the skill can
// then serve the prompt (a pasted diff still needs a PR or range to resolve). It
// pins the wording the listing and the router carry. Only an eval run proves firing.
// The signals of the ork:auto row are partly the words of these prompts, so the
// ROUTE check guards against the row being edited away, not against a wrong row.
//
// The cases live in fire-cases.json beside this file. A case marked known_gap is a
// prompt the skill does not cover; it prints SKIP with the reason and is not a pass.
//
// USAGE  node tests/skills/triggering/test-fire-cases.mjs [repo-root]
//        exit 0 = every check passes, 1 = a check failed
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || join(HERE, '..', '..', '..');

const STOP = new Set(
  ('the a an and or but for nor to of in on at by with from as is are was were be been it its this that ' +
    'these those i you we they he she my your our their me us them do does did done have has had not no ' +
    'can could would should will may might must if then than so such only also very just about into over ' +
    'out up down off any all some each every what which who whom how when where why there here get got ' +
    'one two three first want need please give tell write show make use used using').split(' '),
);
// Two-letter words that carry meaning in this domain and must not be dropped as short.
const SHORT_TERMS = new Set(['pr', 'ci', 'mr']);

function stem(w) {
  for (const suf of ['ing', 'ed', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}

function words(text) {
  const out = new Set();
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if ((w.length >= 3 || SHORT_TERMS.has(w)) && !STOP.has(w) && !/^\d+$/.test(w)) out.add(stem(w));
  }
  return out;
}

function frontmatter(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const fm = [];
  if (lines[0]?.trim() === '---') {
    for (const ln of lines.slice(1)) {
      if (/^---\s*$/.test(ln)) break;
      fm.push(ln);
    }
  }
  return fm;
}

const unquote = (s) => s.replace(/^"|"$/g, '');

function listing() {
  const excl = new Set(JSON.parse(readFileSync(join(ROOT, 'manifests', 'ork.json'), 'utf8')).skillsExclude);
  const dir = join(ROOT, 'src', 'skills');
  const out = new Map();
  for (const d of readdirSync(dir).sort()) {
    const f = join(dir, d, 'SKILL.md');
    if (!existsSync(f) || excl.has(d)) continue;
    let name = '';
    let desc = '';
    let hidden = false;
    for (const ln of frontmatter(f)) {
      if (/^disable-model-invocation:\s*true/.test(ln)) hidden = true;
      else if (ln.startsWith('name:')) name = unquote(ln.slice(5).trim());
      else if (ln.startsWith('description:')) desc = unquote(ln.slice(12).trim());
    }
    if (!hidden && (desc === '' || /^[>|][-+]?$/.test(desc))) {
      // A folded or block description is not read by this parser: fail loudly, never score it as zero.
      console.log(`FAIL listing ${d}: description is empty or a folded block this test does not parse`);
      process.exit(1);
    }
    if (!hidden) out.set(name || d, words(`${(name || d).replace(/-/g, ' ')} ${desc}`));
  }
  return out;
}

function promptOf(evalDir) {
  const text = readFileSync(join(ROOT, 'evals', evalDir, 'prompt.md'), 'utf8');
  const parts = text.split('\n---\n');
  return parts.length >= 2 ? parts.slice(1).join('\n---\n') : text;
}

function autoRows() {
  const text = readFileSync(join(ROOT, 'src', 'skills', 'auto', 'SKILL.md'), 'utf8');
  const rows = new Map();
  for (const m of text.matchAll(/^\|\s*\*\*([a-z-]+)\*\*\s*\|([^|]*)\|([^|]*)\|/gm)) {
    rows.set(m[1], { signals: m[2].toLowerCase(), routes: m[3].toLowerCase() });
  }
  return rows;
}

const docs = listing();
const n = docs.size;
const df = new Map();
for (const ws of docs.values()) for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
const rows = autoRows();
const spec = JSON.parse(readFileSync(join(HERE, 'fire-cases.json'), 'utf8'));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A signal matches as whole words, so "pr" does not match inside "production".
const hasSignal = (text, signal) => new RegExp(`(^|[^a-z0-9])${escapeRe(signal)}([^a-z0-9]|$)`).test(text);

console.log('==========================================');
console.log('Testing Natural-Trigger Fire Cases (offline)');
console.log('==========================================');

let failed = 0;
for (const c of spec.cases) {
  if (c.known_gap) {
    console.log(`SKIP ${c.eval.padEnd(41)} known gap: ${c.known_gap}`);
    continue;
  }
  const prompt = promptOf(c.eval);
  const q = words(prompt);
  const scores = new Map();
  for (const [skill, ws] of docs) {
    let s = 0;
    for (const w of q) if (ws.has(w)) s += Math.log(n / df.get(w));
    scores.set(skill, s);
  }
  const ranked = [...scores.keys()].sort((a, b) => scores.get(b) - scores.get(a) || (a < b ? -1 : 1));
  const okRank = ranked[0] === c.skill;
  const top3 = ranked
    .slice(0, 3)
    .map((s) => `${s} ${scores.get(s).toFixed(1)}`)
    .join(', ');
  console.log(`${okRank ? 'PASS' : 'FAIL'} rank  ${c.eval.padEnd(36)} want ${c.skill.padEnd(10)} top: ${top3}`);
  if (!okRank) failed++;
  if (c.intent) {
    const row = rows.get(c.intent);
    if (!row) {
      console.log(`FAIL route ${c.eval.padEnd(36)} no ork:auto row for intent '${c.intent}'`);
      failed++;
      continue;
    }
    const flat = prompt.toLowerCase().split(/\s+/).join(' ');
    const hit = row.signals.split(',').map((s) => s.trim()).filter((s) => s && hasSignal(flat, s));
    const okRoute = row.routes.includes(`\`${c.skill}\``) && hit.length > 0;
    console.log(
      `${okRoute ? 'PASS' : 'FAIL'} route ${c.eval.padEnd(36)} intent ${c.intent.padEnd(8)} signals hit: ${hit.length ? hit.join(' | ') : 'none'}`,
    );
    if (!okRoute) failed++;
  }
}
const skipped = spec.cases.filter((c) => c.known_gap).length;
console.log(`${failed} check(s) failed over ${spec.cases.length - skipped} checked cases, ${skipped} skipped as known gaps`);
if (failed) {
  console.log('ACTION REQUIRED: a fire prompt no longer ranks its skill first in the listing, or ork:auto no longer routes it.');
  console.log('Fix the skill description (260-byte cap, Test 4b ratchet) or the ork:auto intent table.');
}
process.exit(failed ? 1 : 0);
