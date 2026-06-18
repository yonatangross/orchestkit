#!/usr/bin/env node
/**
 * gen-release-notes.mjs
 *
 * Grep-only generator: turn a snapshotted upstream Claude Code changelog
 * (shared/cc-snapshots/<version>.md, written by cc-release-watch.mjs) into the
 * RELEASE.items[] data the #2516 release-notes player consumes.
 *
 * Usage:
 *   node scripts/gen-release-notes.mjs [version]   # default: highest 2.1.x snapshot
 *   node scripts/gen-release-notes.mjs 2.1.179
 *
 * Output: RELEASE JSON on stdout. NO LLM, NO network — pure deterministic
 * mapping (aligns with the repo's no-LLM-in-cheap-paths stance). impact.lines
 * are emitted as TODO placeholders ON PURPOSE: the raw CC bullets are too terse
 * to fabricate benefit prose from — a human writes those editorially.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP_DIR = resolve(ROOT, 'shared/cc-snapshots');

// ── tag inference: leading verb / keyword → category (deterministic) ──
// Order matters: first match wins. Severity is presence-based ('high' only).
const RULES = [
  { tag: 'breaking',    sev: 'high', re: /\bBREAKING\b|^Removed\b|^Remove\b|no longer supported/i },
  { tag: 'adoption',    sev: 'high', re: /now requires|you must|requires? (you|a |an )|upgrade to|migrat/i },
  { tag: 'deprecation', sev: null,   re: /\bdeprecat/i },
  { tag: 'feat',        sev: null,   re: /^Added\b|^New\b|^Introduce|^Support(s|ed)? |now lets you|you can now/i },
  { tag: 'perf',        sev: null,   re: /^Improved\b|^Improve\b|performance|faster|reduce[sd]? |optimi[sz]/i },
  { tag: 'fix',         sev: null,   re: /^Fixed\b|^Fix\b|regression|no longer (gets|shows|stuck)/i },
];
const TAG_LABEL = { feat: 'Feature', fix: 'Fix', perf: 'Perf', breaking: 'Breaking', adoption: 'Adoption', deprecation: 'Deprecated' };
// headliner-first: the player sorts by this so ▶ play opens on what matters most
const LANE_ORDER = { breaking: 0, adoption: 1, feat: 2, perf: 3, deprecation: 4, fix: 5 };

function classify(bullet) {
  for (const r of RULES) if (r.re.test(bullet)) return { tag: r.tag, sev: r.sev };
  return { tag: 'feat', sev: null }; // conservative fallback
}

// title = leading clause, trimmed; strip the leading verb so titles read cleanly
function toTitle(bullet) {
  let t = bullet.replace(/^(Fixed|Fix|Added|Improved|Improve|Changed|Updated|Removed|Introduced?|Support(s|ed)?)\s+/i, '');
  t = t.split(/[:;—]| - | so | by | instead| that | which | when /)[0].trim();
  if (t.length > 64) t = t.slice(0, 61).replace(/\s\S*$/, '') + '…';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function pickVersion(arg) {
  if (arg) return arg;
  const versions = readdirSync(SNAP_DIR)
    .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return versions[versions.length - 1];
}

function main() {
  const version = pickVersion(process.argv[2]);
  const md = readFileSync(resolve(SNAP_DIR, `${version}.md`), 'utf8');
  const title = (md.match(/^#\s*(.+)$/m) || [, `Claude Code ${version}`])[1].trim();
  const captured = (md.match(/^Captured:\s*(.+)$/m) || [, ''])[1].trim();

  const items = md
    .split('\n')
    .filter((l) => /^\s*-\s+/.test(l))
    .map((l) => l.replace(/^\s*-\s+/, '').trim())
    .filter(Boolean)
    .map((bullet) => {
      const { tag, sev } = classify(bullet);
      const item = {
        tag,
        tagLabel: TAG_LABEL[tag],
        title: toTitle(bullet),
        what: bullet,
        impact: { kind: 'note', lines: ['TODO: editorial — write the one-line "why it matters" benefit'] },
      };
      if (sev) item.sev = sev; // presence-based, optional
      return item;
    })
    .sort((a, b) => (LANE_ORDER[a.tag] - LANE_ORDER[b.tag]) || 0);

  const RELEASE = { product: title, version, captured, items };
  process.stdout.write(JSON.stringify(RELEASE, null, 2) + '\n');
}

main();
