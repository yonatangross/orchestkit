#!/usr/bin/env node
// ============================================================================
// Docs-Site Drift  (the docs/site/content counterpart of validate-counts.sh)
// ============================================================================
// WHAT IT GUARDS
//   Two ways docs/site/content/docs/**/*.mdx silently stops matching reality:
//
//     1. DEAD COMMAND — a page tells the reader to run `/ork:<name>` for a
//        skill that does not exist in src/skills/. The reader types it and
//        gets "skill not found". Nothing catches this today.
//
//     2. STALE TOTAL — a page states a plugin-wide count ("OrchestKit has
//        112 skills", "all 37 agents") that no longer matches src/.
//
// THE GAP THIS FILLS
//   `bin/validate-counts.sh` already gates the repo's OWN count surfaces
//   (.claude-plugin/plugin.json, CLAUDE.md, manifests, marketplace). It does
//   NOT look at docs/site/content/**, which is why the 2026-08-01 audit found
//   12 wrong totals and 5 dead commands there while validate-counts.sh was
//   passing green. This test extends the same discipline to the docs site.
//
// GROUND TRUTH IS DERIVED, NEVER HARDCODED
//   Counts come from counting src/ at runtime, so this test cannot itself go
//   stale when a skill or agent is added. `src/agents/README.md` is excluded —
//   it is documentation, not an agent (that off-by-one is what made the
//   original audit misreport 36 as 37).
//
// WHAT IT DELIBERATELY DOES NOT FLAG
//   - Subset counts. "12 hooks with `type: http`", "40 skills set `effort:`",
//     "spawns up to 14 agents" are all correct statements about a subset.
//     Only lines matching an explicit TOTAL_CLAIM pattern are checked.
//   - Teaching placeholders: /ork:foo, /ork:my-skill, /ork:skill-name, ...
//   - Deliberate references to things that do not exist — negative examples
//     ("don't pretend a /ork:experiment skill exists"), removal notes
//     ("ork:agents-view was removed in favor of ..."), and roadmap items
//     tracked by issue number. Those live in KNOWN_ABSENT below WITH a reason,
//     so adding one is a conscious act, not an accident.
// ============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const CONTENT = join(ROOT, 'docs/site/content/docs');

// --- ground truth, derived ---------------------------------------------------
const skills = new Set(
  readdirSync(join(ROOT, 'src/skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/skills', d.name, 'SKILL.md')))
    .map((d) => d.name),
);
const agents = new Set(
  readdirSync(join(ROOT, 'src/agents'))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.slice(0, -3)),
);
// Hook total comes from bin/count-hooks.sh, the same script validate-counts.sh
// trusts. An earlier revision of this gate skipped `hooks` outright on the
// grounds that no single src/ path yields the number — that blind spot let
// "183 hooks" (actual 218) sit uncaught in foundations/skills-agents-hooks.mdx
// while this test reported SUCCESS.
let hookTotal = null;
try {
  const out = execFileSync('bash', [join(ROOT, 'bin/count-hooks.sh')], { encoding: 'utf8' });
  const m = out.match(/TOTAL=(\d+)/);
  if (m) hookTotal = Number(m[1]);
} catch {
  /* leave null — reported below rather than silently skipped */
}

const TRUTH = { skills: skills.size, agents: agents.size, hooks: hookTotal };

// Skills a reader can actually type as /ork:<name>. A reference to a
// non-invocable skill renders as a command that silently does nothing.
// Held as a RATCHET, not a hard zero: the docs carry a large existing backlog
// of these, and failing on all of them would report a regression that did not
// happen. House pattern, same as UNREACHABLE_BASELINE in test-skill-reachability.
// 66 is the measured backlog as of 2026-08-01, not a target. The big
// contributors are demo-producer (22), analytics (9), configure (9) and
// audit-full (5) — skills the docs present with a slash form they do not have.
// Ratchet DOWN as those pages get reworded; never raise it to make a red run go
// green. `ORK_DOCS_NONINVOCABLE_BASELINE` exists for a deliberate, reviewed bump.
const NON_INVOCABLE_BASELINE = Number(process.env.ORK_DOCS_NONINVOCABLE_BASELINE ?? 66);
const invocable = new Set(
  [...skills].filter((s) =>
    /^user-invocable:\s*true/m.test(readFileSync(join(ROOT, 'src/skills', s, 'SKILL.md'), 'utf8')),
  ),
);

// --- references that are absent ON PURPOSE ----------------------------------
// Every entry needs a reason. If a skill by this name is ever really added,
// the entry becomes dead weight — remove it then.
const KNOWN_ABSENT = new Map([
  ['experiment', 'negative example — the docs say outright that no such skill exists'],
  ['agents-view', 'removal note — retired in favour of the native `claude agents` CLI'],
  ['design-iterate', 'roadmap item — M124 / issue #1393, documented as not yet built'],
  ['scaffold', 'illustrative failure case — merged into `implement` in v7.2.0'],
  ['build-optimizer', 'demo-config example in demo-producer, not a real command'],
  ['code-walkthrough', 'demo-config example in demo-producer, not a real command'],
]);

const PLACEHOLDER = new Set([
  'foo', 'bar', 'baz', 'x', 'xxx', 'my-skill', 'skill-name', 'skillname', 'skill', 'name',
]);

