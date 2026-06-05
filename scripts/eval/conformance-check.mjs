#!/usr/bin/env node
/**
 * CC-idiom conformance grader (#2193, Eval v2 #156).
 *
 * Scans skill + agent docs for stale Claude Code idioms that drift out of date
 * as CC advances. Deliberately HIGH-PRECISION (few, real findings) over recall:
 *
 *   C1  stale model-ID     — Opus 4.6-and-older used as a CURRENT model in bodies
 *                            (scans SKILL.md + agents/*.md only — references/ carry
 *                            intentional historical model mentions)
 *   C2  hook-count drift   — a hardcoded "N hooks" disagreeing with hooks.json
 *                            (scans SKILL.md + every skill references/*.md + agents)
 *
 * Explicitly does NOT check CC-version *annotations* like "(CC 2.1.76)" — those
 * document when a feature landed and are the CORRECT idiom, not drift. An earlier
 * floor-drift check was removed: it produced 160 false positives because feature
 * provenance annotations are indistinguishable by regex from stale requirements.
 * Floor *consistency* (frontmatter `compatibility:`) is already enforced by
 * tests/manifests/test-cc-version-floor.sh — this grader does not duplicate it.
 *
 * Advisory by default (exit 0, WARN only). CONFORMANCE_STRICT=1 → exit 1 on any
 * finding (for a future blocking gate, once signal quality is trusted).
 *
 * No external deps. No network. No gh. Deterministic.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS_DIR = join(ROOT, 'src', 'skills');
const AGENTS_DIR = join(ROOT, 'src', 'agents');
const STALE_OPUS_MAX = 6; // flag Opus 4.6 and older (4.7 is one-back; too historical to flag)

function realHookCount() {
  try {
    return (readFileSync(join(ROOT, 'src', 'hooks', 'hooks.json'), 'utf8').match(/"type"\s*:/g) || []).length || null;
  } catch { return null; }
}
const HOOK_COUNT = realHookCount();

// ── File enumeration ──────────────────────────────────────────────────────
function walkMd(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
}
function targets() {
  const out = [];
  if (existsSync(SKILLS_DIR)) {
    for (const d of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const primary = join(SKILLS_DIR, d.name, 'SKILL.md');
      const all = [];
      walkMd(join(SKILLS_DIR, d.name), all);
      for (const p of all) {
        out.push({ kind: 'skill', name: d.name, path: p, primary: p === primary });
      }
    }
  }
  if (existsSync(AGENTS_DIR)) {
    for (const f of readdirSync(AGENTS_DIR)) {
      if (f.endsWith('.md') && f !== 'README.md') {
        out.push({ kind: 'agent', name: f.replace(/\.md$/, ''), path: join(AGENTS_DIR, f), primary: true });
      }
    }
  }
  return out;
}

function stripFrontmatter(raw) {
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const after = raw.indexOf('\n', end + 1);
      const head = raw.slice(0, after + 1).split('\n').length - 1;
      return { body: raw.slice(after + 1), offset: head };
    }
  }
  return { body: raw, offset: 0 };
}

function isHistoricalContext(line) {
  const l = line.toLowerCase();
  return (
    l.includes('http://') || l.includes('https://') ||
    l.includes('noreply@anthropic.com') ||
    /4\.[0-9]\+/.test(line) ||                                   // "4.6+" floor form
    /\b\d+\s*[x×]\b/i.test(line) || /[x×]\s*opus/i.test(line) || // "3× Opus 4.6"
    /\b(previously|was |formerly|migrat|deprecat|no longer|renamed|→|->|vs\.?|compared|introduced in|since cc|added in|default on)\b/i.test(l) ||
    /\bhistor/i.test(l)
  );
}

// ── Scan ──────────────────────────────────────────────────────────────────
const findings = [];
const add = (check, t, lineno, message) =>
  findings.push({ check, severity: 'warn', kind: t.kind, name: t.name, file: t.path.replace(ROOT + '/', ''), line: lineno, message });

const all = targets();
for (const t of all) {
  const { body, offset } = stripFrontmatter(readFileSync(t.path, 'utf8'));
  let inFence = false;
  body.split('\n').forEach((line, i) => {
    const lineno = offset + i + 1;
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }

    // C1 — stale model-ID, primary docs only (SKILL.md + agents)
    if (t.primary) {
      const m = line.match(/\bclaude-opus-4-([0-9])\b/i) || line.match(/\bOpus 4\.([0-9])\b/);
      if (m && Number(m[1]) <= STALE_OPUS_MAX && !isHistoricalContext(line)) {
        add('C1-model-id', t, lineno,
          `references Opus 4.${m[1]} as a current model (>=2 generations behind); bump to the current model or mark as historical`);
      }
    }

    // C2 — hook-count drift vs hooks.json (prose only), all docs.
    // Requires OrchestKit-hook context so React/library "N hooks" don't false-positive.
    if (!inFence && HOOK_COUNT && !/\breact\b/i.test(line)) {
      const orkHookContext =
        /global hooks?|orchestkit|hooks?\.json|hook entries|hooks? across|across \d+ event|event types|\d+\s+skills?,?\s+\d+\s+agents?/i.test(line);
      const m = line.match(/\b(\d{2,3})\s+(?:global\s+)?hooks?\b/i);
      if (orkHookContext && m && Number(m[1]) !== HOOK_COUNT &&
          !/~|about|roughly|approx|planned|future|up to|last release|added|removed/i.test(line)) {
        add('C2-hook-count', t, lineno, `states "${m[1]} hooks" but hooks.json has ${HOOK_COUNT}`);
      }
    }

    // C3 — install-path portability: absolute /Users/ paths or hardcoded
    // plugins/ork/skills/<name>/ (should be ${CLAUDE_SKILL_DIR} same-skill /
    // ${CLAUDE_PLUGIN_ROOT} cross-skill). Skips the *-glob and already-portable lines.
    // /Users/<real-name>/ is a non-portable author path; placeholder usernames
    // (foo/dev/john/me/you/…) and docs-about-paths are illustrative — skip them.
    const PLACEHOLDER = /\/Users\/(foo|bar|baz|john|jane|dev|me|you|user|username|alice|bob|example|test)\b/i;
    if (!/\$\{CLAUDE_(SKILL_DIR|PLUGIN_ROOT)\}/.test(line)) {
      // case-SENSITIVE: /Users/ is the macOS home dir; /users/ is a REST resource path (not a bug)
      if (/\/Users\/[A-Za-z0-9._-]+\//.test(line) && !PLACEHOLDER.test(line)) {
        add('C3-install-path', t, lineno, 'absolute /Users/ path — non-portable; use ${CLAUDE_SKILL_DIR}/${CLAUDE_PLUGIN_ROOT} (or ~ for home paths)');
      } else if (/plugins\/ork\/skills\/[a-z0-9-]+\//i.test(line) && !/plugins\/ork\/skills\/\*/.test(line)) {
        add('C3-install-path', t, lineno, 'hardcoded plugins/ork/skills/<name>/ path — use ${CLAUDE_SKILL_DIR} (same-skill) or ${CLAUDE_PLUGIN_ROOT}/skills (cross-skill)');
      }
    }
  });
}

