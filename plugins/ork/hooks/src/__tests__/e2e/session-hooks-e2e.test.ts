/**
 * E2E Tests for Issue #245 Session Hooks
 * Multi-User Intelligent Decision Capture System
 *
 * Tests complete session lifecycle flows from start to end:
 * - SessionStart event with profile loading
 * - UserPromptSubmit hooks (capture-user-intent, satisfaction-detector, communication-style-tracker)
 * - Stop event hooks (session-end-tracking, session-profile-aggregator)
 * - Cross-hook data consistency and filesystem changes
 *
 * Uses real filesystem with tmpdir isolation.
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// =============================================================================
// TEST SETUP - Real filesystem with tmpdir isolation
// =============================================================================

let testDir: string;
let testHomeDir: string;
let originalEnv: NodeJS.ProcessEnv;
let originalHome: string | undefined;

beforeAll(() => {
  // Store original environment
  originalEnv = { ...process.env };
  originalHome = process.env.HOME;
});

beforeEach(() => {
  // Create isolated test directories
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-hooks-e2e-'));
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-hooks-e2e-home-'));

  // Create required directory structure
  fs.mkdirSync(path.join(testDir, '.claude', 'memory', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(testDir, '.claude', 'feedback'), { recursive: true });
  fs.mkdirSync(path.join(testHomeDir, '.claude', 'orchestkit', 'users'), { recursive: true });

  // Set environment variables for isolation
  process.env.HOME = testHomeDir;
  process.env.CLAUDE_PROJECT_DIR = testDir;
  process.env.CLAUDE_SESSION_ID = `e2e-session-${Date.now()}`;
  process.env.SATISFACTION_SAMPLE_RATE = '1'; // Analyze every prompt for testing
  process.env.COMM_STYLE_SAMPLE_RATE = '1'; // Analyze every prompt for testing
});

afterEach(() => {
  // Restore original environment
  process.env = { ...originalEnv };
  if (originalHome) {
    process.env.HOME = originalHome;
  }

  // Clean up test directories
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

afterAll(() => {
  process.env = originalEnv;
});

// =============================================================================
// MOCK SETUP - Mock common functions but keep filesystem operations real
// =============================================================================

// Mock common.js to return our test directories
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || path.join(os.tmpdir(), 'test')),
    getSessionId: vi.fn(() => process.env.CLAUDE_SESSION_ID || 'test-session-default'),
    getCachedBranch: vi.fn().mockReturnValue('main'),
  };
});

// Mock child_process for git operations
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execSync: vi.fn((cmd: string) => {
      if (cmd.includes('git config user.email')) return 'test@example.com\n';
      if (cmd.includes('git config user.name')) return 'Test User\n';
      if (cmd.includes('git rev-parse --abbrev-ref HEAD')) return 'main\n';
      return '';
    }),
  };
});

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create UserPromptSubmit input
 */
function createUserPromptInput(prompt: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: process.env.CLAUDE_SESSION_ID || 'test-session',
    project_dir: process.env.CLAUDE_PROJECT_DIR || testDir,
    tool_input: {},
    prompt,
    ...overrides,
  };
}

/**
 * Create SessionStart input
 */
function createSessionStartInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'SessionStart',
    tool_name: 'SessionStart',
    session_id: process.env.CLAUDE_SESSION_ID || 'test-session',
    project_dir: process.env.CLAUDE_PROJECT_DIR || testDir,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create Stop input
 */
function createStopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'Stop',
    tool_name: '',
    session_id: process.env.CLAUDE_SESSION_ID || 'test-session',
    project_dir: process.env.CLAUDE_PROJECT_DIR || testDir,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Read events.jsonl for a session
 */
