#!/usr/bin/env node
// ============================================================================
// Skill Reachability Linter  (issue #3215)
// ============================================================================
// WHAT IT GUARDS
//   Two frontmatter fields decide who may start a skill, and CC's docs describe
//   them as independent switches:
//
//     user-invocable: false          -> the USER may not invoke it
//     disable-model-invocation: true -> the MODEL may not invoke it, AND the
//                                       skill is removed from the model's
//                                       context entirely, AND it can no longer
//                                       be preloaded into subagents
//
//   Set BOTH on one skill and nobody can run it. Neither side reports this as
//   an error at authoring time; the failure only shows up at the point of use,
//   as a pair of messages that point at each other:
//
//     user  /ork:chain-patterns
//           "This skill can only be invoked by Claude, not directly by users.
//            Ask Claude to use the skill for you."
//     model Skill(chain-patterns)
//           "cannot be used with Skill tool due to disable-model-invocation"
//
//   That circular dead end is why the class went unnoticed: the user-facing
//   message reads as a routing hint rather than a wall. At the time this linter
//   was written, 36 of 105 skills (34%) were in that state, and 18 skills
//   declared 32 `skills:` preload edges that could never resolve — including
//   brainstorm, assess, verify, explore, implement and review-pr, i.e. exactly
//   the pipeline skills whose whole design depends on preloading libraries.
//
//   Worse, the stranded skills' own descriptions named the mechanism their flag
//   disabled. chain-patterns said "Loaded via skills: field by pipeline skills
//   (fix-issue, implement, brainstorm, verify)" while carrying the one flag that
//   prevents exactly that.
//
// THE FIVE CHECKS
//   [UNREACHABLE]  a skill carrying BOTH `user-invocable: false` and
//                  `disable-model-invocation: true`. Reachable by nobody.
//                  Fix: drop `disable-model-invocation`, keep `user-invocable:
//                  false`. That yields the intended library behaviour — hidden
//                  from the slash menu, never auto-loaded standalone, still
//                  resolvable as a `skills:` dependency.
//
//   [DEAD-EDGE]    a `skills:` preload entry naming a target that carries
//                  `disable-model-invocation: true`. The declaration cannot
//                  resolve, so it is a claim of capability the skill does not
//                  have. Fix: either the target is a library (drop its flag) or
//                  it is a deliberate user-only action such as commit /
//                  create-pr / doctor / ci-debug, in which case remove the
//                  preload entry rather than weakening the target. Never
//                  weaken a mutating skill just to satisfy a preload.
//
//   [AGENT-DEAD-EDGE]  the same thing on `src/agents/*.md`. #3218.
//
//   [MISSING-TARGET]   a `skills:` entry naming a skill that does not exist.
//
//   [MISSING-AGENT]    a skill's `agent:` SCALAR, or an `Agent(ork:x)` tool
//                      grant, naming an agent that does not exist.
//
//   Check 1 alone would have caught all 36 at authoring time, in one pass.
//
// WHAT "UNREACHABLE" COUNTS, AND WHY THE NUMBER IS DEFINITION-SENSITIVE
//   An independent audit pointed out this ratchet is only meaningful once you
//   say which question it answers. Measured at e2172dd9a:
//
//     disable-model-invocation AND not user-invocable ......... 30
//     disable-model-invocation, zero LIVE inbound edge ......... 40
//     not user-invocable, zero live inbound .................... 40
//     not user-invocable (any) ................................ 70
//
//   All 40 DMI skills have zero live inbound edges BY CONSTRUCTION, since a DMI
//   target cannot be preloaded, so every inbound edge to one is dead by
//   definition. This linter deliberately counts the FIRST definition: "no path
//   exists for anyone at all". The other 10 DMI skills are user-invocable, so a
//   human can still reach them by typing the slash command; they are reachable,
//   just not preloadable, which is a design choice rather than a defect.
//
// WHY DEAD-EDGE IS HARD-ZERO BUT UNREACHABLE IS A RATCHET
//   The obvious fix — drop `disable-model-invocation` from all 36 — fails the
//   token budget. That flag does DOUBLE DUTY: it also keeps a skill's
//   description out of every session's context. Un-flagging all 36 moved the
//   model-facing skill index from 59 to 95 entries and pushed total session
//   overhead from ~7.9k to ~10498 tokens against a 9300 budget, caught by
//   tests/performance/test-token-overhead.sh (+2638t on EVERY session, forever).
//
//   So #3216 un-flagged only the SIX skills that are actually preload targets
//   (chain-patterns, code-review-playbook, architecture-decision-record,
//   scope-appropriate-architecture, browser-tools, configure). Those six carry
//   all 32 dead edges, and cost ~405t. The other 30 are unreachable but nothing
//   depends on them, so un-flagging them would buy zero repaired edges for
//   ~2233t per session.
//
//   Hence the asymmetry:
//     DEAD-EDGE    must be ZERO. A preload that cannot resolve is always a bug,
//                  and fixing it is cheap because something already wants it.
//     UNREACHABLE  is a RATCHET at UNREACHABLE_BASELINE. Those skills are inert
//                  but harmless and, more to the point, cheap. Making them
//                  reachable is a budget decision, not a correctness one. The
//                  count may fall, never rise: a NEW unreachable skill is an
//                  authoring mistake, while the existing 30 are a deliberate
//                  cost trade recorded in #3215.
//
//   If you make one of the 30 a preload target, DEAD-EDGE fires and forces you
//   to un-flag it, which lowers this baseline. That is the intended ratchet.
//
// USAGE
//   node tests/skills/structure/test-skill-reachability.mjs
//   node tests/skills/structure/test-skill-reachability.mjs --dir <src-dir>
//     <src-dir> must be a directory containing BOTH skills/ and agents/,
//     i.e. a repo's src/. Used to run this against another checkout.
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');
const argDir = process.argv.indexOf('--dir');
const ROOT =
  argDir !== -1 && process.argv[argDir + 1] ? process.argv[argDir + 1] : join(REPO, 'src');
