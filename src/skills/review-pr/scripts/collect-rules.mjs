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
// Paths the reviewed PR controls are confined (see "Confinement" below): the
// repo's own CLAUDE.md files and rules are read only when their realpath is a
// .md inside the repo root, and an @import only when its realpath is a .md
// inside the repo root or ~/.claude (both roots realpath'd). ~/.claude/CLAUDE.md
// and ~/.claude/rules are exempt: they are the operator's, often symlinked into
// a dotfiles repo. A refused file is listed in `skipped` with a reason, and
// never opened:
//   missing         the target does not exist
//   outside-root    the target is outside both roots
//   symlink-escape  the path sits inside a root but its realpath leaves it
//   not-md          the target is not a .md file
//
// Prints {"sources":[{"path","text"}],"missing":[...],
//         "skipped":[{"import","from","reason"} | {"file","reason"}]}
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

// Every .md under dir, symlinks included (a symlinked file is listed by its
// in-tree path; whether it may be READ is decided by the caller). Directories
// are walked once by realpath, so a symlink loop terminates. With `fence` set,
// a symlinked directory whose realpath leaves the fence is not walked at all
// (a PR could point .claude/rules/x at /), it is reported in `refused`.
function mdUnder(dir, fence = null, refused = [], walked = new Set()) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const real = realpathSync(dir);
  if (walked.has(real)) return [];
  walked.add(real);
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    const isDir = e.isDirectory() || (e.isSymbolicLink() && existsSync(p) && statSync(p).isDirectory());
    if (isDir) {
      if (fence && !fence.some((r) => under(realpathSync(p), r.real))) refused.push(p);
      else out.push(...mdUnder(p, fence, refused, walked));
    } else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Confinement. Rule-check runs on other people's pull requests, so every file
// the PR controls is untrusted as a PATH, not only as text:
//   - the repo's own CLAUDE.md, .claude/CLAUDE.md and .claude/rules/** may be
//     symlinks committed by the PR; each is read only when its realpath is a
//     .md inside the repo root;
//   - an @import may point anywhere; it is followed only when its realpath is a
//     .md inside the repo root or inside ~/.claude.
// ~/.claude/CLAUDE.md and ~/.claude/rules/** are the operator's own files and
// often symlinks into a dotfiles repo, so they are exempt (never PR-controlled).
// A refused file is listed in `skipped` with a reason and never opened.
const realOrSelf = (p) => (existsSync(p) ? realpathSync(p) : p);
const rootOf = (r) => ({ lexical: r, real: realOrSelf(r) });
const REPO_ROOTS = [rootOf(REPO)];
const IMPORT_ROOTS = [rootOf(REPO), rootOf(path.join(HOME, '.claude'))];
const under = (p, root) => p === root || p.startsWith(root + path.sep);

function confine(target, roots) {
  if (!existsSync(target)) return 'missing';
  const real = realpathSync(target);
  if (!roots.some((r) => under(real, r.real))) {
    return roots.some((r) => under(target, r.lexical) || under(target, r.real)) ? 'symlink-escape' : 'outside-root';
  }
  if (!real.endsWith('.md') || !statSync(real).isFile()) return 'not-md';
  return null;
}

const sources = [];
const missing = [];
const skipped = [];
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

// [path, confined to the repo root?]; absent top-level CLAUDE.md files are normal.
const refusedDirs = [];
const roots = [
  ...[path.join(REPO, 'CLAUDE.md'), path.join(REPO, '.claude', 'CLAUDE.md')].filter((p) => existsSync(p)).map((p) => [p, true]),
  ...mdUnder(path.join(REPO, '.claude', 'rules'), REPO_ROOTS, refusedDirs).map((p) => [p, true]),
];
for (const d of refusedDirs) skipped.push({ file: display(d), reason: 'symlink-escape' });
if (USER) {
  const home = path.join(HOME, '.claude', 'CLAUDE.md');
  if (existsSync(home)) roots.push([home, false]);
  roots.push(...mdUnder(path.join(HOME, '.claude', 'rules')).map((p) => [p, false]));
}

for (const [root, confined] of roots) {
  const why = confined ? confine(root, REPO_ROOTS) : null;
  if (why) {
    skipped.push({ file: display(root), reason: why });
    continue;
  }
  const text = read(root);
  if (text === null) continue;
  for (const m of text.matchAll(/^@(\S+)\s*$/gm)) {
    const ref = m[1];
    const target = ref.startsWith('~/') ? path.join(HOME, ref.slice(2)) : path.resolve(path.dirname(root), ref);
    const reason = confine(target, IMPORT_ROOTS);
    if (reason) {
      skipped.push({ import: `@${ref}`, from: display(root), reason });
      continue;
    }
    read(target);
  }
}

process.stdout.write(`${JSON.stringify({ sources, missing, skipped })}\n`);