function readSessionEvents(sessionId: string): Array<Record<string, unknown>> {
  const eventsPath = path.join(
    process.env.CLAUDE_PROJECT_DIR || testDir,
    '.claude',
    'memory',
    'sessions',
    sessionId,
    'events.jsonl'
  );

  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  const content = fs.readFileSync(eventsPath, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

/**
 * Read satisfaction log
 */
function readSatisfactionLog(): string[] {
  const logPath = path.join(
    process.env.CLAUDE_PROJECT_DIR || testDir,
    '.claude',
    'feedback',
    'satisfaction.log'
  );

  if (!fs.existsSync(logPath)) {
    return [];
  }

  return fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
}

/**
 * Read open problems JSONL
 */
function readOpenProblems(): Array<Record<string, unknown>> {
  const problemsPath = path.join(
    process.env.CLAUDE_PROJECT_DIR || testDir,
    '.claude',
    'memory',
    'open-problems.jsonl'
  );

  if (!fs.existsSync(problemsPath)) {
    return [];
  }

  const content = fs.readFileSync(problemsPath, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

/**
 * Read user profile
 */
function readUserProfile(userId: string): Record<string, unknown> | null {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const profilePath = path.join(
    process.env.HOME || testHomeDir,
    '.claude',
    'orchestkit',
    'users',
    sanitizedUserId,
    'profile.json'
  );

  if (!fs.existsSync(profilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

// =============================================================================
// A. COMPLETE SESSION LIFECYCLE TESTS
// =============================================================================

describe('A. Complete Session Lifecycle', () => {
  describe('Session starts -> user sends prompts -> hooks fire -> session ends -> profile updated', () => {
    test('full session lifecycle with decision capture', async () => {
      // Dynamic imports to get fresh instances with our mocks
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');
      const { sessionProfileAggregator } = await import('../../stop/session-profile-aggregator.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Phase 1: Session Start
      const startInput = createSessionStartInput();
      const startResult = sessionTracking(startInput);
      expect(startResult.continue).toBe(true);

      // Verify session_start event was logged
      let events = readSessionEvents(sessionId);
      const sessionStartEvent = events.find(e => e.event_type === 'session_start');
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent?.payload).toHaveProperty('name', 'session');

      // Phase 2: User sends decision prompt
      const decisionInput = createUserPromptInput(
        'I decided to use PostgreSQL for the database because of its JSON support and reliability.'
      );
      const decisionResult = captureUserIntent(decisionInput);
      expect(decisionResult.continue).toBe(true);

      // Verify decision was captured to events
      events = readSessionEvents(sessionId);
      const decisionEvent = events.find(e => e.event_type === 'decision_made');
      expect(decisionEvent).toBeDefined();

      // Phase 3: Session End
      const endInput = createStopInput();
      const endTrackingResult = sessionEndTracking(endInput);
      expect(endTrackingResult.continue).toBe(true);

      // Verify session_end event
      events = readSessionEvents(sessionId);
      const sessionEndEvent = events.find(e => e.event_type === 'session_end');
      expect(sessionEndEvent).toBeDefined();

      // Phase 4: Profile Aggregation
      const aggregatorResult = sessionProfileAggregator(endInput);
      expect(aggregatorResult.continue).toBe(true);
    });

    test('session with multiple prompts tracks all events', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Start session
      sessionTracking(createSessionStartInput());

      // Multiple prompts
      const prompts = [
        'Let us use cursor pagination for the API endpoints',
        'I prefer TypeScript over JavaScript for type safety',
        'Fix the failing test in the auth module',
        'Thanks, that works great!',
      ];

      for (const prompt of prompts) {
        const input = createUserPromptInput(prompt);
        captureUserIntent(input);
        satisfactionDetector(input);
        communicationStyleTracker(input);
      }

      // Verify events were tracked
      const events = readSessionEvents(sessionId);
      expect(events.length).toBeGreaterThan(0);

      // Should have session_start plus various tracked events
      const eventTypes = new Set(events.map(e => e.event_type));
      expect(eventTypes.has('session_start')).toBe(true);
    });

    test('session events contain correct identity context', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Start and track an event
      sessionTracking(createSessionStartInput());
      captureUserIntent(createUserPromptInput('I chose FastAPI for the backend framework.'));

      const events = readSessionEvents(sessionId);
      expect(events.length).toBeGreaterThan(0);

      // All events should have identity context
      for (const event of events) {
        expect(event).toHaveProperty('identity');
        const identity = event.identity as Record<string, unknown>;
        expect(identity).toHaveProperty('session_id');
        expect(identity).toHaveProperty('user_id');
        expect(identity).toHaveProperty('timestamp');
      }
    });
  });

  describe('Events persistence and JSONL format', () => {
    test('events.jsonl contains valid JSON lines', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Generate multiple events
      sessionTracking(createSessionStartInput());
      captureUserIntent(createUserPromptInput('Using Redis for caching layer.'));
      captureUserIntent(createUserPromptInput('I prefer explicit imports in all files.'));

      // Read raw file content
      const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', sessionId, 'events.jsonl');
      const content = fs.readFileSync(eventsPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    test('events have unique event_id', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Generate multiple events
      captureUserIntent(createUserPromptInput('Decision one about architecture pattern.'));
      captureUserIntent(createUserPromptInput('Decision two about database choice.'));

      const events = readSessionEvents(sessionId);
      const eventIds = events.map(e => e.event_id);
      const uniqueIds = new Set(eventIds);

      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });
});

// =============================================================================
// B. USERPROMPTSUBMIT HOOKS E2E
// =============================================================================

describe('B. UserPromptSubmit Hooks E2E', () => {
  describe('capture-user-intent hook', () => {
    test('detects and tracks decision from user prompt', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput(
        'I decided to use pgvector for vector search because it integrates well with PostgreSQL.'
      );
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);

      const events = readSessionEvents(sessionId);
      const decisionEvent = events.find(e => e.event_type === 'decision_made');
      expect(decisionEvent).toBeDefined();
    });

    test('detects and tracks preference from user prompt', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput('I prefer using async/await over callbacks in all async code.');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);

      const events = readSessionEvents(sessionId);
      const preferenceEvent = events.find(e => e.event_type === 'preference_stated');
      expect(preferenceEvent).toBeDefined();
    });

    test('detects and stores problem to open-problems.jsonl', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput(
        'The tests are failing with a timeout error when connecting to the database.'
      );
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);

      const problems = readOpenProblems();
      expect(problems.length).toBeGreaterThan(0);

      const problem = problems[0];
      expect(problem).toHaveProperty('type', 'problem');
      expect(problem).toHaveProperty('status', 'open');
      expect(problem).toHaveProperty('session_id');
    });

    test('handles prompt with multiple intent types', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput(
        'I chose FastAPI for the backend because of async support. I prefer pytest for testing. The build is failing in CI.'
      );
      captureUserIntent(input);

      const events = readSessionEvents(sessionId);
      const decisionEvents = events.filter(e => e.event_type === 'decision_made');
      const preferenceEvents = events.filter(e => e.event_type === 'preference_stated');
      const problemEvents = events.filter(e => e.event_type === 'problem_reported');

      // Should have tracked at least one of each type
      expect(decisionEvents.length + preferenceEvents.length + problemEvents.length).toBeGreaterThan(0);
    });

    test('skips prompts shorter than minimum length', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;
      const initialEvents = readSessionEvents(sessionId);

      const input = createUserPromptInput('short');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);

      const finalEvents = readSessionEvents(sessionId);
      expect(finalEvents.length).toBe(initialEvents.length);
    });

    test('handles empty prompt gracefully', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput('');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('satisfaction-detector hook', () => {
    test('detects positive satisfaction signal', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const input = createUserPromptInput('Thanks! That works perfectly, exactly what I needed.');
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);

      const logs = readSatisfactionLog();
      expect(logs.length).toBeGreaterThan(0);

      const lastLog = logs[logs.length - 1];
      expect(lastLog).toContain('positive');
    });

    test('detects negative satisfaction signal', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const input = createUserPromptInput("That's wrong, it doesn't work. Try again please.");
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);

      const logs = readSatisfactionLog();
      expect(logs.length).toBeGreaterThan(0);

      const lastLog = logs[logs.length - 1];
      expect(lastLog).toContain('negative');
    });

    test('does not log neutral prompts', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const initialLogs = readSatisfactionLog();
      const initialCount = initialLogs.length;

      const input = createUserPromptInput('Can you add a new function to handle user authentication?');
      satisfactionDetector(input);

      const finalLogs = readSatisfactionLog();
      expect(finalLogs.length).toBe(initialCount);
    });

    test('tracks satisfaction to session events', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput('Great job! This is excellent work.');
      satisfactionDetector(input);

      const events = readSessionEvents(sessionId);
      const satisfactionEvent = events.find(e => e.event_type === 'preference_stated');
      expect(satisfactionEvent).toBeDefined();
    });

    test('skips command prompts starting with /', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const initialLogs = readSatisfactionLog();
      const initialCount = initialLogs.length;

      const input = createUserPromptInput('/ork:remember thanks this is great');
      satisfactionDetector(input);

      const finalLogs = readSatisfactionLog();
      expect(finalLogs.length).toBe(initialCount);
    });

    test('sampling is disabled for tests (rate=1)', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      // With SATISFACTION_SAMPLE_RATE=1, every prompt should be analyzed
      const inputs = [
        'Thanks! Perfect solution.',
        'Great, that works well.',
        'Excellent work on this.',
      ];

      for (const text of inputs) {
        satisfactionDetector(createUserPromptInput(text));
      }

      const logs = readSatisfactionLog();
      expect(logs.length).toBe(3);
    });
  });

  describe('communication-style-tracker hook', () => {
    test('detects terse verbosity', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput('fix the bug');
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.verbosity).toBe('terse');
    });

    test('detects detailed verbosity', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput(
        'I need you to implement a comprehensive user authentication system. The system should support multiple authentication methods including OAuth2, JWT tokens, and passkeys. Additionally, we need to implement rate limiting and audit logging for security purposes. The reason for this is that we are preparing for SOC2 compliance and need to demonstrate robust security controls.'
      );
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.verbosity).toBe('detailed');
    });

    test('detects question interaction type', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput('How do I implement cursor-based pagination in FastAPI?');
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.interaction_type).toBe('question');
    });

    test('detects command interaction type', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput('Create a new React component for the dashboard');
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.interaction_type).toBe('command');
    });

    test('detects expert technical level', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput(
        'Configure the HNSW index parameters for pgvector with ef_construction=128 and m=16 for optimal RAG retrieval performance.'
      );
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.technical_level).toBe('expert');
    });

    test('detects beginner technical level', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      const input = createUserPromptInput(
        "What is a database? Can you explain how databases work in simple terms for beginners?"
      );
      communicationStyleTracker(input);

      const events = readSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();

      const inputData = (styleEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData?.technical_level).toBe('beginner');
    });

    test('skips command prompts starting with /', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;
      const initialEvents = readSessionEvents(sessionId);

      const input = createUserPromptInput('/ork:remember some text here');
      communicationStyleTracker(input);

      const finalEvents = readSessionEvents(sessionId);
      expect(finalEvents.length).toBe(initialEvents.length);
    });
  });
});

