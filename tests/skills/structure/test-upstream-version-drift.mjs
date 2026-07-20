#!/usr/bin/env node
// ============================================================================
// Body-Version-Drift Linter  (issue #2599)
// ============================================================================
// WHAT IT GUARDS
//   The `labs-version-watch` bot (scripts/check-labs-versions.mjs --apply) only
//   rewrites the `upstream-version-tested:` frontmatter PIN. It never touches a
//   skill's BODY prose or its `description:` frontmatter line. So after a bump,
//   the pin says e.g. agent-browser 0.29.1 while the body still claims 0.27 /
//   0.29.x — silent rot that ships stale instructions to users.
//
//   This linter FAILS CI when a skill's highest body/description version token
//   is BEHIND its own `upstream-version-tested:` pin. It is the back-half of the
//   pair: check-labs-versions.mjs watches the PIN (does it match npm latest?);
//   THIS watches the BODY (did the prose catch up to the pin?).
//
// ALGORITHM (see issue #2599 for the canonical spec)
//   - For each <dir>/*/SKILL.md, split frontmatter (between the first two `---`).
//   - Read the `upstream-version-tested:` pin from the frontmatter; skip if absent.
//   - scanText = the `description:` line value + the entire body.
//   - Extract 0-major version tokens (/\bv?0\.(\d+)(?:\.(\d+|x))?/g). Scoping to
//     the 0.x scheme avoids false matches on Node 24, CC 2.1.x, skill version
//     1.x, "12.9K", etc. — all four currently tracked packages are 0-major.
//   - If the body's semver-max token is BELOW the pin -> FAIL (stale body).
//   - No tokens / no pin -> skip (a body that makes no version claim isn't stale).
//
// USAGE
//   node tests/skills/structure/test-upstream-version-drift.mjs
//   node tests/skills/structure/test-upstream-version-drift.mjs --dir <path>
//   Exit 0 = all pass, exit 1 = at least one stale body.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/skills/structure -> repo root is two levels up.
const REPO_ROOT = join(__dirname, '..', '..', '..');

// ----------------------------------------------------------------------------
// CLI: optional `--dir <path>`, default <repoRoot>/src/skills
// ----------------------------------------------------------------------------
function parseDir(argv) {
  const i = argv.indexOf('--dir');
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return join(REPO_ROOT, 'src', 'skills');
}

const SKILLS_DIR = parseDir(process.argv.slice(2));

// ----------------------------------------------------------------------------
// Glob every <dir>/*/SKILL.md (one level deep)
// ----------------------------------------------------------------------------
function findSkillFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(dir, entry.name, 'SKILL.md');
    try {
      if (statSync(candidate).isFile()) files.push(candidate);
    } catch {
      // no SKILL.md in this directory — skip
    }
  }
  return files.sort();
}

// ----------------------------------------------------------------------------
// Frontmatter split: text between the first `---` line and the next `---` line.
// Body = everything after the closing `---`.
// ----------------------------------------------------------------------------
function splitFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') {
    return { frontmatter: '', body: text };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { frontmatter: lines.slice(1).join('\n'), body: '' };
  }
  return {
    frontmatter: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n'),
  };
}

// ----------------------------------------------------------------------------
// Version helpers — scoped to the 0.x scheme.
// ----------------------------------------------------------------------------
const TOKEN_RE = /\bv?0\.(\d+)(?:\.(\d+|x))?/g;

function tokensFrom(scanText) {
  const out = [];
  for (const m of scanText.matchAll(TOKEN_RE)) {
    const minor = Number(m[1]);
    const g2 = m[2];
    // A `.x` or omitted patch is patch-AGNOSTIC: `0.29.x` means "any 0.29
    // patch", so it must satisfy a `0.29.1` pin. Track whether the patch was
    // an explicit number so the comparison can relax patch precision.
    const hasPatch = g2 !== undefined && g2 !== 'x';
    const patch = hasPatch ? Number(g2) : 0;
    out.push({ major: 0, minor, patch, hasPatch });
  }
  return out;
}