const SKILLS_DIR = join(ROOT, 'skills');
const AGENTS_DIR = join(ROOT, 'agents');

/** Parse the YAML frontmatter block only. Body text must never match. */
function frontmatter(text) {
  if (!text.startsWith('---')) return '';
  const parts = text.split('---');
  return parts.length >= 3 ? parts[1] : '';
}

/**
 * Extract a YAML list field, handling BOTH forms this repo uses:
 *
 *   inline (skills):  skills: [a, b, c]      may wrap across lines
 *   block  (agents):  skills:
 *                       - a
 *                       - b
 *
 * This function exists because the first version of this linter matched only
 * the inline form. On block-form files the regex returned nothing and the
 * linter printed DEAD-EDGE: 0, a false clean. That shipped in #3216 and hid
 * five real skill edges (the design-* family) plus the ENTIRE agent surface,
 * 98 edges, which is #3218. Parse the shape; never assume which one an author
 * picked.
 *
 * Deliberately dependency-free: js-yaml resolves in this tree today but is a
 * transitive package, not a declared dependency, so a test must not import it.
 */
function parseListField(fm, key) {
  const lines = fm.split('\n');
  const head = new RegExp(`^${key}:\\s*(.*)$`);
  const clean = (s) => s.trim().replace(/^['"]|['"]$/g, '');

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(head);
    if (!m) continue;
    const rest = m[1].trim();

    if (rest.startsWith('[')) {
      let buf = rest;
      while (!buf.includes(']') && i + 1 < lines.length) buf += ` ${lines[++i].trim()}`;
      const inner = buf.slice(buf.indexOf('[') + 1, buf.lastIndexOf(']'));
      return inner.split(',').map(clean).filter(Boolean);
    }

    if (rest === '') {
      const out = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s*#/.test(lines[j])) continue;
        const item = lines[j].match(/^\s+-\s*(.+?)\s*$/);
        if (!item) break;
        out.push(clean(item[1]));
      }
      return out;
    }
    return [];
  }
  return [];
}

