/**
 * Tests for Usage Summary Reporter Hook (#1007)
 *
 * Covers: no-op guard, happy path POST, error/timeout handling,
 * payload shape, HMAC signing, project slug resolution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies BEFORE importing the module
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getSessionId: vi.fn(() => 'test-session-001'),
  getCachedBranch: vi.fn(() => 'main'),
  getProjectDir: vi.fn(() => '/Users/test/coding/orchestkit'),
}));

vi.mock('../../lib/token-tracker.js', () => ({
  getTokenState: vi.fn(() => ({
    sessionId: 'test-session-001',
    totalTokensInjected: 5000,
    byHook: { 'profile-injector': 3000 },
    byCategory: { context_injection: 5000 },
    records: [],
  })),
}));

vi.mock('../../lib/orchestration-state.js', () => ({
  getWebhookUrl: vi.fn(),
}));

vi.mock('../../lib/session-tracker.js', () => ({
  generateSessionSummary: vi.fn(() => ({
    session_id: 'test-session-001',
    user_id: 'user-123',
    anonymous_id: 'anon-456',
    team_id: 'team-789',
    start_time: '2026-03-10T20:00:00Z',
    end_time: '2026-03-10T21:00:00Z',
    duration_ms: 3600000,
    event_counts: {
      skill_invoked: 3,
      agent_spawned: 2,
      hook_triggered: 15,
      decision_made: 1,
      preference_stated: 0,
      problem_reported: 0,
      solution_found: 1,
      tool_used: 50,
      session_start: 1,
      session_end: 1,
      communication_style_detected: 0,
    },
    skills_used: ['assess', 'verify'],
    agents_spawned: ['Explore', 'Plan'],
    hooks_triggered: ['pre-commit-blocker', 'session-tracker'],
    decisions_made: 1,
    problems_reported: 0,
    solutions_found: 1,
  })),
}));

// Mock node:fs for HOOK_VERSION reading
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ version: '7.2.2' })),
  existsSync: vi.fn(() => false),
}));

import { usageSummaryReporter, signPayload, getProjectSlug } from '../../lifecycle/usage-summary-reporter.js';
import { logHook } from '../../lib/common.js';
import { getWebhookUrl } from '../../lib/orchestration-state.js';
import type { HookInput } from '../../types.js';

describe('Usage Summary Reporter Hook', () => {
  const mockLogHook = vi.mocked(logHook);
  const mockGetWebhookUrl = vi.mocked(getWebhookUrl);
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const defaultInput: HookInput = {
    hook_event: 'SessionEnd' as HookInput['hook_event'],
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
    project_dir: '/Users/test/coding/orchestkit',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    globalThis.fetch = mockFetch as typeof globalThis.fetch;
    vi.stubEnv('ORCHESTKIT_HOOK_TOKEN', 'test-fixture-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  // ===========================================================================
  // SECTION 1: No-Op Guard (missing config)
  // ===========================================================================
  describe('No-Op Guard', () => {
    it('should skip when webhook URL is missing', async () => {
      mockGetWebhookUrl.mockReturnValue(undefined);

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogHook).toHaveBeenCalledWith(
        'usage-summary-reporter',
        'No webhookUrl/TOKEN configured, skipping',
      );
    });

    it('should skip when hook token is missing', async () => {
      mockGetWebhookUrl.mockReturnValue('https://api.example.com');
      vi.stubEnv('ORCHESTKIT_HOOK_TOKEN', '');

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip when both URL and token are missing', async () => {
      mockGetWebhookUrl.mockReturnValue(undefined);
      vi.stubEnv('ORCHESTKIT_HOOK_TOKEN', '');

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 2: Happy Path POST
  // ===========================================================================
  describe('Happy Path', () => {
    beforeEach(() => {
      mockGetWebhookUrl.mockReturnValue('https://hq.example.com/api/hooks');
    });

    it('should POST to /ingest endpoint', async () => {
      await usageSummaryReporter(defaultInput);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://hq.example.com/api/hooks/ingest');
    });

    it('should strip trailing slash from webhook URL', async () => {
      mockGetWebhookUrl.mockReturnValue('https://hq.example.com/api/hooks/');

      await usageSummaryReporter(defaultInput);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://hq.example.com/api/hooks/ingest');
    });

    it('should include HMAC signature header', async () => {
      await usageSummaryReporter(defaultInput);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-CC-Hooks-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should send correct payload shape', async () => {
      await usageSummaryReporter(defaultInput);

      const [, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body);

      // Top-level fields
      expect(payload.event).toBe('SessionEnd');
      expect(payload.session_id).toBe('test-session-001');
      expect(payload.project).toBe('orchestkit');
      expect(payload.timestamp).toBeDefined();

      // Token usage
      expect(payload.data.token_usage).toEqual({
        totalTokensInjected: 5000,
        byHook: { 'profile-injector': 3000 },
        byCategory: { context_injection: 5000 },
      });

      // Usage summary — the unique OrchestKit data
      expect(payload.data.usage_summary.skills_used).toEqual(['assess', 'verify']);
      expect(payload.data.usage_summary.agents_spawned).toEqual(['Explore', 'Plan']);
      expect(payload.data.usage_summary.hooks_triggered).toEqual(['pre-commit-blocker', 'session-tracker']);
      expect(payload.data.usage_summary.event_counts.skill_invoked).toBe(3);
      expect(payload.data.usage_summary.duration_ms).toBe(3600000);

      // Metadata
      expect(payload.metadata.branch).toBe('main');
      expect(payload.metadata.hook_version).toBeDefined();
    });

    it('should NOT leak user_id or anonymous_id in payload', async () => {
      await usageSummaryReporter(defaultInput);

      const [, options] = mockFetch.mock.calls[0];
      const body = options.body;

      expect(body).not.toContain('user-123');
      expect(body).not.toContain('anon-456');
      expect(body).not.toContain('team-789');
    });

    it('should use hook_event from input when present', async () => {
      const input = { ...defaultInput, hook_event: 'Stop' as HookInput['hook_event'] };
      await usageSummaryReporter(input);

      const [, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload.event).toBe('Stop');
    });

    it('should set AbortSignal timeout of 4000ms', async () => {
      await usageSummaryReporter(defaultInput);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
    });

    it('should return silent success after successful POST', async () => {
      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log POST status on success', async () => {
      mockFetch.mockResolvedValue({ status: 202 });

      await usageSummaryReporter(defaultInput);

      expect(mockLogHook).toHaveBeenCalledWith(
        'usage-summary-reporter',
        'POST complete: 202',
      );
    });
  });

  // ===========================================================================
  // SECTION 3: Error / Bad Path
  // ===========================================================================
  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetWebhookUrl.mockReturnValue('https://hq.example.com/api/hooks');
    });

    it('should return silent success on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log warning on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await usageSummaryReporter(defaultInput);

      expect(mockLogHook).toHaveBeenCalledWith(
        'usage-summary-reporter',
        'POST failed (non-blocking): ECONNREFUSED',
        'warn',
      );
    });

    it('should return silent success on fetch timeout', async () => {
      mockFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should handle non-Error throws gracefully', async () => {
      mockFetch.mockRejectedValue('string error');

      const result = await usageSummaryReporter(defaultInput);

      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'usage-summary-reporter',
        'POST failed (non-blocking): string error',
        'warn',
      );
    });

    it('should return silent success on HTTP 500', async () => {
      mockFetch.mockResolvedValue({ status: 500 });

      const result = await usageSummaryReporter(defaultInput);

      // Fire-and-forget: even 500 is non-blocking
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });
  });

  // ===========================================================================
  // SECTION 4: Helper Functions
  // ===========================================================================
  describe('signPayload', () => {
    it('should produce sha256-prefixed hex string', () => {
      const sig = signPayload('{"test":true}', 'secret');

      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should be deterministic for same inputs', () => {
      const sig1 = signPayload('same body', 'same key');
      const sig2 = signPayload('same body', 'same key');

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different bodies', () => {
      const sig1 = signPayload('body A', 'key');
      const sig2 = signPayload('body B', 'key');

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const sig1 = signPayload('same body', 'key1');
      const sig2 = signPayload('same body', 'key2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('getProjectSlug', () => {
    it('should extract slug from input.project_dir', () => {
      const slug = getProjectSlug({ project_dir: '/Users/test/coding/my-project' } as HookInput);

      expect(slug).toBe('my-project');
    });

    it('should fall back to getProjectDir when input has no project_dir', () => {
      const slug = getProjectSlug({} as HookInput);

      // getProjectDir mock returns '/Users/test/coding/orchestkit'
      expect(slug).toBe('orchestkit');
    });

    it('should return "unknown" for root path', () => {
      const slug = getProjectSlug({ project_dir: '/' } as HookInput);

      // '/'.split('/').pop() returns '' → fallback to 'unknown'
      expect(slug).toBe('unknown');
    });
  });
});
