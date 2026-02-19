/**
 * Tests for Session Event Tracker
 * Tests event tracking, session summaries, and cross-session queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    writeFileSync: vi.fn(),
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
  trackCommunicationStyle,
  loadSessionEvents,
  generateSessionSummary,
  resetEventCounter,
  flushEventCounter,
  // GAP-008/009: Removed listSessionIds and getRecentUserSessions (dead code)
} from '../../lib/session-tracker.js';
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

describe('Session Event Tracker', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockAppendFileSync = vi.mocked(appendFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    // Reset counter state between tests
    resetEventCounter();
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

    it('trackToolUsed should include category in input', () => {
      trackToolUsed('Grep', true, 50, 'search');

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('tool_used');
      expect(event.payload.input.category).toBe('search');
    });
  });

  describe('trackCommunicationStyle', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('should track terse verbosity style', () => {
      trackCommunicationStyle({
        verbosity: 'terse',
        interaction_type: 'command',
        technical_level: 'expert',
      });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_type).toBe('communication_style_detected');
      expect(event.payload.name).toBe('communication');
      expect(event.payload.input.verbosity).toBe('terse');
      expect(event.payload.input.interaction_type).toBe('command');
      expect(event.payload.input.technical_level).toBe('expert');
    });

    it('should track moderate verbosity style', () => {
      trackCommunicationStyle({
        verbosity: 'moderate',
        interaction_type: 'question',
        technical_level: 'intermediate',
      });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.verbosity).toBe('moderate');
      expect(event.payload.input.interaction_type).toBe('question');
      expect(event.payload.input.technical_level).toBe('intermediate');
    });

    it('should track detailed verbosity style', () => {
      trackCommunicationStyle({
        verbosity: 'detailed',
        interaction_type: 'discussion',
        technical_level: 'beginner',
      });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.verbosity).toBe('detailed');
      expect(event.payload.input.interaction_type).toBe('discussion');
      expect(event.payload.input.technical_level).toBe('beginner');
    });
  });

  describe('trackSessionStart with time_of_day', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    // Helper to create local time for a specific hour
    // Use local time (no Z suffix) to ensure getHours() returns the expected value
    const createLocalTime = (hour: number) => {
      const date = new Date(2026, 0, 28, hour, 0, 0); // Jan 28, 2026, hour:00:00 local time
      return date;
    };

    it('should set morning for hour 5 (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(5));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('morning');
      vi.useRealTimers();
    });

    it('should set morning for hour 11', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(11));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('morning');
      vi.useRealTimers();
    });

    it('should set afternoon for hour 12 (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(12));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('afternoon');
      vi.useRealTimers();
    });

    it('should set afternoon for hour 16', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(16));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('afternoon');
      vi.useRealTimers();
    });

    it('should set evening for hour 17 (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(17));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('evening');
      vi.useRealTimers();
    });

    it('should set evening for hour 20', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(20));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('evening');
      vi.useRealTimers();
    });

    it('should set night for hour 21 (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(21));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('night');
      vi.useRealTimers();
    });

    it('should set night for hour 4 (before morning boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(createLocalTime(4));

      trackSessionStart();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('night');
      vi.useRealTimers();
    });

    it('should use provided time_of_day context when given', () => {
      trackSessionStart({ time_of_day: 'evening' });

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.payload.input.time_of_day).toBe('evening');
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

  describe('Persistent Event Counter (Issue #245)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset counter state BEFORE setting up mocks
      resetEventCounter();
      // Default: no counter file exists
      mockExistsSync.mockReturnValue(false);
    });

    it('should load persisted counter value on first event', () => {
      // Mock counter file exists with value 100
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return true;
        if (typeof path === 'string' && path.includes('sessions')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) {
          return JSON.stringify({ counter: 100, updated_at: new Date().toISOString() });
        }
        throw new Error('File not found');
      });

      trackEvent('skill_invoked', 'test', { success: true });

      // Event ID should be evt-{timestamp}-101 (loaded 100 + 1)
      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      expect(event.event_id).toMatch(/^evt-\d+-101$/);
    });

    it('should increment counter across events', () => {
      // No counter file - starts fresh
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return false;
        return true;
      });

      trackEvent('skill_invoked', 'first', { success: true });
      trackEvent('skill_invoked', 'second', { success: true });
      trackEvent('skill_invoked', 'third', { success: true });

      const event1 = JSON.parse((mockAppendFileSync.mock.calls[0][1] as string).trim());
      const event2 = JSON.parse((mockAppendFileSync.mock.calls[1][1] as string).trim());
      const event3 = JSON.parse((mockAppendFileSync.mock.calls[2][1] as string).trim());

      // Extract counter values from event IDs
      const counter1 = parseInt(event1.event_id.split('-').pop(), 10);
      const counter2 = parseInt(event2.event_id.split('-').pop(), 10);
      const counter3 = parseInt(event3.event_id.split('-').pop(), 10);

      expect(counter1).toBe(1);
      expect(counter2).toBe(counter1 + 1);
      expect(counter3).toBe(counter2 + 1);
    });

    it('should flush counter to file', () => {
      // No counter file - starts fresh
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return false;
        return true;
      });

      // Generate some events to increment counter
      trackEvent('skill_invoked', 'test', { success: true });

      // Force flush
      flushEventCounter();

      // Verify writeFileSync was called with counter data
      const writeCall = mockWriteFileSync.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('counter.json')
      );

      expect(writeCall).toBeDefined();
      if (writeCall) {
        const data = JSON.parse(writeCall[1] as string);
        expect(data.counter).toBe(1);
        expect(data.updated_at).toBeDefined();
      }
    });

    it('should reset counter state', () => {
      // No counter file - starts fresh
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return false;
        return true;
      });

      trackEvent('skill_invoked', 'first', { success: true });
      const event1 = JSON.parse((mockAppendFileSync.mock.calls[0][1] as string).trim());
      const counter1 = parseInt(event1.event_id.split('-').pop(), 10);
      expect(counter1).toBe(1);

      // Reset counter and clear mocks
      resetEventCounter();
      vi.clearAllMocks();

      // Re-setup mocks after clearAllMocks
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return false;
        return true;
      });

      trackEvent('skill_invoked', 'after-reset', { success: true });
      const event2 = JSON.parse((mockAppendFileSync.mock.calls[0][1] as string).trim());
      const counter2 = parseInt(event2.event_id.split('-').pop(), 10);

      // Counter should restart from 1 after reset
      expect(counter2).toBe(1);
    });

    it('should handle missing counter file gracefully', () => {
      mockExistsSync.mockReturnValue(false);

      // Should not throw
      expect(() => {
        trackEvent('skill_invoked', 'test', { success: true });
      }).not.toThrow();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      // Should start from 1
      expect(event.event_id).toMatch(/^evt-\d+-1$/);
    });

    it('should handle corrupted counter file gracefully', () => {
      mockExistsSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) return true;
        return true;
      });
      mockReadFileSync.mockImplementation((path: unknown) => {
        if (typeof path === 'string' && path.includes('counter.json')) {
          return 'invalid json';
        }
        throw new Error('File not found');
      });

      // Should not throw
      expect(() => {
        trackEvent('skill_invoked', 'test', { success: true });
      }).not.toThrow();

      const written = mockAppendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());

      // Should start from 1 when counter file is corrupted
      expect(event.event_id).toMatch(/^evt-\d+-1$/);
    });
  });
});
