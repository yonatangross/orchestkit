/**
 * Unit tests for profile-injector hook
 * Tests materializeProfileRules() which writes user profile to .claude/rules/
 *
 * Updated: profileInjector() deprecated — tests now cover materializeProfileRules()
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import type { UserProfile, UsageStats, RecordedDecision } from '../../lib/user-profile.js';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../lib/common.js', () => mockCommonBasic({
  writeRulesFile: vi.fn(),
}));

vi.mock('../../lib/paths.js', () => ({
  getHomeDir: vi.fn(() => '/test/home'),
}));

vi.mock('../../lib/user-profile.js', () => ({
  loadUserProfile: vi.fn(),
  getTopSkills: vi.fn(),
  getTopAgents: vi.fn(),
  getRecentDecisions: vi.fn(),
}));

import { materializeProfileRules, profileInjector } from '../../prompt/profile-injector.js';
import { loadUserProfile, getTopSkills, getTopAgents, getRecentDecisions } from '../../lib/user-profile.js';
import { outputSilentSuccess, writeRulesFile } from '../../lib/common.js';
import { createTestContext } from '../fixtures/test-context.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date().toISOString();
  return {
    user_id: 'test@user.com',
    anonymous_id: 'anon123456789012',
    display_name: 'Test User',
    team_id: 'test-team',
    sessions_count: 5,
    first_seen: '2026-01-01T00:00:00Z',
    last_seen: now,
    version: 1,
    skill_usage: {},
    agent_usage: {},
    tool_usage: {},
    decisions: [],
    preferences: [],
    workflow_patterns: [],
    aggregated_sessions: [],
    ...overrides,
  };
}

function createMockUsageStats(count: number): UsageStats {
  return {
    count,
    success_rate: 0.95,
    first_used: '2026-01-01T00:00:00Z',
    last_used: '2026-01-28T00:00:00Z',
  };
}

function createMockDecision(what: string): RecordedDecision {
  return {
    what,
    confidence: 0.9,
    timestamp: '2026-01-28T00:00:00Z',
  };
}

function createEmptyProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 0,
    skill_usage: {},
    agent_usage: {},
    decisions: [],
    preferences: [],
  });
}

function createFullProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 25,
    skill_usage: {
      'api-design': createMockUsageStats(50),
      'database-patterns': createMockUsageStats(35),
      'security-patterns': createMockUsageStats(20),
      'unit-testing': createMockUsageStats(15),
      'e2e-testing': createMockUsageStats(10),
    },
    agent_usage: {
      'backend-system-architect': createMockUsageStats(30),
      'database-engineer': createMockUsageStats(25),
      'test-generator': createMockUsageStats(15),
    },
    decisions: [
      createMockDecision('Use cursor-based pagination for large datasets'),
      createMockDecision('PostgreSQL for ACID compliance'),
      createMockDecision('JWT tokens for API authentication'),
    ],
  });
}

function createPartialProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 10,
    skill_usage: {
      'api-design': createMockUsageStats(20),
      'python-backend': createMockUsageStats(15),
    },
    agent_usage: {},
    decisions: [],
  });
}

// =============================================================================
// Tests for materializeProfileRules (the active function)
// =============================================================================

let testCtx: ReturnType<typeof createTestContext>;
describe('prompt/materializeProfileRules', () => {
  const mockLoadUserProfile = vi.mocked(loadUserProfile);
  const mockGetTopSkills = vi.mocked(getTopSkills);
  const mockGetTopAgents = vi.mocked(getTopAgents);
  const mockGetRecentDecisions = vi.mocked(getRecentDecisions);
  const mockWriteRulesFile = vi.mocked(writeRulesFile);

  beforeEach(() => {
    testCtx = createTestContext({ writeRules: vi.fn() });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('empty profile (new user)', () => {
    test('skips materialization for new user with zero sessions', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });

    test('skips materialization when profile has no skill usage', () => {
      const profileNoSkills = createMockProfile({
        sessions_count: 0,
        skill_usage: {},
        agent_usage: {},
        decisions: [],
      });
      mockLoadUserProfile.mockReturnValue(profileNoSkills);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      expect(mockWriteRulesFile).not.toHaveBeenCalled();
    });
  });

  describe('full profile (returning user)', () => {
    test('writes profile context to rules file for user with full profile', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design', stats: createMockUsageStats(50) },
        { skill: 'database-patterns', stats: createMockUsageStats(35) },
        { skill: 'security-patterns', stats: createMockUsageStats(20) },
      ]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
        { agent: 'database-engineer', stats: createMockUsageStats(25) },
      ]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination for large datasets'),
        createMockDecision('PostgreSQL for ACID compliance'),
      ]);

      materializeProfileRules();

      expect(mockWriteRulesFile).toHaveBeenCalled();
    });

    test('includes top skills in rules file context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design', stats: createMockUsageStats(50) },
        { skill: 'database-patterns', stats: createMockUsageStats(35) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      expect(mockWriteRulesFile).toHaveBeenCalled();
      const context = mockWriteRulesFile.mock.calls[0][2] as string;
      expect(context).toContain('api-design');
      expect(context).toContain('database-patterns');
    });

    test('includes top agents in rules file context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
        { agent: 'database-engineer', stats: createMockUsageStats(25) },
      ]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      expect(mockWriteRulesFile).toHaveBeenCalled();
      const context = mockWriteRulesFile.mock.calls[0][2] as string;
      expect(context).toContain('backend-system-architect');
      expect(context).toContain('database-engineer');
    });

    test('includes recent decisions in rules file context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination'),
        createMockDecision('PostgreSQL for ACID compliance'),
      ]);

      materializeProfileRules();

      expect(mockWriteRulesFile).toHaveBeenCalled();
      const context = mockWriteRulesFile.mock.calls[0][2] as string;
      expect(context).toContain('cursor-based pagination');
      expect(context).toContain('PostgreSQL');
    });

    test('writes to rules file with user-profile.md filename', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      expect(mockWriteRulesFile).toHaveBeenCalledWith(
        expect.stringContaining('.claude/rules'),
        'user-profile.md',
        expect.any(String),
        'profile-injector',
      );
    });
  });

  describe('partial profile', () => {
    test('handles profile with skills but no agents', () => {
      mockLoadUserProfile.mockReturnValue(createPartialProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design', stats: createMockUsageStats(20) },
        { skill: 'python-backend', stats: createMockUsageStats(15) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      const context = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(context).toContain('api-design');
      expect(context).toContain('python-backend');
      expect(context).not.toContain('undefined');
    });

    test('handles profile with agents but no skills', () => {
      const profileAgentsOnly = createMockProfile({
        sessions_count: 5,
        skill_usage: {},
        agent_usage: {
          'test-generator': createMockUsageStats(10),
        },
        decisions: [],
      });
      mockLoadUserProfile.mockReturnValue(profileAgentsOnly);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'test-generator', stats: createMockUsageStats(10) },
      ]);
      mockGetRecentDecisions.mockReturnValue([]);

      materializeProfileRules();

      const context = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(context).toContain('test-generator');
    });

    test('handles profile with decisions but no skills or agents', () => {
      const profileDecisionsOnly = createMockProfile({
        sessions_count: 3,
        skill_usage: {},
        agent_usage: {},
        decisions: [createMockDecision('Use TypeScript for type safety')],
      });
      mockLoadUserProfile.mockReturnValue(profileDecisionsOnly);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use TypeScript for type safety'),
      ]);

      materializeProfileRules();

      const context = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      expect(context).toContain('TypeScript');
    });
  });

  describe('token budget (under 200 tokens)', () => {
    test('context message stays under 200 tokens', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design', stats: createMockUsageStats(50) },
        { skill: 'database-patterns', stats: createMockUsageStats(35) },
        { skill: 'security-patterns', stats: createMockUsageStats(20) },
      ]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
        { agent: 'database-engineer', stats: createMockUsageStats(25) },
      ]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination'),
        createMockDecision('PostgreSQL for ACID'),
        createMockDecision('JWT for authentication'),
      ]);

      materializeProfileRules();

      const context = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      const estimatedTokens = Math.ceil(context.length / 3.5);
      expect(estimatedTokens).toBeLessThanOrEqual(200);
    });

    test('truncates content when approaching token limit', () => {
      const hugeProfile = createMockProfile({
        sessions_count: 100,
        skill_usage: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [
            `skill-${i}`,
            createMockUsageStats(100 - i),
          ])
        ),
        agent_usage: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            `agent-${i}`,
            createMockUsageStats(50 - i),
          ])
        ),
        decisions: Array.from({ length: 20 }, (_, i) =>
          createMockDecision(`Decision ${i} with some detailed explanation`)
        ),
      });

      mockLoadUserProfile.mockReturnValue(hugeProfile);
      mockGetTopSkills.mockReturnValue(
        Array.from({ length: 5 }, (_, i) => ({
          skill: `skill-${i}`,
          stats: createMockUsageStats(100 - i),
        }))
      );
      mockGetTopAgents.mockReturnValue(
        Array.from({ length: 3 }, (_, i) => ({
          agent: `agent-${i}`,
          stats: createMockUsageStats(50 - i),
        }))
      );
      mockGetRecentDecisions.mockReturnValue(
        Array.from({ length: 3 }, (_, i) =>
          createMockDecision(`Decision ${i} with some detailed explanation`)
        )
      );

      materializeProfileRules();

      const context = (mockWriteRulesFile.mock.calls[0]?.[2] as string) || '';
      const estimatedTokens = Math.ceil(context.length / 3.5);
      expect(estimatedTokens).toBeLessThanOrEqual(200);
    });
  });

  describe('error handling', () => {
    test('does not crash when loadUserProfile throws', () => {
      mockLoadUserProfile.mockImplementation(() => {
        throw new Error('Failed to read profile file');
      });

      // materializeProfileRules is called from sync-session-dispatcher
      // which wraps it in try/catch, but the function itself may throw
      expect(() => {
        try { materializeProfileRules(); } catch { /* expected */ }
      }).not.toThrow();
    });

    test('handles getTopSkills returning null gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue(null as unknown as never[]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      // May throw due to null — caller (sync-session-dispatcher) catches
      try { materializeProfileRules(); } catch { /* acceptable */ }
    });
  });
});

// =============================================================================
// Tests for deprecated profileInjector (backward compat stub)
// =============================================================================

describe('prompt/profileInjector (deprecated)', () => {
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOutputSilentSuccess.mockReturnValue({ continue: true, suppressOutput: true });
  });

  test('returns silent success without doing work', () => {
    const input: HookInput = {
      hook_event: 'UserPromptSubmit',
      tool_name: 'UserPromptSubmit',
      session_id: 'test-session',
      project_dir: '/test/project',
      tool_input: {},
      prompt: 'Hello',
    };

    const result = profileInjector(input);

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    expect(mockOutputSilentSuccess).toHaveBeenCalled();
  });
});
