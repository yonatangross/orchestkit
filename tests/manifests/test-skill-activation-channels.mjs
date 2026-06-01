#!/usr/bin/env node
// ============================================================================
// Skill Activation-Channel Orphan Detection
// ============================================================================
// A user-invocable skill is reachable four ways ("activation channels"):
//   direct    — a user types /ork:<skill>        (always available, not counted here)
//   chain     — another skill references it (/ork:x, /x, or skills:[] frontmatter)
//   subagent  — an agent is granted it (src/agents/*.md skills:[] frontmatter)
//   background— the skill itself is autonomous (cron / nightly / hourly / headless)
//
// A skill that ONLY has the direct channel is an "island": reachable only when a
// human remembers to type it. Islands are how skills silently rot (cf. prd-to-goal,
// telemetry-inspect — both had zero incoming references until wired in #<this PR>).
//
// This gate FAILS if any user-invocable skill has 0 automated channels (chain +
// subagent + background all empty) AND is not on STANDALONE_ALLOWLIST.
//
// To intentionally ship a direct-only command, add it to STANDALONE_ALLOWLIST
// with a one-line justification — that makes the choice explicit and reviewed.
//
// Usage: node tests/manifests/test-skill-activation-channels.mjs [--verbose]
// Exit:  0 = every user-invocable skill has a trigger path, 1 = island(s) found
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.CLAUDE_PROJECT_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = join(ROOT, 'src', 'skills');
const AGENTS = join(ROOT, 'src', 'agents');
const VERBOSE = process.argv.includes('--verbose');

const C = process.stdout.isTTY
  ? { r: '\x1b[0;31m', g: '\x1b[0;32m', y: '\x1b[1;33m', b: '\x1b[0;34m', n: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', n: '' };

// Direct-only commands that legitimately need no automated trigger.
// Keep this list SHORT and justified — each entry is a skill a human is expected
// to invoke explicitly, where chaining/granting would be artificial.
const STANDALONE_ALLOWLIST = {
  // (currently empty — every user-invocable skill is wired. Add entries as:
  //   'skill-name': 'why it is intentionally direct-only',
};

// ---- parse a YAML frontmatter `skills:` field (inline [..] OR block list) ----
function frontmatterSkills(text) {
  const out = new Set();
  const inline = text.match(/^skills:\s*\[(.*?)\]/ms);
  if (inline) {
    for (const x of inline[1].split(',')) {
      const t = x.trim().replace(/^["']|["']$/g, '');
      if (t) out.add(t.split(/\s+/)[0]);
    }
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^skills:\s*$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const m = lines[j].match(/^\s*-\s*(.+?)\s*$/);
        if (!m) break;
        out.add(m[1].replace(/^["']|["']$/g, '').split(/\s+/)[0]);
      }
      break;
    }
  }
  return out;
}

function frontmatterFlag(text, field) {
  return new RegExp(`^${field}:\\s*true`, 'm').test(text);
}

// ---- collect skills ----
const skillDirs = readdirSync(SKILLS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const skillText = {};
const userInvocable = [];
for (const name of skillDirs) {
  const p = join(SKILLS, name, 'SKILL.md');
  if (!existsSync(p)) continue;
  const t = readFileSync(p, 'utf8');
  skillText[name] = t;
  if (frontmatterFlag(t, 'user-invocable')) userInvocable.push(name);
}
const skillSet = new Set(skillDirs);

// ---- channel: chain (incoming refs from OTHER skills) ----
const chainedBy = new Map(skillDirs.map((n) => [n, new Set()]));
for (const [src, t] of Object.entries(skillText)) {
  const refs = new Set();
  for (const m of t.matchAll(/\/(?:ork:)?([a-z][a-z0-9-]{2,})/g)) refs.add(m[1]);
  for (const s of frontmatterSkills(t)) refs.add(s);
  for (const r of refs) if (skillSet.has(r) && r !== src) chainedBy.get(r).add(src);
}

// ---- channel: subagent (granted in an agent's skills: frontmatter) ----
const grantedBy = new Map(skillDirs.map((n) => [n, new Set()]));
for (const f of readdirSync(AGENTS).filter((x) => x.endsWith('.md'))) {
  const agent = f.replace(/\.md$/, '');
  for (const s of frontmatterSkills(readFileSync(join(AGENTS, f), 'utf8')))
    if (skillSet.has(s)) grantedBy.get(s).add(agent);
}

// ---- channel: background (skill is autonomous) ----
const BG = /autonomous|nightly|hourly|\bcron\b|background:|headless|stop hook|runs? (on a )?schedule|post-release|after (tagging|a release)|propose-don/i;

// ---- evaluate ----
console.log('');
console.log('══════════════════════════════════════════════════════════════════════');
console.log('  Skill Activation Channels — island detection');
console.log('  Every user-invocable skill needs chain, subagent, or background reach.');
console.log('══════════════════════════════════════════════════════════════════════');
console.log('');

const islands = [];
let wired = 0;
for (const s of userInvocable.sort()) {
  const chain = chainedBy.get(s).size;
  const sub = grantedBy.get(s).size;
  const bg = BG.test(skillText[s] || '');
  const auto = (chain > 0) + (sub > 0) + (bg ? 1 : 0);
  if (auto === 0) {
    if (s in STANDALONE_ALLOWLIST) {
      console.log(`  ${C.y}[ALLOW]${C.n} ${s} — direct-only by design (${STANDALONE_ALLOWLIST[s]})`);
    } else {
      console.log(`  ${C.r}[ISLAND]${C.n} ${s} — 0 automated channels (only reachable by typing /ork:${s})`);
      islands.push(s);
    }
  } else {
    wired++;
    if (VERBOSE) {
      const tags = [chain && `chain:${chain}`, sub && `subagent:${sub}`, bg && 'background'].filter(Boolean).join(' · ');
      console.log(`  ${C.g}[OK]${C.n} ${s} (${tags})`);
    }
  }
}

console.log('');
console.log('══════════════════════════════════════════════════════════════════════');
console.log(`  User-invocable skills:  ${C.b}${userInvocable.length}${C.n}`);
console.log(`  Wired (>=1 automated):  ${C.g}${wired}${C.n}`);
console.log(`  Allowlisted direct:     ${C.y}${Object.keys(STANDALONE_ALLOWLIST).length}${C.n}`);
console.log(`  Islands (no trigger):   ${islands.length ? C.r : C.g}${islands.length}${C.n}`);
console.log('');

if (islands.length) {
  console.log(`${C.r}FAILED${C.n} — ${islands.length} user-invocable skill(s) are islands: ${islands.join(', ')}`);
  console.log('  Give each a trigger path (pick one):');
  console.log('    • chain     — reference /ork:<skill> in a parent SKILL.md (or its skills:[] frontmatter)');
  console.log('    • subagent  — add it to a src/agents/<agent>.md skills:[] list');
  console.log('    • background— add an autonomous trigger (cron / Stop hook / release step)');
  console.log('  Or, if it is intentionally direct-only, add it to STANDALONE_ALLOWLIST with a reason.');
  process.exit(1);
}

console.log(`${C.g}PASSED${C.n} — all ${userInvocable.length} user-invocable skills have a trigger path.`);
process.exit(0);
