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
import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
  test('two overlapping starts of one type consume two different intents', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n${pretool('Explore', 'parentB', 'toolu_b')}\n`);

    subagentValidator(start('child-1'));
    subagentValidator(start('child-2'));

    const parents = startRows().map((r) => r.parent_agent_id).sort();
    expect(parents).toEqual(['parentA', 'parentB']);
  });

  test('an overlapping second start for the same agent_id writes no second row', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n${pretool('Explore', 'parentB', 'toolu_b')}\n`);

    subagentValidator(start('child-1'));
    subagentValidator(start('child-1'));

    const rows = startRows().filter((r) => r.agent_id === 'child-1');
    expect(rows).toHaveLength(1);
  });

  test('a held lock never lets a start claim lineage it could not serialize', () => {
    writeFileSync(log, `${pretool('Explore', 'parentA', 'toolu_a')}\n`);
    // Another hook holds the lock (fresh, not stale).
    writeFileSync(`${log}.lock`, String(process.pid));

    subagentValidator(start('child-1'));

    const rows = startRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('parent_agent_id');
    expect(rows[0]).not.toHaveProperty('spawn_depth');
  });
});
