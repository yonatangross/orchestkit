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
// NOT A RATCHET
//   Both counts must be ZERO. Unlike check-skill-delta.mjs, this is not a
//   pre-existing mass being driven down over time; #3215 took both to zero, so
//   any reappearance is a new authoring mistake and should fail immediately.
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
console.log(`  skills scanned : ${skills.size}`);
console.log(`  UNREACHABLE    : ${unreachable.length}`);
console.log(`  DEAD-EDGE      : ${deadEdges.length}`);

if (unreachable.length) {
  console.log(`\n== UNREACHABLE (${unreachable.length}) ==`);
  console.log('   Carries BOTH user-invocable:false AND disable-model-invocation:true.');
  console.log('   Nobody can invoke these. Drop disable-model-invocation.');
  for (const n of unreachable) console.log(`   ${skills.get(n).file}`);
}

if (deadEdges.length) {
  console.log(`\n== DEAD-EDGE (${deadEdges.length}) ==`);
  console.log('   A skills: preload naming a disable-model-invocation:true target.');
  console.log('   The declaration cannot resolve. Drop the flag, or drop the entry.');
  for (const e of deadEdges) console.log(`   ${e.from}  ->  ${e.to}`);
}

if (unreachable.length || deadEdges.length) {
  console.log(`\nFAILED: ${unreachable.length} unreachable, ${deadEdges.length} dead preload edges`);
  process.exit(1);
}

console.log('\nSUCCESS: every skill is reachable and every preload edge resolves');
process.exit(0);