// --- a line only counts as a TOTAL claim if it says so ----------------------
// `[\s-]*` and the optional plural are both load-bearing. An earlier revision
// required whitespace and a plural noun, so "the full 37-agent registry" and
// "the 37-agent catalog" sailed past in three source files while this gate
// reported SUCCESS. Hyphenated attributive forms are how people write these.
const TOTAL_CLAIM = [
  /OrchestKit(?:'s)?\s+(?:has\s+|includes?\s+)?(\d{2,4})[\s-]*(skills?|agents?|hooks?)/i,
  /OrchestKit:\s*(\d{2,4})[\s-]*(skills?|agents?|hooks?)/i,
  /\b(?:full|complete|entire)\s+(\d{2,4})-(skill|agent|hook)\b/i,
  // "all N agents" ONLY counts as a total when the sentence claims completeness.
  // Bare "All 14 agents" in a table cell is /ork:implement's fanout, and
  // "all 33 skills using AskUserQuestion" is a qualified subset — neither is a
  // plugin-wide claim, and flagging them would make this gate cry wolf.
  // `full(?!-)` so "Full-stack" in a table cell does not read as "full reference".
  /\b(?:full(?!-)|complete(?!-)|entire|every)\b[^.]{0,40}?\ball\s+(\d{2,4})\s*(skills|agents|hooks)\b/i,
  /\bork:\s*(\d{2,4})\s*(skills|agents|hooks)/i,
];

const REF = /\/?\bork:([a-z0-9][a-z0-9-]*)/g;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.mdx')) out.push(p);
  }
  return out;
}

const files = walk(CONTENT);
const deadRefs = [];
const staleCounts = [];
const nonInvocable = [];

for (const path of files) {
  const rel = relative(ROOT, path);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, idx) => {
    REF.lastIndex = 0;
    let m;
    while ((m = REF.exec(line)) !== null) {
      const name = m[1];
      if (PLACEHOLDER.has(name) || KNOWN_ABSENT.has(name)) continue;
      if (skills.has(name) || agents.has(name)) {
        // Exists, but can the reader actually invoke it? Only count the
        // slash-command form; `ork:foo` in a prose list is a cross-reference,
        // not an instruction to type something.
        if (skills.has(name) && !invocable.has(name) && line.includes(`/ork:${name}`)) {
          nonInvocable.push({ rel, line: idx + 1, name });
        }
        continue;
      }
      deadRefs.push({ rel, line: idx + 1, name, text: line.trim().slice(0, 110) });
    }

    for (const re of TOTAL_CLAIM) {
      const c = line.match(re);
      if (!c) continue;
      const n = Number(c[1]);
      // normalise singular attributive forms ("37-agent") to the plural key
      const noun = c[2].toLowerCase().replace(/^(skill|agent|hook)$/, '$1s');
      if (TRUTH[noun] == null) continue; // count-hooks.sh unavailable; reported below
      if (n !== TRUTH[noun]) {
        staleCounts.push({ rel, line: idx + 1, said: n, noun, actual: TRUTH[noun], text: line.trim().slice(0, 110) });
      }
      break;
    }
  });
}

console.log(`Docs-site drift: ${files.length} MDX files`);
console.log(
  `Ground truth (derived): ${TRUTH.skills} skills, ${TRUTH.agents} agents, ` +
    `${TRUTH.hooks ?? 'hooks UNAVAILABLE (count-hooks.sh failed)'} hooks\n`,
);
console.log(
  `Non-invocable /ork: commands: ${nonInvocable.length} (baseline ${NON_INVOCABLE_BASELINE})`,
);

if (deadRefs.length) {
  console.log(`== DEAD /ork: REFERENCES (${deadRefs.length}) ==`);
  console.log('   The page tells a reader to run a skill that does not exist.');
  console.log('   Fix the name, or — if the absence is deliberate — add it to');
  console.log('   KNOWN_ABSENT in this file with a reason.\n');
  for (const d of deadRefs) console.log(`   ${d.rel}:${d.line}  ork:${d.name}\n      ${d.text}`);
}

if (staleCounts.length) {
  console.log(`\n== STALE PLUGIN-WIDE TOTALS (${staleCounts.length}) ==`);
  for (const s of staleCounts) {
    console.log(`   ${s.rel}:${s.line}  says ${s.said} ${s.noun}, actual ${s.actual}\n      ${s.text}`);
  }
}

// Ratchet: fail only when the backlog GROWS. A hard zero would report a
// regression that did not happen, and a gate that always fails gets ignored.
const ratchetBroken = nonInvocable.length > NON_INVOCABLE_BASELINE;
if (ratchetBroken) {
  console.log(
    `\n== NON-INVOCABLE COMMANDS UP (${nonInvocable.length} > ${NON_INVOCABLE_BASELINE}) ==`,
  );
  console.log('   These render as /ork:<name> but the skill is user-invocable: false,');
  console.log('   so a reader who types them gets nothing.\n');
  for (const n of nonInvocable) console.log(`   ${n.rel}:${n.line}  /ork:${n.name}`);
}

if (deadRefs.length || staleCounts.length || ratchetBroken) {
  console.log(
    `\nFAILED: ${deadRefs.length} dead references, ${staleCounts.length} stale totals, ` +
      `non-invocable ${nonInvocable.length}/${NON_INVOCABLE_BASELINE}`,
  );
  process.exit(1);
}

console.log(
  `SUCCESS: every /ork: reference resolves and every plugin-wide total matches src/ ` +
    `(${KNOWN_ABSENT.size} deliberate absences allowlisted)`,
);
process.exit(0);
