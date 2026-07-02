#!/usr/bin/env node
/**
 * check-docs-facts.mjs — fail CI when hand-written docs pages state a Claude Code
 * floor or a component-count triple that contradicts the repo's ground truth.
 *
 * Why: the build-drift gate only covers GENERATED paths (content/docs/reference,
 * content/docs/skills/by-category). Hand-written pages hard-coding facts rot
 * silently across releases (observed: floor 2.1.148 advertised 10 days after the
 * 2.1.183 bump). Pages should prefer <Count k="..."/> / <MinCC /> from
 * @/components/count; this gate catches the literals that remain (frontmatter,
 * code blocks, future additions).
 *
 * Scope: docs/site/content/docs/**\/*.mdx excluding generated paths.
 * Escape hatch: lines containing "docs-facts-ignore" are skipped.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs/site/content/docs');
const EXCLUDE = [
  path.join(DOCS, 'reference'),
  path.join(DOCS, 'skills/by-category'),
];

// ── Ground truth ────────────────────────────────────────────────────────────
const floor = JSON.parse(
  readFileSync(path.join(ROOT, 'shared/cc-support.json'), 'utf8'),
).supported_floor;

// Skills = dirs containing a SKILL.md (src/skills/shared/ is not a skill)
const skills = readdirSync(path.join(ROOT, 'src/skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(path.join(ROOT, 'src/skills', d.name, 'SKILL.md')))
  .length;

// Agents = definition files only (README.md is not an agent)
const agents = readdirSync(path.join(ROOT, 'src/agents'))
  .filter((f) => f.endsWith('.md') && f !== 'README.md').length;

const hooksDesc = JSON.parse(
  readFileSync(path.join(ROOT, 'src/hooks/hooks.json'), 'utf8'),
).description;
const hooksMatch = hooksDesc.match(/=\s*(\d+)\s+total hooks/);
if (!hooksMatch) {
  console.error('check-docs-facts: cannot parse hook total from hooks.json description');
  process.exit(1);
}
const hooks = Number(hooksMatch[1]);

// ── Checks ──────────────────────────────────────────────────────────────────
// Floor-claim shapes; every captured 2.x.x version must equal the floor.
const FLOOR_PATTERNS = [
  /(?:>=|≥)\s*(2\.\d+\.\d+)/g,
  /Claude Code (2\.\d+\.\d+) or later/g,
  /below (2\.\d+\.\d+)/g,
];
// "N skills, M agents[, and K hooks]" is always a totals claim.
const TRIPLE = /(\d+)\s+skills?,\s*(\d+)\s+agents?(?:,\s*(?:and\s+)?(\d+)\s+hooks?)?/g;

function* mdxFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUDE.includes(p)) continue;
    if (e.isDirectory()) yield* mdxFiles(p);
    else if (e.name.endsWith('.mdx')) yield p;
  }
}

let errors = 0;
for (const file of mdxFiles(DOCS)) {
  const rel = path.relative(ROOT, file);
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('docs-facts-ignore')) return;
    for (const pat of FLOOR_PATTERNS) {
      pat.lastIndex = 0;
      for (const m of line.matchAll(pat)) {
        if (m[1] !== floor) {
          console.error(`${rel}:${i + 1} states CC version ${m[1]} — supported floor is ${floor}`);
          errors++;
        }
      }
    }
    TRIPLE.lastIndex = 0;
    for (const m of line.matchAll(TRIPLE)) {
      const [s, a] = [Number(m[1]), Number(m[2])];
      const h = m[3] === undefined ? null : Number(m[3]);
      if (s !== skills || a !== agents || (h !== null && h !== hooks)) {
        console.error(`${rel}:${i + 1} states "${m[0]}" — actual: ${skills} skills, ${agents} agents, ${hooks} hooks`);
        errors++;
      }
    }
  });
}

if (errors) {
  console.error(`check-docs-facts: ${errors} stale fact(s). Fix the value, use <Count k="..."/> / <MinCC />, or mark the line with docs-facts-ignore.`);
  process.exit(1);
}
console.log(`check-docs-facts: OK (floor ${floor}, ${skills} skills, ${agents} agents, ${hooks} hooks)`);