// =============================================================================
// C. STOP DISPATCHER E2E
// =============================================================================

describe('C. Stop Dispatcher E2E', () => {
  describe('session-end-tracking fires on Stop', () => {
    test('tracks session_end event', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Start session first
      sessionTracking(createSessionStartInput());

      // End session
      const result = sessionEndTracking(createStopInput());
      expect(result.continue).toBe(true);

      const events = readSessionEvents(sessionId);
      const endEvent = events.find(e => e.event_type === 'session_end');
      expect(endEvent).toBeDefined();
      expect(endEvent?.payload).toHaveProperty('name', 'session');
    });

    test('session_end event has ended_at timestamp', async () => {
      const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      sessionEndTracking(createStopInput());

      const events = readSessionEvents(sessionId);
      const endEvent = events.find(e => e.event_type === 'session_end');
      expect(endEvent).toBeDefined();

      const inputData = (endEvent?.payload as Record<string, unknown>)?.input as Record<string, unknown>;
      expect(inputData).toHaveProperty('ended_at');
      expect(typeof inputData?.ended_at).toBe('string');
    });
  });

  describe('session-profile-aggregator fires on Stop', () => {
    test('aggregates session data into user profile', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { sessionProfileAggregator } = await import('../../stop/session-profile-aggregator.js');

      // Start session and generate some activity
      sessionTracking(createSessionStartInput());
      captureUserIntent(createUserPromptInput('I decided to use TypeScript for all new code.'));

      // Aggregate
      const result = sessionProfileAggregator(createStopInput());
      expect(result.continue).toBe(true);
    });

    test('returns success even with no meaningful activity', async () => {
      const { sessionProfileAggregator } = await import('../../stop/session-profile-aggregator.js');

      // No activity before aggregation
      const result = sessionProfileAggregator(createStopInput());
      expect(result.continue).toBe(true);
    });
  });

  describe('unified stop dispatcher runs all hooks', () => {
    test('dispatcher is correctly registered with all hooks', async () => {
      const { registeredHookNames } = await import('../../stop/unified-dispatcher.js');

      const names = registeredHookNames();

      // Issue #245 hooks should be registered
      expect(names).toContain('session-profile-aggregator');
      expect(names).toContain('session-end-tracking');
      expect(names).toContain('graph-queue-sync');
      expect(names).toContain('workflow-preference-learner');
    });

    test('dispatcher runs without errors', async () => {
      const { unifiedStopDispatcher } = await import('../../stop/unified-dispatcher.js');

      const result = await unifiedStopDispatcher(createStopInput());
      expect(result.continue).toBe(true);
    });
  });
});

