import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { sessionRegistrar } from '../lifecycle/session-registrar.js';
import { sessionFinalizer } from '../lifecycle/session-finalizer.js';
import { heartbeat, __internals as heartbeatInternals } from '../posttool/heartbeat.js';
import { openDb, __resetDbForTests } from '../lib/session-registry.js';
import { NOOP_CTX } from '../lib/context.js';
import type { HookInput } from '../types.js';

describe('State machine regression: sessions.db lifecycle transitions', () => {
  let workDir: string;
  let dbPath: string;
  let prevDbEnv: string | undefined;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'ork-sm-session-db-'));
    dbPath = join(workDir, 'sessions.db');
    prevDbEnv = process.env.ORK_SESSION_DB;
    process.env.ORK_SESSION_DB = dbPath;
    __resetDbForTests();
    heartbeatInternals.lastBeat.clear();
  });

  afterEach(() => {
    __resetDbForTests();
    heartbeatInternals.lastBeat.clear();
    if (prevDbEnv === undefined) delete process.env.ORK_SESSION_DB;
    else process.env.ORK_SESSION_DB = prevDbEnv;
    rmSync(workDir, { recursive: true, force: true });
  });

  it('resuming a completed session clears ended_at so running and later crashed rows do not carry a stale ended_at', () => {
    const sid = 'sess-resume-1';
    sessionRegistrar(
      {
        hook_event: 'SessionStart',
        tool_name: '',
        session_id: sid,
        tool_input: {},
        project_dir: workDir,
      } as HookInput,
      NOOP_CTX,
    );
    __resetDbForTests();

    sessionFinalizer(
      {
        hook_event: 'SessionEnd',
        tool_name: '',
        session_id: sid,
        tool_input: {},
        project_dir: workDir,
      } as HookInput,
      NOOP_CTX,
    );
    __resetDbForTests();

    // Verify completed state has ended_at set
    const db1 = new DatabaseSync(dbPath, { readOnly: true });
    const completedRow = db1
      .prepare('SELECT status, ended_at FROM sessions WHERE sid = ?')
      .get(sid) as { status: string; ended_at: number | null };
    db1.close();
    expect(completedRow.status).toBe('completed');
    expect(completedRow.ended_at).not.toBeNull();

    // Resume the same session via SessionStart
    sessionRegistrar(
      {
        hook_event: 'SessionStart',
        tool_name: '',
        session_id: sid,
        tool_input: {},
        project_dir: workDir,
      } as HookInput,
      NOOP_CTX,
    );
    __resetDbForTests();

    const db2 = new DatabaseSync(dbPath, { readOnly: true });
    const resumedRow = db2
      .prepare('SELECT status, ended_at FROM sessions WHERE sid = ?')
      .get(sid) as { status: string; ended_at: number | null };
    db2.close();
    expect(resumedRow.status).toBe('running');
    expect(resumedRow.ended_at).toBeNull();
  });

  it('heartbeat recovers a swept crashed session (ended_at IS NULL) back to running when tool activity resumes', () => {
    const sid = 'sess-idle-swept';
    const db = openDb();
    const stale = Math.floor(Date.now() / 1000) - 90_000;
    db.prepare(
      `INSERT INTO sessions (sid, pid, cwd, repo_hash, repo_path, started_at, last_heartbeat, status, ended_at)
       VALUES (?, 1, ?, 'h', ?, ?, ?, 'crashed', NULL)`,
    ).run(sid, workDir, workDir, stale, stale);
    db.close();
    __resetDbForTests();

    heartbeat(
      {
        hook_event: 'PostToolUse',
        tool_name: 'Read',
        session_id: sid,
        tool_input: {},
      } as HookInput,
      NOOP_CTX,
    );

    const dbRO = new DatabaseSync(dbPath, { readOnly: true });
    const row = dbRO
      .prepare('SELECT status, last_heartbeat, ended_at FROM sessions WHERE sid = ?')
      .get(sid) as { status: string; last_heartbeat: number; ended_at: number | null };
    dbRO.close();
    expect(row.status).toBe('running');
    expect(row.last_heartbeat).toBeGreaterThan(stale);
    expect(row.ended_at).toBeNull();
  });

  it('heartbeat does not advance last_heartbeat past ended_at on a completed session', () => {
    const sid = 'sess-already-completed';
    const endedAt = Math.floor(Date.now() / 1000) - 60;
    const db = openDb();
    db.prepare(
      `INSERT INTO sessions (sid, pid, cwd, repo_hash, repo_path, started_at, last_heartbeat, status, ended_at)
       VALUES (?, 1, ?, 'h', ?, ?, ?, 'completed', ?)`,
    ).run(sid, workDir, workDir, endedAt - 100, endedAt, endedAt);
    db.close();
    __resetDbForTests();

    heartbeat(
      {
        hook_event: 'PostToolUse',
        tool_name: 'Read',
        session_id: sid,
        tool_input: {},
      } as HookInput,
      NOOP_CTX,
    );

    const dbRO = new DatabaseSync(dbPath, { readOnly: true });
    const row = dbRO
      .prepare('SELECT status, last_heartbeat, ended_at FROM sessions WHERE sid = ?')
      .get(sid) as { status: string; last_heartbeat: number; ended_at: number | null };
    dbRO.close();
    expect(row.status).toBe('completed');
    expect(row.last_heartbeat).toBe(endedAt);
    expect(row.ended_at).toBe(endedAt);
  });
});
