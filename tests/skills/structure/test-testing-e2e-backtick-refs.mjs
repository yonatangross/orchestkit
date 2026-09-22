#!/usr/bin/env node
// ============================================================================
// testing-e2e backtick reference integrity (F27 / sc47)
// ============================================================================
// WHAT IT GUARDS
//   Skill prose often points readers at sibling files with backtick paths
//   such as `references/foo.md` or `rules/bar.md`. Those are skill-root
//   relative. The SKILL.md markdown-link gate in test-skill-md.sh only
//   checks [text](path) links inside SKILL.md, so a dead backtick path
//   inside references/*.md stays green forever.
//
//   F27: playwright-setup.md pointed at references/planner-agent.md, a
//   file that never existed. Readers were sent into a dead end.
//
// SCOPE
//   Only src/skills/testing-e2e/**/*.md. A repo-wide hard zero currently
//   fails on unrelated skills (ork-delta gap lists, cross-skill pointers).
//   This file freezes the class that bit testing-e2e.
//
// USAGE
//   node tests/skills/structure/test-testing-e2e-backtick-refs.mjs
// ============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILL = join(REPO, 'src', 'skills', 'testing-e2e');

// Skill-root relative targets: references/ or rules/ markdown files.
const REF_RE =
  /`((?:references|rules)\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md)`/g;

function walkMarkdown(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkMarkdown(full, out);
      continue;
    }
    if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

if (!existsSync(SKILL)) {
  console.log(`\nFAILED: missing skill dir ${SKILL}`);
  process.exit(1);
}

const files = walkMarkdown(SKILL);
if (files.length === 0) {
  console.log('\nFAILED: scanned zero markdown files under testing-e2e');
  process.exit(1);
}

const dead = [];
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  let match;
  REF_RE.lastIndex = 0;
  while ((match = REF_RE.exec(text)) !== null) {
    checked += 1;
    const rel = match[1];
    const target = join(SKILL, rel);
    if (!existsSync(target)) {
      const line = text.slice(0, match.index).split('\n').length;
      dead.push({
        file: relative(REPO, file),
        line,
        rel,
      });
    }
  }
}

console.log(
  `testing-e2e backtick refs: ${files.length} md files, ${checked} path checks`,
);

if (checked === 0) {
  console.log(
    '\nFAILED: found zero backtick references/ or rules/ paths; scanner is blind',
  );
  process.exit(1);
}

if (dead.length) {
  console.log(`\n== DEAD BACKTICK REFS (${dead.length}) ==`);
  for (const d of dead) {
    console.log(`   ${d.file}:${d.line}  \`${d.rel}\``);
  }
  console.log(
    `\nFAILED: ${dead.length} dead backtick reference(s) under testing-e2e`,
  );
  process.exit(1);
}

console.log(
  'SUCCESS: every testing-e2e backtick references/ and rules/ path resolves',
);
process.exit(0);