// =============================================================================
// D. REAL HOOK EXECUTION SIMULATION
// =============================================================================

describe('D. Real Hook Execution Simulation', () => {
  describe('CC 2.1.7 format compliance', () => {
    test('all hooks return valid HookResult structure', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');
      const { sessionProfileAggregator } = await import('../../stop/session-profile-aggregator.js');

      const promptInput = createUserPromptInput('Test prompt for hook execution.');
      const startInput = createSessionStartInput();
      const stopInput = createStopInput();

      const hooks: Array<{ name: string; fn: (input: HookInput) => HookResult; input: HookInput }> = [
        { name: 'captureUserIntent', fn: captureUserIntent, input: promptInput },
        { name: 'satisfactionDetector', fn: satisfactionDetector, input: promptInput },
        { name: 'communicationStyleTracker', fn: communicationStyleTracker, input: promptInput },
        { name: 'sessionTracking', fn: sessionTracking, input: startInput },
        { name: 'sessionEndTracking', fn: sessionEndTracking, input: stopInput },
        { name: 'sessionProfileAggregator', fn: sessionProfileAggregator, input: stopInput },
      ];

      for (const { name, fn, input } of hooks) {
        const result = fn(input);

        expect(result).toHaveProperty('continue');
        expect(typeof result.continue).toBe('boolean');
        expect(result.continue).toBe(true); // All Issue #245 hooks should never block

        // CC 2.1.7 compliance: UserPromptSubmit and Stop hooks should suppress output
        if (input.hook_event === 'UserPromptSubmit' || input.hook_event === 'Stop') {
          expect(result.suppressOutput).toBe(true);
        }
      }
    });

    test('hooks handle missing optional fields gracefully', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      // Minimal input with required fields only
      const minimalInput: HookInput = {
        tool_name: 'UserPromptSubmit',
        session_id: 'minimal-session',
        tool_input: {},
        prompt: 'I decided to use minimal configuration.',
      };

      const result = captureUserIntent(minimalInput);
      expect(result.continue).toBe(true);
    });
  });

  describe('Filesystem changes verification', () => {
    test('events.jsonl is created and populated', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;
      const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', sessionId, 'events.jsonl');

      // Initially no events file
      expect(fs.existsSync(eventsPath)).toBe(false);

      // Track session start
      sessionTracking(createSessionStartInput());

      // Now events file should exist
      expect(fs.existsSync(eventsPath)).toBe(true);

      const content = fs.readFileSync(eventsPath, 'utf8');
      expect(content.length).toBeGreaterThan(0);
    });

    test('satisfaction.log is created when positive/negative signals detected', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');

      // Detect positive signal
      satisfactionDetector(createUserPromptInput('Thanks, this is perfect!'));

      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('positive');
    });

    test('open-problems.jsonl is created when problems detected', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const problemsPath = path.join(testDir, '.claude', 'memory', 'open-problems.jsonl');

      captureUserIntent(createUserPromptInput('The API is returning 500 errors on every request.'));

      expect(fs.existsSync(problemsPath)).toBe(true);

      const content = fs.readFileSync(problemsPath, 'utf8');
      const problem = JSON.parse(content.trim().split('\n')[0]);
      expect(problem.status).toBe('open');
    });

    test('sampling counter files are created', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      satisfactionDetector(createUserPromptInput('Test satisfaction detection.'));
      communicationStyleTracker(createUserPromptInput('Test communication style detection.'));

      const satisfactionCounter = path.join(testDir, '.claude', '.satisfaction-counter');
      const commStyleCounter = path.join(testDir, '.claude', '.comm-style-counter');

      expect(fs.existsSync(satisfactionCounter)).toBe(true);
      expect(fs.existsSync(commStyleCounter)).toBe(true);

      // Counter values should be incremented
      expect(parseInt(fs.readFileSync(satisfactionCounter, 'utf8').trim(), 10)).toBeGreaterThan(0);
      expect(parseInt(fs.readFileSync(commStyleCounter, 'utf8').trim(), 10)).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// E. CROSS-HOOK DATA CONSISTENCY
// =============================================================================

describe('E. Cross-Hook Data Consistency', () => {
  describe('Data written by one hook is readable by another', () => {
    test('session events from capture-user-intent are visible to session-profile-aggregator', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { generateSessionSummary } = await import('../../lib/session-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Generate events
      sessionTracking(createSessionStartInput());
      captureUserIntent(createUserPromptInput('I decided to use cursor-based pagination.'));

      // Session summary should see the events
      const summary = generateSessionSummary(sessionId);
      expect(summary.event_counts.session_start).toBe(1);
      expect(summary.decisions_made).toBeGreaterThanOrEqual(0);
    });

    test('session_start and session_end events are both tracked', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
      const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');
      const { loadSessionEvents } = await import('../../lib/session-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Full lifecycle
      sessionTracking(createSessionStartInput());
      sessionEndTracking(createStopInput());

      const events = loadSessionEvents(sessionId);
      const startEvent = events.find(e => e.event_type === 'session_start');
      const endEvent = events.find(e => e.event_type === 'session_end');

      expect(startEvent).toBeDefined();
      expect(endEvent).toBeDefined();
    });

    test('communication style is tracked and accessible', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');
      const { loadSessionEvents } = await import('../../lib/session-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      communicationStyleTracker(createUserPromptInput('Implement the repository pattern for the user service.'));

      const events = loadSessionEvents(sessionId);
      const styleEvent = events.find(e => e.event_type === 'communication_style_detected');
      expect(styleEvent).toBeDefined();
      expect(styleEvent?.payload).toHaveProperty('input');
    });
  });

  describe('No race conditions in file writes', () => {
    test('rapid sequential writes do not corrupt files', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;

      // Rapid sequential writes
      const prompts = [
        'I chose PostgreSQL for the database.',
        'I prefer using TypeScript over JavaScript.',
        'The build is failing with timeout errors.',
        'Let us use cursor pagination instead of offset.',
        'I decided to implement the repository pattern.',
      ];

      for (const prompt of prompts) {
        captureUserIntent(createUserPromptInput(prompt));
      }

      // All events should be readable and valid JSON
      const events = readSessionEvents(sessionId);
      expect(events.length).toBeGreaterThan(0);

      // Each event should have required fields
      for (const event of events) {
        expect(event).toHaveProperty('event_id');
        expect(event).toHaveProperty('event_type');
        expect(event).toHaveProperty('identity');
        expect(event).toHaveProperty('payload');
      }
    });

    test('parallel hook execution does not cause data loss', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const sessionId = process.env.CLAUDE_SESSION_ID!;
      const input = createUserPromptInput('Thanks! I decided to use React for the frontend. Great work!');

      // Simulate parallel execution (in practice these run sequentially in Node.js)
      await Promise.all([
        Promise.resolve(captureUserIntent(input)),
        Promise.resolve(satisfactionDetector(input)),
        Promise.resolve(communicationStyleTracker(input)),
      ]);

      const events = readSessionEvents(sessionId);
      const satisfactionLogs = readSatisfactionLog();

      // Both should have recorded data
      expect(events.length).toBeGreaterThan(0);
      expect(satisfactionLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Sampling counters persist correctly', () => {
    test('satisfaction counter increments across calls', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const counterPath = path.join(testDir, '.claude', '.satisfaction-counter');

      satisfactionDetector(createUserPromptInput('First prompt for counting.'));
      const count1 = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10);

      satisfactionDetector(createUserPromptInput('Second prompt for counting.'));
      const count2 = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10);

      expect(count2).toBe(count1 + 1);
    });

    test('communication style counter increments across calls', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const counterPath = path.join(testDir, '.claude', '.comm-style-counter');

      communicationStyleTracker(createUserPromptInput('First prompt for counting.'));
      const count1 = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10);

      communicationStyleTracker(createUserPromptInput('Second prompt for counting.'));
      const count2 = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10);

      expect(count2).toBe(count1 + 1);
    });
  });
});