// Numeric (major, minor, patch) comparison. Returns -1 / 0 / 1.
function cmp(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

function maxOf(versions) {
  return versions.reduce((best, v) => (cmp(v, best) > 0 ? v : best));
}

// Is the body stale relative to the pin? The body SATISFIES the pin when it
// mentions a version that COVERS it:
//   - a higher minor anywhere       -> satisfied
//   - the pin's minor, patch-agnostic (`0.29.x` / `0.29`) -> satisfied (covers any patch)
//   - the pin's minor with an explicit patch >= pin.patch -> satisfied
// Minor/major drift always fails; only PATCH precision is relaxed for `.x`.
function isStale(tokens, pin) {
  const sameMajor = tokens.filter((t) => t.major === pin.major);
  if (sameMajor.length === 0) return false; // no comparable token -> no claim
  const maxMinor = Math.max(...sameMajor.map((t) => t.minor));
  if (maxMinor > pin.minor) return false; // body mentions a higher minor
  if (maxMinor < pin.minor) return true; // body never reaches the pin's minor
  // maxMinor === pin.minor: a patch-agnostic token covers any patch.
  const atMinor = sameMajor.filter((t) => t.minor === pin.minor);
  if (atMinor.some((t) => !t.hasPatch)) return false;
  return Math.max(...atMinor.map((t) => t.patch)) < pin.patch;
}

// Parse the `upstream-version-tested:` pin into {major,minor,patch}.
// Missing patch -> 0.
function parsePin(pinStr) {
  const m = pinStr.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] === undefined ? 0 : Number(m[3]),
  };
}

// ----------------------------------------------------------------------------
// Header
// ----------------------------------------------------------------------------
console.log('============================================================================');
console.log('  Upstream Body-Version-Drift Linter');
console.log('============================================================================');
console.log('');
console.log(`Skills directory: ${SKILLS_DIR}`);
console.log('Complements scripts/check-labs-versions.mjs (which only watches the pin).');
console.log('');

// ----------------------------------------------------------------------------
// Scan
// ----------------------------------------------------------------------------
const skillFiles = findSkillFiles(SKILLS_DIR);

let passCount = 0;
let failCount = 0;
const failures = [];

for (const file of skillFiles) {
  const skillName = basename(dirname(file));
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const { frontmatter, body } = splitFrontmatter(text);

  // (b) pin — required. Absent -> skip (nothing to check).
  const pinMatch = frontmatter.match(
    /^\s*upstream-version-tested:\s*["']?(\d+\.\d+(?:\.\d+)?)["']?\s*$/m,
  );
  if (!pinMatch) continue;
  const pinStr = pinMatch[1];
  const pin = parsePin(pinStr);
  if (!pin) continue;

  // (c) pkg label — report only.
  const pkgMatch =
    frontmatter.match(/^\s*upstream-package:\s*["']?([^"'\n]+?)["']?\s*$/m) ||
    frontmatter.match(/^\s*upstream-skill:\s*["']?([^"'\n]+?)["']?\s*$/m);
  const pkg = pkgMatch ? pkgMatch[1].trim() : 'unknown';

  // (d) scanText = description: line value + entire body.
  const descMatch = frontmatter.match(/^\s*description:\s*(.+)$/m);
  const descValue = descMatch ? descMatch[1] : '';
  const scanText = `${descValue}\n${body}`;

  // (e) extract 0.x tokens.
  const tokens = tokensFrom(scanText);

  // (f) zero tokens -> skip (no version claim made).
  if (tokens.length === 0) {
    passCount++;
    continue;
  }

  // (g) body max (for the report) + (i) staleness decision (patch-aware).
  const maxBody = maxOf(tokens);

  if (isStale(tokens, pin)) {
    failCount++;
    failures.push(
      `${skillName}: body tops out at 0.${maxBody.minor}.${maxBody.patch} ` +
        `but upstream-version-tested pin is ${pinStr} (${pkg}) — ` +
        `body is stale, update the body to mention the pinned version`,
    );
  } else {
    passCount++;
  }
}

// ----------------------------------------------------------------------------
// Report
// ----------------------------------------------------------------------------
if (failures.length > 0) {
  console.log('Stale skill bodies (body version is behind the upstream pin):');
  console.log('────────────────────────────────────────────────────────────────────────────');
  for (const line of failures) {
    console.log(`  FAIL  ${line}`);
  }
  console.log('');
}

console.log('============================================================================');
console.log(`  Passed: ${passCount}  Failed: ${failCount}`);
console.log('============================================================================');

if (failCount > 0) {
  console.log('FAILED: at least one skill body lags its upstream-version-tested pin');
  process.exit(1);
} else {
  console.log('SUCCESS: all pinned skill bodies are current with their upstream pin');
  process.exit(0);
}
