#!/usr/bin/env node
/**
 * PreToolUse Bash guard for the careful skill.
 *
 * The skill registers this script from its frontmatter, so Claude Code runs it
 * on every Bash call for the rest of the session once careful is invoked. It
 * denies, with exit 2 and a stderr reason naming the rule:
 *
 *   rm-rf              rm with both recursive and force flags, unless every target is
 *                      strictly inside a temp dir ($TMPDIR, /tmp, the runtime tmpdir)
 *   git-push-force     git push --force, -f (alone or in a cluster), --force-with-lease, +refspec
 *   git-reset-hard     git reset --hard
 *   sql-drop           DROP TABLE, DROP DATABASE, DROP SCHEMA anywhere in the command text
 *   sql-truncate       TRUNCATE TABLE anywhere, or a bare TRUNCATE <name> statement
 *                      when a SQL client is named in the command
 *   kubectl-delete     kubectl ... delete
 *   terraform-destroy  terraform destroy, terraform apply -destroy
 *
 * Matching is on shell words, not substrings: quoted text is one word, so a
 * commit message or a grep pattern that mentions "git push --force" is not a
 * push. Compound commands are split on ; & | and newlines, and the bodies of
 * `bash -c`, `eval` and $( ) are checked too.
 *
 * Input that cannot be read fails closed (exit 2): a guard that cannot see the
 * command cannot say it is safe. Node stdlib only.
 *
 * Usage (as a hook): node careful-guard.mjs < PreToolUse-payload.json
 * Exit: 0 allow · 2 deny (reason on stderr)
 */
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
const SQL_CLIENT = /\b(psql|pgcli|mysql|mariadb|mycli|sqlite3|duckdb|clickhouse(-client)?|cockroach|sqlcmd|snowsql|usql)\b/i;
const MAX_DEPTH = 4;

/**
 * Split a command into segments of shell words. Quotes are removed from the
 * words they delimit; $( ) is kept whole inside its word so the caller can
 * see that a target is computed.
 */
export function tokenize(command) {
  const segments = [];
  let words = [];
  let word = '';
  let inWord = false;
  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) segments.push(words);
    words = [];
  };

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === '\\' && i + 1 < command.length) {
      if (command[i + 1] !== '\n') {
        word += command[i + 1];
        inWord = true;
      }
      i++;
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end === -1 ? command.length : end;
      word += command.slice(i + 1, stop);
      inWord = true;
      i = stop;
    } else if (c === '"') {
      inWord = true;
      let j = i + 1;
      while (j < command.length && command[j] !== '"') {
        if (command[j] === '\\' && j + 1 < command.length) {
          word += command[j + 1];
          j += 2;
        } else {
          word += command[j];
          j++;
        }
      }
      i = j;
    } else if (c === '$' && command[i + 1] === '(') {
      let depth = 0;
      let j = i + 1;
      for (; j < command.length; j++) {
        if (command[j] === '(') depth++;
        else if (command[j] === ')' && --depth === 0) break;
      }
      word += command.slice(i, j + 1);
      inWord = true;
      i = j;
    } else if (c === ' ' || c === '\t') {
      endWord();
    } else if (c === '\n' || c === ';' || c === '&' || c === '|' || c === '(' || c === ')') {
      endSegment();
    } else {
      word += c;
      inWord = true;
    }
  }
  endSegment();
  return segments;
}

const base = (w) => w.slice(w.lastIndexOf('/') + 1);
const isShortCluster = (w) => /^-[a-zA-Z]+$/.test(w);

function isTempTarget(target, tmpRoots) {
  if (target.includes('$(') || target.includes('`')) return false;
  if (target.split('/').includes('..')) return false;
  for (const root of tmpRoots) {
    const prefix = `${root.replace(/\/+$/, '')}/`;
    if (target.startsWith(prefix) && target.slice(prefix.length).replace(/\/+/g, '') !== '') {
      return true;
    }
  }
  return false;
}

function checkRm(args, tmpRoots) {
  let recursive = false;
  let force = false;
  const targets = [];
  let flagsDone = false;
  for (const a of args) {
    if (!flagsDone && a === '--') {
      flagsDone = true;
    } else if (!flagsDone && a === '--recursive') {
      recursive = true;
    } else if (!flagsDone && a === '--force') {
      force = true;
    } else if (!flagsDone && isShortCluster(a)) {
      if (/[rR]/.test(a)) recursive = true;
      if (a.includes('f')) force = true;
    } else if (!flagsDone && a.startsWith('--')) {
      // other long options (--verbose, --one-file-system) change nothing here
    } else {
      targets.push(a);
    }
  }
  if (!recursive || !force) return null;
  if (targets.length > 0 && targets.every((t) => isTempTarget(t, tmpRoots))) return null;
  return {
    rule: 'rm-rf',
    detail: targets.length > 0
      ? `recursive force delete of ${targets.join(' ')}`
      : 'recursive force delete with targets from stdin or none visible',
  };
}