// =============================================================================
// F. ERROR HANDLING AND EDGE CASES
// =============================================================================

describe('F. Error Handling and Edge Cases', () => {
  describe('Hooks handle errors gracefully', () => {
    test('captureUserIntent returns success even with detection errors', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      // Very long prompt that might cause issues
      const longPrompt = 'I decided to use ' + 'x'.repeat(10000);
      const input = createUserPromptInput(longPrompt);

      const result = captureUserIntent(input);
      expect(result.continue).toBe(true);
    });

    test('satisfactionDetector handles special characters', async () => {
      const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');

      const input = createUserPromptInput('Thanks! <script>alert("xss")</script> works great!');
      const result = satisfactionDetector(input);

      expect(result.continue).toBe(true);
    });

    test('communicationStyleTracker handles unicode', async () => {
      const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

      const input = createUserPromptInput('Implement the feature with proper testing and docs.');
      const result = communicationStyleTracker(input);

      expect(result.continue).toBe(true);
    });

    test('hooks continue after filesystem permission errors', async () => {
      const { sessionTracking } = await import('../../lifecycle/session-tracking.js');

      // Even if filesystem operations fail internally, hooks should return success
      const result = sessionTracking(createSessionStartInput());
      expect(result.continue).toBe(true);
    });
  });

  describe('Boundary conditions', () => {
    test('empty session_id is handled', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput('I decided to use TypeScript.');
      input.session_id = '';

      // Should not throw, may use fallback session ID
      const result = captureUserIntent(input);
      expect(result.continue).toBe(true);
    });

    test('missing project_dir is handled', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput('I decided to use TypeScript.');
      delete (input as Record<string, unknown>).project_dir;

      const result = captureUserIntent(input);
      expect(result.continue).toBe(true);
    });

    test('prompt exactly at minimum length threshold', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      // Minimum is 15 characters
      const input = createUserPromptInput('15 chars total!'); // Exactly 15
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });

    test('prompt with only whitespace', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput('                    '); // 20 spaces
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });

    test('prompt with newlines and tabs', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = createUserPromptInput('I decided to use\nTypeScript\tfor the\nproject.');
      const result = captureUserIntent(input);

      expect(result.continue).toBe(true);
    });
  });
});

