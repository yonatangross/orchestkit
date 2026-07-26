#!/usr/bin/env node
/**
 * Two skills must not declare different floors for the same library.
 *
 * WHY THIS EXISTS
 *
 * LangGraph once carried four different floors across four files (>=1.2.0 in
 * targets:, then 1.1, 1.0.6+ and 1.0 in prose). Nothing detected it.
 * `check-labs-versions.mjs` compares a pin against real UPSTREAM, and
 * `test-upstream-version-drift.mjs` compares a skill's prose against its OWN
 * pin. Neither compares two skills to each other.
 *
 * WHY THIS CHECKS ONLY `targets:` FRONTMATTER
 *
 * A first attempt scanned prose for "Lib N.N" and reported four divergent
 * libraries. Every single one was legitimate:
 *
 *   "[Playwright 1.58 Release Notes](...)"          a link to release notes
 *   "type-aware rules (Biome 2.0+)"                 feature landed in 2.0
 *   "halfvec (pgvector 0.7+)"                       feature landed in 0.7
 *   "MessageGraph is deprecated in LangGraph v1.0.0" deprecation history
 *
 * A lexical scan cannot separate "requires >= X" from "feature Y landed in X",
 * and a gate with that precision would either cry wolf or need its findings
 * baselined away as noise, which is the theatre this repo has been removing.
 *
 * `targets:` frontmatter is machine-readable and unambiguous: it is a declared
 * floor and nothing else. Two skills declaring different floors for one library
 * is always a defect, so this is a HARD gate at zero rather than a ratchet.
 *
 * Deterministic, no LLM calls, no network.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILLS = join(ROOT, 'src', 'skills');

/** Pull the `targets:` block out of YAML frontmatter, then its library/version pairs. */
function declaredTargets(md) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!fm) return [];
  const block = /^targets:\s*\n((?:[ \t]+.*\n)+)/m.exec(fm[1]);
  if (!block) return [];
  const out = [];
  const re = /-\s*library:\s*"?([A-Za-z0-9@/._-]+)"?\s*\n\s*version:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block[1])) !== null) out.push({ library: m[1].toLowerCase(), version: m[2] });
  return out;
}

const byLibrary = new Map();
for (const dir of readdirSync(SKILLS, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const p = join(SKILLS, dir.name, 'SKILL.md');
  if (!existsSync(p)) continue;
  for (const { library, version } of declaredTargets(readFileSync(p, 'utf8'))) {
    if (!byLibrary.has(library)) byLibrary.set(library, []);
    byLibrary.get(library).push({ version, skill: dir.name });
  }
}

const shared = [...byLibrary.entries()].filter(([, d]) => new Set(d.map(x => x.skill)).size > 1);
const conflicts = shared.filter(([, d]) => new Set(d.map(x => x.version)).size > 1);

console.log('==========================================');
console.log('  targets: floor agreement');
console.log('==========================================\n');
console.log(`  libraries with a declared floor : ${byLibrary.size}`);
console.log(`  declared by more than one skill : ${shared.length}`);
console.log(`  conflicting floors              : ${conflicts.length}\n`);

for (const [lib, decls] of shared) {
  const versions = [...new Set(decls.map(d => d.version))];
  const mark = versions.length > 1 ? '\x1b[0;31mCONFLICT\x1b[0m' : '\x1b[0;36mok      \x1b[0m';
  console.log(`  ${mark} ${lib.padEnd(20)} ${decls.map(d => `${d.version} (${d.skill})`).join('  |  ')}`);
}

if (conflicts.length > 0) {
  console.log('\n\x1b[0;31mFAIL: one library, two declared floors.\x1b[0m');
  console.log('  A reader following either skill gets a different answer.');
  console.log('  Align them on the higher floor, or split the dependency if the');
  console.log('  skills genuinely target different major lines.');
  process.exit(1);
}

console.log('\n\x1b[0;32mPASS: every shared library declares one floor.\x1b[0m');
