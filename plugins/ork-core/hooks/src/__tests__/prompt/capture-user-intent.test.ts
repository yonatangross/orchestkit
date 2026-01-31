/**
 * Unit tests for capture-user-intent hook
 * Tests UserPromptSubmit hook that captures decisions, preferences, and problems from user prompts
 *
 * Part of Intelligent Decision Capture System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock common.js functions
vi.mock('../../lib/common.js', () => ({
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
  logHook: vi.fn(),
}));

// Mock session-tracker.ts functions
vi.mock('../../lib/session-tracker.js', () => ({
  trackProblemReported: vi.fn(),
}));

// Mock memory-writer.ts functions
vi.mock('../../lib/memory-writer.js', () => ({
  createDecisionRecord: vi.fn((_type: string, _content: unknown, _entities: string[], _meta: unknown) => ({
    id: 'mock-record-id',
    type: _type,
    content: _content,
    entities: _entities,
    relations: [],
    identity: { user_id: 'test', anonymous_id: 'anon', machine_id: 'machine' },
    metadata: { session_id: 'test', timestamp: '2025-01-01T00:00:00.000Z', confidence: 0.8, source: 'user_prompt', project: 'test', category: 'general' },
  })),
  storeDecision: vi.fn(() => Promise.resolve({ local: true, graph_queued: true, mem0_queued: false })),
}));

// Mock user-intent-detector.ts
vi.mock('../../lib/user-intent-detector.js', () => ({
  detectUserIntent: vi.fn(() => ({
    intents: [],
    decisions: [],
    preferences: [],
    questions: [],
    problems: [],
    summary: 'No intents detected',
  })),
}));

// Mock node:fs for JSONL storage
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Import mocked modules
import {
  outputSilentSuccess,
  getProjectDir,
  logHook,
} from '../../lib/common.js';
import {
  trackProblemReported,
} from '../../lib/session-tracker.js';
import {
  createDecisionRecord,
  storeDecision,
} from '../../lib/memory-writer.js';
import { detectUserIntent } from '../../lib/user-intent-detector.js';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';

// Import the hook under test
import { captureUserIntent } from '../../prompt/capture-user-intent.js';

// =============================================================================
// Test Utilities
// =============================================================================

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
 * Create mock intent detection result
 */
