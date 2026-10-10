#!/usr/bin/env node
// post-review.mjs: the only command /ork:review-pr may use to write to GitHub (#4675).
//
//   node post-review.mjs --pr <n|url> --body-file <path>
//        [--kind review|comment] [--event approve|request-changes|comment]
//        [--post] [--post-verdict]
//
// Refuses (exit 2, gh never runs):
//   - without --post. The skill passes --post only when the user typed it.
//   - when any line of the body is verdict-shaped (LAND, HOLD,
//     XREVIEW, also behind markdown emphasis, a heading or a quote) and
//     --post-verdict is absent.
//   - when --body-file is not a regular file under a system temp dir after
//     symlinks resolve, is over 64 KB, or holds a secret shape. A repo file
//     such as .env or a key file is never posted. The roots are fixed: no
//     environment variable (TMPDIR, CLAUDE_JOB_DIR) can widen them.
// The checked bytes go to gh on stdin (--body-file -), so gh never re-reads
// a path that could change after the checks.
//   - for --event approve without --post-verdict: an approval is a verdict.
//   - when the body file has a second hard link, or the opened file is not
//     the file the checked path names (dev and inode differ), so a link to a
//     file outside the temp root, or a swapped parent dir, is never posted.
// Exit 1 is a usage error, also for a flag given twice. The skill's PreToolUse gate (skill/review-post-gate)
// also checks that the user typed the flags this call passes.

import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const EVENTS = { approve: '--approve', 'request-changes': '--request-changes', comment: '--comment' };
// The verdict line rule, structural (product-11 HOLD 6099340056, codex22
// XREVIEW 6099321110). Each line (split on \n and \r) is first made to read as
// it renders: NFKC (fullwidth letters become ASCII), format characters dropped
// (zero-width space, soft hyphen), HTML tags dropped, and Cyrillic and Greek
// look-alike letters folded to Latin. Then it is a verdict line when LAND, HOLD
// or XREVIEW in capitals stands anywhere as a word, or when land, hold or
// xreview in any case is one of its first four words. A word is a run of
// letters, so list markers, pipes, emphasis, digits and emoji never count.
// Prose refused by design: "hold on, one nit", "Hold-out set", "Land access".
const VERDICT_WORDS = new Set(['land', 'hold', 'xreview']);
const LOOKALIKE = {
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'і': 'i', 'ԁ': 'd', 'һ': 'h', 'ѵ': 'v', 'ԝ': 'w',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X',
  'ο': 'o', 'ν': 'v',
};
const folded = (line) =>
  line
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[Ͱ-ϿЀ-ԯ]/g, (c) => LOOKALIKE[c] ?? c);
// Both views count: with HTML tags (a < or </ then a letter) dropped, as a page
// renders them, and with every character kept, so a bare "a < HOLD > b" whose
// brackets are not a tag still reads as a verdict.
const views = (line) => {
  const t = folded(line);
  return [t, t.replace(/<\/?[A-Za-z][^>]*>/g, '')];
};
const CAPS_ANYWHERE = /(?<!\p{L})(?:LAND|HOLD|XREVIEW)(?!\p{L})/u;
const verdictIn = (t) =>
  CAPS_ANYWHERE.test(t) ||
  t
    .split(/[^\p{L}]+/u)
    .filter((w) => w !== '')
    .slice(0, 4)
    .some((w) => VERDICT_WORDS.has(w.toLowerCase()));
const isVerdictLine = (line) => views(line).some(verdictIn);
const MAX_BODY_BYTES = 65536; // GitHub's own body limit is 65,536 characters
const SECRET_SHAPES = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
];

function usage(msg) {
  process.stderr.write(`post-review: ${msg}\n`);
  process.exit(1);
}
function refuse(msg) {
  process.stderr.write(`post-review: REFUSED: ${msg}\n`);
  process.exit(2);
}

const opts = { kind: 'review', event: 'comment', post: false, postVerdict: false };
const argv = process.argv.slice(2);
const given = new Set();
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  // One value per flag: the gate reads the first, so a second could differ.
  if (a.startsWith('--')) {
    if (given.has(a)) usage(`${a} is given twice`);
    given.add(a);
  }
  const val = () => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) usage(`${a} needs a value`);
    i += 1;
    return v;
  };
  if (a === '--pr') opts.pr = val();
  else if (a === '--body-file') opts.bodyFile = val();
  else if (a === '--kind') opts.kind = val();
  else if (a === '--event') opts.event = val();
  else if (a === '--post') opts.post = true;
  else if (a === '--post-verdict') opts.postVerdict = true;
  else usage(`unknown argument ${a}`);
}

