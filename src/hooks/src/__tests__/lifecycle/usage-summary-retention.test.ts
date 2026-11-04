/**
 * Local telemetry retention at SessionEnd, against REAL files (no fs mock,
 * no telemetry mock).
 *
 * usage-summary-reporter runs as its own SessionEnd process. No sink is
 * registered in that process, so a sink-based flush loops over nothing; the
 * reporter must call the JSONL rotation and pruning itself. Retention is local
 * only: with no webhook configured, nothing is fetched.
 *
 * Contract (what the privacy page and README promise):
 *   - the active telemetry/events.jsonl rotates once it is over 10 MB
 *   - rotated events.<stamp>.jsonl files older than 7 days are deleted
 *   - newer rotated files are kept
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, statSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../../lib/orchestration-state.js', () => ({
  getWebhookUrl: vi.fn(() => undefined),
  getHookToken: vi.fn(() => undefined),
}));

import { usageSummaryReporter } from '../../lifecycle/usage-summary-reporter.js';
import { createTestContext } from '../fixtures/test-context.js';

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('usage-summary-reporter: local telemetry retention (real files)', () => {
  let dataDir: string;
  let telemetryDir: string;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'ork-retention-'));
    telemetryDir = join(dataDir, 'telemetry');
    mkdirSync(telemetryDir, { recursive: true });
    vi.stubEnv('CLAUDE_PLUGIN_DATA', dataDir);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('rotates an active log over 10 MB and prunes rotated files older than 7 days, with no webhook', async () => {
    const active = join(telemetryDir, 'events.jsonl');
    writeFileSync(active, Buffer.alloc(10 * MB + 1, 0x61));

    const oldRotated = join(telemetryDir, 'events.20260101T000000.jsonl');
    writeFileSync(oldRotated, '{"e":"old"}\n');
    const eightDaysAgo = (Date.now() - 8 * DAY_MS) / 1000;
    utimesSync(oldRotated, eightDaysAgo, eightDaysAgo);

    const recentRotated = join(telemetryDir, 'events.20261103T000000.jsonl');
    writeFileSync(recentRotated, '{"e":"recent"}\n');

    const result = await usageSummaryReporter(
      { hook_event: 'SessionEnd', session_id: 'retention-test', tool_name: '', tool_input: {} },
      createTestContext(),
    );

    expect(result).toEqual({ continue: true, suppressOutput: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Over-limit active file was moved aside, intact, to a rotated name.
    expect(existsSync(active)).toBe(false);
    const rotated = readdirSync(telemetryDir).filter(
      (f) => f.startsWith('events.') && f.endsWith('.jsonl') && f !== 'events.jsonl'
        && f !== 'events.20261103T000000.jsonl',
    );
    expect(rotated).toHaveLength(1);
    expect(statSync(join(telemetryDir, rotated[0])).size).toBe(10 * MB + 1);

    // Older than 7 days: deleted. Newer: kept.
    expect(existsSync(oldRotated)).toBe(false);
    expect(existsSync(recentRotated)).toBe(true);
  });

  it('leaves an active log at or under 10 MB in place', async () => {
    const active = join(telemetryDir, 'events.jsonl');
    writeFileSync(active, '{"e":"small"}\n');

    await usageSummaryReporter(
      { hook_event: 'SessionEnd', session_id: 'retention-test', tool_name: '', tool_input: {} },
      createTestContext(),
    );

    expect(existsSync(active)).toBe(true);
    expect(readdirSync(telemetryDir)).toEqual(['events.jsonl']);
  });
});
