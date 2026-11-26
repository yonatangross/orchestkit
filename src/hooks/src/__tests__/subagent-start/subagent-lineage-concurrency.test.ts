/**
 * #5464 review (Codex HOLD at b70727d2): overlapping SubagentStart hooks.
 *
 * Real filesystem, no fs mock. Each validator call below runs while the
 * previous one's start row is still pending, which is the state Codex
 * reproduced with two Node processes that had both returned but neither
 * exited (the start row was buffered until process exit). Each pretool
 * intent must be consumed at most once, and one agent_id gets one start row.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// vitest.setup.ts makes bufferWrite append at once, which hides the race. In
// production a buffered row reaches disk only when the hook process exits, so
// this file restores a real deferred buffer: rows land on flush() only.
vi.mock('../../lib/analytics-buffer.js', () => {
  const pending: Array<[string, string]> = [];
  return {
    bufferWrite: (filePath: string, content: string) => {
      pending.push([filePath, content]);
    },
    flush: () => {
      for (const [p, c] of pending.splice(0)) appendFileSync(p, c);
    },
    pendingCount: () => pending.length,
    _resetForTesting: () => {
      pending.length = 0;
    },
  };
});

import { subagentValidator } from '../../subagent-start/subagent-validator.js';
import { flush, _resetForTesting } from '../../lib/analytics-buffer.js';
import type { HookInput } from '../../types.js';

const SESSION = 'session-lineage-concurrency';
let project = '';
let log = '';
const savedProjectDir = process.env.CLAUDE_PROJECT_DIR;
const savedDisable = process.env.ORK_TELEMETRY_DISABLE;

const pretool = (type: string, parent: string, toolUseId: string): string =>
  JSON.stringify({ timestamp: '2026-11-26T12:00:00.000Z', source: 'pretool', subagent_type: type, session_id: SESSION, tool_use_id: toolUseId, parent_agent_id: parent });

const start = (agentId: string): HookInput => ({
  tool_name: '',
  hook_event: 'SubagentStart',
  session_id: SESSION,
  agent_id: agentId,
  agent_type: 'Explore',
  tool_input: { subagent_type: 'Explore' },
});

const startRows = (): Array<Record<string, unknown>> => {
  flush();
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line: string) => JSON.parse(line) as Record<string, unknown>)
    .filter((row: Record<string, unknown>) => row.source === 'start');
};

beforeEach(() => {
  _resetForTesting();
  project = mkdtempSync(join(tmpdir(), 'ork-lineage-'));
  mkdirSync(join(project, '.claude', 'logs'), { recursive: true });
  log = join(project, '.claude', 'logs', 'subagent-spawns.jsonl');
  process.env.CLAUDE_PROJECT_DIR = project;
  delete process.env.ORK_TELEMETRY_DISABLE;
});

afterEach(() => {
  _resetForTesting();
  rmSync(project, { recursive: true, force: true });
  if (savedProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
  if (savedDisable !== undefined) process.env.ORK_TELEMETRY_DISABLE = savedDisable;
});

describe('overlapping SubagentStart hooks (#5464 review)', () => {
  // FIFO pairing was withdrawn (Opus HOLD at b76bd94a, no clean key), so
  // overlapping starts write no lineage at all, which no race can make wrong.
  test('two overlapping starts of one type write no guessed lineage', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n${pretool('Explore', 'parentB', 'toolu_b')}\n`);

    subagentValidator(start('child-1'));
    subagentValidator(start('child-2'));

    const rows = startRows();
    expect(rows.map((r) => r.agent_id).sort()).toEqual(['child-1', 'child-2']);
    for (const r of rows) {
      expect(r).not.toHaveProperty('parent_agent_id');
      expect(r).not.toHaveProperty('spawn_depth');
    }
  });

  test('an overlapping second start for the same agent_id writes no second row', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n${pretool('Explore', 'parentB', 'toolu_b')}\n`);

    subagentValidator(start('child-1'));
    subagentValidator(start('child-1'));

    const rows = startRows().filter((r) => r.agent_id === 'child-1');
    expect(rows).toHaveLength(1);
  });

  // Codex HOLD round 2 at b76bd94a: the lock's timeout path and its stale
  // takeover. No lock exists any more; the per-agent claim is an atomic 'wx'
  // create with nothing to wait on, time out, take over or unlink.
  test('a pending first start and a waking second start write one row, and no lock file is ever made', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n`);

    subagentValidator(start('child-1'));
    expect(existsSync(`${log}.lock`)).toBe(false);
    subagentValidator(start('child-1'));
    subagentValidator(start('child-1'));

    expect(startRows().filter((r) => r.agent_id === 'child-1')).toHaveLength(1);
  });

  // Codex HOLD round 3 at 8a0f9ae9: rotation cleared every claim while a
  // claimed start was still buffered, so a second start for the same agent
  // claimed again and both rows landed in the new active log.
  test('a log rotation between two starts of one agent never writes a second row', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n`);

    subagentValidator(start('child-1')); // claimed, row still pending
    appendFileSync(log, `${'x'.repeat(600 * 1024)}\n`); // other telemetry crosses 500 KiB
    subagentValidator(start('child-1')); // rotates the log, then starts again

    expect(startRows().filter((r) => r.agent_id === 'child-1')).toHaveLength(1);
  });

  test('rotation prunes only claims older than a day', () => {
    const claims = join(project, '.claude', 'logs', 'spawn-claims');
    mkdirSync(claims, { recursive: true });
    const old = join(claims, `${SESSION}.agent.ancient`);
    const fresh = join(claims, `${SESSION}.agent.recent`);
    writeFileSync(old, '');
    writeFileSync(fresh, '');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    utimesSync(old, twoDaysAgo, twoDaysAgo);
    writeFileSync(log, `${'x'.repeat(600 * 1024)}\n`);

    subagentValidator(start('child-9')); // triggers rotation

    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  test('an old claim from a crashed start is never taken over: the agent stays at one row', () => {
    const claims = join(project, '.claude', 'logs', 'spawn-claims');
    mkdirSync(claims, { recursive: true });
    const held = join(claims, `${SESSION}.agent.child-1`);
    writeFileSync(held, '');
    utimesSync(held, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));

    subagentValidator(start('child-1'));

    expect(startRows()).toHaveLength(0);
    expect(existsSync(held)).toBe(true);
  });
});
