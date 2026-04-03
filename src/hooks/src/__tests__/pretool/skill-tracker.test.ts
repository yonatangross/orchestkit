/**
 * Unit tests for skill-tracker hook
 * Tests logging of skill invocations and analytics writing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

const { mockAppendFileSync } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
}));

// Mock dependencies before imports
vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
}));

import { skillTracker } from '../../pretool/skill/skill-tracker.js';
import type { HookInput } from '../../types.js';
// appendFileSync import removed — use mockAppendFileSync directly
import { logHook } from '../../lib/common.js';

function createSkillInput(skillName: string, args: string = ''): HookInput {
  return {
    tool_name: 'Skill',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { skill: skillName, args },
  };
}

describe('skill-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for empty skill name', () => {
    const input: HookInput = {
      tool_name: 'Skill',
      session_id: 'test-session-123',
      project_dir: '/test/project',
      tool_input: {},
    };
    const result = skillTracker(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('logs skill invocation to usage log file', () => {
    const input = createSkillInput('unit-testing');
    skillTracker(input);

    expect(mockAppendFileSync).toHaveBeenCalledTimes(1); // usage log only (analytics JSONL removed #919)
    const usageCall = mockAppendFileSync.mock.calls[0];
    expect(String(usageCall[0])).toContain('skill-usage.log');
    expect(String(usageCall[1])).toContain('unit-testing');
  });

  it('always returns silent success after logging', () => {
    const input = createSkillInput('recall', '--graph database');
    const result = skillTracker(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('calls logHook with skill name', () => {
    const input = createSkillInput('e2e-testing');
    skillTracker(input);

    expect(logHook).toHaveBeenCalledWith(
      'skill-tracker',
      expect.stringContaining('e2e-testing')
    );
  });

  it('handles skill invocation without args', () => {
    const input = createSkillInput('run-tests');
    skillTracker(input);

    const usageCall = mockAppendFileSync.mock.calls[0];
    expect(String(usageCall[1])).toContain('no args');
  });
});
