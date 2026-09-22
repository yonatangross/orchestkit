#!/usr/bin/env node
// ============================================================================
// testing-e2e backtick reference integrity (F27 / sc47 / #4356 follow-up)
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
//   #4356 CodeRabbit: join(SKILL, rel) alone accepts references/../../x.md
//   which resolves outside the skill root. After resolve, the path must
//   stay under the skill directory or the check fails with a named message.
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
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILL = resolve(join(REPO, 'src', 'skills', 'testing-e2e'));

// Skill-root relative targets. First segment after the slash may be "." so
// escape probes like references/../../outside.md are visible to the scanner.
const REF_RE =
  /`((?:references|rules)\/[A-Za-z0-9.][A-Za-z0-9_./-]*\.md)`/g;

/** @returns {{ ok: true, resolved: string } | { ok: false, code: string, message: string, resolved: string }} */
export function checkBacktickTarget(skillRoot, rel) {
  const root = resolve(skillRoot);
  const resolved = resolve(root, rel);
  const out = relative(root, resolved);
  if (out.startsWith('..') || isAbsolute(out)) {
    return {
      ok: false,
      code: 'ESCAPES_SKILL_ROOT',
      message: `FAILED: backtick path escapes skill root: \`${rel}\``,
      resolved,
    };
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    return {
      ok: false,
      code: 'MISSING',
      message: `FAILED: dead backtick reference: \`${rel}\``,
      resolved,
    };
  }
  return { ok: true, resolved };
}

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

function runEscapeProbe() {
  // Planted control: must fail with ESCAPES_SKILL_ROOT even if a file exists
  // at the escaped location (for example repo CLAUDE.md two levels up).
  const planted = 'references/../../CLAUDE.md';
  const result = checkBacktickTarget(SKILL, planted);
  if (result.ok || result.code !== 'ESCAPES_SKILL_ROOT') {
    console.log(
      `\nFAILED: escape probe did not reject ${planted} (got ${JSON.stringify(result)})`,
    );
    process.exit(1);
  }
  console.log(`escape probe: ${result.message}`);
  console.log(`escape probe resolved outside skill: ${result.resolved}`);
}

function main() {
  if (!existsSync(SKILL)) {
    console.log(`\nFAILED: missing skill dir ${SKILL}`);
    process.exit(1);
  }

  runEscapeProbe();
  runEscapeProbe();

  const files = walkMarkdown(SKILL);
  if (files.length === 0) {
    console.log('\nFAILED: scanned zero markdown files under testing-e2e');
    process.exit(1);
  }

  const dead = [];
  const escapes = [];
  let checked = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    let match;
    REF_RE.lastIndex = 0;
    while ((match = REF_RE.exec(text)) !== null) {
      checked += 1;
      const rel = match[1];
      const line = text.slice(0, match.index).split('\n').length;
      const result = checkBacktickTarget(SKILL, rel);
      if (result.ok) continue;
      const row = {
        file: relative(REPO, file),
        line,
        rel,
        message: result.message,
      };
      if (result.code === 'ESCAPES_SKILL_ROOT') escapes.push(row);
      else dead.push(row);
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

  if (escapes.length) {
    console.log(`\n== ESCAPING BACKTICK REFS (${escapes.length}) ==`);
    for (const d of escapes) {
      console.log(`   ${d.file}:${d.line}  ${d.message}`);
    }
    console.log(
      `\nFAILED: ${escapes.length} backtick path(s) escape the skill root`,
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
    'SUCCESS: every testing-e2e backtick references/ and rules/ path resolves inside the skill root',
  );
  process.exit(0);
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