function loadSkills(dir) {
  const out = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (name === 'shared') continue;
    const file = join(dir, name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const fm = frontmatter(readFileSync(file, 'utf8'));
    out.set(name, {
      file: `src/skills/${name}/SKILL.md`,
      modelBlocked: /^disable-model-invocation:\s*true/m.test(fm),
      userBlocked: /^user-invocable:\s*false/m.test(fm),
      preloads: parseListField(fm, 'skills'),
      agentRef: parseScalarField(fm, 'agent'),
    });
  }
  return out;
}

/**
 * Read a SCALAR frontmatter field, e.g. `agent: backend-system-architect`.
 *
 * This is the THIRD shape of the same trap, and it is the one a list parser
 * silently skips. 58 of 105 skills name a preferred agent this way. A linter
 * that only learned inline-vs-block would still be blind here, so the fix for
 * the #3216 false clean is not "handle both list forms", it is "know which
 * shape each field actually has".
 */
function parseScalarField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!m) return null;
  const v = m[1].trim().replace(/^['"]|['"]$/g, '');
  return v.startsWith('[') || v === '' ? null : v;
}

/** `Agent(ork:foo)` grants are NAMESPACED. A resolver that fails to strip the
 *  plugin prefix reports all 18 as dangling: the false-positive mirror of the
 *  false-clean this file exists to prevent. Handles `Skill(...)` too, which
 *  nothing uses today but someone will add. */
function parseAgentGrants(fm) {
  return [...fm.matchAll(/\bAgent\(([^)]+)\)/g)].map((m) => m[1].trim().split(':').pop());
}

function loadAgents(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const fm = frontmatter(readFileSync(join(dir, name), 'utf8'));
    out.set(name.slice(0, -3), {
      file: `src/agents/${name}`,
      preloads: parseListField(fm, 'skills'),
      grants: parseAgentGrants(fm),
    });
  }
  return out;
}

// Ratchet ceilings. Lower each whenever the count genuinely drops; never
// raise one. See the header for why UNREACHABLE is not zero.
//
// AGENT_DEAD_EDGE starts at the measured baseline rather than zero because
// clearing it is per-agent judgement, not a sweep: with ~331 tokens of budget
// headroom, most of these must be fixed by DELETING the false declaration
// rather than un-flagging the target (#3218). Skill-side DEAD-EDGE stays a
// hard zero, since #3216 already took it there.
const UNREACHABLE_BASELINE = 29;
const AGENT_DEAD_EDGE_BASELINE = 94;

const skills = loadSkills(SKILLS_DIR);
const agents = loadAgents(AGENTS_DIR);

const unreachable = [];
const deadEdges = [];
const agentDeadEdges = [];
const missingTargets = [];
const missingAgents = [];

for (const [name, s] of skills) {
  if (s.modelBlocked && s.userBlocked) unreachable.push(name);
  for (const dep of s.preloads) {
    const target = skills.get(dep);
    if (!target) missingTargets.push({ from: s.file, to: dep });
    else if (target.modelBlocked) deadEdges.push({ from: name, to: dep });
  }
}

for (const [, s] of skills) {
  if (s.agentRef && !agents.has(s.agentRef)) {
    missingAgents.push({ from: s.file, to: s.agentRef });
  }
}

for (const [name, a] of agents) {
  for (const g of a.grants) {
    if (!agents.has(g)) missingAgents.push({ from: a.file, to: `Agent(${g})` });
  }
  for (const dep of a.preloads) {
    const target = skills.get(dep);
    if (!target) missingTargets.push({ from: a.file, to: dep });
    else if (target.modelBlocked) agentDeadEdges.push({ from: name, to: dep });
  }
}

const unreachableRegressed = unreachable.length > UNREACHABLE_BASELINE;
const agentRegressed = agentDeadEdges.length > AGENT_DEAD_EDGE_BASELINE;

console.log('='.repeat(70));
console.log('  Skill + Agent Reachability Linter (#3215, #3218)');
console.log('='.repeat(70));
console.log(`  skills scanned  : ${skills.size}`);
console.log(`  agents scanned  : ${agents.size}`);
console.log(
  `  UNREACHABLE     : ${unreachable.length} / ${UNREACHABLE_BASELINE} baseline` +
    (unreachableRegressed ? '  <-- REGRESSION' : ''),
);
console.log(`  DEAD-EDGE       : ${deadEdges.length} (must be 0)`);
console.log(
  `  AGENT-DEAD-EDGE : ${agentDeadEdges.length} / ${AGENT_DEAD_EDGE_BASELINE} baseline` +
    (agentRegressed ? '  <-- REGRESSION' : ''),
);
console.log(`  MISSING-TARGET  : ${missingTargets.length} (must be 0)`);
console.log(`  MISSING-AGENT   : ${missingAgents.length} (must be 0)`);