// ── Output ──────────────────────────────────────────────────────────────────
const byCheck = findings.reduce((a, f) => ((a[f.check] = (a[f.check] || 0) + 1), a), {});
const result = {
  generated_for: 'cc-idiom-conformance (#2193)',
  real_hook_count: HOOK_COUNT,
  scanned_files: all.length,
  total_findings: findings.length,
  by_check: byCheck,
  findings,
};
const outDir = join(ROOT, 'tests', 'evaluations', 'results');
try { mkdirSync(outDir, { recursive: true }); } catch {}
writeFileSync(join(outDir, 'conformance.json'), JSON.stringify(result, null, 2) + '\n');

const log = (s) => process.stderr.write(s + '\n');
log(`CC-idiom conformance — scanned ${all.length} docs · ${HOOK_COUNT} hooks (hooks.json)`);
if (!findings.length) {
  log('✓ No stale-idiom drift detected.');
} else {
  log(`⚠ ${findings.length} advisory finding(s):`);
  for (const [c, n] of Object.entries(byCheck)) log(`  ${c}: ${n}`);
  for (const f of findings) log(`  [${f.check}] ${f.file}:${f.line} — ${f.message}`);
}
process.exit(process.env.CONFORMANCE_STRICT === '1' && findings.length ? 1 : 0);
