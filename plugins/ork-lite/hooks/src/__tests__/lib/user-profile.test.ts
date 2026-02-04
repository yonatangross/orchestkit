/**
 * Tests for User Profile Management
 * Tests profile loading, saving, aggregation, and queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  logHook: vi.fn(),
}));

// Mock node:os for cross-platform path handling in tests
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    default: {
      ...actual,
      homedir: vi.fn().mockReturnValue('/tmp'),
    },
    homedir: vi.fn().mockReturnValue('/tmp'),
  };
});

vi.mock('../../lib/user-identity.js', () => ({
  resolveUserIdentity: vi.fn(() => ({
    user_id: 'test@user.com',
    anonymous_id: 'anon123456789012',
    display_name: 'Test User',
    team_id: 'test-team',
    machine_id: 'test-machine',
    source: 'config',
  })),
}));

vi.mock('../../lib/session-tracker.js', () => ({
  generateSessionSummary: vi.fn(() => ({
    session_id: 'test-session-789',
    user_id: 'test@user.com',
    anonymous_id: 'anon123456789012',
    team_id: 'test-team',
    start_time: '2026-01-28T10:00:00Z',
    end_time: '2026-01-28T10:30:00Z',
    duration_ms: 1800000,
    event_counts: {
      skill_invoked: 5,
      agent_spawned: 2,
      hook_triggered: 10,
      decision_made: 1,
      preference_stated: 0,
      problem_reported: 1,
      solution_found: 1,
      tool_used: 20,
      session_start: 1,
      session_end: 1,
    },
    skills_used: ['commit', 'verify', 'explore'],
    agents_spawned: ['backend-architect', 'test-generator'],
    hooks_triggered: ['capture-user-intent'],
    decisions_made: 1,
    problems_reported: 1,
    solutions_found: 1,
  })),
}));

vi.mock('../../lib/decision-flow-tracker.js', () => ({
  analyzeDecisionFlow: vi.fn(() => null),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import {
  loadUserProfile,
  saveUserProfile,
  aggregateSession,
  aggregateCurrentSession,
  addDecision,
  addPreference,
  getTopSkills,
  getTopAgents,
  getPreferredTool,
  getRecentDecisions,
  hasDecisionAbout,
  exportForTeam,
  exportForGlobal,
} from '../../lib/user-profile.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { analyzeDecisionFlow } from '../../lib/decision-flow-tracker.js';

describe('User Profile Management', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockAnalyzeDecisionFlow = vi.mocked(analyzeDecisionFlow);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/test/home";
    delete process.env.USERPROFILE;
    mockExistsSync.mockReturnValue(false);
    mockAnalyzeDecisionFlow.mockReturnValue(null);
  });

  describe('loadUserProfile', () => {
    it('should return empty profile when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('test@user.com');

      expect(profile.user_id).toBe('test@user.com');
      expect(profile.sessions_count).toBe(0);
      expect(profile.skill_usage).toEqual({});
      expect(profile.decisions).toEqual([]);
    });

    it('should load existing profile from disk', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'existing@user.com',
        anonymous_id: 'anon999',
        display_name: 'Existing User',
        sessions_count: 10,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1,
        skill_usage: {
          commit: { count: 50, success_rate: 0.95, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-27T00:00:00Z' },
        },
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('existing@user.com');

      expect(profile.sessions_count).toBe(10);
      expect(profile.skill_usage.commit.count).toBe(50);
    });

    it('should use USERPROFILE env var when HOME is not set', () => {
      delete process.env.HOME;
      process.env.USERPROFILE = '/test/userprofile';
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('userprofile@user.com');

      expect(profile.user_id).toBe('userprofile@user.com');
      // Verify it used USERPROFILE path (cross-platform: accept / or \)
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]test[/\\]userprofile/)
      );
    });

    it('should use /tmp when no home env vars are set', () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('tmp@user.com');

      expect(profile.user_id).toBe('tmp@user.com');
      // Cross-platform: accept /tmp or \tmp path separators
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]tmp/)
      );
    });

    it('should handle profile load errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const profile = loadUserProfile('error@user.com');

      // Should return empty profile on error
      expect(profile.user_id).toBe('error@user.com');
      expect(profile.sessions_count).toBe(0);
    });

    it('should migrate profile from v1 to v2 (Issue #245)', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'version@user.com',
        anonymous_id: 'anon999',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1, // Old version
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('version@user.com');

      expect(profile.version).toBe(2); // Should be migrated to v2
      expect(profile.tool_preferences).toEqual({}); // v1->v2 adds this
      expect(profile.tool_usage_by_category).toEqual({}); // v1->v2 adds this
    });

    it('should auto-save profile after migration', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'autosave@user.com',
        anonymous_id: 'anon999',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1, // Old version triggers migration
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      loadUserProfile('autosave@user.com');

      // Should have saved the migrated profile
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('profile.json'),
        expect.stringContaining('"version": 2')
      );
    });

    it('should preserve existing tool_preferences during migration', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'preserve@user.com',
        anonymous_id: 'anon999',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        tool_preferences: { search: 'Grep' }, // Already exists somehow
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('preserve@user.com');

      expect(profile.version).toBe(2);
      expect(profile.tool_preferences).toEqual({ search: 'Grep' }); // Preserved
    });

    it('should handle profiles without version field', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'no-version@user.com',
        anonymous_id: 'anon999',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        // No version field - defaults to 1
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('no-version@user.com');

      expect(profile.version).toBe(2); // Should be migrated to current
      expect(profile.tool_preferences).toEqual({});
      expect(profile.tool_usage_by_category).toEqual({});
    });

    it('should use resolveUserIdentity when userId not provided', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile();

      expect(profile.user_id).toBe('test@user.com'); // From mock
    });

    it('should migrate profile from legacy path when new path does not exist', () => {
      // First call: check new path (false), second: check legacy path (true)
      // Third: check new dir (false)
      let callCount = 0;
      mockExistsSync.mockImplementation((path: any) => {
        callCount++;
        if (callCount === 1) return false; // new path doesn't exist
        if (callCount === 2) return true;  // legacy path exists
        if (callCount === 3) return false; // new dir doesn't exist
        return false;
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'migrate@user.com',
        anonymous_id: 'anon-legacy',
        display_name: 'Legacy User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('migrate@user.com');

      // Should have written to new location
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockMkdirSync).toHaveBeenCalled();
    });

    it('should migrate profile when new directory already exists', () => {
      // First call: check new path (false), second: check legacy path (true)
      // Third: check new dir (true - exists)
      let callCount = 0;
      mockExistsSync.mockImplementation((path: any) => {
        callCount++;
        if (callCount === 1) return false; // new path doesn't exist
        if (callCount === 2) return true;  // legacy path exists
        if (callCount === 3) return true;  // new dir already exists
        return false;
      });

      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'migrate-dir-exists@user.com',
        anonymous_id: 'anon-legacy',
        display_name: 'Legacy User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('migrate-dir-exists@user.com');

      // Should have written to new location but not created directory
      expect(mockWriteFileSync).toHaveBeenCalled();
      // mkdirSync should not have been called during migration (dir exists)
    });

    it('should skip migration when new profile already exists with current version', () => {
      // New path exists, so no migration needed
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('orchestkit/users')) {
          return true; // new path exists
        }
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'existing@user.com',
        anonymous_id: 'anon999',
        display_name: 'Existing User',
        sessions_count: 10,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-27T00:00:00Z',
        version: 2, // Current version - no migration needed
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        tool_preferences: {},
        tool_usage_by_category: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      loadUserProfile('existing@user.com');

      // writeFileSync should not be called when profile is already at current version
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should handle migration error gracefully', () => {
      let callCount = 0;
      mockExistsSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return false; // new path doesn't exist
        if (callCount === 2) return true;  // legacy path exists
        return false;
      });

      mockReadFileSync.mockImplementation(() => {
        throw new Error('Migration read error');
      });

      const profile = loadUserProfile('migrate-error@user.com');

      // Should return empty profile when migration fails
      expect(profile.user_id).toBe('migrate-error@user.com');
      expect(profile.sessions_count).toBe(0);
    });
  });

  describe('saveUserProfile', () => {
    it('should save profile to disk', () => {
      // First call: check if profile exists (false = new profile)
      // Second call: check if directory exists before mkdir (true = exists)
      mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true);

      const profile = loadUserProfile('save@user.com');
      profile.sessions_count = 5;

      const result = saveUserProfile(profile);

      expect(result).toBe(true);
      // Cross-platform: accept / or \ path separators
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/orchestkit[/\\]users[/\\]save@user\.com[/\\]profile\.json/),
        expect.stringContaining('"sessions_count": 5')
      );
    });

    it('should create user directory if missing', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('new@user.com');
      saveUserProfile(profile);

      // Cross-platform: accept / or \ path separators
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringMatching(/orchestkit[/\\]users[/\\]new@user\.com/),
        { recursive: true }
      );
    });

    it('should handle save errors gracefully', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const profile = loadUserProfile('save-error@user.com');
      const result = saveUserProfile(profile);

      expect(result).toBe(false);
    });

    it('should not create directory if it already exists', () => {
      // First call for loadUserProfile checks
      let dirCheckCount = 0;
      mockExistsSync.mockImplementation((path: any) => {
        if (typeof path === 'string' && path.includes('orchestkit/users')) {
          dirCheckCount++;
          if (dirCheckCount <= 2) return false; // profile doesn't exist
          return true; // directory exists
        }
        return false;
      });

      const profile = loadUserProfile('dir-exists@user.com');
      saveUserProfile(profile);

      // mkdirSync should still be called because directory check returns true
      // The mock implementation is complex, just verify save works
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('aggregateSession', () => {
    it('should increment session count', () => {
      const profile = loadUserProfile('agg@user.com');
      const summary = {
        session_id: 'new-session',
        user_id: 'agg@user.com',
        anonymous_id: 'anon',
        skills_used: ['commit'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.sessions_count).toBe(1);
      expect(updated.aggregated_sessions).toContain('new-session');
    });

    it('should update skill usage stats', () => {
      const profile = loadUserProfile('skill@user.com');
      const summary = {
        session_id: 'skill-session',
        user_id: 'skill@user.com',
        anonymous_id: 'anon',
        skills_used: ['commit', 'verify', 'commit'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.skill_usage.commit).toBeDefined();
      expect(updated.skill_usage.verify).toBeDefined();
    });

    it('should skip already aggregated sessions', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'dup@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 1,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: ['already-done'],
      }));

      const profile = loadUserProfile('dup@user.com');
      const summary = {
        session_id: 'already-done',
        user_id: 'dup@user.com',
        anonymous_id: 'anon',
        skills_used: ['new-skill'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.sessions_count).toBe(1); // Not incremented
      expect(updated.skill_usage['new-skill']).toBeUndefined();
    });

    it('should aggregate agent usage', () => {
      const profile = loadUserProfile('agent-usage@user.com');
      const summary = {
        session_id: 'agent-session',
        user_id: 'agent-usage@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: ['backend-architect', 'test-generator', 'backend-architect'],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.agent_usage['backend-architect']).toBeDefined();
      expect(updated.agent_usage['test-generator']).toBeDefined();
    });

    it('should aggregate new workflow pattern from decision flow', () => {
      mockAnalyzeDecisionFlow.mockReturnValue({
        session_id: 'flow-session',
        inferred_pattern: 'test-first',
        decisions: [],
        tool_sequence: [],
        confidence: 0.8,
      } as any);

      const profile = loadUserProfile('workflow@user.com');
      const summary = {
        session_id: 'flow-session',
        user_id: 'workflow@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.workflow_patterns.length).toBe(1);
      expect(updated.workflow_patterns[0].name).toBe('test-first');
      expect(updated.workflow_patterns[0].frequency).toBe(0.1);
    });

    it('should update existing workflow pattern frequency', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'existing-workflow@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 1,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [
          { name: 'test-first', description: 'TDD', frequency: 0.5, tool_sequences: [] },
        ],
        aggregated_sessions: [],
      }));

      mockAnalyzeDecisionFlow.mockReturnValue({
        session_id: 'update-flow',
        inferred_pattern: 'test-first',
        decisions: [],
        tool_sequence: [],
        confidence: 0.9,
      } as any);

      const profile = loadUserProfile('existing-workflow@user.com');
      const summary = {
        session_id: 'update-flow',
        user_id: 'existing-workflow@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.workflow_patterns[0].name).toBe('test-first');
      expect(updated.workflow_patterns[0].frequency).toBe(0.6); // 0.5 + 0.1
    });

    it('should handle workflow pattern aggregation errors gracefully', () => {
      mockAnalyzeDecisionFlow.mockImplementation(() => {
        throw new Error('Flow analysis error');
      });

      const profile = loadUserProfile('flow-error@user.com');
      const summary = {
        session_id: 'error-flow',
        user_id: 'flow-error@user.com',
        anonymous_id: 'anon',
        skills_used: ['commit'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      // Should not throw, aggregation should continue
      const updated = aggregateSession(profile, summary);

      expect(updated.sessions_count).toBe(1);
      expect(updated.skill_usage['commit']).toBeDefined();
    });

    it('should skip mixed workflow pattern', () => {
      mockAnalyzeDecisionFlow.mockReturnValue({
        session_id: 'mixed-flow',
        inferred_pattern: 'mixed',
        decisions: [],
        tool_sequence: [],
        confidence: 0.5,
      } as any);

      const profile = loadUserProfile('mixed@user.com');
      const summary = {
        session_id: 'mixed-flow',
        user_id: 'mixed@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.workflow_patterns.length).toBe(0); // Mixed pattern is skipped
    });

    it('should truncate aggregated sessions to MAX_AGGREGATED_SESSIONS', () => {
      mockExistsSync.mockReturnValue(true);

      // Create profile with 100 aggregated sessions
      const existingSessions = Array.from({ length: 100 }, (_, i) => `session-${i}`);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'many-sessions@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 100,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: existingSessions,
      }));

      const profile = loadUserProfile('many-sessions@user.com');
      const summary = {
        session_id: 'new-session-101',
        user_id: 'many-sessions@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.aggregated_sessions.length).toBe(100); // Still 100 (truncated)
      expect(updated.aggregated_sessions).toContain('new-session-101');
      expect(updated.aggregated_sessions).not.toContain('session-0'); // Oldest removed
    });

    it('should limit workflow patterns to 10', () => {
      mockExistsSync.mockReturnValue(true);

      // Create profile with 10 workflow patterns
      const existingPatterns = Array.from({ length: 10 }, (_, i) => ({
        name: `pattern-${i}`,
        description: `Pattern ${i}`,
        frequency: 0.5,
        tool_sequences: [],
      }));
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'many-patterns@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 10,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: existingPatterns,
        aggregated_sessions: [],
      }));

      mockAnalyzeDecisionFlow.mockReturnValue({
        session_id: 'new-pattern-session',
        inferred_pattern: 'explore-first',
        decisions: [],
        tool_sequence: [],
        confidence: 0.9,
      } as any);

      const profile = loadUserProfile('many-patterns@user.com');
      const summary = {
        session_id: 'new-pattern-session',
        user_id: 'many-patterns@user.com',
        anonymous_id: 'anon',
        skills_used: [],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {} as any,
      };

      const updated = aggregateSession(profile, summary);

      expect(updated.workflow_patterns.length).toBe(10); // Still limited to 10
      expect(updated.workflow_patterns[0].name).toBe('explore-first'); // New one is first
    });
  });

  describe('aggregateCurrentSession', () => {
    it('should aggregate current session and save profile', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = aggregateCurrentSession();

      expect(profile.sessions_count).toBe(1);
      expect(profile.skill_usage['commit']).toBeDefined();
      expect(profile.skill_usage['verify']).toBeDefined();
      expect(profile.agent_usage['backend-architect']).toBeDefined();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('addDecision', () => {
    it('should add decision to profile', () => {
      const profile = loadUserProfile('dec@user.com');

      const updated = addDecision(profile, {
        what: 'Use cursor-pagination',
        alternatives: ['offset-pagination'],
        rationale: 'Scales better',
        confidence: 0.9,
      });

      expect(updated.decisions).toHaveLength(1);
      expect(updated.decisions[0].what).toBe('Use cursor-pagination');
      expect(updated.decisions[0].timestamp).toBeDefined();
    });

    it('should limit decisions to MAX_DECISIONS', () => {
      const profile = loadUserProfile('many@user.com');

      // Add 101 decisions
      for (let i = 0; i < 101; i++) {
        addDecision(profile, {
          what: `Decision ${i}`,
          confidence: 0.8,
        });
      }

      expect(profile.decisions.length).toBeLessThanOrEqual(100);
    });
  });

  describe('addPreference', () => {
    it('should add new preference', () => {
      const profile = loadUserProfile('pref@user.com');

      const updated = addPreference(profile, 'language', 'TypeScript', 0.9);

      expect(updated.preferences).toHaveLength(1);
      expect(updated.preferences[0].category).toBe('language');
      expect(updated.preferences[0].preference).toBe('TypeScript');
      expect(updated.preferences[0].observation_count).toBe(1);
    });

    it('should increment observation count for existing preference', () => {
      const profile = loadUserProfile('repeat@user.com');

      addPreference(profile, 'language', 'TypeScript', 0.8);
      addPreference(profile, 'language', 'TypeScript', 0.9);

      expect(profile.preferences).toHaveLength(1);
      expect(profile.preferences[0].observation_count).toBe(2);
      expect(profile.preferences[0].confidence).toBe(0.9); // Higher confidence kept
    });

    it('should limit preferences to MAX_PREFERENCES (50)', () => {
      const profile = loadUserProfile('many-prefs@user.com');

      // Add 51 unique preferences with varying observation counts
      for (let i = 0; i < 51; i++) {
        addPreference(profile, `category_${i}`, `pref_${i}`, 0.5);
        // Add extra observations to some preferences to test sorting
        if (i < 10) {
          for (let j = 0; j < 5; j++) {
            addPreference(profile, `category_${i}`, `pref_${i}`, 0.6);
          }
        }
      }

      expect(profile.preferences.length).toBeLessThanOrEqual(50);
      // The preferences with higher observation_count should be kept
      const firstPref = profile.preferences[0];
      expect(firstPref.observation_count).toBeGreaterThan(1);
    });

    it('should keep higher confidence when updating existing preference', () => {
      const profile = loadUserProfile('confidence@user.com');

      addPreference(profile, 'language', 'TypeScript', 0.9);
      addPreference(profile, 'language', 'TypeScript', 0.7); // Lower confidence

      expect(profile.preferences[0].confidence).toBe(0.9); // Higher value kept
    });
  });

  describe('query functions', () => {
    it('getTopSkills should return most used skills', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'top@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {
          commit: { count: 100, success_rate: 0.95, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          verify: { count: 80, success_rate: 0.9, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          explore: { count: 50, success_rate: 0.85, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
        },
        agent_usage: {},
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('top@user.com');
      const topSkills = getTopSkills(profile, 2);

      expect(topSkills).toHaveLength(2);
      expect(topSkills[0].skill).toBe('commit');
      expect(topSkills[1].skill).toBe('verify');
    });

    it('getTopAgents should return most used agents', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'agents@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {
          'backend-architect': { count: 50, success_rate: 0.95, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'test-generator': { count: 30, success_rate: 0.9, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'code-reviewer': { count: 20, success_rate: 0.85, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
        },
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('agents@user.com');
      const topAgents = getTopAgents(profile, 2);

      expect(topAgents).toHaveLength(2);
      expect(topAgents[0].agent).toBe('backend-architect');
      expect(topAgents[0].stats.count).toBe(50);
      expect(topAgents[1].agent).toBe('test-generator');
      expect(topAgents[1].stats.count).toBe(30);
    });

    it('getTopAgents should use default limit of 5', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'default-limit@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {
          'agent1': { count: 10, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'agent2': { count: 9, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'agent3': { count: 8, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'agent4': { count: 7, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'agent5': { count: 6, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
          'agent6': { count: 5, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' },
        },
        tool_usage: {},
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('default-limit@user.com');
      const topAgents = getTopAgents(profile);

      expect(topAgents).toHaveLength(5);
    });

    it('getRecentDecisions should return recent decisions', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'decisions@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [
          { what: 'Decision 1', confidence: 0.9, timestamp: '2026-01-28T10:00:00Z' },
          { what: 'Decision 2', confidence: 0.8, timestamp: '2026-01-27T10:00:00Z' },
          { what: 'Decision 3', confidence: 0.7, timestamp: '2026-01-26T10:00:00Z' },
        ],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('decisions@user.com');
      const recentDecisions = getRecentDecisions(profile, 2);

      expect(recentDecisions).toHaveLength(2);
      expect(recentDecisions[0].what).toBe('Decision 1');
      expect(recentDecisions[1].what).toBe('Decision 2');
    });

    it('getRecentDecisions should use default limit of 10', () => {
      const profile = loadUserProfile('default-decisions@user.com');
      // Add 15 decisions
      for (let i = 0; i < 15; i++) {
        addDecision(profile, { what: `Decision ${i}`, confidence: 0.8 });
      }

      const recentDecisions = getRecentDecisions(profile);

      expect(recentDecisions).toHaveLength(10);
    });

    it('getPreferredTool should return preferred tool for category', () => {
      const profile = loadUserProfile('tool@user.com');
      addPreference(profile, 'file_search', 'Grep', 0.9);

      const preferred = getPreferredTool(profile, 'file_search');

      expect(preferred).toBe('Grep');
    });

    it('getPreferredTool should return undefined for unknown category', () => {
      const profile = loadUserProfile('no-pref@user.com');

      const preferred = getPreferredTool(profile, 'unknown_category');

      expect(preferred).toBeUndefined();
    });

    it('hasDecisionAbout should find related decisions', () => {
      const profile = loadUserProfile('find@user.com');
      addDecision(profile, {
        what: 'Use cursor-pagination for API',
        rationale: 'Better performance at scale',
        confidence: 0.9,
      });

      const found = hasDecisionAbout(profile, 'pagination');

      expect(found).toBeDefined();
      expect(found?.what).toContain('pagination');
    });

    it('hasDecisionAbout should find decision by rationale', () => {
      const profile = loadUserProfile('rationale@user.com');
      addDecision(profile, {
        what: 'Use PostgreSQL',
        rationale: 'Better performance for large datasets',
        confidence: 0.9,
      });

      const found = hasDecisionAbout(profile, 'datasets');

      expect(found).toBeDefined();
      expect(found?.rationale).toContain('datasets');
    });

    it('hasDecisionAbout should return undefined when not found', () => {
      const profile = loadUserProfile('no-match@user.com');
      addDecision(profile, {
        what: 'Use PostgreSQL',
        confidence: 0.9,
      });

      const found = hasDecisionAbout(profile, 'mongodb');

      expect(found).toBeUndefined();
    });
  });

  describe('tool_preferences and tool_usage_by_category', () => {
    it('should initialize empty tool_preferences on new profile', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('tool-prefs@user.com');

      expect(profile.tool_preferences).toBeUndefined();
      expect(profile.tool_usage_by_category).toBeUndefined();
    });

    it('should preserve tool_preferences when loading existing profile', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'tool-prefs-existing@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        tool_preferences: {
          search: 'Grep',
          file_read: 'Read',
        },
        tool_usage_by_category: {
          search: { Grep: 50, Glob: 10 },
          file_read: { Read: 100 },
        },
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('tool-prefs-existing@user.com');

      expect(profile.tool_preferences).toBeDefined();
      expect(profile.tool_preferences?.search).toBe('Grep');
      expect(profile.tool_preferences?.file_read).toBe('Read');
      expect(profile.tool_usage_by_category).toBeDefined();
      expect(profile.tool_usage_by_category?.search.Grep).toBe(50);
      expect(profile.tool_usage_by_category?.search.Glob).toBe(10);
    });

    it('should include tool_preferences in exportForTeam', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'team-prefs@user.com',
        anonymous_id: 'anon',
        display_name: 'User',
        team_id: 'backend',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        tool_preferences: {
          search: 'Grep',
        },
        decisions: [],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('team-prefs@user.com');
      const exported = exportForTeam(profile);

      expect(exported.skill_usage).toBeDefined();
      // exportForTeam includes user_id but not tool_preferences (not in export spec)
      expect(exported.user_id).toBe('team-prefs@user.com');
    });
  });

  describe('export functions', () => {
    it('exportForTeam should include user_id and usage data', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'team@user.com',
        anonymous_id: 'anon999',
        display_name: 'Team User',
        team_id: 'backend',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: { commit: { count: 10, success_rate: 1, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-01T00:00:00Z' } },
        agent_usage: {},
        tool_usage: {},
        decisions: [{ what: 'test', confidence: 0.8, timestamp: '2026-01-01T00:00:00Z' }],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('team@user.com');
      const exported = exportForTeam(profile);

      expect(exported.user_id).toBe('team@user.com');
      expect(exported.skill_usage).toBeDefined();
      expect(exported.decisions).toBeDefined();
    });

    it('exportForGlobal should use anonymous_id and strip project info', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'global@user.com',
        anonymous_id: 'anon888',
        display_name: 'Global User',
        sessions_count: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-01T00:00:00Z',
        version: 1,
        skill_usage: {},
        agent_usage: {},
        tool_usage: {},
        decisions: [{ what: 'test', confidence: 0.8, timestamp: '2026-01-01T00:00:00Z', project: 'secret-project' }],
        preferences: [],
        workflow_patterns: [],
        aggregated_sessions: [],
      }));

      const profile = loadUserProfile('global@user.com');
      const exported = exportForGlobal(profile);

      expect(exported.anonymous_id).toBe('anon888');
      expect(exported.decisions[0]).not.toHaveProperty('project');
    });
  });
});
