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

describe('User Profile Management', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/test/home";
    mockExistsSync.mockReturnValue(false);
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
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('orchestkit/users/save@user.com/profile.json'),
        expect.stringContaining('"sessions_count": 5')
      );
    });

    it('should create user directory if missing', () => {
      mockExistsSync.mockReturnValue(false);

      const profile = loadUserProfile('new@user.com');
      saveUserProfile(profile);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('orchestkit/users/new@user.com'),
        { recursive: true }
      );
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

    it('getPreferredTool should return preferred tool for category', () => {
      const profile = loadUserProfile('tool@user.com');
      addPreference(profile, 'file_search', 'Grep', 0.9);

      const preferred = getPreferredTool(profile, 'file_search');

      expect(preferred).toBe('Grep');
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