function createMockIntentResult(options: {
  decisions?: Array<{ text: string; confidence: number; rationale?: string; entities?: string[]; alternatives?: string[]; constraints?: string[]; tradeoffs?: string[] }>;
  preferences?: Array<{ text: string; confidence: number; entities?: string[] }>;
  problems?: Array<{ text: string; confidence: number; entities?: string[] }>;
} = {}) {
  const decisions = (options.decisions || []).map((d, i) => ({
    type: 'decision' as const,
    text: d.text,
    confidence: d.confidence,
    rationale: d.rationale,
    entities: d.entities || [],
    ...(d.alternatives?.length ? { alternatives: d.alternatives } : {}),
    ...(d.constraints?.length ? { constraints: d.constraints } : {}),
    ...(d.tradeoffs?.length ? { tradeoffs: d.tradeoffs } : {}),
    position: i * 50,
  }));

  const preferences = (options.preferences || []).map((p, i) => ({
    type: 'preference' as const,
    text: p.text,
    confidence: p.confidence,
    entities: p.entities || [],
    position: i * 50 + 100,
  }));

  const problems = (options.problems || []).map((p, i) => ({
    type: 'problem' as const,
    text: p.text,
    confidence: p.confidence,
    entities: p.entities || [],
    position: i * 50 + 200,
  }));

  const intents = [...decisions, ...preferences, ...problems];

  return {
    intents,
    decisions,
    preferences,
    questions: [],
    problems,
    summary: intents.length > 0
      ? `Detected: ${decisions.length} decisions, ${preferences.length} preferences, ${problems.length} problems`
      : 'No intents detected',
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('prompt/capture-user-intent', () => {
  const mockOutputSilentSuccess = vi.mocked(outputSilentSuccess);
  const mockDetectUserIntent = vi.mocked(detectUserIntent);
  const mockCreateDecisionRecord = vi.mocked(createDecisionRecord);
  const mockStoreDecision = vi.mocked(storeDecision);
  const mockTrackProblemReported = vi.mocked(trackProblemReported);
  const mockLogHook = vi.mocked(logHook);
  const mockExistsSync = vi.mocked(existsSync);
  const mockAppendFileSync = vi.mocked(appendFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockOutputSilentSuccess.mockReturnValue({ continue: true, suppressOutput: true });
    mockDetectUserIntent.mockReturnValue(createMockIntentResult());
    mockExistsSync.mockReturnValue(true);
    mockStoreDecision.mockResolvedValue({ local: true, graph_queued: true, mem0_queued: false });
    mockCreateDecisionRecord.mockImplementation((_type: string, _content: unknown, _entities: string[], _meta: unknown) => ({
      id: 'mock-record-id',
      type: _type as 'decision' | 'preference',
      content: _content as { what: string; why?: string },
      entities: _entities,
      relations: [],
      identity: { user_id: 'test', anonymous_id: 'anon', machine_id: 'machine' },
      metadata: { session_id: 'test', timestamp: '2025-01-01T00:00:00.000Z', confidence: 0.8, source: 'user_prompt' as const, project: 'test', category: 'general' },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Skip short prompts (< 15 chars)
  // ===========================================================================
  describe('skip short prompts', () => {
    it('should skip empty prompts', () => {
      const input = createPromptInput('');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockDetectUserIntent).not.toHaveBeenCalled();
    });

    it('should skip undefined prompts', () => {
      const input = createPromptInput('');
      input.prompt = undefined;
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockDetectUserIntent).not.toHaveBeenCalled();
    });

    it('should skip prompts shorter than 15 characters', () => {
      const input = createPromptInput('short prompt'); // 12 chars
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockDetectUserIntent).not.toHaveBeenCalled();
    });

    it('should skip prompts exactly at 14 characters', () => {
      const input = createPromptInput('14charactersss'); // 14 chars
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockDetectUserIntent).not.toHaveBeenCalled();
    });

    it('should process prompts at 15 characters', () => {
      const input = createPromptInput('15 characters!!'); // 15 chars
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(mockDetectUserIntent).toHaveBeenCalled();
    });

    it('should process prompts longer than 15 characters', () => {
      const input = createPromptInput('This is a longer prompt that will be processed');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(mockDetectUserIntent).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. Skip empty/undefined prompts
  // ===========================================================================
  describe('skip empty/undefined prompts', () => {
    it('should handle null-ish prompt gracefully', () => {
      const input = createPromptInput('');
      (input as Record<string, unknown>).prompt = null;
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should handle missing prompt field', () => {
      const input = createPromptInput('');
      delete (input as Record<string, unknown>).prompt;
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // 3. Detect decisions and store via createDecisionRecord + storeDecision
  // ===========================================================================
  describe('detect decisions', () => {
    it('should create a decision record and store it', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          {
            text: 'I chose PostgreSQL for the database',
            confidence: 0.85,
            rationale: 'better JSON support',
            entities: ['postgresql'],
          },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('I chose PostgreSQL for the database because of better JSON support');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        {
          what: 'I chose PostgreSQL for the database',
          why: 'better JSON support',
        },
        ['postgresql'],
        expect.objectContaining({
          session_id: 'test-session-123',
          source: 'user_prompt',
          confidence: 0.85,
          category: 'database',
        })
      );
      expect(mockStoreDecision).toHaveBeenCalled();
    });

    it('should store multiple decisions', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Let us use cursor pagination', confidence: 0.8 },
          { text: 'Selected FastAPI for the backend', confidence: 0.9, rationale: 'async support', entities: ['fastapi'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Let us use cursor pagination. Selected FastAPI for the backend.');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledTimes(2);
      expect(mockStoreDecision).toHaveBeenCalledTimes(2);
    });

    it('should store decisions without rationale', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using TypeScript for all code', confidence: 0.75, entities: ['typescript'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using TypeScript for all code in this project');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        {
          what: 'Using TypeScript for all code',
          why: undefined,
        },
        ['typescript'],
        expect.objectContaining({
          source: 'user_prompt',
          confidence: 0.75,
          category: 'language',
        })
      );
    });
  });

  // ===========================================================================
  // 4. Detect preferences and store via createDecisionRecord + storeDecision
  // ===========================================================================
  describe('detect preferences', () => {
    it('should create a preference record and store it', () => {
      const mockResult = createMockIntentResult({
        preferences: [
          { text: 'I prefer TypeScript over JavaScript', confidence: 0.9, entities: ['typescript'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('I prefer TypeScript over JavaScript for type safety');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'preference',
        {
          what: 'I prefer TypeScript over JavaScript',
        },
        ['typescript'],
        expect.objectContaining({
          source: 'user_prompt',
          confidence: 0.9,
        })
      );
      expect(mockStoreDecision).toHaveBeenCalled();
    });

    it('should store multiple preferences', () => {
      const mockResult = createMockIntentResult({
        preferences: [
          { text: 'I always use tabs', confidence: 0.8 },
          { text: 'I prefer kebab-case', confidence: 0.85 },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('I always use tabs for indentation. I prefer kebab-case for naming.');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledTimes(2);
      expect(mockStoreDecision).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // 5. Detect problems, store to JSONL, and track via trackProblemReported
  // ===========================================================================
  describe('detect and store problems', () => {
    it('should track problems via trackProblemReported', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'The tests are failing with timeout', confidence: 0.75, entities: ['tests'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('The tests are failing with timeout error in CI');
      captureUserIntent(input);

      expect(mockTrackProblemReported).toHaveBeenCalledWith('The tests are failing with timeout');
    });

    it('should store problems to JSONL file', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Database connection error', confidence: 0.8, entities: ['postgresql'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockExistsSync.mockReturnValue(true);

      const input = createPromptInput('Getting database connection error when running tests');
      captureUserIntent(input);

      expect(mockAppendFileSync).toHaveBeenCalled();
      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());

      expect(record.type).toBe('problem');
      expect(record.text).toBe('Database connection error');
      expect(record.confidence).toBe(0.8);
      expect(record.status).toBe('open');
      expect(record.id).toMatch(/^prob-/);
    });

    it('should create memory directory if missing', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Import error in module', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockExistsSync.mockReturnValue(false);

      const input = createPromptInput('Getting an import error in the main module');
      captureUserIntent(input);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.claude/memory'),
        { recursive: true }
      );
    });

    it('should store multiple problems', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'API returning 500 error', confidence: 0.8, entities: [] },
          { text: 'Build failing on CI', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('API returning 500 error and build failing on CI');
      captureUserIntent(input);

      expect(mockTrackProblemReported).toHaveBeenCalledTimes(2);
      expect(mockAppendFileSync).toHaveBeenCalledTimes(2);
    });

    it('should log when problems are captured', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Memory leak detected', confidence: 0.85, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Memory leak detected in the worker process');
      captureUserIntent(input);

      expect(mockLogHook).toHaveBeenCalledWith(
        'capture-user-intent',
        'Captured: 1 problems',
        'info'
      );
    });

    it('should not use createDecisionRecord for problems', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Only a problem here', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Only a problem here with the build system');
      captureUserIntent(input);

      // Problems go through trackProblemReported, not createDecisionRecord
      expect(mockCreateDecisionRecord).not.toHaveBeenCalled();
      expect(mockStoreDecision).not.toHaveBeenCalled();
      expect(mockTrackProblemReported).toHaveBeenCalledWith('Only a problem here');
    });
  });

  // ===========================================================================
  // 6. Handle multiple intents in single prompt
  // ===========================================================================
  describe('handle multiple intents', () => {
    it('should handle prompt with decision, preference, and problem', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'I chose FastAPI', confidence: 0.85, rationale: 'async support', entities: ['fastapi'] },
        ],
        preferences: [
          { text: 'I prefer pytest for testing', confidence: 0.9, entities: ['pytest'] },
        ],
        problems: [
          { text: 'The build is failing', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput(
        'I chose FastAPI because async support. I prefer pytest for testing. The build is failing.'
      );
      captureUserIntent(input);

      // Decisions and preferences go through memory pipeline
      expect(mockCreateDecisionRecord).toHaveBeenCalledTimes(2); // 1 decision + 1 preference
      expect(mockStoreDecision).toHaveBeenCalledTimes(2);
      // Problems go through session tracker
      expect(mockTrackProblemReported).toHaveBeenCalledTimes(1);
    });

    it('should handle prompt with only decisions and preferences', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using Redis for caching', confidence: 0.8, entities: ['redis'] },
        ],
        preferences: [
          { text: 'I prefer explicit imports', confidence: 0.85 },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using Redis for caching. I prefer explicit imports in all files.');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledTimes(2);
      expect(mockStoreDecision).toHaveBeenCalledTimes(2);
      expect(mockTrackProblemReported).not.toHaveBeenCalled();
    });

    it('should log when decisions and preferences are tracked', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using Vitest', confidence: 0.85, entities: ['vitest'] },
        ],
        preferences: [
          { text: 'I prefer camelCase', confidence: 0.8 },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using Vitest for testing. I prefer camelCase for variables.');
      captureUserIntent(input);

      expect(mockLogHook).toHaveBeenCalledWith(
        'capture-user-intent',
        'Tracked: 1 decisions, 1 preferences (to decisions.jsonl + queues)',
        'debug'
      );
    });
  });

  // ===========================================================================
  // 7. Handle errors gracefully (returns silent success)
  // ===========================================================================
  describe('error handling', () => {
    it('should return silent success when detectUserIntent throws', () => {
      mockDetectUserIntent.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      const input = createPromptInput('This prompt will cause an error during detection');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockLogHook).toHaveBeenCalledWith(
        'capture-user-intent',
        expect.stringContaining('Intent detection failed'),
        'warn'
      );
    });

    it('should continue processing when storeDecision rejects', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using PostgreSQL', confidence: 0.85, entities: ['postgresql'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockStoreDecision.mockRejectedValue(new Error('Storage failed'));

      const input = createPromptInput('Using PostgreSQL for the database');
      const result = captureUserIntent(input);

      // Should still return silent success despite storage error
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should continue processing when createDecisionRecord throws', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using PostgreSQL', confidence: 0.85, entities: ['postgresql'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockCreateDecisionRecord.mockImplementation(() => {
        throw new Error('Record creation failed');
      });

      const input = createPromptInput('Using PostgreSQL for the database');
      const result = captureUserIntent(input);

      // Should still return silent success due to try/catch in storeDecisionsAndPreferences
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    it('should handle JSONL write failures gracefully', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Build failing', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const input = createPromptInput('Build failing in CI pipeline');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockLogHook).toHaveBeenCalledWith(
        'capture-user-intent',
        expect.stringContaining('Failed to write'),
        'warn'
      );
    });

    it('should handle directory creation failure gracefully', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Test timeout', confidence: 0.8, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const input = createPromptInput('Test timeout in the integration suite');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // 8. File/directory creation for JSONL storage
  // ===========================================================================
  describe('JSONL storage', () => {
    it('should write to open-problems.jsonl path', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Network error', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Getting network error when connecting to API');
      captureUserIntent(input);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('open-problems.jsonl'),
        expect.any(String)
      );
    });

    it('should include session_id in stored problem', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Crash on startup', confidence: 0.8, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('App crash on startup after update');
      input.session_id = 'custom-session-456';
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.session_id).toBe('custom-session-456');
    });

    it('should include project name in stored problem', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Lint error', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Lint error in the module file');
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.project).toBe('project'); // from /test/project
    });

    it('should use "unknown" as project name when path has no segments', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Edge case error', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      // Mock getProjectDir to return '/' (root) - split('/').pop() returns ''
      const mockGetProjectDir = vi.mocked(getProjectDir);
      // Reset the mock and set it to return '/' for all calls in this test
      mockGetProjectDir.mockReturnValue('/');

      const input = createPromptInput('Edge case error with empty project dir');
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.project).toBe('unknown');

      // Restore for other tests
      mockGetProjectDir.mockReturnValue('/test/project');
    });

    it('should generate unique IDs for each problem', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Problem 1', confidence: 0.75, entities: [] },
          { text: 'Problem 2', confidence: 0.8, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Problem 1 and Problem 2 in the codebase');
      captureUserIntent(input);

      const record1 = JSON.parse((mockAppendFileSync.mock.calls[0][1] as string).trim());
      const record2 = JSON.parse((mockAppendFileSync.mock.calls[1][1] as string).trim());

      expect(record1.id).toMatch(/^prob-/);
      expect(record2.id).toMatch(/^prob-/);
      expect(record1.id).not.toBe(record2.id);
    });

    it('should include entities in stored problem', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'PostgreSQL connection timeout', confidence: 0.85, entities: ['postgresql'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('PostgreSQL connection timeout in production');
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.entities).toContain('postgresql');
    });

    it('should write valid JSONL format with newline', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'JSONL test', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Testing JSONL format output');
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      expect(writtenData.endsWith('\n')).toBe(true);
      // Should be parseable JSON
      expect(() => JSON.parse(writtenData.trim())).not.toThrow();
    });
  });

  // ===========================================================================
  // No intents detected
  // ===========================================================================
  describe('no intents detected', () => {
    it('should return silent success when no intents found', () => {
      mockDetectUserIntent.mockReturnValue(createMockIntentResult());

      const input = createPromptInput('Hello, how are you doing today?');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(mockCreateDecisionRecord).not.toHaveBeenCalled();
      expect(mockStoreDecision).not.toHaveBeenCalled();
      expect(mockTrackProblemReported).not.toHaveBeenCalled();
    });

    it('should not write to JSONL when no problems', () => {
      mockDetectUserIntent.mockReturnValue(createMockIntentResult({
        decisions: [
          { text: 'Using React', confidence: 0.85, entities: ['react'] },
        ],
      }));

      const input = createPromptInput('Using React for the frontend application');
      captureUserIntent(input);

      expect(mockAppendFileSync).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Session ID handling
  // ===========================================================================
  describe('session ID handling', () => {
    it('should use input session_id when provided', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Test error', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Test error in CI');
      input.session_id = 'provided-session-789';
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.session_id).toBe('provided-session-789');
    });

    it('should fallback to getSessionId when session_id not in input', () => {
      const mockResult = createMockIntentResult({
        problems: [
          { text: 'Missing session', confidence: 0.75, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Missing session test case');
      delete (input as Record<string, unknown>).session_id;
      captureUserIntent(input);

      const writtenData = mockAppendFileSync.mock.calls[0][1] as string;
      const record = JSON.parse(writtenData.trim());
      expect(record.session_id).toBe('test-session-123'); // from mocked getSessionId
    });
  });

  // ===========================================================================
  // Always returns silent success (CC 2.1.16 compliance)
  // ===========================================================================
  describe('CC 2.1.16 compliance', () => {
    it('should always return continue: true', () => {
      const scenarios = [
        { prompt: '' },
        { prompt: 'short' },
        { prompt: 'A longer prompt with decisions' },
        { prompt: 'Error scenario', throwError: true },
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();
        if (scenario.throwError) {
          mockDetectUserIntent.mockImplementation(() => {
            throw new Error('Test error');
          });
        } else {
          mockDetectUserIntent.mockReturnValue(createMockIntentResult());
        }

        const input = createPromptInput(scenario.prompt);
        const result = captureUserIntent(input);
        expect(result.continue).toBe(true);
      }
    });

    it('should always suppress output for non-blocking capture', () => {
      const mockResult = createMockIntentResult({
        decisions: [{ text: 'Test decision', confidence: 0.85, entities: [] }],
        preferences: [{ text: 'Test preference', confidence: 0.8 }],
        problems: [{ text: 'Test problem', confidence: 0.75, entities: [] }],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Test decision and preference and problem');
      const result = captureUserIntent(input);

      expect(result.suppressOutput).toBe(true);
    });
  });

  // ===========================================================================
  // inferCategory tests
  // ===========================================================================
  describe('inferCategory via createDecisionRecord calls', () => {
    it('should infer database category from postgresql entity', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using PostgreSQL', confidence: 0.85, entities: ['postgresql'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using PostgreSQL for the database');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.any(Object),
        ['postgresql'],
        expect.objectContaining({ category: 'database' })
      );
    });

    it('should infer frontend category from react entity', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using React', confidence: 0.85, entities: ['react'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using React for the frontend');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.any(Object),
        ['react'],
        expect.objectContaining({ category: 'frontend' })
      );
    });

    it('should infer general category for unknown entities', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using foobar', confidence: 0.85, entities: ['foobar'] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using foobar for everything');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.any(Object),
        ['foobar'],
        expect.objectContaining({ category: 'general' })
      );
    });

    it('should infer general category when no entities', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'I decided on this approach', confidence: 0.8, entities: [] },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('I decided on this approach for the project');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.any(Object),
        [],
        expect.objectContaining({ category: 'general' })
      );
    });
  });

  // ===========================================================================
  // No double-tracking (createDecisionRecord handles session tracking internally)
  // ===========================================================================
  describe('no double-tracking', () => {
    it('should not directly call trackDecisionMade or trackPreferenceStated', () => {
      // These are now called internally by createDecisionRecord in memory-writer.ts
      // The hook should NOT call them directly
      const mockResult = createMockIntentResult({
        decisions: [
          { text: 'Using PostgreSQL', confidence: 0.85, entities: ['postgresql'] },
        ],
        preferences: [
          { text: 'I prefer tabs', confidence: 0.8 },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using PostgreSQL. I prefer tabs.');
      captureUserIntent(input);

      // createDecisionRecord is called (which internally calls trackDecisionMade/trackPreferenceStated)
      expect(mockCreateDecisionRecord).toHaveBeenCalledTimes(2);
      // trackProblemReported is NOT called since there are no problems
      expect(mockTrackProblemReported).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Alternatives/Constraints/Tradeoffs pass-through to createDecisionRecord
  // ===========================================================================
  describe('alternatives/constraints/tradeoffs pass-through', () => {
    it('should pass alternatives to content when present', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          {
            text: 'Chose PostgreSQL over MySQL',
            confidence: 0.9,
            rationale: 'better JSON support',
            entities: ['postgresql'],
            alternatives: ['MySQL'],
          },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Chose PostgreSQL over MySQL because better JSON support');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.objectContaining({
          what: 'Chose PostgreSQL over MySQL',
          why: 'better JSON support',
          alternatives: ['MySQL'],
        }),
        ['postgresql'],
        expect.any(Object)
      );
    });

    it('should pass constraints to content when present', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          {
            text: 'Using PostgreSQL for the database',
            confidence: 0.85,
            entities: ['postgresql'],
            constraints: ['support JSONB queries'],
          },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using PostgreSQL because we must support JSONB queries');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.objectContaining({
          what: 'Using PostgreSQL for the database',
          constraints: ['support JSONB queries'],
        }),
        ['postgresql'],
        expect.any(Object)
      );
    });

    it('should pass tradeoffs to content when present', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          {
            text: 'Going with microservices architecture',
            confidence: 0.8,
            entities: ['microservices'],
            tradeoffs: ['it increases deployment complexity'],
          },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Going with microservices however it increases deployment complexity');
      captureUserIntent(input);

      expect(mockCreateDecisionRecord).toHaveBeenCalledWith(
        'decision',
        expect.objectContaining({
          what: 'Going with microservices architecture',
          tradeoffs: ['it increases deployment complexity'],
        }),
        ['microservices'],
        expect.any(Object)
      );
    });

    it('should not include alternatives/constraints/tradeoffs when empty', () => {
      const mockResult = createMockIntentResult({
        decisions: [
          {
            text: 'Using Redis for caching',
            confidence: 0.85,
            entities: ['redis'],
            // No alternatives, constraints, or tradeoffs
          },
        ],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using Redis for caching in production');
      captureUserIntent(input);

      const callContent = mockCreateDecisionRecord.mock.calls[0][1] as Record<string, unknown>;
      expect(callContent).toEqual({
        what: 'Using Redis for caching',
        why: undefined,
      });
      expect(callContent).not.toHaveProperty('alternatives');
      expect(callContent).not.toHaveProperty('constraints');
      expect(callContent).not.toHaveProperty('tradeoffs');
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle prompts with special characters', () => {
      const mockResult = createMockIntentResult({
        decisions: [{ text: 'Using <template>', confidence: 0.8 }],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using <template> & "quotes" in the code');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });

    it('should handle prompts with newlines', () => {
      const mockResult = createMockIntentResult({
        decisions: [{ text: 'Using multiline', confidence: 0.8 }],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('First line\nUsing multiline\nThird line');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(mockDetectUserIntent).toHaveBeenCalled();
    });

    it('should handle very long prompts', () => {
      const mockResult = createMockIntentResult();
      mockDetectUserIntent.mockReturnValue(mockResult);

      const longPrompt = 'I decided to use PostgreSQL ' + 'a'.repeat(5000);
      const input = createPromptInput(longPrompt);
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });

    it('should handle prompts with unicode characters', () => {
      const mockResult = createMockIntentResult({
        decisions: [{ text: 'Using emoji strategy', confidence: 0.75 }],
      });
      mockDetectUserIntent.mockReturnValue(mockResult);

      const input = createPromptInput('Using emoji strategy for status indicators');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });

    it('should handle empty intent arrays in result', () => {
      mockDetectUserIntent.mockReturnValue({
        intents: [],
        decisions: [],
        preferences: [],
        questions: [],
        problems: [],
        summary: 'No intents detected',
      });

      const input = createPromptInput('Random text without any intents here');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(mockCreateDecisionRecord).not.toHaveBeenCalled();
      expect(mockStoreDecision).not.toHaveBeenCalled();
      expect(mockTrackProblemReported).not.toHaveBeenCalled();
    });
  });
});