const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix']);

function checkGit(args) {
  let j = 0;
  while (j < args.length && args[j].startsWith('-')) j += GIT_OPTS_WITH_VALUE.has(args[j]) ? 2 : 1;
  const sub = args[j];
  const rest = args.slice(j + 1);
  if (sub === 'push') {
    const forced = rest.find((a) =>
      a === '--force' ||
      a === '--force-with-lease' ||
      a.startsWith('--force-with-lease=') ||
      (isShortCluster(a) && a.includes('f')) ||
      (a.startsWith('+') && a.length > 1));
    if (forced) return { rule: 'git-push-force', detail: `git push with ${forced}` };
  }
  if (sub === 'reset' && rest.includes('--hard')) {
    return { rule: 'git-reset-hard', detail: 'git reset --hard discards uncommitted work' };
  }
  return null;
}

function checkSegment(words, tmpRoots, depth) {
  for (let i = 0; i < words.length; i++) {
    const cmd = base(words[i]);
    const args = words.slice(i + 1);
    let hit = null;
    if (cmd === 'rm') hit = checkRm(args, tmpRoots);
    else if (cmd === 'git') hit = checkGit(args);
    else if (cmd === 'kubectl' && args.includes('delete')) {
      hit = { rule: 'kubectl-delete', detail: 'kubectl delete removes cluster resources' };
    } else if (cmd === 'terraform' && (args.includes('destroy') ||
      (args.includes('apply') && (args.includes('-destroy') || args.includes('--destroy'))))) {
      hit = { rule: 'terraform-destroy', detail: 'terraform destroy tears down managed infrastructure' };
    } else if (SHELLS.has(cmd) && depth < MAX_DEPTH) {
      const c = args.findIndex((a) => isShortCluster(a) && a.includes('c'));
      if (c !== -1 && args[c + 1] !== undefined) hit = scan(args[c + 1], tmpRoots, depth + 1);
    } else if (cmd === 'eval' && depth < MAX_DEPTH) {
      hit = scan(args.join(' '), tmpRoots, depth + 1);
    }
    if (hit) return hit;
  }
  return null;
}

function checkSql(command) {
  const drop = command.match(/\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i);
  if (drop) return { rule: 'sql-drop', detail: `DROP ${drop[1].toUpperCase()}` };
  if (/\bTRUNCATE\s+TABLE\b/i.test(command) ||
    (SQL_CLIENT.test(command) && /(^|[;"'\n])\s*TRUNCATE\s+[A-Za-z_"`]/i.test(command))) {
    return { rule: 'sql-truncate', detail: 'TRUNCATE empties a table' };
  }
  return null;
}

function scan(command, tmpRoots, depth) {
  for (const words of tokenize(command)) {
    const hit = checkSegment(words, tmpRoots, depth);
    if (hit) return hit;
  }
  if (depth < MAX_DEPTH) {
    for (const m of command.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
      const hit = scan(m[1] ?? m[2] ?? '', tmpRoots, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Return the first destructive pattern in a Bash command, or null.
 * opts.tmpdir adds a runtime temp root (the hook passes $TMPDIR).
 */
export function findDestructive(command, opts = {}) {
  if (typeof command !== 'string' || command.trim() === '') return null;
  const tmpRoots = ['$TMPDIR', '${TMPDIR}', '/tmp', '/private/tmp', tmpdir()];
  if (opts.tmpdir) tmpRoots.push(opts.tmpdir);
  return checkSql(command) ?? scan(command, tmpRoots, 0);
}

export function denyMessage(hit) {
  return [
    `[ork:careful] blocked by rule ${hit.rule}: ${hit.detail}.`,
    'careful mode is on for this session, so destructive commands do not run unattended.',
    'To proceed, ask the operator: they can run the command themselves, or confirm it and run it outside careful mode.',
    'Do not rephrase the command to get past this guard.',
  ].join('\n');
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch (err) {
    process.stderr.write(`[ork:careful] could not read the hook input (${err.message}); blocking because the command cannot be checked.\n`);
    return 2;
  }
  if (payload?.tool_name !== 'Bash') return 0;
  const hit = findDestructive(payload.tool_input?.command, { tmpdir: process.env.TMPDIR });
  if (!hit) return 0;
  process.stderr.write(`${denyMessage(hit)}\n`);
  return 2;
}

function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = main();
