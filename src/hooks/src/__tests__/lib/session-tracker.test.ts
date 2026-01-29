/**
 * Tests for Session Event Tracker
 * Tests event tracking, session summaries, and cross-session queries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../lib/common.js', () => ({
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-456'),
  logHook: vi.fn(),
}));

vi.mock('../../lib/user-identity.js', () => ({
  getIdentityContext: vi.fn(() => ({
    session_id: 'test-session-456',
    user_id: 'test@user.com',
    anonymous_id: 'anon123456789012',
    team_id: 'test-team',
    machine_id: 'test-machine',
    identity_source: 'config',
    timestamp: '2026-01-28T10:00:00.000Z',
  })),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import {
  trackEvent,
  trackSkillInvoked,
  trackAgentSpawned,
  trackHookTriggered,
  trackDecisionMade,
  trackPreferenceStated,
  trackProblemReported,
  trackSolutionFound,
  trackToolUsed,
  trackSessionStart,
  trackSessionEnd,
  loadSessionEvents,
  generateSessionSummary,
  // GAP-008/009: Removed listSessionIds and getRecentUserSessions (dead code)
} from '../../lib/session-tracker.js';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';

describe('Session Event Tracker', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockAppendFileSync = vi.mocked(appendFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('trackEvent', () => {
    it('should create session directory if missing', () => {
      mockExistsSync.mockReturnValue(false);

      trackEvent('skill_invoked', 'commit', { success: true });

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('sessions/test-session-456'),
        { recursive: true }
      );
    });

    it('should append event to JSONL file', () => {
      mockExistsSync.mockReturnValue(true);

      trackEvent('skill_invoked', 'commit', { success: true });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('events.jsonl'),
        expect.stringContaining('"event_type":"skill_invoked"')
      );
    });

    it('should include identity context in event', () => {
      mockExistsSync.mockReturnValue(true);

      trackEvent('agent_spawned', 'backend-architect', { success: true });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.identity.user_id).toBe('test@user.com');
      expect(event.identity.team_id).toBe('test-team');
    });

    it('should generate unique event IDs', () => {
      mockExistsSync.mockReturnValue(true);

      trackEvent('tool_used', 'Read', { success: true });
      trackEvent('tool_used', 'Write', { success: true });

      const call1 = JSON.parse((mockAppendFileSync.mock.calls[0][1] as string).trim());
      const call2 = JSON.parse((mockAppendFileSync.mock.calls[1][1] as string).trim());

      expect(call1.event_id).not.toBe(call2.event_id);
    });
  });

  describe('convenience tracking functions', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('trackSkillInvoked should log skill events', () => {
      trackSkillInvoked('commit', '--amend', true, 150);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('skill_invoked');
      expect(event.payload.name).toBe('commit');
      expect(event.payload.input.args).toBe('--amend');
      expect(event.payload.duration_ms).toBe(150);
    });

    it('trackAgentSpawned should log agent events', () => {
      trackAgentSpawned('backend-architect', 'Design API endpoints', true);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('agent_spawned');
      expect(event.payload.name).toBe('backend-architect');
    });

    it('trackHookTriggered should log hook events', () => {
      trackHookTriggered('capture-user-intent', true, 25);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('hook_triggered');
      expect(event.payload.name).toBe('capture-user-intent');
    });

    it('trackDecisionMade should log decision events', () => {
      trackDecisionMade('Use cursor-pagination', 'Scales better', 0.85);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('decision_made');
      expect(event.payload.context).toBe('Use cursor-pagination');
      expect(event.payload.confidence).toBe(0.85);
    });

    it('trackPreferenceStated should log preference events', () => {
      trackPreferenceStated('TypeScript over JavaScript', 0.9);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('preference_stated');
      expect(event.payload.confidence).toBe(0.9);
    });

    it('trackProblemReported should log problem events', () => {
      trackProblemReported('Tests failing with timeout');

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('problem_reported');
      expect(event.payload.context).toBe('Tests failing with timeout');
    });

    it('trackSolutionFound should log solution events', () => {
      trackSolutionFound('Increased timeout to 5000ms', 'prob-123', 0.8);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('solution_found');
      expect(event.payload.input.problem_id).toBe('prob-123');
    });

    it('trackToolUsed should log tool events', () => {
      trackToolUsed('Grep', true, 50);

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('tool_used');
      expect(event.payload.name).toBe('Grep');
    });

    it('trackSessionStart should log session start', () => {
      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('session_start');
    });

    it('trackSessionEnd should log session end', () => {
      trackSessionEnd();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('session_end');
    });
  });

  describe('loadSessionEvents', () => {
    it('should return empty array when no events file', () => {
      mockExistsSync.mockReturnValue(false);

      const events = loadSessionEvents();

      expect(events).toEqual([]);
    });

    it('should parse JSONL events file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{"event_id":"1","event_type":"skill_invoked","payload":{"name":"commit"}}\n' +
        '{"event_id":"2","event_type":"agent_spawned","payload":{"name":"test-gen"}}\n'
      );

      const events = loadSessionEvents();

      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBe('skill_invoked');
      expect(events[1].event_type).toBe('agent_spawned');
    });
  });

  describe('generateSessionSummary', () => {
    it('should aggregate event counts', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{"event_id":"1","event_type":"skill_invoked","identity":{"timestamp":"2026-01-28T10:00:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"commit","success":true}}\n' +
        '{"event_id":"2","event_type":"skill_invoked","identity":{"timestamp":"2026-01-28T10:01:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"verify","success":true}}\n' +
        '{"event_id":"3","event_type":"agent_spawned","identity":{"timestamp":"2026-01-28T10:02:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"test-gen","success":true}}\n' +
        '{"event_id":"4","event_type":"decision_made","identity":{"timestamp":"2026-01-28T10:03:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"decision","success":true}}\n'
      );

      const summary = generateSessionSummary();

      expect(summary.event_counts.skill_invoked).toBe(2);
      expect(summary.event_counts.agent_spawned).toBe(1);
      expect(summary.event_counts.decision_made).toBe(1);
      expect(summary.skills_used).toContain('commit');
      expect(summary.skills_used).toContain('verify');
      expect(summary.agents_spawned).toContain('test-gen');
    });

    it('should calculate session duration', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{"event_id":"1","event_type":"session_start","identity":{"timestamp":"2026-01-28T10:00:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"session","success":true}}\n' +
        '{"event_id":"2","event_type":"session_end","identity":{"timestamp":"2026-01-28T10:30:00Z","user_id":"test@user.com","anonymous_id":"anon123"},"payload":{"name":"session","success":true}}\n'
      );

      const summary = generateSessionSummary();

      expect(summary.duration_ms).toBe(30 * 60 * 1000); // 30 minutes
    });
  });

  // GAP-008/009: Removed listSessionIds and getRecentUserSessions tests
  // These functions were dead code (never called by production)

  describe('event sanitization', () => {
    it('should redact sensitive data in input', () => {
      mockExistsSync.mockReturnValue(true);

      trackEvent('tool_used', 'Bash', {
        input: {
          command: 'echo test',
          password: 'secret123',
          api_key: 'sk-xxx',
        },
        success: true,
      });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.command).toBe('echo test');
      expect(event.payload.input.password).toBe('[REDACTED]');
      expect(event.payload.input.api_key).toBe('[REDACTED]');
    });

    it('should truncate long strings', () => {
      mockExistsSync.mockReturnValue(true);
      const longText = 'x'.repeat(1000);

      trackEvent('decision_made', 'decision', {
        context: longText,
        success: true,
      });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.context.length).toBeLessThan(1000);
      expect(event.payload.context).toContain('...');
    });
  });
});
