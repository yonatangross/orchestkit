#!/usr/bin/env node
// scripts/check-skill-delta.mjs: grade skill sub-files on "wrap + our delta"
//
// Usage:
//   node scripts/check-skill-delta.mjs                     # report, exit 0
//   node scripts/check-skill-delta.mjs --check             # ratchet vs baseline, exit 1 on regression
//   node scripts/check-skill-delta.mjs --update-baseline   # regenerate baseline (only when findings genuinely resolved)
//   node scripts/check-skill-delta.mjs --skill <name>      # scoped report for one skill (swarm agents use this)
//   node scripts/check-skill-delta.mjs --json              # machine-readable output
//
// THREE CHECKS, ALL $0 (no network, no LLM, node stdlib only):
//
//   [ORPHAN]      a non-SKILL.md file whose stem appears nowhere else across
//                 src/** + manifests/** (md/json/ts). Nothing can navigate to it;
//                 it ships in plugins/ as dead weight. LENIENT by design: any stem
//                 echo anywhere counts as linked, so this is a LOWER bound.
//
//   [RESTATEMENT] a file > RESTATE_MIN_LINES with ZERO ork anchors (repo paths,
//                 issue #s, milestone ids, our tool names). Validated 2026-07-31:
//                 the proxy over-flags small scaffolding (_template.md), which is
//                 why the line threshold exists; the line-weighted mass it flags is
//                 genuine upstream restatement (measured 72% of non-SKILL.md lines).
//
//   [OVERLAP]     a file matching a FIRST_PARTY registry topic while exceeding that
//                 entry's oursMax. The vendor now ships this content as a skill;
//                 ours should shrink to floors + scars + a pointer.
//
// RATCHET CONTRACT (same as route-check.mjs / test-targets-floor-agreement.mjs):
// baseline commits today's counts; --check fails only on INCREASE. Pre-existing
// findings never redden an unrelated PR, and the number can only be driven down.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';
import { FIRST_PARTY } from './lib/first-party-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'tests', 'skills', 'structure', 'skill-delta-baseline.json');

const RESTATE_MIN_LINES = 150;

