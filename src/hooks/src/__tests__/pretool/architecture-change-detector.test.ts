/**
 * Unit tests for architecture-change-detector hook
 * Tests detection of architectural layer changes and context injection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx },
  })),
  outputWarning: vi.fn((msg: string) => ({ continue: true, systemMessage: `\u26a0 ${msg}` })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('../../lib/guards.js', () => ({
  guardPathPattern: vi.fn(() => null),
  isDontAskMode: vi.fn(() => false),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { architectureChangeDetector } from '../../pretool/Write/architecture-change-detector.js';
import type { HookInput } from '../../types.js';
import { guardPathPattern, isDontAskMode } from '../../lib/guards.js';
import { existsSync, } from 'node:fs';

function createWriteInput(filePath: string, content: string = ''): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content },
  };
}

describe('architecture-change-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardPathPattern).mockReturnValue(null);
    vi.mocked(isDontAskMode).mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns silent success for empty file path', () => {
    const input = createWriteInput('', 'content');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when guard rejects non-architectural path', () => {
    vi.mocked(guardPathPattern).mockReturnValue({ continue: true, suppressOutput: true });

    const input = createWriteInput('/test/project/src/utils/helper.ts', 'code');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('detects api-layer changes and injects context for new files', () => {
    const input = createWriteInput('/test/project/src/api/users.ts', 'export function getUsers() {}');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('New api-layer file');
    expect(result.hookSpecificOutput?.additionalContext).toContain('dependency injection');
  });

  it('detects service-layer modification for existing files', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.includes('services')) return true;
      return false;
    });

    const input = createWriteInput('/test/project/src/services/auth.ts', 'updated code');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Modifying service-layer');
    expect(result.hookSpecificOutput?.additionalContext).toContain('no breaking API changes');
  });

  it('detects data-layer changes for models directory', () => {
    const input = createWriteInput('/test/project/src/models/user.ts', 'interface User {}');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('data-layer');
  });

  it('returns warning instead of context in dontAsk mode', () => {
    vi.mocked(isDontAskMode).mockReturnValue(true);

    const input = createWriteInput('/test/project/src/api/routes.ts', 'route code');
    const result = architectureChangeDetector(input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Quality Gate');
  });
});