if (!opts.pr) usage('--pr is required');
// gh takes --pr as written, so only a number or a full github.com pull URL.
// gh resolves a bare number against the cwd's repo; the gate checks the PR
// equals what the user typed and, for a number, that the shell is at the
// session project root.
if (!/^\d+$/.test(opts.pr) && !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/.test(opts.pr)) {
  usage(`--pr must be a PR number or a https://github.com/<owner>/<repo>/pull/<n> URL, not ${opts.pr}`);
}
if (!opts.bodyFile) usage('--body-file is required');
if (opts.kind !== 'review' && opts.kind !== 'comment') usage(`--kind must be review or comment, not ${opts.kind}`);
if (!Object.hasOwn(EVENTS, opts.event)) usage(`--event must be one of ${Object.keys(EVENTS).join(', ')}, not ${opts.event}`);

// Fixed roots, never read from the environment. macOS keeps the per-user
// temp dir under /private/var/folders/<x>/<y>/T.
const FIXED_ROOTS = ['/tmp', '/var/tmp'].flatMap((d) => {
  try {
    return [realpathSync(d)];
  } catch {
    return [];
  }
});
const inRoot = (p) => FIXED_ROOTS.some((r) => p.startsWith(r + path.sep)) || /^\/private\/var\/folders\/[^/]+\/[^/]+\/T\//.test(p);

let body;
let real;
let isFile = false;
let size = 0;
let links = 1;
let sameInode = false;
try {
  real = realpathSync(opts.bodyFile);
  // One descriptor for the type, size and bytes: no second lookup of the path.
  const fd = openSync(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const st = fstatSync(fd);
    isFile = st.isFile();
    size = st.size;
    links = st.nlink;
    const byPath = statSync(real);
    sameInode = byPath.dev === st.dev && byPath.ino === st.ino && realpathSync(opts.bodyFile) === real;
    if (isFile && size <= MAX_BODY_BYTES) body = readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
} catch (err) {
  usage(`cannot read --body-file ${opts.bodyFile}: ${err.code ?? err.message}`);
}

// Nothing may point gh at another repo than the PR form names.
for (const v of ['GH_REPO', 'GH_HOST', 'GH_ENTERPRISE_TOKEN']) {
  if (process.env[v]) refuse(`${v} is set; post-review.mjs posts to the current repo only.`);
}

if (!opts.post) {
  refuse('no --post. /ork:review-pr never posts unless the user typed --post. Print the review instead.');
}

if (!inRoot(real)) {
  refuse(`--body-file must be a file under a system temp dir (/tmp, /var/tmp or the macOS per-user T dir); ${real} is not. Write the review there first.`);
}
if (!isFile) refuse('--body-file is not a regular file.');
if (links !== 1) refuse('--body-file has another hard link; write a new file under the temp dir.');
if (!sameInode) refuse('--body-file changed while it was checked; write a new file and post again.');
if (size > MAX_BODY_BYTES) refuse(`--body-file is over ${MAX_BODY_BYTES} bytes.`);
if (SECRET_SHAPES.some((re) => re.test(body))) refuse('--body-file holds a secret-shaped value (token, key or private key). Nothing was posted.');

// Every line counts, with any leading marks, emoji or markdown taken off: a
// verdict word below a summary line or behind an emoji is still a verdict
// (HOLD 6097900519 should 4).
const bare = (body.split(/\r\n|\r|\n/).find(isVerdictLine) ?? '').trim();
if (opts.kind === 'review' && (opts.event === 'approve' || opts.event === 'request-changes') && !opts.postVerdict) {
  refuse(`a ${opts.event} review is a verdict. That needs --post-verdict typed by the user.`);
}
if (bare !== '' && !opts.postVerdict) {
  refuse(`a line is verdict-shaped ("${bare.slice(0, 40)}"). That needs --post-verdict typed by the user.`);
}

const args =
  opts.kind === 'review'
    ? ['pr', 'review', opts.pr, EVENTS[opts.event], '--body-file', '-']
    : ['pr', 'comment', opts.pr, '--body-file', '-'];

try {
  execFileSync('gh', args, { input: body, stdio: ['pipe', 'inherit', 'inherit'] });
} catch (err) {
  process.stderr.write(`post-review: gh failed (exit ${err.status ?? '?'})\n`);
  process.exit(err.status || 1);
}
