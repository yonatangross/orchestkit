/**
 * Tests for Session Profile Aggregator Hook
 *
 * Tests session data aggregation into user profiles at session end.
 * Covers: happy path, skip aggregation, identity resolution, profile operations,
 * global sharing, decision filtering, and error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-001'),
}));

// Mock user identity
vi.mock('../../lib/user-identity.js', () => ({
  resolveUserIdentity: vi.fn(),
  canShare: vi.fn(),
  getPrivacySettings: vi.fn(),
}));

// Mock session tracker
vi.mock('../../lib/session-tracker.js', () => ({
  generateSessionSummary: vi.fn(),
}));

// Mock user profile
vi.mock('../../lib/user-profile.js', () => ({
  loadUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  aggregateSession: vi.fn(),
  exportForGlobal: vi.fn(),
}));

import { sessionProfileAggregator } from '../../stop/session-profile-aggregator.js';
import { logHook, outputSilentSuccess } from '../../lib/common.js';
import { resolveUserIdentity, canShare, getPrivacySettings } from '../../lib/user-identity.js';
import { generateSessionSummary } from '../../lib/session-tracker.js';
import { loadUserProfile, saveUserProfile, aggregateSession, exportForGlobal } from '../../lib/user-profile.js';
import type { HookInput } from '../../types.js';

describe('Session Profile Aggregator Hook', () => {
  // Type-cast mocks for better TypeScript support
  const mockLogHook = vi.mocked(logHook);
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockResolveUserIdentity = vi.mocked(resolveUserIdentity);
  const mockCanShare = vi.mocked(canShare);
  const mockGetPrivacySettings = vi.mocked(getPrivacySettings);
  const mockGenerateSessionSummary = vi.mocked(generateSessionSummary);
  const mockLoadUserProfile = vi.mocked(loadUserProfile);
  const mockSaveUserProfile = vi.mocked(saveUserProfile);
  const mockAggregateSession = vi.mocked(aggregateSession);
  const mockExportForGlobal = vi.mocked(exportForGlobal);

  // Default test input
  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  // Default mock values
  const defaultIdentity = {
    user_id: 'alice@company.com',
    anonymous_id: 'anon123456789012',
    display_name: 'Alice Smith',
    team_id: 'backend-team',
    machine_id: 'dev-machine',
    source: 'config' as const,
    email: 'alice@company.com',
  };

  const defaultSummary = {
    session_id: 'test-session-001',
    user_id: 'alice@company.com',
    anonymous_id: 'anon123456789012',
    team_id: 'backend-team',
    start_time: '2026-01-28T10:00:00Z',
    end_time: '2026-01-28T10:30:00Z',
    duration_ms: 1800000,
    event_counts: {
      skill_invoked: 5,
      agent_spawned: 2,
      hook_triggered: 10,
      decision_made: 3,
      preference_stated: 1,
      problem_reported: 1,
      solution_found: 1,
      tool_used: 20,
      session_start: 1,
      session_end: 1,
      communication_style_detected: 0,
    },
    skills_used: ['commit', 'verify', 'explore'],
    agents_spawned: ['backend-architect', 'test-generator'],
    hooks_triggered: ['capture-user-intent'],
    decisions_made: 3,
    problems_reported: 1,
    solutions_found: 1,
  };

  const defaultProfile = {
    user_id: 'alice@company.com',
    anonymous_id: 'anon123456789012',
    display_name: 'Alice Smith',
    team_id: 'backend-team',
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
  };

  const defaultPrivacySettings = {
    share_with_team: true,
    share_globally: false,
    share_decisions: true,
    share_preferences: true,
    share_skill_usage: false,
    share_prompts: false,
    anonymize_globally: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    mockResolveUserIdentity.mockReturnValue(defaultIdentity);
    mockGenerateSessionSummary.mockReturnValue(defaultSummary);
    mockLoadUserProfile.mockReturnValue({ ...defaultProfile });
    mockSaveUserProfile.mockReturnValue(true);
    mockAggregateSession.mockImplementation((profile) => ({
      ...profile,
      sessions_count: profile.sessions_count + 1,
    }));
    mockGetPrivacySettings.mockReturnValue(defaultPrivacySettings);
    mockCanShare.mockReturnValue(false);
    mockExportForGlobal.mockReturnValue({
      anonymous_id: 'anon123456789012',
      decisions: [],
      preferences: [],
    });
  });

  // ===========================================================================
  // SECTION 1: Happy Path Tests (Core Functionality)
  // ===========================================================================
  describe('Happy Path - Full Aggregation Flow', () => {
    it('should aggregate session with skills, agents, and decisions successfully', () => {
      // Arrange
      const summary = { ...defaultSummary };

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockResolveUserIdentity).toHaveBeenCalled();
      expect(mockGenerateSessionSummary).toHaveBeenCalled();
      expect(mockLoadUserProfile).toHaveBeenCalledWith('alice@company.com');
      expect(mockAggregateSession).toHaveBeenCalled();
      expect(mockSaveUserProfile).toHaveBeenCalled();
    });

    it('should log info message with aggregated counts on success', () => {
      // Arrange - default mocks

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Aggregated session: 3 skills, 2 agents, 3 decisions',
        'info'
      );
    });

    it('should pass user identity user_id to loadUserProfile', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        user_id: 'bob@example.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('bob@example.com');
    });

    it('should call aggregateSession with loaded profile and summary', () => {
      // Arrange
      const profile = { ...defaultProfile, sessions_count: 10 };
      mockLoadUserProfile.mockReturnValue(profile);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockAggregateSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessions_count: 10 }),
        defaultSummary
      );
    });

    it('should save the updated profile after aggregation', () => {
      // Arrange
      const updatedProfile = { ...defaultProfile, sessions_count: 6 };
      mockAggregateSession.mockReturnValue(updatedProfile);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockSaveUserProfile).toHaveBeenCalledWith(updatedProfile);
    });

    it('should always return silent success result', () => {
      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 2: Skip Aggregation - No Meaningful Activity
  // ===========================================================================
  describe('Skip Aggregation - No Meaningful Activity', () => {
    it('should skip when skills_used is empty', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLoadUserProfile).not.toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'No meaningful activity to aggregate',
        'debug'
      );
    });

    it('should skip when agents_spawned is empty and no skills or decisions', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockAggregateSession).not.toHaveBeenCalled();
      expect(mockSaveUserProfile).not.toHaveBeenCalled();
    });

    it('should skip when decisions_made is 0 and no skills or agents', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).not.toHaveBeenCalled();
    });

    it('should aggregate when only skills_used has items', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: ['commit'],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalled();
      expect(mockAggregateSession).toHaveBeenCalled();
    });

    it('should aggregate when only agents_spawned has items', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: ['backend-architect'],
        decisions_made: 0,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalled();
      expect(mockAggregateSession).toHaveBeenCalled();
    });

    it('should aggregate when only decisions_made > 0', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 1,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalled();
      expect(mockAggregateSession).toHaveBeenCalled();
    });

    it('should return silent success even when skipping', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 3: User Identity Resolution Tests
  // ===========================================================================
  describe('User Identity Resolution', () => {
    it('should use identity from config source', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        source: 'config',
        user_id: 'config-user@test.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('config-user@test.com');
    });

    it('should use identity from git source', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        source: 'git',
        user_id: 'git-user@example.com',
        email: 'git-user@example.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('git-user@example.com');
    });

    it('should use identity from env source', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        source: 'env',
        user_id: 'envuser@dev-machine',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('envuser@dev-machine');
    });

    it('should use anonymous identity when other sources fail', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        user_id: 'anon-abc12345',
        anonymous_id: 'abc1234567890123',
        display_name: 'Anonymous',
        machine_id: 'unknown-machine',
        source: 'anonymous',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('anon-abc12345');
    });

    it('should log debug message with user_id on identity resolution', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        user_id: 'debug-user@test.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Aggregating session for debug-user@test.com',
        'debug'
      );
    });

    it('should handle identity with team_id', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        team_id: 'engineering-team',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - team_id flows through to profile
      expect(mockLoadUserProfile).toHaveBeenCalled();
    });

    it('should handle identity without team_id', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        team_id: undefined,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 4: Profile Loading and Saving Tests
  // ===========================================================================
  describe('Profile Loading and Saving', () => {
    it('should load existing profile successfully', () => {
      // Arrange
      const existingProfile = {
        ...defaultProfile,
        sessions_count: 20,
        skill_usage: { commit: { count: 50, success_rate: 0.95, first_used: '2026-01-01T00:00:00Z', last_used: '2026-01-27T00:00:00Z' } },
      };
      mockLoadUserProfile.mockReturnValue(existingProfile);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockAggregateSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessions_count: 20 }),
        expect.anything()
      );
    });

    it('should handle new user with empty profile', () => {
      // Arrange
      const emptyProfile = {
        ...defaultProfile,
        sessions_count: 0,
        skill_usage: {},
        agent_usage: {},
        decisions: [],
      };
      mockLoadUserProfile.mockReturnValue(emptyProfile);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockAggregateSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessions_count: 0 }),
        expect.anything()
      );
    });

    it('should save profile successfully when saveUserProfile returns true', () => {
      // Arrange
      mockSaveUserProfile.mockReturnValue(true);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockSaveUserProfile).toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('Aggregated session'),
        'info'
      );
    });

    it('should log warning when saveUserProfile returns false', () => {
      // Arrange
      mockSaveUserProfile.mockReturnValue(false);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Failed to save profile',
        'warn'
      );
    });

    it('should return silent success even when save fails', () => {
      // Arrange
      mockSaveUserProfile.mockReturnValue(false);

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should not proceed to global sharing when save fails', () => {
      // Arrange
      mockSaveUserProfile.mockReturnValue(false);
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockExportForGlobal).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 5: Global Sharing - Privacy Settings Tests
  // ===========================================================================
  describe('Global Sharing - Privacy Settings', () => {
    it('should not export when share_globally is false', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: false,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockExportForGlobal).not.toHaveBeenCalled();
    });

    it('should not export when canShare returns false for decisions', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(false);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockExportForGlobal).not.toHaveBeenCalled();
    });

    it('should export when both share_globally and canShare are true', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Use TypeScript', confidence: 0.9, rationale: 'Type safety', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockExportForGlobal).toHaveBeenCalled();
    });

    it('should call canShare with correct arguments', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockCanShare).toHaveBeenCalledWith('decisions', 'global');
    });

    it('should check privacy settings after successful save', () => {
      // Arrange
      mockSaveUserProfile.mockReturnValue(true);
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockGetPrivacySettings).toHaveBeenCalled();
      expect(mockCanShare).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 6: Decision Confidence Filtering Tests
  // ===========================================================================
  describe('Decision Confidence Filtering', () => {
    it('should filter decisions with confidence < 0.8', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Low confidence', confidence: 0.5, timestamp: '2026-01-28T10:00:00Z' },
          { what: 'High confidence', confidence: 0.9, rationale: 'Good reason', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - the filtering happens in the hook, check log was called
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        '1 decisions eligible for global sharing',
        'info'
      );
    });

    it('should filter decisions without rationale', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'No rationale', confidence: 0.95, timestamp: '2026-01-28T10:00:00Z' },
          { what: 'With rationale', confidence: 0.85, rationale: 'Because', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        '1 decisions eligible for global sharing',
        'info'
      );
    });

    it('should accept decisions with confidence exactly 0.8', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Exact threshold', confidence: 0.8, rationale: 'Meets threshold', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        '1 decisions eligible for global sharing',
        'info'
      );
    });

    it('should not log when no decisions pass filtering', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Low conf no rationale', confidence: 0.5, timestamp: '2026-01-28T10:00:00Z' },
          { what: 'High conf no rationale', confidence: 0.9, timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - should NOT log "decisions eligible" message
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('eligible for global sharing'),
        'info'
      );
    });

    it('should handle empty decisions array', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('eligible for global sharing'),
        'info'
      );
    });

    it('should log correct count when multiple decisions pass filter', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Decision 1', confidence: 0.9, rationale: 'Reason 1', timestamp: '2026-01-28T10:00:00Z' },
          { what: 'Decision 2', confidence: 0.85, rationale: 'Reason 2', timestamp: '2026-01-28T10:00:00Z' },
          { what: 'Decision 3', confidence: 0.8, rationale: 'Reason 3', timestamp: '2026-01-28T10:00:00Z' },
          { what: 'Low conf', confidence: 0.7, rationale: 'Reason 4', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        '3 decisions eligible for global sharing',
        'info'
      );
    });
  });

  // ===========================================================================
  // SECTION 7: Error Handling Tests
  // ===========================================================================
  describe('Error Handling', () => {
    it('should catch and log error when resolveUserIdentity throws', () => {
      // Arrange
      mockResolveUserIdentity.mockImplementation(() => {
        throw new Error('Identity resolution failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('Error aggregating session'),
        'error'
      );
    });

    it('should catch and log error when generateSessionSummary throws', () => {
      // Arrange
      mockGenerateSessionSummary.mockImplementation(() => {
        throw new Error('Summary generation failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Summary generation failed',
        'error'
      );
    });

    it('should catch and log error when loadUserProfile throws', () => {
      // Arrange
      mockLoadUserProfile.mockImplementation(() => {
        throw new Error('Profile load failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Profile load failed',
        'error'
      );
    });

    it('should catch and log error when aggregateSession throws', () => {
      // Arrange
      mockAggregateSession.mockImplementation(() => {
        throw new Error('Aggregation failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Aggregation failed',
        'error'
      );
    });

    it('should catch and log error when saveUserProfile throws', () => {
      // Arrange
      mockSaveUserProfile.mockImplementation(() => {
        throw new Error('Save failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Save failed',
        'error'
      );
    });

    it('should catch and log error when getPrivacySettings throws', () => {
      // Arrange
      mockGetPrivacySettings.mockImplementation(() => {
        throw new Error('Privacy settings failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Privacy settings failed',
        'error'
      );
    });

    it('should catch and log error when exportForGlobal throws', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockImplementation(() => {
        throw new Error('Export failed');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Error aggregating session: Error: Export failed',
        'error'
      );
    });

    it('should always return silent success even on error', () => {
      // Arrange
      mockResolveUserIdentity.mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // SECTION 8: Edge Cases Tests
  // ===========================================================================
  describe('Edge Cases', () => {
    it('should handle undefined rationale in decisions', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'No rationale', confidence: 0.95, rationale: undefined, timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act - should not throw
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should handle zero confidence decisions', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Zero confidence', confidence: 0, rationale: 'Some reason', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - should filter out zero confidence
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('eligible for global sharing'),
        'info'
      );
    });

    it('should handle confidence of exactly 1.0', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Perfect confidence', confidence: 1.0, rationale: 'Certainty', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        '1 decisions eligible for global sharing',
        'info'
      );
    });

    it('should handle empty string rationale as falsy', () => {
      // Arrange
      mockGetPrivacySettings.mockReturnValue({
        ...defaultPrivacySettings,
        share_globally: true,
      });
      mockCanShare.mockReturnValue(true);
      mockExportForGlobal.mockReturnValue({
        anonymous_id: 'anon123456789012',
        decisions: [
          { what: 'Empty rationale', confidence: 0.9, rationale: '', timestamp: '2026-01-28T10:00:00Z' },
        ],
        preferences: [],
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - empty string is falsy, should not pass filter
      expect(mockLogHook).not.toHaveBeenCalledWith(
        'session-profile-aggregator',
        expect.stringContaining('eligible for global sharing'),
        'info'
      );
    });

    it('should handle very long skill lists', () => {
      // Arrange
      const manySkills = Array.from({ length: 100 }, (_, i) => `skill-${i}`);
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: manySkills,
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockAggregateSession).toHaveBeenCalled();
    });

    it('should handle very long agent lists', () => {
      // Arrange
      const manyAgents = Array.from({ length: 50 }, (_, i) => `agent-${i}`);
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: manyAgents,
        decisions_made: 0,
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockAggregateSession).toHaveBeenCalled();
    });

    it('should handle special characters in user_id', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        user_id: 'user+tag@sub.domain.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('user+tag@sub.domain.com');
    });

    it('should handle unicode in display_name', () => {
      // Arrange
      mockResolveUserIdentity.mockReturnValue({
        ...defaultIdentity,
        display_name: 'User Name',
        user_id: 'unicode@test.com',
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).toHaveBeenCalledWith('unicode@test.com');
    });

    it('should handle null-ish values in summary gracefully', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: ['skill'],
        team_id: undefined,
        start_time: undefined,
        end_time: undefined,
        duration_ms: undefined,
      });

      // Act
      const result = sessionProfileAggregator(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 9: Session Summary Content Tests
  // ===========================================================================
  describe('Session Summary Content', () => {
    it('should log correct skills count in info message', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: ['skill1', 'skill2', 'skill3', 'skill4', 'skill5'],
        agents_spawned: ['agent1'],
        decisions_made: 2,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Aggregated session: 5 skills, 1 agents, 2 decisions',
        'info'
      );
    });

    it('should log correct agents count in info message', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: ['skill1'],
        agents_spawned: ['agent1', 'agent2', 'agent3'],
        decisions_made: 1,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Aggregated session: 1 skills, 3 agents, 1 decisions',
        'info'
      );
    });

    it('should log correct decisions count in info message', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: ['skill1'],
        agents_spawned: [],
        decisions_made: 10,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'session-profile-aggregator',
        'Aggregated session: 1 skills, 0 agents, 10 decisions',
        'info'
      );
    });

    it('should pass full summary to aggregateSession', () => {
      // Arrange
      const customSummary = {
        ...defaultSummary,
        session_id: 'custom-session-999',
        skills_used: ['custom-skill'],
        agents_spawned: ['custom-agent'],
        decisions_made: 7,
      };
      mockGenerateSessionSummary.mockReturnValue(customSummary);

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockAggregateSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          session_id: 'custom-session-999',
          skills_used: ['custom-skill'],
          agents_spawned: ['custom-agent'],
          decisions_made: 7,
        })
      );
    });
  });

  // ===========================================================================
  // SECTION 10: Integration Flow Tests
  // ===========================================================================
  describe('Integration Flow', () => {
    it('should execute full aggregation flow in correct order', () => {
      // Arrange
      const callOrder: string[] = [];
      mockResolveUserIdentity.mockImplementation(() => {
        callOrder.push('resolveUserIdentity');
        return defaultIdentity;
      });
      mockGenerateSessionSummary.mockImplementation(() => {
        callOrder.push('generateSessionSummary');
        return defaultSummary;
      });
      mockLoadUserProfile.mockImplementation(() => {
        callOrder.push('loadUserProfile');
        return { ...defaultProfile };
      });
      mockAggregateSession.mockImplementation((profile) => {
        callOrder.push('aggregateSession');
        return { ...profile, sessions_count: profile.sessions_count + 1 };
      });
      mockSaveUserProfile.mockImplementation(() => {
        callOrder.push('saveUserProfile');
        return true;
      });
      mockGetPrivacySettings.mockImplementation(() => {
        callOrder.push('getPrivacySettings');
        return defaultPrivacySettings;
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert - verify order
      expect(callOrder).toEqual([
        'resolveUserIdentity',
        'generateSessionSummary',
        'loadUserProfile',
        'aggregateSession',
        'saveUserProfile',
        'getPrivacySettings',
      ]);
    });

    it('should execute full global sharing flow when enabled', () => {
      // Arrange
      const callOrder: string[] = [];
      mockResolveUserIdentity.mockImplementation(() => {
        callOrder.push('resolveUserIdentity');
        return defaultIdentity;
      });
      mockGenerateSessionSummary.mockImplementation(() => {
        callOrder.push('generateSessionSummary');
        return defaultSummary;
      });
      mockLoadUserProfile.mockImplementation(() => {
        callOrder.push('loadUserProfile');
        return { ...defaultProfile };
      });
      mockAggregateSession.mockImplementation((profile) => {
        callOrder.push('aggregateSession');
        return { ...profile, sessions_count: profile.sessions_count + 1 };
      });
      mockSaveUserProfile.mockImplementation(() => {
        callOrder.push('saveUserProfile');
        return true;
      });
      mockGetPrivacySettings.mockImplementation(() => {
        callOrder.push('getPrivacySettings');
        return { ...defaultPrivacySettings, share_globally: true };
      });
      mockCanShare.mockImplementation(() => {
        callOrder.push('canShare');
        return true;
      });
      mockExportForGlobal.mockImplementation(() => {
        callOrder.push('exportForGlobal');
        return {
          anonymous_id: 'anon123456789012',
          decisions: [{ what: 'test', confidence: 0.9, rationale: 'reason', timestamp: '2026-01-28T10:00:00Z' }],
          preferences: [],
        };
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(callOrder).toContain('exportForGlobal');
      expect(callOrder.indexOf('saveUserProfile')).toBeLessThan(
        callOrder.indexOf('getPrivacySettings')
      );
    });

    it('should not call later functions when early skip occurs', () => {
      // Arrange
      mockGenerateSessionSummary.mockReturnValue({
        ...defaultSummary,
        skills_used: [],
        agents_spawned: [],
        decisions_made: 0,
      });

      // Act
      sessionProfileAggregator(defaultInput);

      // Assert
      expect(mockLoadUserProfile).not.toHaveBeenCalled();
      expect(mockAggregateSession).not.toHaveBeenCalled();
      expect(mockSaveUserProfile).not.toHaveBeenCalled();
      expect(mockGetPrivacySettings).not.toHaveBeenCalled();
      expect(mockExportForGlobal).not.toHaveBeenCalled();
    });
  });
});
