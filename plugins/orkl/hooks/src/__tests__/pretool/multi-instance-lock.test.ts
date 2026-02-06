/**
 * Unit tests for multi-instance-lock hook
 * Tests file lock acquisition and conflict detection for Write/Edit operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputDeny: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/guards.js', () => ({
  guardWriteEdit: vi.fn(() => null),
}));

vi.mock('../../lib/session-id-generator.js', () => ({
  getOrGenerateSessionId: vi.fn(() => 'instance-abc-123'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{"locks":[]}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

import { multiInstanceLock } from '../../pretool/write-edit/multi-instance-lock.js';
import type { HookInput } from '../../types.js';
import { guardWriteEdit } from '../../lib/guards.js';
import { existsSync, readFileSync } from 'node:fs';

function createWriteInput(filePath: string): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content: 'new content' },
  };
}

describe('multi-instance-lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardWriteEdit).mockReturnValue(null);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns guard result when tool is not Write or Edit', () => {
    vi.mocked(guardWriteEdit).mockReturnValue({ continue: true, suppressOutput: true });

    const input: HookInput = {
      tool_name: 'Read',
      session_id: 'test-session-123',
      project_dir: '/test/project',
      tool_input: { file_path: '/test/project/src/app.ts' },
    };
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for empty file path', () => {
    const input = createWriteInput('');
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no instance identity exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const input = createWriteInput('/test/project/src/app.ts');
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('acquires lock when no existing lock for the file', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes('id.json')) return true;
      if (path.includes('locks.json')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ locks: [] }));

    const input = createWriteInput('/test/project/src/app.ts');
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('denies when file is locked by another instance', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes('id.json')) return true;
      if (path.includes('locks.json')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        locks: [
          {
            lock_id: 'lock-existing',
            file_path: 'src/app.ts',
            lock_type: 'exclusive_write',
            instance_id: 'other-instance-456',
            acquired_at: new Date().toISOString(),
            expires_at: futureDate,
          },
        ],
      })
    );

    const input = createWriteInput('/test/project/src/app.ts');
    const result = multiInstanceLock(input);

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('locked by another Claude instance');
  });
});
