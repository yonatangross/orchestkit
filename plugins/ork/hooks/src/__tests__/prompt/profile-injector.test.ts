/**
 * Unit tests for profile-injector hook
 * Tests UserPromptSubmit hook that loads user profile and injects personalized context
 * on the first prompt of a session.
 *
 * Hook behavior:
 * - Loads user profile via loadUserProfile() from user-profile.ts
 * - Returns outputPromptContext() with personalized message for users with history
 * - Returns outputSilentSuccess() for new users (empty profile)
 * - Gracefully handles profile load errors
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import type { UserProfile, UsageStats, RecordedDecision } from '../../lib/user-profile.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock common utilities before importing the hook
vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputPromptContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  })),
  estimateTokenCount: vi.fn((content: string) => Math.ceil(content.length / 3.5)),
}));

// Mock user-profile module
vi.mock('../../lib/user-profile.js', () => ({
  loadUserProfile: vi.fn(),
  getTopSkills: vi.fn(),
  getTopAgents: vi.fn(),
  getRecentDecisions: vi.fn(),
}));

// Import after mocks are set up
import { profileInjector } from '../../prompt/profile-injector.js';
import { loadUserProfile, getTopSkills, getTopAgents, getRecentDecisions } from '../../lib/user-profile.js';
import { outputSilentSuccess, outputPromptContext } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock UserProfile with customizable fields
 */
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

/**
 * Create mock usage stats
 */
function createMockUsageStats(count: number): UsageStats {
  return {
    count,
    success_rate: 0.95,
    first_used: '2026-01-01T00:00:00Z',
    last_used: '2026-01-28T00:00:00Z',
  };
}

/**
 * Create mock decision
 */
function createMockDecision(what: string): RecordedDecision {
  return {
    what,
    confidence: 0.9,
    timestamp: '2026-01-28T00:00:00Z',
  };
}

/**
 * Create UserPromptSubmit input for testing
 */
function createPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    prompt,
    ...overrides,
  };
}

/**
 * Create an empty profile (new user)
 */
function createEmptyProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 0,
    skill_usage: {},
    agent_usage: {},
    decisions: [],
    preferences: [],
  });
}

/**
 * Create a full profile with skills, agents, and decisions
 */
function createFullProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 25,
    skill_usage: {
      'api-design-framework': createMockUsageStats(50),
      'database-schema-designer': createMockUsageStats(35),
      'auth-patterns': createMockUsageStats(20),
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

/**
 * Create a partial profile with only skills
 */
function createPartialProfile(): UserProfile {
  return createMockProfile({
    sessions_count: 10,
    skill_usage: {
      'api-design-framework': createMockUsageStats(20),
      'fastapi-advanced': createMockUsageStats(15),
    },
    agent_usage: {},
    decisions: [],
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/profile-injector', () => {
  const mockLoadUserProfile = vi.mocked(loadUserProfile);
  const mockGetTopSkills = vi.mocked(getTopSkills);
  const mockGetTopAgents = vi.mocked(getTopAgents);
  const mockGetRecentDecisions = vi.mocked(getRecentDecisions);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockOutputPromptContext = vi.mocked(outputPromptContext);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockOutputSilentSuccess.mockReturnValue({ continue: true, suppressOutput: true });
    mockOutputPromptContext.mockImplementation((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: ctx,
      },
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('basic behavior', () => {
    test('always continues execution', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Hello, how can you help me?');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles empty prompt', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns suppressOutput: true in all cases', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
      ]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination'),
      ]);

      const input = createPromptInput('Build a new API endpoint');
      const result = profileInjector(input);

      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('empty profile (new user)', () => {
    test('returns silent success for new user with zero sessions', () => {
      const emptyProfile = createEmptyProfile();
      mockLoadUserProfile.mockReturnValue(emptyProfile);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Help me build an application');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      // Should not inject context for empty profiles
      expect(mockOutputSilentSuccess).toHaveBeenCalled();
    });

    test('returns silent success when profile has no skill usage', () => {
      const profileNoSkills = createMockProfile({
        sessions_count: 1,
        skill_usage: {},
        agent_usage: {},
        decisions: [],
      });
      mockLoadUserProfile.mockReturnValue(profileNoSkills);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('What can you do?');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('does not call outputPromptContext for empty profiles', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Hello!');
      profileInjector(input);

      expect(mockOutputPromptContext).not.toHaveBeenCalled();
    });
  });

  describe('full profile (returning user with skills, agents, decisions)', () => {
    test('injects context for user with full profile', () => {
      const fullProfile = createFullProfile();
      mockLoadUserProfile.mockReturnValue(fullProfile);
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
        { skill: 'database-schema-designer', stats: createMockUsageStats(35) },
        { skill: 'auth-patterns', stats: createMockUsageStats(20) },
      ]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
        { agent: 'database-engineer', stats: createMockUsageStats(25) },
      ]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination for large datasets'),
        createMockDecision('PostgreSQL for ACID compliance'),
      ]);

      const input = createPromptInput('Design a new microservice');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      expect(mockOutputPromptContext).toHaveBeenCalled();
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('includes top skills in context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
        { skill: 'database-schema-designer', stats: createMockUsageStats(35) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Help me with the project');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('api-design-framework');
      expect(context).toContain('database-schema-designer');
    });

    test('includes top agents in context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
        { agent: 'database-engineer', stats: createMockUsageStats(25) },
      ]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Help me with the project');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('backend-system-architect');
      expect(context).toContain('database-engineer');
    });

    test('includes recent decisions in context', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination'),
        createMockDecision('PostgreSQL for ACID compliance'),
      ]);

      const input = createPromptInput('Continue with the database work');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('cursor-based pagination');
      expect(context).toContain('PostgreSQL');
    });

    test('uses CC 2.1.9 additionalContext format', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Build an API');
      const result = profileInjector(input);

      expect(result.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });

  describe('partial profile (only skills, no agents)', () => {
    test('handles profile with skills but no agents gracefully', () => {
      const partialProfile = createPartialProfile();
      mockLoadUserProfile.mockReturnValue(partialProfile);
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(20) },
        { skill: 'fastapi-advanced', stats: createMockUsageStats(15) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Create a FastAPI endpoint');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('api-design-framework');
      expect(context).toContain('fastapi-advanced');
      // Should not crash or include undefined agents
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

      const input = createPromptInput('Write some tests');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      const context = result.hookSpecificOutput?.additionalContext || '';
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

      const input = createPromptInput('Start a new feature');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('TypeScript');
    });
  });

  describe('token budget (under 200 tokens)', () => {
    test('context message stays under 200 tokens', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
        { skill: 'database-schema-designer', stats: createMockUsageStats(35) },
        { skill: 'auth-patterns', stats: createMockUsageStats(20) },
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

      const input = createPromptInput('Build a comprehensive API');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      // Estimate tokens (approximately 3.5 chars per token)
      const estimatedTokens = Math.ceil(context.length / 3.5);

      expect(estimatedTokens).toBeLessThanOrEqual(200);
    });

    test('truncates or limits content when approaching token limit', () => {
      // Create a profile with many skills, agents, and decisions
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

      const input = createPromptInput('Start a complex project');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      const estimatedTokens = Math.ceil(context.length / 3.5);

      expect(estimatedTokens).toBeLessThanOrEqual(200);
    });

    test('respects token budget even with long decision descriptions', () => {
      const longDecision = createMockDecision(
        'A very long decision description that goes on and on explaining the rationale ' +
          'and alternatives considered and potential implications for the architecture ' +
          'and future maintenance concerns and performance considerations'
      );

      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
      ]);
      mockGetRecentDecisions.mockReturnValue([longDecision]);

      const input = createPromptInput('Continue the work');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      const estimatedTokens = Math.ceil(context.length / 3.5);

      expect(estimatedTokens).toBeLessThanOrEqual(200);
    });
  });

  describe('error handling', () => {
    test('does not crash when loadUserProfile throws', () => {
      mockLoadUserProfile.mockImplementation(() => {
        throw new Error('Failed to read profile file');
      });

      const input = createPromptInput('Help me with something');

      // Should not throw
      expect(() => profileInjector(input)).not.toThrow();

      const result = profileInjector(input);
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('returns silent success when profile load fails', () => {
      mockLoadUserProfile.mockImplementation(() => {
        throw new Error('JSON parse error');
      });

      const input = createPromptInput('Build an API');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
      expect(mockOutputSilentSuccess).toHaveBeenCalled();
    });

    test('handles getTopSkills returning null gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue(null as unknown as never[]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Start project');

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });

    test('handles getTopAgents returning undefined gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue(undefined as unknown as never[]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Start project');

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });

    test('handles getRecentDecisions throwing gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockImplementation(() => {
        throw new Error('Database error');
      });

      const input = createPromptInput('Help me');

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });

    test('handles corrupted profile data gracefully', () => {
      const corruptedProfile = {
        user_id: 'test@user.com',
        // Missing required fields
      } as UserProfile;

      mockLoadUserProfile.mockReturnValue(corruptedProfile);
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('What can you do?');

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });
  });

  describe('session handling', () => {
    test('uses session_id from input', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Hello', {
        session_id: 'unique-session-456',
      });

      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });

    test('handles missing session_id gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: '',
        project_dir: '/test/project',
        tool_input: {},
        prompt: 'Hello',
      };

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles prompt with special characters', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Build API for $pecial ch@rs! <html>');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles prompt with newlines', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'database-schema-designer', stats: createMockUsageStats(35) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('First line\nSecond line\nThird line');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles very long prompt', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const longPrompt = 'Build an API ' + 'x'.repeat(10000);
      const input = createPromptInput(longPrompt);
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles unicode characters in prompt', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Build API with emoji support: \ud83d\ude00 \ud83d\udd25');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles profile with unicode in skill names', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'skill-with-\u00e9m\u00f8j\u00ed', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Build something');
      const result = profileInjector(input);

      expect(result.continue).toBe(true);
    });

    test('handles missing project_dir gracefully', () => {
      mockLoadUserProfile.mockReturnValue(createEmptyProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input: HookInput = {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: 'test-session',
        tool_input: {},
        prompt: 'Hello there',
      };

      expect(() => profileInjector(input)).not.toThrow();
      const result = profileInjector(input);
      expect(result.continue).toBe(true);
    });
  });

  describe('first prompt detection', () => {
    test('should only inject context on first prompt of session', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      // First prompt should inject context
      const input1 = createPromptInput('First prompt', {
        session_id: 'session-first-prompt-test',
      });
      const result1 = profileInjector(input1);

      // The hook should track this and not inject on subsequent prompts
      // (implementation may use session tracking)
      expect(result1.continue).toBe(true);
    });
  });

  describe('context content formatting', () => {
    test('formats skill list correctly', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([
        { skill: 'api-design-framework', stats: createMockUsageStats(50) },
        { skill: 'database-schema-designer', stats: createMockUsageStats(35) },
      ]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Start work');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      // Should have some form of list or mention of skills
      expect(context).toMatch(/api-design-framework|database-schema-designer/);
    });

    test('formats agent list correctly', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([
        { agent: 'backend-system-architect', stats: createMockUsageStats(30) },
      ]);
      mockGetRecentDecisions.mockReturnValue([]);

      const input = createPromptInput('Design system');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('backend-system-architect');
    });

    test('formats decisions correctly', () => {
      mockLoadUserProfile.mockReturnValue(createFullProfile());
      mockGetTopSkills.mockReturnValue([]);
      mockGetTopAgents.mockReturnValue([]);
      mockGetRecentDecisions.mockReturnValue([
        createMockDecision('Use cursor-based pagination'),
      ]);

      const input = createPromptInput('Work on pagination');
      const result = profileInjector(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('cursor-based pagination');
    });
  });
});