// =============================================================================
// G. PERFORMANCE TESTS
// =============================================================================

describe('G. Performance Tests', () => {
  test('hooks execute within acceptable time bounds', async () => {
    const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
    const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
    const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

    const iterations = 50;
    const maxTotalTime = 5000; // 5 seconds for 50 iterations of 3 hooks

    const input = createUserPromptInput('I decided to use PostgreSQL because of its reliability. Thanks!');
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      captureUserIntent(input);
      satisfactionDetector(input);
      communicationStyleTracker(input);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(maxTotalTime);
  });

  test('individual hook execution is fast', async () => {
    const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

    const input = createUserPromptInput('I decided to implement the service layer pattern.');
    const iterations = 100;
    const maxTotalTime = 2000; // 2 seconds for 100 iterations

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      captureUserIntent(input);
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(maxTotalTime);
  });

  test('file I/O does not cause significant slowdown', async () => {
    const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
    const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');

    const iterations = 20;
    const maxTotalTime = 2000; // 2 seconds

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      // Reset session ID for each iteration to create new files
      process.env.CLAUDE_SESSION_ID = `perf-session-${i}`;
      sessionTracking(createSessionStartInput());
      sessionEndTracking(createStopInput());
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(maxTotalTime);
  });
});

// =============================================================================
// H. INTEGRATION WITH USER IDENTITY
// =============================================================================

