#!/usr/bin/env node
/**
 * sessions-under: list the sessions that ran under one rule version or one
 * OrchestKit version, read only.
 *
 *   node sessions-under.mjs <rules_hash | hash prefix (8+ hex) | ork_version> [--db <path>] [--json]
 *
 * Prints start, end, status, repo, branch, worktree, session id, ork_version
 * and rules_hash per session, oldest first, then a count line. After a rule
 * rollback this is the list of sessions, branches and worktrees to re-check.
 *
 * Guarantees:
 *   - Read only: the DB is opened with readOnly, no migration runs, nothing is
 *     written. A DB that predates migration 006 is an explicit error, not an
 *     empty result.
 *   - Never a silent empty answer: zero matches prints a line to stderr and
 *     exits 1, so a script cannot read "nothing ran under it" from a typo.
 *
 * Exit codes: 0 one or more sessions, 1 none matched, 2 usage or DB error.
 * Plain ESM with no imports from src/: it runs from the shipped plugin as is.
 */

import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Default registry path, same resolution as src/lib/session-registry.ts. */
export function defaultDbPath() {
  if (process.env.ORK_SESSION_DB) return process.env.ORK_SESSION_DB;
  const home = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(home, '.local', 'state', 'orchestkit', 'sessions.db');
}

/** Columns a 006+ sessions table has; the query needs every one. */
const REQUIRED_COLUMNS = ['sid', 'repo_path', 'branch', 'worktree_path', 'started_at', 'ended_at', 'status', 'ork_version', 'rules_hash'];

/**
 * Sessions whose rules_hash or ork_version equals `key`, or whose rules_hash
 * starts with `key` when it is 8 or more hex characters. Oldest first.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} key
 */
export function findSessionsUnder(db, key) {
  const cols = db.prepare('PRAGMA table_info(sessions)').all().map(c => String(c.name));
  if (cols.length === 0) throw new Error('no sessions table in this DB');
  const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c));
  if (missing.length > 0) {
    throw new Error(`sessions table lacks ${missing.join(', ')} (DB predates migration 006; start one session to migrate it)`);
  }
  const prefix = /^[0-9a-f]{8,63}$/.test(key) ? `${key}%` : null;
  return db
    .prepare(
      `SELECT sid, repo_path, branch, worktree_path, started_at, ended_at, status, ork_version, rules_hash
       FROM sessions
       WHERE rules_hash = @key OR ork_version = @key OR (@prefix IS NOT NULL AND rules_hash LIKE @prefix)
       ORDER BY started_at ASC, sid ASC`,
    )
    .all({ key, prefix });
}

function iso(sec) {
  return sec == null ? '-' : new Date(Number(sec) * 1000).toISOString().replace('.000Z', 'Z');
}

/** One tab-separated line per session. */
export function formatRow(r) {
  return [
    iso(r.started_at),
    r.ended_at == null ? '-' : iso(r.ended_at),
    r.status,
    r.repo_path,
    r.branch ?? '-',
    r.worktree_path ?? '-',
    String(r.sid).slice(0, 8),
    r.ork_version ?? 'NULL',
    r.rules_hash == null ? 'NULL' : String(r.rules_hash).slice(0, 12),
  ].join('\t');
}

const HEADER = ['started', 'ended', 'status', 'repo', 'branch', 'worktree', 'sid', 'ork_version', 'rules_hash'].join('\t');

/**
 * CLI body. Returns the exit code; writes through the given streams.
 * @param {string[]} argv arguments after the script path
 */
export function main(argv, out = process.stdout, err = process.stderr) {
  let dbPath = defaultDbPath();
  let json = false;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') {
      const v = argv[++i];
      if (!v) {
        err.write('sessions-under: --db needs a path\n');
        return 2;
      }
      dbPath = v;
    } else if (a === '--json') json = true;
    else if (a === '-h' || a === '--help') {
      out.write('usage: sessions-under <rules_hash | hash prefix (8+ hex) | ork_version> [--db <path>] [--json]\n');
      return 0;
    } else positional.push(a);
  }
  const key = (positional[0] ?? '').trim();
  if (!key || positional.length > 1) {
    err.write('usage: sessions-under <rules_hash | hash prefix (8+ hex) | ork_version> [--db <path>] [--json]\n');
    return 2;
  }
  if (!existsSync(dbPath)) {
    err.write(`sessions-under: no session DB at ${dbPath}\n`);
    return 2;
  }

  let db;
  let rows;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(dbPath, { readOnly: true });
    rows = findSessionsUnder(db, key);
  } catch (e) {
    err.write(`sessions-under: ${e instanceof Error ? e.message : String(e)} (${dbPath})\n`);
    return 2;
  } finally {
    try {
      db?.close();
    } catch {
      /* closing a read-only handle cannot lose data */
    }
  }

  if (rows.length === 0) {
    err.write(`sessions-under: 0 sessions match ${key} in ${dbPath}\n`);
    return 1;
  }
  if (json) {
    out.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    out.write(`${HEADER}\n`);
    for (const r of rows) out.write(`${formatRow(r)}\n`);
    out.write(`${rows.length} session(s) under ${key}\n`);
  }
  return 0;
}

// Run when executed directly (realpath on both sides: a symlinked plugin path
// must still match, #5004).
const self = fileURLToPath(import.meta.url);
let invoked = '';
try {
  invoked = process.argv[1] ? realpathSync(process.argv[1]) : '';
} catch {
  invoked = '';
}
if (invoked && invoked === realpathSync(self)) {
  process.exitCode = main(process.argv.slice(2));
}
