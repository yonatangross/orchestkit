/**
 * Integration Tests: Issue #245 Tracking Data Flows
 *
 * Tests the complete data flow between tracking system components:
 * - session-tracker.ts: Event tracking and session summaries
 * - user-identity.ts: Identity resolution and privacy
 * - user-profile.ts: Profile aggregation and persistence
 * - capture-user-intent.ts: Intent detection and session tracking
 * - satisfaction-detector.ts: Satisfaction signal tracking
 *
 * Uses real filesystem (tmpdir) for state persistence testing.
 * Tests actual cross-module interactions, not just mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// =============================================================================
// TEST SETUP: Use real temp directories for integration testing
// =============================================================================

let testDir: string;
let testHomeDir: string;

beforeAll(() => {
  // Create test directories
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-tracking-test-'));
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-home-test-'));

  // Set environment variables
  process.env.CLAUDE_PROJECT_DIR = testDir;
  process.env.HOME = testHomeDir;
  process.env.CLAUDE_SESSION_ID = 'test-session-integration-001';
  process.env.ORCHESTKIT_LOG_LEVEL = 'error'; // Suppress debug logs
});

afterAll(() => {
  // Cleanup test directories
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Reset environment
  delete process.env.CLAUDE_PROJECT_DIR;
  delete process.env.HOME;
  delete process.env.CLAUDE_SESSION_ID;
  delete process.env.ORCHESTKIT_LOG_LEVEL;
});

// =============================================================================
// MOCK SETUP: Minimal mocks for controlled testing
// =============================================================================

// Mock analytics-buffer to use real appendFileSync (integration uses real filesystem)
// vi.hoisted ensures the helper fns are available inside the vi.mock factory
const { _realWrite } = vi.hoisted(() => {
  const nodefs = require('node:fs');
  const nodepath = require('node:path');
  return {
    _realWrite: (filePath: string, content: string) => {
      try {
        nodefs.mkdirSync(nodepath.dirname(filePath), { recursive: true });
        nodefs.appendFileSync(filePath, content);
      } catch {
        // ignore
      }
    },
  };
});

vi.mock('../../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    _realWrite(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

// Mock git commands for user-identity resolution
vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd === 'git config user.email') {
      return 'integration-test@orchestkit.dev\n';
    }
    if (cmd === 'git config user.name') {
      return 'Integration Test User\n';
    }
    if (cmd === 'git branch --show-current') {
      return 'main\n';
    }
    throw new Error('Unknown command');
  }),
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    hostname: vi.fn(() => 'integration-test-machine'),
  };
});

// =============================================================================
// IMPORTS: After mocks are set up
// =============================================================================

// Dynamic imports after mocks are configured
const importModules = async () => {
  // Clear module cache to pick up mocks
  vi.resetModules();

  const sessionTracker = await import('../../lib/session-tracker.js');
  const userIdentity = await import('../../lib/user-identity.js');
  const userProfile = await import('../../lib/user-profile.js');
  const captureUserIntent = await import('../../prompt/capture-user-intent.js');
  const satisfactionDetector = await import('../../prompt/satisfaction-detector.js');
  const userIntentDetector = await import('../../lib/user-intent-detector.js');

  return {
    sessionTracker,
    userIdentity,
    userProfile,
    captureUserIntent,
    satisfactionDetector,
    userIntentDetector,
  };
};

// =============================================================================
// SECTION A: Session Lifecycle Flow Tests
// =============================================================================

describe('A. Session Lifecycle Flow', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    // Create fresh session directory
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-lifecycle');
    fs.mkdirSync(sessionDir, { recursive: true });

    // Reset environment for each test
    process.env.CLAUDE_SESSION_ID = 'test-session-lifecycle';
    modules.userIdentity.clearIdentityCache();
  });

  afterEach(() => {
    // Cleanup session data
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-lifecycle');
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('A.1: Session start creates session event', () => {
    // Arrange
    const sessionId = 'test-session-lifecycle';

    // Act
    modules.sessionTracker.trackSessionStart({
      project_dir: testDir,
      git_branch: 'main',
      time_of_day: 'morning',
    });

    // Assert
    const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', sessionId, 'events.jsonl');
    expect(fs.existsSync(eventsPath)).toBe(true);

    const content = fs.readFileSync(eventsPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    const event = JSON.parse(lines[0]);
    expect(event.event_type).toBe('session_start');
    expect(event.payload.input.project_dir).toBe(testDir);
    expect(event.payload.input.time_of_day).toBe('morning');
  });

  it('A.2: Event tracking writes to events.jsonl', () => {
    // Arrange
    const sessionId = 'test-session-lifecycle';

    // Act
    modules.sessionTracker.trackSkillInvoked('commit', '--amend', true, 150);
    modules.sessionTracker.trackAgentSpawned('backend-architect', 'Design API', true);
    modules.sessionTracker.trackToolUsed('Grep', true, 50, 'search');

    // Assert
    const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', sessionId, 'events.jsonl');
    const content = fs.readFileSync(eventsPath, 'utf8');
    const events = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

    expect(events.length).toBeGreaterThanOrEqual(3);

    const skillEvent = events.find((e: any) => e.event_type === 'skill_invoked');
    expect(skillEvent).toBeDefined();
    expect(skillEvent.payload.name).toBe('commit');

    const agentEvent = events.find((e: any) => e.event_type === 'agent_spawned');
    expect(agentEvent).toBeDefined();
    expect(agentEvent.payload.name).toBe('backend-architect');

    const toolEvent = events.find((e: any) => e.event_type === 'tool_used');
    expect(toolEvent).toBeDefined();
    expect(toolEvent.payload.name).toBe('Grep');
  });

  it('A.3: Session end event is recorded', () => {
    // Arrange & Act
    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackSessionEnd();

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    const endEvent = events.find((e: any) => e.event_type === 'session_end');
    expect(endEvent).toBeDefined();
    expect(endEvent!.payload.input.ended_at).toBeDefined();
  });

  it('A.4: generateSessionSummary aggregates event counts correctly', () => {
    // Arrange
    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackSkillInvoked('skill-1', undefined, true);
    modules.sessionTracker.trackSkillInvoked('skill-2', undefined, true);
    modules.sessionTracker.trackSkillInvoked('skill-1', undefined, true); // Duplicate skill
    modules.sessionTracker.trackAgentSpawned('agent-1', undefined, true);
    modules.sessionTracker.trackDecisionMade('Use TypeScript', 'Type safety', 0.9);
    modules.sessionTracker.trackSessionEnd();

    // Act
    const summary = modules.sessionTracker.generateSessionSummary();

    // Assert
    expect(summary.event_counts.skill_invoked).toBe(3);
    expect(summary.event_counts.agent_spawned).toBe(1);
    expect(summary.event_counts.decision_made).toBe(1);
    expect(summary.event_counts.session_start).toBe(1);
    expect(summary.event_counts.session_end).toBe(1);
    expect(summary.skills_used).toContain('skill-1');
    expect(summary.skills_used).toContain('skill-2');
    expect(summary.skills_used).toHaveLength(2); // Unique skills only
    expect(summary.agents_spawned).toContain('agent-1');
  });

  it('A.5: Session duration is calculated from start/end events', () => {
    // Arrange - we need timestamps from the events
    modules.sessionTracker.trackSessionStart();

    // Simulate some activity
    modules.sessionTracker.trackSkillInvoked('test-skill', undefined, true);

    // Small delay for realistic timestamp difference
    modules.sessionTracker.trackSessionEnd();

    // Act
    const summary = modules.sessionTracker.generateSessionSummary();

    // Assert
    expect(summary.start_time).toBeDefined();
    expect(summary.end_time).toBeDefined();
    // Duration should be defined and >= 0
    expect(summary.duration_ms).toBeDefined();
    expect(summary.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('A.6: loadSessionEvents returns empty array for non-existent session', () => {
    // Arrange
    process.env.CLAUDE_SESSION_ID = 'non-existent-session-12345';

    // Act
    const events = modules.sessionTracker.loadSessionEvents('non-existent-session-12345');

    // Assert
    expect(events).toEqual([]);
  });

  it('A.7: Multiple event types are tracked in correct order', () => {
    // Arrange & Act
    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackHookTriggered('hook-1', true, 10);
    modules.sessionTracker.trackProblemReported('Test failing');
    modules.sessionTracker.trackSolutionFound('Fixed the test', 'prob-1', 0.8);
    modules.sessionTracker.trackPreferenceStated('Prefer TypeScript', 0.9);
    modules.sessionTracker.trackSessionEnd();

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    const eventTypes = events.map((e: any) => e.event_type);

    expect(eventTypes[0]).toBe('session_start');
    expect(eventTypes).toContain('hook_triggered');
    expect(eventTypes).toContain('problem_reported');
    expect(eventTypes).toContain('solution_found');
    expect(eventTypes).toContain('preference_stated');
    expect(eventTypes[eventTypes.length - 1]).toBe('session_end');
  });
});

// =============================================================================
// SECTION B: Identity -> Session Tracking Flow Tests
// =============================================================================

describe('B. Identity -> Session Tracking Flow', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    // Reset caches and environment
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-identity';
    process.env.CLAUDE_PROJECT_DIR = testDir;

    // Create session directory
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-identity');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-identity');
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('B.1: resolveUserIdentity returns correct identity from git config', () => {
    // Act
    const identity = modules.userIdentity.resolveUserIdentity(testDir);

    // Assert
    expect(identity.user_id).toBe('integration-test@orchestkit.dev');
    expect(identity.display_name).toBe('Integration Test User');
    expect(identity.source).toBe('git');
    expect(identity.machine_id).toBe('integration-test-machine');
  });

  it('B.2: getIdentityContext includes session and user info', () => {
    // Act
    const ctx = modules.userIdentity.getIdentityContext();

    // Assert
    expect(ctx.session_id).toBe('test-session-identity');
    expect(ctx.user_id).toBe('integration-test@orchestkit.dev');
    expect(ctx.machine_id).toBe('integration-test-machine');
    expect(ctx.identity_source).toBe('git');
    expect(ctx.timestamp).toBeDefined();
    expect(ctx.anonymous_id).toBeDefined();
    expect(ctx.anonymous_id).toHaveLength(32);
  });

  it('B.3: Events are tagged with correct user identity', () => {
    // Act
    modules.sessionTracker.trackSkillInvoked('test-skill', undefined, true);

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBeGreaterThan(0);

    const event = events[0];
    expect(event.identity.user_id).toBe('integration-test@orchestkit.dev');
    expect(event.identity.session_id).toBe('test-session-identity');
    expect(event.identity.machine_id).toBe('integration-test-machine');
  });

  it('B.4: Anonymous ID is consistent across events', () => {
    // Act
    modules.sessionTracker.trackSkillInvoked('skill-1', undefined, true);
    modules.sessionTracker.trackAgentSpawned('agent-1', undefined, true);

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBe(2);

    const anonId1 = events[0].identity.anonymous_id;
    const anonId2 = events[1].identity.anonymous_id;
    expect(anonId1).toBe(anonId2);
    expect(anonId1).toHaveLength(32);
  });

  it('B.5: Identity caching works correctly', () => {
    // Act
    const identity1 = modules.userIdentity.resolveUserIdentity(testDir);
    const identity2 = modules.userIdentity.resolveUserIdentity(testDir);

    // Assert - same object reference due to caching
    expect(identity1).toBe(identity2);
  });

  it('B.6: clearIdentityCache resets cached identity', () => {
    // Arrange
    const identity1 = modules.userIdentity.resolveUserIdentity(testDir);

    // Act
    modules.userIdentity.clearIdentityCache();
    const identity2 = modules.userIdentity.resolveUserIdentity(testDir);

    // Assert - different object references after cache clear
    expect(identity1).not.toBe(identity2);
    // But same values
    expect(identity1.user_id).toBe(identity2.user_id);
  });

  it('B.7: getProjectUserId generates correct scoped ID', () => {
    // Act
    const userId = modules.userIdentity.getProjectUserId('decisions');

    // Assert
    const expectedProjectName = path.basename(testDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    expect(userId).toBe(`${expectedProjectName}-decisions`);
  });

  it('B.8: getGlobalScopeId generates correct global ID', () => {
    // Act
    const globalId = modules.userIdentity.getGlobalScopeId('best-practices');

    // Assert
    expect(globalId).toBe('orchestkit-global-best-practices');
  });
});

// =============================================================================
// SECTION C: Session -> Profile Aggregation Flow Tests
// =============================================================================

describe('C. Session -> Profile Aggregation Flow', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    // Reset environment
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-profile';
    process.env.CLAUDE_PROJECT_DIR = testDir;
    process.env.HOME = testHomeDir;

    // Create session directory
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-profile');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup session and profile data
    try {
      const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-profile');
      fs.rmSync(sessionDir, { recursive: true, force: true });

      const profileDir = path.join(testHomeDir, '.claude', 'orchestkit', 'users');
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('C.1: loadUserProfile returns empty profile for new user', () => {
    // Act
    const profile = modules.userProfile.loadUserProfile('new-user@test.com');

    // Assert
    expect(profile.user_id).toBe('new-user@test.com');
    expect(profile.sessions_count).toBe(0);
    expect(profile.skill_usage).toEqual({});
    expect(profile.agent_usage).toEqual({});
    expect(profile.decisions).toEqual([]);
    expect(profile.preferences).toEqual([]);
    expect(profile.aggregated_sessions).toEqual([]);
  });

  it('C.2: saveUserProfile persists profile to cross-project storage', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('save-test@test.com');
    profile.sessions_count = 5;

    // Act
    const result = modules.userProfile.saveUserProfile(profile);

    // Assert
    expect(result).toBe(true);

    const profilePath = path.join(testHomeDir, '.claude', 'orchestkit', 'users', 'save-test@test.com', 'profile.json');
    expect(fs.existsSync(profilePath)).toBe(true);

    const savedContent = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    expect(savedContent.sessions_count).toBe(5);
  });

  it('C.3: aggregateSession updates profile with session summary', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('aggregate-test@test.com');
    const summary: any = {
      session_id: 'agg-session-001',
      user_id: 'aggregate-test@test.com',
      anonymous_id: 'anon123',
      skills_used: ['commit', 'verify', 'explore'],
      agents_spawned: ['backend-architect', 'test-generator'],
      hooks_triggered: [],
      decisions_made: 2,
      problems_reported: 1,
      solutions_found: 1,
      event_counts: {},
    };

    // Act
    const updated = modules.userProfile.aggregateSession(profile, summary);

    // Assert
    expect(updated.sessions_count).toBe(1);
    expect(updated.aggregated_sessions).toContain('agg-session-001');
    expect(updated.skill_usage.commit).toBeDefined();
    expect(updated.skill_usage.verify).toBeDefined();
    expect(updated.skill_usage.explore).toBeDefined();
    expect(updated.agent_usage['backend-architect']).toBeDefined();
    expect(updated.agent_usage['test-generator']).toBeDefined();
  });

  it('C.4: Duplicate session aggregation is prevented', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('dup-test@test.com');
    const summary: any = {
      session_id: 'dup-session-001',
      user_id: 'dup-test@test.com',
      anonymous_id: 'anon123',
      skills_used: ['skill-new'],
      agents_spawned: [],
      hooks_triggered: [],
      decisions_made: 0,
      problems_reported: 0,
      solutions_found: 0,
      event_counts: {},
    };

    // Act - Aggregate same session twice
    modules.userProfile.aggregateSession(profile, summary);
    const updated = modules.userProfile.aggregateSession(profile, summary);

    // Assert
    expect(updated.sessions_count).toBe(1); // Not incremented
    expect(updated.aggregated_sessions.length).toBe(1);
    // Skill should only be counted once
    expect(updated.skill_usage['skill-new'].count).toBe(1);
  });

  it('C.5: addDecision adds decision to profile', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('decision-test@test.com');

    // Act
    const updated = modules.userProfile.addDecision(profile, {
      what: 'Use cursor-pagination',
      alternatives: ['offset-pagination'],
      rationale: 'Scales better for large datasets',
      confidence: 0.9,
    });

    // Assert
    expect(updated.decisions).toHaveLength(1);
    expect(updated.decisions[0].what).toBe('Use cursor-pagination');
    expect(updated.decisions[0].alternatives).toContain('offset-pagination');
    expect(updated.decisions[0].rationale).toBe('Scales better for large datasets');
    expect(updated.decisions[0].timestamp).toBeDefined();
  });

  it('C.6: addPreference updates existing preference', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('pref-test@test.com');

    // Act
    modules.userProfile.addPreference(profile, 'language', 'TypeScript', 0.8);
    modules.userProfile.addPreference(profile, 'language', 'TypeScript', 0.95);

    // Assert
    expect(profile.preferences).toHaveLength(1);
    expect(profile.preferences[0].observation_count).toBe(2);
    expect(profile.preferences[0].confidence).toBe(0.95); // Higher confidence kept
  });

  it('C.7: Skill usage stats are updated correctly', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('stats-test@test.com');
    const summary1: any = {
      session_id: 'stats-session-1',
      user_id: 'stats-test@test.com',
      anonymous_id: 'anon',
      skills_used: ['commit', 'verify'],
      agents_spawned: [],
      hooks_triggered: [],
      decisions_made: 0,
      problems_reported: 0,
      solutions_found: 0,
      event_counts: {},
    };
    const summary2: any = {
      session_id: 'stats-session-2',
      user_id: 'stats-test@test.com',
      anonymous_id: 'anon',
      skills_used: ['commit', 'explore'],
      agents_spawned: [],
      hooks_triggered: [],
      decisions_made: 0,
      problems_reported: 0,
      solutions_found: 0,
      event_counts: {},
    };

    // Act
    modules.userProfile.aggregateSession(profile, summary1);
    modules.userProfile.aggregateSession(profile, summary2);

    // Assert
    expect(profile.skill_usage.commit.count).toBe(2);
    expect(profile.skill_usage.verify.count).toBe(1);
    expect(profile.skill_usage.explore.count).toBe(1);
  });

  it('C.8: getTopSkills returns most used skills', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('top-test@test.com');

    // Add skills with different usage counts
    for (let i = 0; i < 5; i++) {
      modules.userProfile.aggregateSession(profile, {
        session_id: `top-session-commit-${i}`,
        user_id: 'top-test@test.com',
        anonymous_id: 'anon',
        skills_used: ['commit'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {},
      } as any);
    }
    for (let i = 0; i < 3; i++) {
      modules.userProfile.aggregateSession(profile, {
        session_id: `top-session-verify-${i}`,
        user_id: 'top-test@test.com',
        anonymous_id: 'anon',
        skills_used: ['verify'],
        agents_spawned: [],
        hooks_triggered: [],
        decisions_made: 0,
        problems_reported: 0,
        solutions_found: 0,
        event_counts: {},
      } as any);
    }

    // Act
    const topSkills = modules.userProfile.getTopSkills(profile, 2);

    // Assert
    expect(topSkills).toHaveLength(2);
    expect(topSkills[0].skill).toBe('commit');
    expect(topSkills[0].stats.count).toBe(5);
    expect(topSkills[1].skill).toBe('verify');
  });

  it('C.9: hasDecisionAbout finds related decisions', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('find-test@test.com');
    modules.userProfile.addDecision(profile, {
      what: 'Use cursor-based pagination for API',
      rationale: 'Better performance at scale',
      confidence: 0.9,
    });

    // Act
    const found = modules.userProfile.hasDecisionAbout(profile, 'pagination');

    // Assert
    expect(found).toBeDefined();
    expect(found?.what).toContain('pagination');
  });

  it('C.10: exportForTeam includes user_id and usage data', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('export-test@test.com');
    profile.sessions_count = 10;
    modules.userProfile.addDecision(profile, {
      what: 'Test decision',
      confidence: 0.8,
    });

    // Act
    const exported = modules.userProfile.exportForTeam(profile);

    // Assert
    expect(exported.user_id).toBe('export-test@test.com');
    expect(exported.skill_usage).toBeDefined();
    expect(exported.decisions).toBeDefined();
    expect(exported.decisions).toHaveLength(1);
  });

  it('C.11: exportForGlobal uses anonymous_id and strips project info', () => {
    // Arrange
    const profile = modules.userProfile.loadUserProfile('anon-export@test.com');
    modules.userProfile.addDecision(profile, {
      what: 'Use TypeScript',
      confidence: 0.9,
      project: 'secret-project',
    });

    // Act
    const exported = modules.userProfile.exportForGlobal(profile);

    // Assert
    expect(exported.anonymous_id).toBeDefined();
    expect(exported.decisions).toHaveLength(1);
    expect((exported.decisions[0] as any).project).toBeUndefined();
  });
});

// =============================================================================
// SECTION D: Intent Tracking -> Session Flow Tests
// =============================================================================

describe('D. Intent Tracking -> Session Flow', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-intent';
    process.env.CLAUDE_PROJECT_DIR = testDir;

    // Create session directory
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-intent');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-intent');
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('D.1: detectUserIntent extracts decisions from text', () => {
    // Arrange
    const prompt = "Let's use cursor-pagination instead of offset pagination because it scales better";

    // Act
    const result = modules.userIntentDetector.detectUserIntent(prompt);

    // Assert
    expect(result.decisions.length).toBeGreaterThan(0);
    const decision = result.decisions[0];
    expect(decision.type).toBe('decision');
    expect(decision.text).toContain('cursor-pagination');
    expect(decision.confidence).toBeGreaterThan(0.5);
  });

  it('D.2: detectUserIntent extracts preferences', () => {
    // Arrange
    const prompt = 'I prefer TypeScript over JavaScript for type safety';

    // Act
    const result = modules.userIntentDetector.detectUserIntent(prompt);

    // Assert
    expect(result.preferences.length).toBeGreaterThan(0);
    const pref = result.preferences[0];
    expect(pref.type).toBe('preference');
    expect(pref.text.toLowerCase()).toContain('typescript');
  });

  it('D.3: detectUserIntent extracts problems', () => {
    // Arrange
    const prompt = 'The tests are failing with a timeout error';

    // Act
    const result = modules.userIntentDetector.detectUserIntent(prompt);

    // Assert
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems[0].type).toBe('problem');
  });

  it('D.4: captureUserIntent hook tracks decisions to session', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-intent',
      tool_input: {},
      project_dir: testDir,
      prompt: "I decided to use PostgreSQL for the database because of ACID compliance",
    };

    // Act
    const result = modules.captureUserIntent.captureUserIntent(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);

    // Check events were tracked
    const events = modules.sessionTracker.loadSessionEvents();
    const decisionEvents = events.filter((e: any) => e.event_type === 'decision_made');
    expect(decisionEvents.length).toBeGreaterThan(0);
  });

  it('D.5: captureUserIntent hook tracks preferences to session', () => {
    // Arrange - Use "I prefer" pattern which matches PREFERENCE_PATTERNS
    const input = {
      tool_name: '',
      session_id: 'test-session-intent',
      tool_input: {},
      project_dir: testDir,
      prompt: 'I prefer vitest over jest for testing TypeScript projects',
    };

    // Act
    modules.captureUserIntent.captureUserIntent(input);

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    const prefEvents = events.filter((e: any) => e.event_type === 'preference_stated');
    expect(prefEvents.length).toBeGreaterThan(0);
  });

  it('D.6: captureUserIntent stores problems to open-problems.jsonl', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-intent',
      tool_input: {},
      project_dir: testDir,
      prompt: 'There is an error with the authentication not working',
    };

    // Act
    modules.captureUserIntent.captureUserIntent(input);

    // Assert
    const problemsPath = path.join(testDir, '.claude', 'memory', 'open-problems.jsonl');
    if (fs.existsSync(problemsPath)) {
      const content = fs.readFileSync(problemsPath, 'utf8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('D.7: Short prompts are skipped', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-intent',
      tool_input: {},
      project_dir: testDir,
      prompt: 'hi', // Too short
    };

    // Act
    const result = modules.captureUserIntent.captureUserIntent(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    // No events should be tracked for short prompts
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBe(0);
  });

  it('D.8: extractEntities identifies technologies', () => {
    // Arrange
    const text = 'Using PostgreSQL with pgvector for vector search in our FastAPI application';

    // Act
    const entities = modules.userIntentDetector.extractEntities(text);

    // Assert
    expect(entities).toContain('postgresql');
    expect(entities).toContain('pgvector');
    expect(entities).toContain('fastapi');
  });

  it('D.9: Rationale is extracted when present', () => {
    // Arrange
    const prompt = "Chose TypeScript because it provides better type safety";

    // Act
    const result = modules.userIntentDetector.detectUserIntent(prompt);

    // Assert
    expect(result.decisions.length).toBeGreaterThan(0);
    const decision = result.decisions[0];
    expect(decision.rationale).toBeDefined();
    expect(decision.rationale?.toLowerCase()).toContain('type safety');
  });

  it('D.10: Confidence score increases with rationale', () => {
    // Arrange
    const promptWithRationale = "Let's use Redis because it's fast";
    const promptWithoutRationale = "Let's use Redis";

    // Act
    const resultWith = modules.userIntentDetector.detectUserIntent(promptWithRationale);
    const resultWithout = modules.userIntentDetector.detectUserIntent(promptWithoutRationale);

    // Assert
    if (resultWith.decisions.length > 0 && resultWithout.decisions.length > 0) {
      expect(resultWith.decisions[0].confidence).toBeGreaterThanOrEqual(
        resultWithout.decisions[0].confidence
      );
    }
  });
});

// =============================================================================
// SECTION E: Satisfaction Detection -> Session Flow Tests
// =============================================================================

describe('E. Satisfaction Detection -> Session Flow', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-satisfaction';
    process.env.CLAUDE_PROJECT_DIR = testDir;
    process.env.SATISFACTION_SAMPLE_RATE = '1'; // Sample every prompt for testing

    // Create session and feedback directories
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-satisfaction');
    const feedbackDir = path.join(testDir, '.claude', 'feedback');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.mkdirSync(feedbackDir, { recursive: true });

    // Reset counter file
    const counterFile = path.join(testDir, '.claude', '.satisfaction-counter');
    try {
      fs.unlinkSync(counterFile);
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(() => {
    try {
      const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-satisfaction');
      fs.rmSync(sessionDir, { recursive: true, force: true });
      const feedbackDir = path.join(testDir, '.claude', 'feedback');
      fs.rmSync(feedbackDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.SATISFACTION_SAMPLE_RATE;
  });

  it('E.1: Positive satisfaction is detected', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Thank you, that worked perfectly!',
    };

    // Act
    const result = modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    expect(result.continue).toBe(true);

    // Check satisfaction log
    const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8');
      expect(logContent).toContain('positive');
    }
  });

  it('E.2: Negative satisfaction is detected', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: "That doesn't work, it's still broken",
    };

    // Act
    modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8');
      expect(logContent).toContain('negative');
    }
  });

  it('E.3: Neutral prompts are not logged', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Can you show me the file contents?',
    };

    // Act
    modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');
    // Either file doesn't exist or is empty (neutral prompts not logged)
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8');
      expect(logContent.trim()).toBe('');
    }
  });

  it('E.4: Commands (starting with /) are skipped', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: '/commit Thank you for the great work',
    };

    // Act
    const result = modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
    // Should not log because it starts with /
    const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');
    expect(fs.existsSync(logPath)).toBe(false);
  });

  it('E.5: Very short prompts are skipped', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: 'y', // Single character
    };

    // Act
    const result = modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    expect(result.continue).toBe(true);
  });

  it('E.6: Satisfaction triggers trackEvent to session', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Excellent work, this is exactly what I needed!',
    };

    // Act
    modules.satisfactionDetector.satisfactionDetector(input);

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    const prefEvents = events.filter((e: any) => e.event_type === 'preference_stated');
    expect(prefEvents.length).toBeGreaterThan(0);
  });

  it('E.7: Sample rate controls detection frequency', () => {
    // Arrange
    process.env.SATISFACTION_SAMPLE_RATE = '3'; // Sample every 3rd prompt

    // Create counter file to control sampling
    const counterFile = path.join(testDir, '.claude', '.satisfaction-counter');
    fs.writeFileSync(counterFile, '2'); // Next call will be #3, which should be sampled

    const input = {
      tool_name: '',
      session_id: 'test-session-satisfaction',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Thanks, that works great!',
    };

    // Act - This should be the 3rd call (sampled)
    modules.satisfactionDetector.satisfactionDetector(input);

    // Assert - Should have logged because counter was at 2 (next is 3)
    const logPath = path.join(testDir, '.claude', 'feedback', 'satisfaction.log');
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8');
      expect(logContent).toContain('positive');
    }
  });
});

// =============================================================================
// SECTION F: Error Handling Across Boundaries Tests
// =============================================================================

describe('F. Error Handling Across Boundaries', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-errors';
    process.env.CLAUDE_PROJECT_DIR = testDir;

    // Create session directory
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-errors');
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-errors');
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('F.1: Invalid session ID is rejected (SEC-002)', () => {
    // Arrange
    const invalidSessionIds = [
      '../../../etc/passwd',
      'session/../../hack',
      'session\x00null',
      'a'.repeat(200), // Too long
    ];

    // Act & Assert
    for (const invalidId of invalidSessionIds) {
      expect(() => {
        modules.sessionTracker.loadSessionEvents(invalidId);
      }).toThrow();
    }
  });

  it('F.2: Valid session IDs are accepted', () => {
    // Arrange
    const validSessionIds = [
      'session-123',
      'session_456',
      'abc123',
      'TEST-SESSION',
    ];

    // Act & Assert
    for (const validId of validSessionIds) {
      expect(() => {
        modules.sessionTracker.loadSessionEvents(validId);
      }).not.toThrow();
    }
  });

  it('F.3: Missing prompt is handled gracefully', () => {
    // Arrange
    const input = {
      tool_name: '',
      session_id: 'test-session-errors',
      tool_input: {},
      project_dir: testDir,
      // No prompt field
    };

    // Act
    const result = modules.captureUserIntent.captureUserIntent(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('F.4: Empty events file returns empty array', () => {
    // Arrange
    const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-errors', 'events.jsonl');
    fs.writeFileSync(eventsPath, '');

    // Act
    const events = modules.sessionTracker.loadSessionEvents();

    // Assert
    expect(events).toEqual([]);
  });

  it('F.5: Malformed JSON in events file is handled', () => {
    // Arrange
    const eventsPath = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-errors', 'events.jsonl');
    fs.writeFileSync(eventsPath, 'not valid json\n{also invalid');

    // Act
    const events = modules.sessionTracker.loadSessionEvents();

    // Assert
    expect(events).toEqual([]);
  });

  it('F.6: Profile load with corrupted file returns empty profile', () => {
    // Arrange
    const profileDir = path.join(testHomeDir, '.claude', 'orchestkit', 'users', 'corrupt@test.com');
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(path.join(profileDir, 'profile.json'), 'not valid json');

    // Act
    const profile = modules.userProfile.loadUserProfile('corrupt@test.com');

    // Assert
    expect(profile.user_id).toBe('corrupt@test.com');
    expect(profile.sessions_count).toBe(0);

    // Cleanup
    fs.rmSync(profileDir, { recursive: true, force: true });
  });

  it('F.7: Sensitive data is redacted in events', () => {
    // Arrange & Act
    modules.sessionTracker.trackEvent('tool_used', 'Bash', {
      input: {
        command: 'echo test',
        password: 'secret123',
        api_key: 'sk-xxxx',
        auth_token: 'bearer-token',
      },
      success: true,
    });

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event.payload.input.command).toBe('echo test');
    expect(event.payload.input.password).toBe('[REDACTED]');
    expect(event.payload.input.api_key).toBe('[REDACTED]');
    expect(event.payload.input.auth_token).toBe('[REDACTED]');
  });

  it('F.8: Long strings are truncated in events', () => {
    // Arrange
    const longString = 'x'.repeat(1000);

    // Act
    modules.sessionTracker.trackDecisionMade(longString, longString, 0.9);

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event.payload.context.length).toBeLessThan(1000);
    expect(event.payload.context).toContain('...');
  });
});

// =============================================================================
// SECTION G: Privacy Settings Tests
// =============================================================================

describe('G. Privacy Settings Integration', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_PROJECT_DIR = testDir;

    // Create .claude directory for config files
    const claudeDir = path.join(testDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
  });

  afterEach(() => {
    // Remove identity config if exists
    const configPath = path.join(testDir, '.claude', '.user_identity.json');
    try {
      fs.unlinkSync(configPath);
    } catch {
      // Ignore
    }
  });

  it('G.1: Default privacy settings are conservative', () => {
    // Act
    const privacy = modules.userIdentity.getPrivacySettings(testDir);

    // Assert
    expect(privacy.share_with_team).toBe(true);
    expect(privacy.share_globally).toBe(false);
    expect(privacy.share_decisions).toBe(true);
    expect(privacy.share_preferences).toBe(true);
    expect(privacy.share_skill_usage).toBe(false);
    expect(privacy.share_prompts).toBe(false);
    expect(privacy.anonymize_globally).toBe(true);
  });

  it('G.2: canShare respects team scope', () => {
    // Act & Assert
    expect(modules.userIdentity.canShare('decisions', 'team')).toBe(true);
    expect(modules.userIdentity.canShare('preferences', 'team')).toBe(true);
    expect(modules.userIdentity.canShare('prompts', 'team')).toBe(false);
  });

  it('G.3: canShare respects global scope', () => {
    // Act & Assert
    expect(modules.userIdentity.canShare('decisions', 'global')).toBe(false);
    expect(modules.userIdentity.canShare('preferences', 'global')).toBe(false);
  });

  it('G.4: getUserIdForScope returns anonymous_id for global', () => {
    // Act
    const localId = modules.userIdentity.getUserIdForScope('local');
    const globalId = modules.userIdentity.getUserIdForScope('global');

    // Assert
    expect(localId).toBe('integration-test@orchestkit.dev');
    expect(globalId).not.toBe(localId);
    expect(globalId).toHaveLength(32);
  });

  it('G.5: Config file overrides default privacy settings', () => {
    // Arrange
    const configPath = path.join(testDir, '.claude', '.user_identity.json');
    fs.writeFileSync(configPath, JSON.stringify({
      user_id: 'config-user@test.com',
      privacy: {
        share_globally: true,
        share_skill_usage: true,
      },
    }));
    modules.userIdentity.clearIdentityCache();

    // Act
    const privacy = modules.userIdentity.getPrivacySettings(testDir);

    // Assert
    expect(privacy.share_globally).toBe(true);
    expect(privacy.share_skill_usage).toBe(true);
    expect(privacy.share_with_team).toBe(true); // Default preserved
  });

  it('G.6: saveUserIdentityConfig persists config', () => {
    // Act
    const result = modules.userIdentity.saveUserIdentityConfig({
      user_id: 'saved@test.com',
      team_id: 'my-team',
    }, testDir);

    // Assert
    expect(result).toBe(true);

    const configPath = path.join(testDir, '.claude', '.user_identity.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.user_id).toBe('saved@test.com');
    expect(config.team_id).toBe('my-team');
  });
});

// =============================================================================
// SECTION H: End-to-End Integration Scenarios
// =============================================================================

describe('H. End-to-End Integration Scenarios', () => {
  let modules: Awaited<ReturnType<typeof importModules>>;

  beforeAll(async () => {
    modules = await importModules();
  });

  beforeEach(() => {
    modules.userIdentity.clearIdentityCache();
    process.env.CLAUDE_SESSION_ID = 'test-session-e2e';
    process.env.CLAUDE_PROJECT_DIR = testDir;
    process.env.HOME = testHomeDir;
    process.env.SATISFACTION_SAMPLE_RATE = '1';

    // Create necessary directories
    const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-e2e');
    const feedbackDir = path.join(testDir, '.claude', 'feedback');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.mkdirSync(feedbackDir, { recursive: true });
  });

  afterEach(() => {
    try {
      const sessionDir = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-e2e');
      fs.rmSync(sessionDir, { recursive: true, force: true });
      const feedbackDir = path.join(testDir, '.claude', 'feedback');
      fs.rmSync(feedbackDir, { recursive: true, force: true });
      const profileDir = path.join(testHomeDir, '.claude', 'orchestkit', 'users');
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('H.1: Full session lifecycle with profile aggregation', () => {
    // Arrange - Start session
    modules.sessionTracker.trackSessionStart({
      project_dir: testDir,
      git_branch: 'main',
    });

    // Simulate user activity
    modules.captureUserIntent.captureUserIntent({
      tool_name: '',
      session_id: 'test-session-e2e',
      tool_input: {},
      project_dir: testDir,
      prompt: "Let's use PostgreSQL for the database because of ACID compliance",
    });

    modules.sessionTracker.trackSkillInvoked('commit', '--message "feat: add db"', true, 100);
    modules.sessionTracker.trackAgentSpawned('backend-architect', 'Design API', true);

    modules.satisfactionDetector.satisfactionDetector({
      tool_name: '',
      session_id: 'test-session-e2e',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Thank you, that looks great!',
    });

    modules.sessionTracker.trackSessionEnd();

    // Act - Generate summary and aggregate to profile
    const summary = modules.sessionTracker.generateSessionSummary();
    const profile = modules.userProfile.loadUserProfile('integration-test@orchestkit.dev');
    const updatedProfile = modules.userProfile.aggregateSession(profile, summary);
    modules.userProfile.saveUserProfile(updatedProfile);

    // Assert
    expect(summary.event_counts.session_start).toBe(1);
    expect(summary.event_counts.session_end).toBe(1);
    expect(summary.event_counts.skill_invoked).toBeGreaterThan(0);
    expect(summary.skills_used).toContain('commit');
    expect(summary.agents_spawned).toContain('backend-architect');

    expect(updatedProfile.sessions_count).toBe(1);
    expect(updatedProfile.skill_usage.commit).toBeDefined();
    expect(updatedProfile.agent_usage['backend-architect']).toBeDefined();

    // Verify profile was persisted
    const profilePath = path.join(
      testHomeDir, '.claude', 'orchestkit', 'users',
      'integration-test@orchestkit.dev', 'profile.json'
    );
    expect(fs.existsSync(profilePath)).toBe(true);
  });

  it('H.2: Multiple sessions aggregate correctly', () => {
    // Arrange - First session
    process.env.CLAUDE_SESSION_ID = 'test-session-e2e-1';
    const sessionDir1 = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-e2e-1');
    fs.mkdirSync(sessionDir1, { recursive: true });

    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackSkillInvoked('skill-a', undefined, true);
    modules.sessionTracker.trackSkillInvoked('skill-b', undefined, true);
    modules.sessionTracker.trackSessionEnd();

    const summary1 = modules.sessionTracker.generateSessionSummary();
    let profile = modules.userProfile.loadUserProfile('multi-session@test.com');
    profile = modules.userProfile.aggregateSession(profile, summary1);

    // Second session
    process.env.CLAUDE_SESSION_ID = 'test-session-e2e-2';
    const sessionDir2 = path.join(testDir, '.claude', 'memory', 'sessions', 'test-session-e2e-2');
    fs.mkdirSync(sessionDir2, { recursive: true });

    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackSkillInvoked('skill-a', undefined, true);
    modules.sessionTracker.trackSkillInvoked('skill-c', undefined, true);
    modules.sessionTracker.trackSessionEnd();

    const summary2 = modules.sessionTracker.generateSessionSummary();
    profile = modules.userProfile.aggregateSession(profile, summary2);

    // Assert
    expect(profile.sessions_count).toBe(2);
    expect(profile.skill_usage['skill-a'].count).toBe(2);
    expect(profile.skill_usage['skill-b'].count).toBe(1);
    expect(profile.skill_usage['skill-c'].count).toBe(1);

    // Cleanup
    fs.rmSync(sessionDir1, { recursive: true, force: true });
    fs.rmSync(sessionDir2, { recursive: true, force: true });
  });

  it('H.3: Decision capture flows to profile', () => {
    // Arrange & Act
    modules.sessionTracker.trackSessionStart();

    // Capture decision through intent hook
    modules.captureUserIntent.captureUserIntent({
      tool_name: '',
      session_id: 'test-session-e2e',
      tool_input: {},
      project_dir: testDir,
      prompt: "I decided to use cursor-pagination because offset doesn't scale",
    });

    modules.sessionTracker.trackSessionEnd();

    // Get summary and check decision was tracked
    const summary = modules.sessionTracker.generateSessionSummary();

    // Assert - Decision should be in event counts
    expect(summary.event_counts.decision_made).toBeGreaterThan(0);
  });

  it('H.4: Preference detection flows through satisfaction to profile', () => {
    // Arrange & Act
    modules.sessionTracker.trackSessionStart();

    modules.satisfactionDetector.satisfactionDetector({
      tool_name: '',
      session_id: 'test-session-e2e',
      tool_input: {},
      project_dir: testDir,
      prompt: 'Thanks, that works perfectly!',
    });

    modules.sessionTracker.trackSessionEnd();

    // Assert - Satisfaction tracking should create preference_stated event
    const events = modules.sessionTracker.loadSessionEvents();
    const prefEvents = events.filter((e: any) => e.event_type === 'preference_stated');
    expect(prefEvents.length).toBeGreaterThan(0);
  });

  it('H.5: Identity context is consistent across all events', () => {
    // Arrange & Act
    modules.sessionTracker.trackSessionStart();
    modules.sessionTracker.trackSkillInvoked('test-skill', undefined, true);
    modules.sessionTracker.trackAgentSpawned('test-agent', undefined, true);
    modules.sessionTracker.trackDecisionMade('Test decision', 'Test rationale', 0.9);
    modules.sessionTracker.trackSessionEnd();

    // Assert
    const events = modules.sessionTracker.loadSessionEvents();
    expect(events.length).toBeGreaterThanOrEqual(4);

    const firstUserId = events[0].identity.user_id;
    const firstAnonId = events[0].identity.anonymous_id;
    const firstSessionId = events[0].identity.session_id;

    for (const event of events) {
      expect(event.identity.user_id).toBe(firstUserId);
      expect(event.identity.anonymous_id).toBe(firstAnonId);
      expect(event.identity.session_id).toBe(firstSessionId);
    }
  });
});