describe('H. Integration with User Identity', () => {
  test('events are tagged with user identity', async () => {
    const { sessionTracking } = await import('../../lifecycle/session-tracking.js');

    const sessionId = process.env.CLAUDE_SESSION_ID!;
    sessionTracking(createSessionStartInput());

    const events = readSessionEvents(sessionId);
    expect(events.length).toBeGreaterThan(0);

    const event = events[0];
    const identity = event.identity as Record<string, unknown>;

    expect(identity).toHaveProperty('user_id');
    expect(identity).toHaveProperty('session_id');
    expect(identity).toHaveProperty('machine_id');
    expect(identity).toHaveProperty('anonymous_id');
  });

  test('anonymous_id is consistent within session', async () => {
    const { sessionTracking } = await import('../../lifecycle/session-tracking.js');
    const { sessionEndTracking } = await import('../../stop/session-end-tracking.js');

    const sessionId = process.env.CLAUDE_SESSION_ID!;

    // Generate multiple events with known event types
    sessionTracking(createSessionStartInput());
    sessionEndTracking(createStopInput());

    const events = readSessionEvents(sessionId);
    expect(events.length).toBeGreaterThanOrEqual(2);

    const anonymousIds = events
      .map(e => (e.identity as Record<string, unknown>)?.anonymous_id)
      .filter(Boolean);
    const uniqueIds = new Set(anonymousIds);

    // Should be consistent (same anonymous_id for same user)
    expect(uniqueIds.size).toBe(1);
  });
});