if (unreachableRegressed) {
  console.log(`\n== UNREACHABLE REGRESSION (${unreachable.length} > ${UNREACHABLE_BASELINE}) ==`);
  console.log('   A skill carries BOTH user-invocable:false AND');
  console.log('   disable-model-invocation:true, so nobody can invoke it.');
  console.log('   Either drop disable-model-invocation, or drop user-invocable:false.');
  for (const n of unreachable) console.log(`   ${skills.get(n).file}`);
} else if (unreachable.length < UNREACHABLE_BASELINE) {
  console.log(
    `\n  NOTE: unreachable fell to ${unreachable.length}. Lower ` +
      `UNREACHABLE_BASELINE to ${unreachable.length} to lock the gain in.`,
  );
}

if (deadEdges.length) {
  console.log(`\n== DEAD-EDGE (${deadEdges.length}) ==`);
  console.log('   A skills: preload naming a disable-model-invocation:true target.');
  console.log('   The declaration cannot resolve. Drop the flag, or drop the entry.');
  for (const e of deadEdges) console.log(`   ${e.from}  ->  ${e.to}`);
}

if (agentRegressed) {
  console.log(`\n== AGENT-DEAD-EDGE REGRESSION (${agentDeadEdges.length} > ${AGENT_DEAD_EDGE_BASELINE}) ==`);
  console.log('   An agent skills: preload naming a disable-model-invocation:true');
  console.log('   target. It cannot be preloaded into the subagent.');
  for (const e of agentDeadEdges) console.log(`   ${e.from}  ->  ${e.to}`);
} else if (agentDeadEdges.length < AGENT_DEAD_EDGE_BASELINE) {
  console.log(
    `\n  NOTE: agent dead edges fell to ${agentDeadEdges.length}. Lower ` +
      `AGENT_DEAD_EDGE_BASELINE to ${agentDeadEdges.length} to lock the gain in.`,
  );
}

if (missingTargets.length) {
  console.log(`\n== MISSING-TARGET (${missingTargets.length}) ==`);
  console.log('   A skills: preload naming a skill that does not exist at all.');
  for (const e of missingTargets) console.log(`   ${e.from}  ->  ${e.to}`);
}

if (missingAgents.length) {
  console.log(`\n== MISSING-AGENT (${missingAgents.length}) ==`);
  console.log('   A skill `agent:` scalar, or an Agent(...) tool grant, naming');
  console.log('   an agent that does not exist.');
  for (const e of missingAgents) console.log(`   ${e.from}  ->  ${e.to}`);
}

if (unreachableRegressed || deadEdges.length || agentRegressed || missingTargets.length || missingAgents.length) {
  const why = [];
  if (unreachableRegressed) why.push(`unreachable rose to ${unreachable.length} (baseline ${UNREACHABLE_BASELINE})`);
  if (deadEdges.length) why.push(`${deadEdges.length} dead skill preload edges`);
  if (agentRegressed) why.push(`agent dead edges rose to ${agentDeadEdges.length} (baseline ${AGENT_DEAD_EDGE_BASELINE})`);
  if (missingTargets.length) why.push(`${missingTargets.length} preloads naming a nonexistent skill`);
  if (missingAgents.length) why.push(`${missingAgents.length} references naming a nonexistent agent`);
  console.log(`\nFAILED: ${why.join('; ')}`);
  process.exit(1);
}

console.log(
  `\nSUCCESS: 0 skill dead edges, 0 missing targets; unreachable held at ` +
    `${unreachable.length}/${UNREACHABLE_BASELINE}, agent dead edges at ` +
    `${agentDeadEdges.length}/${AGENT_DEAD_EDGE_BASELINE}`,
);
process.exit(0);