// VENDORED FILES ARE EXEMPT.
// references/upstream*.md are not ours to thin: scripts/sync-vercel-skills.sh fetches them
// verbatim from upstream and build-plugins.sh step 7.5 + tests/skills/test-upstream-refs.sh
// require them present. They are restatement BY DESIGN, and they carry no ork anchors, so
// without this exemption the gate reports them forever and actively pushes a thinning agent
// to delete them. That happened: wave 2 removed 8 vendored files and broke the sync check.
//
// HONEST SCOPE (corrected 2026-07-31 after /ork:assess): the exemption is carried by the
// FILENAME CONVENTION regex below, which alone would have prevented every wave-2 deletion.
// The mapping.json-derived set is a weaker secondary check: it stores bare filenames and
// matches with endsWith, with no binding to the mapping's target_skill, so it does NOT
// make this "the same mapping enforcing the rule twice". It is redundancy, not proof.
// Tightening it to (target_skill, ref_filename) pairs is the real fix if the naming
// convention ever slips.
function loadVendoredPaths() {
  const mappingPath = join(ROOT, 'vendor', 'vercel-skills', 'mapping.json');
  const out = new Set();
  if (!existsSync(mappingPath)) return out;
  try {
    const m = JSON.parse(readFileSync(mappingPath, 'utf8'));
    const walkVal = (v) => {
      if (typeof v === 'string') {
        if (/\.md$/.test(v)) out.add(v.replace(/^\.\//, ''));
      } else if (Array.isArray(v)) v.forEach(walkVal);
      else if (v && typeof v === 'object') Object.values(v).forEach(walkVal);
    };
    walkVal(m);
  } catch {
    // A malformed mapping must not silently disable the exemption; fall back to the
    // filename convention the sync script itself documents (references/upstream-*.md).
  }
  return out;
}
const VENDORED = loadVendoredPaths();
const isVendored = (rel) =>
  /(^|\/)references\/upstream[^/]*\.md$/.test(rel) ||
  [...VENDORED].some((v) => rel.endsWith(v));

// Anchors that can only originate from this repo / operator. A file with zero of
// these across >150 lines is teaching upstream's product, not our use of it.
const ORK_ANCHOR = new RegExp(
  [
    'ork:',
    'CLAUDE_PLUGIN_ROOT',
    'CLAUDE_SKILL_DIR',
    '[Oo]rchest[Kk]it',
    'src/(hooks|skills|agents)',
    'manifests/',
    'hooks\\.json',
    '#\\d{3,4}\\b',
    '\\bM1\\d{2}\\b',
    'hq-ext',
    '[Yy]onatan',
    '\\.claude/',
    'bin/validate',
    'tests/evals',
    'playground-visual-standard',
    'anti-sycophancy',
  ].join('|')
);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const mode = has('--update-baseline') ? 'update' : has('--check') ? 'check' : 'report';
const onlySkill = argOf('--skill');
const asJson = has('--json');

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// ---------------------------------------------------------------------------
// Collect: subject files (skill sub-files) + haystack (everything linkable)
// ---------------------------------------------------------------------------
const skillsDir = join(ROOT, 'src', 'skills');
const subjects = []; // { path, rel, skill, bucket, lines, content }
for (const dirent of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!dirent.isDirectory() || dirent.name === 'shared') continue;
  const skillPath = join(skillsDir, dirent.name);
  if (!existsSync(join(skillPath, 'SKILL.md'))) continue;
  for (const p of walk(skillPath)) {
    if (!p.endsWith('.md') || basename(p) === 'SKILL.md') continue;
    const rel = relative(ROOT, p);
    if (isVendored(rel)) continue; // vendored upstream copy, not ours to thin
    const bucket = relative(skillPath, p).split('/')[0];
    const content = readFileSync(p, 'utf8');
    subjects.push({
      path: p,
      rel,
      skill: dirent.name,
      bucket,
      lines: content.split('\n').length,
      content,
    });
  }
}

// The haystack MUST include tests/ and bin/. A skill file named in a test contract is
// referenced, not orphaned. Scanning only src/ + manifests/ reported three EXPECTED_SCRIPTS
// entries (tests/skills/scripts/test-specific-skills.sh) as orphans, and thinning agents duly
// deleted them, turning that suite red. Same failure shape as the vendored-file exemption:
// the gate must see every consumer, or it recommends deleting live contracts.
const haystack = []; // { path, content }
for (const top of ['src', 'manifests', 'tests', 'bin']) {
  const d = join(ROOT, top);
  if (!existsSync(d)) continue;
  for (const p of walk(d)) {
    if (!/\.(md|json|ts|sh|mjs|js)$/.test(p)) continue;
    haystack.push({ path: p, content: readFileSync(p, 'utf8') });
  }
}

// ---------------------------------------------------------------------------
// [ORPHAN]: unresolved-set sweep: one pass over the haystack, each file only
// checks stems still unresolved, so cost collapses as links are found.
// ---------------------------------------------------------------------------
const stemOf = (s) => basename(s.path, '.md');
const unresolved = new Map(); // stem -> Set(subject paths)
for (const s of subjects) {
  if (!unresolved.has(stemOf(s))) unresolved.set(stemOf(s), new Set());
  unresolved.get(stemOf(s)).add(s.path);
}
const linkedStems = new Set();
for (const h of haystack) {
  if (linkedStems.size === unresolved.size) break;
  for (const [stem, owners] of unresolved) {
    if (linkedStems.has(stem)) continue;
    // a hit inside any file OWNING this stem is self-reference, not a link
    if (owners.has(h.path)) continue;
    if (!h.content.includes(stem)) continue;
    linkedStems.add(stem);
  }
}
const orphans = subjects.filter((s) => !linkedStems.has(stemOf(s)));

// ---------------------------------------------------------------------------
// [RESTATEMENT] + [OVERLAP]
// ---------------------------------------------------------------------------
const restatements = subjects.filter(
  (s) => s.lines > RESTATE_MIN_LINES && !ORK_ANCHOR.test(s.content)
);
const overlaps = [];
for (const s of subjects) {
  for (const e of FIRST_PARTY) {
    if (e.pathPattern.test(s.rel) && s.lines > e.oursMax) {
      overlaps.push({ ...s, topic: e.topic, firstParty: e.firstParty, oursMax: e.oursMax });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const scope = (list) => (onlySkill ? list.filter((s) => s.skill === onlySkill) : list);
const sum = (list) => list.reduce((a, s) => a + s.lines, 0);
const counts = {
  orphanFiles: orphans.length,
  orphanLines: sum(orphans),
  restatementFiles: restatements.length,
  restatementLines: sum(restatements),
  overlapFiles: overlaps.length,
};

if (asJson) {
  const out = {
    counts,
    orphans: scope(orphans).map((s) => ({ file: s.rel, lines: s.lines })),
    restatements: scope(restatements).map((s) => ({ file: s.rel, lines: s.lines })),
    overlaps: scope(overlaps).map((s) => ({
      file: s.rel, lines: s.lines, topic: s.topic, firstParty: s.firstParty, oursMax: s.oursMax,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
} else {
  const show = (title, list, fmt) => {
    console.log(`\n== ${title} (${list.length}${onlySkill ? `, skill=${onlySkill}` : ''}) ==`);
    for (const s of list.slice().sort((a, b) => b.lines - a.lines).slice(0, has('--all') ? Infinity : 15)) {
      console.log(fmt(s));
    }
    if (!has('--all') && list.length > 15) console.log(`   ... ${list.length - 15} more (--all to list)`);
  };
  console.log('==========================================');
  console.log('  skill-delta: wrap + our delta, graded');
  console.log('==========================================');
  console.log(`  subjects scanned : ${subjects.length} files (non-SKILL.md under src/skills)`);
  console.log(`  ORPHAN           : ${counts.orphanFiles} files / ${counts.orphanLines} lines`);
  console.log(`  RESTATEMENT      : ${counts.restatementFiles} files / ${counts.restatementLines} lines (>${RESTATE_MIN_LINES} ln, 0 anchors)`);
  console.log(`  OVERLAP          : ${counts.overlapFiles} files (first-party skill exists)`);
  show('ORPHAN', scope(orphans), (s) => `   ${String(s.lines).padStart(5)}  ${s.rel}`);
  show('RESTATEMENT', scope(restatements), (s) => `   ${String(s.lines).padStart(5)}  ${s.rel}`);
  show('OVERLAP', scope(overlaps), (s) => `   ${String(s.lines).padStart(5)}  ${s.rel}  -> ${s.firstParty}`);
}

// ---------------------------------------------------------------------------
// Ratchet
// ---------------------------------------------------------------------------
if (mode === 'update') {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ note: 'Ratchet baseline for check-skill-delta.mjs: counts may only decrease. Regenerate with --update-baseline only when findings are genuinely resolved.', ...counts }, null, 2) + '\n'
  );
  console.log(`\nbaseline written: ${relative(ROOT, BASELINE_PATH)}`);
} else if (mode === 'check') {
  if (!existsSync(BASELINE_PATH)) {
    console.error('\nFAIL: no baseline. Run --update-baseline once and commit it.');
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const regressions = [];
  for (const k of ['orphanFiles', 'restatementFiles', 'overlapFiles']) {
    if (counts[k] > base[k]) regressions.push(`${k}: ${base[k]} -> ${counts[k]}`);
  }
  if (regressions.length) {
    console.error(`\nFAIL: skill-delta regression: ${regressions.join(', ')}`);
    console.error('New restated/orphaned content was added. Link it, thin it, or (only if genuinely resolved elsewhere) --update-baseline.');
    process.exit(1);
  }
  const improved = ['orphanFiles', 'restatementFiles', 'overlapFiles']
    .filter((k) => counts[k] < base[k])
    .map((k) => `${k}: ${base[k]} -> ${counts[k]}`);
  console.log(
    improved.length
      ? `\nPASS (improved: run --update-baseline: ${improved.join(', ')})`
      : '\nPASS: at baseline.'
  );
}
