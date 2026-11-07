import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockExecFileSync = vi.fn();
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

let tmpDir = '';
vi.mock('../lib/paths.js', () => ({
  getCacheDir: () => join(tmpDir, 'cache'),
  getProjectDir: () => tmpDir,
}));

import { acquirePidLock } from '../lib/pidlock.js';
import { writeLedger, readLedger, updateLedgerForFile, LEDGER_VERSION } from '../lib/debt-ledger.js';
import { DEBT_TOKEN } from '../lib/debt-markers.js';

describe('State machine pidlock creation race and debt-ledger HEAD drift regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(join(tmpdir(), 'ork-sm-pidlock-ledger-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('acquirePidLock does not steal a newly created lockfile whose PID write is still in flight', () => {
    const lockPath = join(tmpDir, 'active-create.lock');
    // Simulate the window between O_CREAT|O_EXCL and write() inside writeFileSync(..., { flag: 'wx' })
    writeFileSync(lockPath, '', 'utf8');

    const acquired = acquirePidLock(lockPath, 60_000);
    expect(acquired).toBe(false);
    expect(existsSync(lockPath)).toBe(true);
  });

  test('acquirePidLock reclaims an empty lockfile after the creation grace window expires', () => {
    const lockPath = join(tmpDir, 'abandoned-empty.lock');
    writeFileSync(lockPath, '', 'utf8');
    const past = new Date(Date.now() - 5_000);
    utimesSync(lockPath, past, past);

    const acquired = acquirePidLock(lockPath, 60_000);
    expect(acquired).toBe(true);
  });

  test('updateLedgerForFile does not splice entries from a different git HEAD into a cached ledger', () => {
    const headA = 'a'.repeat(40);
    const headB = 'b'.repeat(40);

    writeLedger({
      version: LEDGER_VERSION,
      head: headA,
      generated_at: new Date().toISOString(),
      entries: [
        { file: 'src/existing.ts', line: 10, choice: 'keep', upgrade: 'u', trigger: 't' },
      ],
    });

    mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'rev-parse') {
        return `${headB}\n`;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    updateLedgerForFile(
      tmpDir,
      join(tmpDir, 'src/existing.ts'),
      `// ${DEBT_TOKEN}: foreign branch choice, upgrade to v2, when ready\n`,
    );

    const after = readLedger();
    expect(after?.head).toBe(headA);
    expect(after?.entries).toEqual([
      { file: 'src/existing.ts', line: 10, choice: 'keep', upgrade: 'u', trigger: 't' },
    ]);
  });
});
