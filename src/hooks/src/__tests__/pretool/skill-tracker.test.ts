/**
 * Unit tests for skill-tracker hook
 * Tests logging of skill invocations and analytics writing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

const { mockAppendFileSync, mockRecordInvocation } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
  mockRecordInvocation: vi.fn(),
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

vi.mock('node:path', () => {
  const named = { join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')), basename: vi.fn((p: string) => p.split('/').pop() || ''), resolve: vi.fn((...a: string[]) => a.join('/')), sep: '/' };
  return { ...named, default: named };
});

// #2010: stub the registry so this UNIT test asserts the wiring without opening
// the real shared sessions.db. Real recordInvocation behavior lives in
// __tests__/lib/session-registry.test.ts (isolated via ORK_SESSION_DB).
vi.mock('../../lib/session-registry.js', () => ({
  recordInvocation: (...args: unknown[]) => mockRecordInvocation(...args),
}));

import { skillTracker } from '../../pretool/skill/skill-tracker.js';
import type { HookInput } from '../../types.js';
// appendFileSync import removed — use mockAppendFileSync directly
import { createTestContext } from '../fixtures/test-context.js';

function createSkillInput(skillName: string, args: string = ''): HookInput {
  return {
    tool_name: 'Skill',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { skill: skillName, args },
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('skill-tracker', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
  });

  it('returns silent success for empty skill name', () => {
    const input: HookInput = {
      tool_name: 'Skill',
      session_id: 'test-session-123',
      project_dir: '/test/project',
      tool_input: {},
    };
    const result = skillTracker(input, testCtx);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('logs skill invocation to usage log file', () => {
    const input = createSkillInput('unit-testing');
    skillTracker(input, testCtx);

    // Two sinks now: [0] plaintext usage log, [1] channel-tagged telemetry (channel:"main")
    expect(mockAppendFileSync).toHaveBeenCalledTimes(2);
    const usageCall = mockAppendFileSync.mock.calls[0];
    expect(String(usageCall[0])).toContain('skill-usage.log');
    expect(String(usageCall[1])).toContain('unit-testing');
    const channelCall = mockAppendFileSync.mock.calls[1];
    expect(String(channelCall[0])).toContain('skill-channels.jsonl');
    expect(String(channelCall[1])).toContain('"channel":"main"');
    expect(String(channelCall[1])).toContain('unit-testing');
  });

  it('always returns silent success after logging', () => {
    const input = createSkillInput('recall', '--graph database');
    const result = skillTracker(input, testCtx);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('calls logHook with skill name', () => {
    const input = createSkillInput('e2e-testing');
    skillTracker(input, testCtx);

    expect(testCtx.log).toHaveBeenCalledWith(
      'skill-tracker',
      expect.stringContaining('e2e-testing')
    );
  });

  it('handles skill invocation without args', () => {
    const input = createSkillInput('run-tests');
    skillTracker(input, testCtx);

    const usageCall = mockAppendFileSync.mock.calls[0];
    expect(String(usageCall[1])).toContain('no args');
  });

  it('records the invocation to the coordination DB (#2010)', () => {
    skillTracker(createSkillInput('unit-testing'), testCtx);

    expect(mockRecordInvocation).toHaveBeenCalledWith('test-session-123', 'unit-testing');
  });

  it('does not record when the skill name is empty', () => {
    skillTracker(
      { tool_name: 'Skill', session_id: 'test-session-123', project_dir: '/test/project', tool_input: {} },
      testCtx,
    );

    expect(mockRecordInvocation).not.toHaveBeenCalled();
  });
});
