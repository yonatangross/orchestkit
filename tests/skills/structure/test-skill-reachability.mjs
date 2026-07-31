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
// THE TWO CHECKS
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
//   Check 1 alone would have caught all 36 at authoring time, in one pass.
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
//   node tests/skills/structure/test-skill-reachability.mjs --dir <path>
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argDir = process.argv.indexOf('--dir');
const SKILLS_DIR =
  argDir !== -1 && process.argv[argDir + 1]
    ? process.argv[argDir + 1]
    : join(__dirname, '..', '..', '..', 'src', 'skills');

/** Parse the YAML frontmatter block only. Body text must never match. */
function frontmatter(text) {
  if (!text.startsWith('---')) return '';
  const parts = text.split('---');
  return parts.length >= 3 ? parts[1] : '';
}

function loadSkills(dir) {
  const out = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (name === 'shared') continue;
    const file = join(dir, name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const fm = frontmatter(readFileSync(file, 'utf8'));
    const preloadMatch = fm.match(/^skills:\s*\[(.*?)\]/ms);
    out.set(name, {
      file: `src/skills/${name}/SKILL.md`,
      modelBlocked: /^disable-model-invocation:\s*true/m.test(fm),
      userBlocked: /^user-invocable:\s*false/m.test(fm),
      preloads: preloadMatch
        ? preloadMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
  }
  return out;
}

// Ratchet ceiling for UNREACHABLE. Lower this whenever the count genuinely
// drops; never raise it. See the header for why this is not zero.
const UNREACHABLE_BASELINE = 30;

const skills = loadSkills(SKILLS_DIR);

const unreachable = [];
const deadEdges = [];

for (const [name, s] of skills) {
  if (s.modelBlocked && s.userBlocked) unreachable.push(name);
  for (const dep of s.preloads) {
    const target = skills.get(dep);
    if (target?.modelBlocked) deadEdges.push({ from: name, to: dep });
  }
}

console.log('='.repeat(70));
console.log('  Skill Reachability Linter (#3215)');
console.log('='.repeat(70));
const unreachableRegressed = unreachable.length > UNREACHABLE_BASELINE;

console.log(`  skills scanned : ${skills.size}`);
console.log(
  `  UNREACHABLE    : ${unreachable.length} / ${UNREACHABLE_BASELINE} baseline` +
    (unreachableRegressed ? '  <-- REGRESSION' : ''),
);
console.log(`  DEAD-EDGE      : ${deadEdges.length} (must be 0)`);

if (unreachableRegressed) {
  console.log(`\n== UNREACHABLE REGRESSION (${unreachable.length} > ${UNREACHABLE_BASELINE}) ==`);
  console.log('   A skill carries BOTH user-invocable:false AND');
  console.log('   disable-model-invocation:true, so nobody can invoke it.');
  console.log('   Either drop disable-model-invocation, or drop user-invocable:false.');
  for (const n of unreachable) console.log(`   ${skills.get(n).file}`);
} else if (unreachable.length < UNREACHABLE_BASELINE) {
  console.log(
    `\n  NOTE: unreachable count fell to ${unreachable.length}. Lower ` +
      `UNREACHABLE_BASELINE to ${unreachable.length} to lock the gain in.`,
  );
}

if (deadEdges.length) {
  console.log(`\n== DEAD-EDGE (${deadEdges.length}) ==`);
  console.log('   A skills: preload naming a disable-model-invocation:true target.');
  console.log('   The declaration cannot resolve. Drop the flag, or drop the entry.');
  for (const e of deadEdges) console.log(`   ${e.from}  ->  ${e.to}`);
}

if (unreachableRegressed || deadEdges.length) {
  const why = [];
  if (unreachableRegressed) why.push(`unreachable rose to ${unreachable.length} (baseline ${UNREACHABLE_BASELINE})`);
  if (deadEdges.length) why.push(`${deadEdges.length} dead preload edges`);
  console.log(`\nFAILED: ${why.join('; ')}`);
  process.exit(1);
}

console.log(
  `\nSUCCESS: every preload edge resolves; unreachable held at ${unreachable.length}` +
    ` (baseline ${UNREACHABLE_BASELINE})`,
);
process.exit(0);
