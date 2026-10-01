#!/usr/bin/env node
// collect-rules.mjs: gather the instruction files rule-check mode verifies a diff
// against, and print them as one JSON object for workflows/rule-check.js.
//
// Usage: node collect-rules.mjs [--repo DIR] [--home DIR] [--no-user]
//
//   --repo DIR   project root (default: the current directory)
//   --home DIR   home directory (default: $HOME); tests point it at a fixture
//   --no-user    project files only, skip ~/.claude
//
// Sources, in the order Claude Code layers them for a session in DIR:
//   DIR/CLAUDE.md, DIR/.claude/CLAUDE.md, DIR/.claude/rules/**/*.md,
//   ~/.claude/CLAUDE.md, ~/.claude/rules/**/*.md
// plus every whole-line `@path` import inside them, one level deep (relative
// to the importing file, `~/` from home). A file reached twice is read once.
//
// Imports are confined. Rule-check runs on other people's pull requests, and an
// import is plain text in a CLAUDE.md the PR may have written, so following
// `@../../<a credential file>` would put it into every verifier prompt. An
// import is followed ONLY when its realpath is a .md file inside the repo root
// or inside ~/.claude (both roots realpath'd too). Everything else is listed in
// `skipped` with a reason, and never opened:
//   missing         the target does not exist
//   outside-root    the target is outside both roots
//   symlink-escape  the path sits inside a root but its realpath leaves it
//   not-md          the target is not a .md file
//
// Prints {"sources":[{"path","text"}],"missing":[...],"skipped":[{"import","from","reason"}]}
// on stdout, exit 0.
// The workflow cannot read files (no fs in a Workflow script), so this is the
// only place rule files are read; splitting them into rules is the workflow's job.

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const REPO = path.resolve(opt('--repo') || process.cwd());
const HOME = path.resolve(opt('--home') || process.env.HOME || homedir());
const USER = !argv.includes('--no-user');

const display = (p) => {
  if (p.startsWith(REPO + path.sep)) return path.relative(REPO, p);
  if (p.startsWith(HOME + path.sep)) return `~/${path.relative(HOME, p)}`;
  return p;
};

function mdUnder(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdUnder(p));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const roots = [path.join(REPO, 'CLAUDE.md'), path.join(REPO, '.claude', 'CLAUDE.md'), ...mdUnder(path.join(REPO, '.claude', 'rules'))];
if (USER) roots.push(path.join(HOME, '.claude', 'CLAUDE.md'), ...mdUnder(path.join(HOME, '.claude', 'rules')));

const sources = [];
const missing = [];
const seen = new Set();

function read(p) {
  if (!existsSync(p) || !statSync(p).isFile()) {
    missing.push(display(p));
    return null;
  }
  const real = realpathSync(p);
  if (seen.has(real)) return null;
  seen.add(real);
  const text = readFileSync(p, 'utf8');
  sources.push({ path: display(p), text });
  return text;
}

// Import confinement roots: lexical (for display and the symlink check) and real.
const realOrSelf = (p) => (existsSync(p) ? realpathSync(p) : p);
const ROOTS = [REPO, path.join(HOME, '.claude')].map((r) => ({ lexical: r, real: realOrSelf(r) }));
const under = (p, root) => p === root || p.startsWith(root + path.sep);
const skipped = [];

function importVerdict(target) {
  if (!existsSync(target)) return 'missing';
  const real = realpathSync(target);
  if (!ROOTS.some((r) => under(real, r.real))) {
    return ROOTS.some((r) => under(target, r.lexical) || under(target, r.real)) ? 'symlink-escape' : 'outside-root';
  }
  if (!real.endsWith('.md') || !statSync(real).isFile()) return 'not-md';
  return null;
}

const OPTIONAL = new Set([path.join(REPO, 'CLAUDE.md'), path.join(REPO, '.claude', 'CLAUDE.md'), path.join(HOME, '.claude', 'CLAUDE.md')]);
for (const root of roots) {
  if (OPTIONAL.has(root) && !existsSync(root)) continue; // absent top-level files are normal, not missing
  const text = read(root);
  if (text === null) continue;
  for (const m of text.matchAll(/^@(\S+)\s*$/gm)) {
    const ref = m[1];
    const target = ref.startsWith('~/') ? path.join(HOME, ref.slice(2)) : path.resolve(path.dirname(root), ref);
    const reason = importVerdict(target);
    if (reason) {
      skipped.push({ import: `@${ref}`, from: display(root), reason });
      continue;
    }
    read(target);
  }
}

process.stdout.write(`${JSON.stringify({ sources, missing, skipped })}\n`);