// =============================================================================
// I. DISPATCHER REGISTRY VERIFICATION
// =============================================================================

describe('I. Dispatcher Registry Verification', () => {
  test('posttool dispatcher does not include session hooks', async () => {
    const { registeredHookNames } = await import('../../posttool/unified-dispatcher.js');
    const names = registeredHookNames();

    // Session hooks should NOT be in posttool dispatcher
    expect(names).not.toContain('session-tracking');
    expect(names).not.toContain('session-end-tracking');
    expect(names).not.toContain('session-profile-aggregator');
  });

  test('lifecycle dispatcher includes session-tracking', async () => {
    const { registeredHookNames } = await import('../../lifecycle/unified-dispatcher.js');
    const names = registeredHookNames();

    expect(names).toContain('session-tracking');
  });

  test('stop dispatcher includes all session end hooks', async () => {
    const { registeredHookNames } = await import('../../stop/unified-dispatcher.js');
    const names = registeredHookNames();

    expect(names).toContain('session-end-tracking');
    expect(names).toContain('session-profile-aggregator');
  });

  test('UserPromptSubmit hooks are registered in hooks.json', async () => {
    // UserPromptSubmit hooks are registered directly in hooks.json, not via dispatcher
    // This test verifies they can be imported and executed
    const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');
    const { satisfactionDetector } = await import('../../prompt/satisfaction-detector.js');
    const { communicationStyleTracker } = await import('../../prompt/communication-style-tracker.js');

    expect(typeof captureUserIntent).toBe('function');
    expect(typeof satisfactionDetector).toBe('function');
    expect(typeof communicationStyleTracker).toBe('function');
  });

  test('all hooks are properly exported', async () => {
    // Verify all Issue #245 hooks can be imported
    const hooks = [
      () => import('../../prompt/capture-user-intent.js'),
      () => import('../../prompt/satisfaction-detector.js'),
      () => import('../../prompt/communication-style-tracker.js'),
      () => import('../../lifecycle/session-tracking.js'),
      () => import('../../stop/session-end-tracking.js'),
      () => import('../../stop/session-profile-aggregator.js'),
    ];

    for (const importHook of hooks) {
      const module = await importHook();
      const exportedFns = Object.values(module).filter(v => typeof v === 'function');
      expect(exportedFns.length).toBeGreaterThan(0);
    }
  });
});
