/**
 * Unit tests for ci-simulation hook
 * Tests detection of project type and CI check suggestions before git push
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputAllowWithContext: vi.fn((ctx: string) => ({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
      permissionDecision: 'allow',
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { ciSimulation } from '../../pretool/bash/ci-simulation.js';
import type { HookInput } from '../../types.js';
import { existsSync } from 'node:fs';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('ci-simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns silent success for non-git-push commands', () => {
    const input = createBashInput('npm run build');
    const result = ciSimulation(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no project files detected', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const input = createBashInput('git push origin main');
    const result = ciSimulation(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('suggests Node.js CI checks when package.json exists', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      return typeof p === 'string' && p.includes('package.json');
    });

    const input = createBashInput('git push origin main');
    const result = ciSimulation(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('npm run lint');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Pre-push CI simulation');
  });

  it('suggests Python CI checks when pyproject.toml exists', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      return typeof p === 'string' && p.includes('pyproject.toml');
    });

    const input = createBashInput('git push origin feature');
    const result = ciSimulation(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('pytest');
    expect(result.hookSpecificOutput?.additionalContext).toContain('ruff check');
  });

  it('suggests Go CI checks when go.mod exists', () => {
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      return typeof p === 'string' && p.includes('go.mod');
    });

    const input = createBashInput('git push origin main');
    const result = ciSimulation(input);

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('go vet');
    expect(result.hookSpecificOutput?.additionalContext).toContain('go test');
  });
});
