#!/usr/bin/env node
// collect-rules.mjs: gather the instruction files rule-check mode verifies a diff
// against, and print them as one JSON object for workflows/rule-check.js.
//
// Usage: node collect-rules.mjs [--repo DIR] [--home DIR] [--no-user]
//        [--standards (--default-branch NAME [--pr-base NAME] | --base-ref REF)]
//
//   --repo DIR   project root (default: the current directory)
//   --home DIR   home directory (default: $HOME); tests point it at a fixture
//   --no-user    project files only, skip ~/.claude
//   --standards  ONLY .github/review-standards.md (the review-only file
//                builders never load): no CLAUDE.md, no ~/.claude, no
//                @imports. It is read from --base-ref with `git show`, never
//                from the working tree: a PR must not rewrite the rules it is
//                checked against. No --base-ref, no file at that ref, or a
//                symlink there: no sources and a one-line `skip`.
//
// Sources, in the order Claude Code layers them for a session in DIR:
//   DIR/CLAUDE.md, DIR/.claude/CLAUDE.md, DIR/.claude/rules/**/*.md,
//   ~/.claude/CLAUDE.md, ~/.claude/rules/**/*.md
// plus every whole-line `@path` import inside them, one level deep (relative
// to the importing file, `~/` from home). A file reached twice is read once.
//
// Paths the reviewed PR controls are confined (see "Confinement" below): the
// repo's own CLAUDE.md files and rules are read only when their realpath is a
// .md inside the repo root, and so is an @import made from one of them; an
// @import made from ~/.claude/CLAUDE.md or ~/.claude/rules may also reach a .md
// inside ~/.claude (both roots realpath'd). ~/.claude/CLAUDE.md
// and ~/.claude/rules are exempt: they are the operator's, often symlinked into
// a dotfiles repo. A refused file is listed in `skipped` with a reason, and
// never opened:
//   missing         the target does not exist
//   outside-root    the target is outside every root allowed for it
//   symlink-escape  the path sits inside a root but its realpath leaves it
//   not-md          the target is not a .md file
//
// Prints {"sources":[{"path","text"}],"missing":[...],
//         "skipped":[{"import","from","reason"} | {"file","reason"}]}
// on stdout, exit 0.
// The workflow cannot read files (no fs in a Workflow script), so this is the
// only place rule files are read; splitting them into rules is the workflow's job.

import { execFileSync } from 'node:child_process';
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
const STANDARDS = argv.includes('--standards');
const STANDARDS_FILE = path.join('.github', 'review-standards.md');

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
//   - an @import may point anywhere. From a repo file it is followed only when
//     its realpath is a .md inside the repo root (a PR's CLAUDE.md must not pull
//     ~/.claude/projects/*/memory/*.md into a prompt, and rule text reaches the
//     review comment); from a ~/.claude file, inside the repo root or ~/.claude.
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

if (STANDARDS) {
  const done = (extra) => {
    process.stdout.write(`${JSON.stringify({ sources, missing, skipped, ...extra })}\n`);
    process.exit(0);
  };
  const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const BRANCH = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;
  // The rules come from the repo's DEFAULT branch, never the PR's base or head:
  // a PR author picks its base, so a base they control could carry weaker
  // rules (#4671 review). --default-branch wins over --base-ref.
  const def = opt('--default-branch');
  const prBase = opt('--pr-base');
  const notes = [];
  let ref = opt('--base-ref');
  // The HEAD check guards a caller-chosen --base-ref only. Under
  // --default-branch the ref IS the default branch, and a reviewer on a fresh
  // origin/<default> has HEAD equal to it: that is the normal case (#4671 F1).
  const fromDefault = def !== null;
  if (def !== null) {
    if (!BRANCH.test(def) || def.includes('..')) done({ skip: `standards pass skipped: --default-branch ${def} is not a branch name` });
    ref = `refs/remotes/origin/${def}`;
    if (prBase !== null && prBase !== def) notes.push(`standards read from the default branch ${def}, not the PR base ${prBase}`);
  }
  // Only a remote-tracking ref or a full commit SHA: no HEAD, @, ~ or ^ forms.
  if (ref && /^origin\/[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(ref)) ref = `refs/remotes/${ref}`;
  const okRef = ref && !ref.includes('..') && (/^refs\/remotes\/origin\/[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(ref) || /^[0-9a-f]{40}$/.test(ref));
  if (!okRef) done({ skip: 'standards pass skipped: the rules ref must be refs/remotes/origin/<branch> or a full commit SHA (never the PR head)' });
  // Resolve once; every later read uses this SHA, so the type check and the
  // content cannot come from two different commits.
  let sha = '';
  let head = '';
  try {
    sha = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    done({ skip: `standards pass skipped: ${ref} is not a commit in ${REPO}` });
  }
  try {
    head = git('rev-parse', '--verify', '--quiet', 'HEAD^{commit}');
  } catch {
    head = '';
  }
  if (!fromDefault && sha === head) done({ skip: `standards pass skipped: ${ref} is the checked-out head (${sha.slice(0, 12)}); the rules must come from the default branch` });
  // A shallow or partial clone can resolve the commit and still miss its
  // tree or blob: print the skip line, never a stack trace.
  let entry = '';
  try {
    entry = git('ls-tree', sha, '--', STANDARDS_FILE);
  } catch {
    done({ skip: `standards pass skipped: cannot read the tree of ${ref} (${sha.slice(0, 12)}) in ${REPO}; fetch it in full`, notes });
  }
  if (!entry) {
    missing.push(`${STANDARDS_FILE}@${ref}`);
    done({ skip: `standards pass skipped: ${REPO} has no ${STANDARDS_FILE} at ${ref}`, notes });
  }
  const [mode, type] = entry.split(/\s+/);
  if (type !== 'blob' || mode === '120000') {
    skipped.push({ file: `${STANDARDS_FILE}@${ref}`, reason: mode === '120000' ? 'symlink' : 'not-file' });
    done({ skip: `standards pass skipped: ${STANDARDS_FILE} at ${ref} is not a plain file`, notes });
  }
  let text = '';
  try {
    text = execFileSync('git', ['-C', REPO, 'show', `${sha}:${STANDARDS_FILE}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    done({ skip: `standards pass skipped: cannot read ${STANDARDS_FILE} at ${ref} (${sha.slice(0, 12)}) in ${REPO}; fetch it in full`, notes });
  }
  sources.push({ path: STANDARDS_FILE, ref, sha, text });
  done(notes.length ? { notes } : {});
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
    const reason = confine(target, confined ? REPO_ROOTS : IMPORT_ROOTS);
    if (reason) {
      skipped.push({ import: `@${ref}`, from: display(root), reason });
      continue;
    }
    read(target);
  }
}

process.stdout.write(`${JSON.stringify({ sources, missing, skipped })}\n`);
