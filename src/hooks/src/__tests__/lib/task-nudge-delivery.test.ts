/**
 * A task-tracking nudge is spent only when its text actually leaves a
 * dispatcher (HOLD on PR 5349 at e6698598). These tests run the real prompt and
 * Agent dispatchers, with their sibling hooks stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../../types.js';

const stubs = vi.hoisted(() => ({
  validator: { continue: true, suppressOutput: true } as Record<string, unknown>,
  executor: { continue: true, suppressOutput: true } as Record<string, unknown>,
}));
const silent = () => ({ continue: true, suppressOutput: true });

vi.mock('../../lib/task-integration.js', () => ({
  getTaskByAgent: vi.fn().mockReturnValue(undefined),
  registerTask: vi.fn(),
  generateTaskCreateInstruction: vi.fn().mockReturnValue({
    subject: 'Subject',
    activeForm: 'Doing',
    description: 'd',
    metadata: {},
  }),
}));
vi.mock('../../pretool/task/unified-agent-safety-dispatcher.js', () => ({
  unifiedAgentSafetyDispatcher: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../pretool/task/spawn-intent-logger.js', () => ({
  spawnIntentLogger: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../pretool/task/fable-spend-consent.js', () => ({
  fableSpendConsent: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../pretool/task/task-agent-advisor.js', () => ({
  taskAgentAdvisor: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../pretool/task/agent-registry-validator.js', () => ({
  agentRegistryValidator: () => stubs.validator,
}));
vi.mock('../../pretool/tool-invocation-linter.js', () => ({
  toolInvocationLinter: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/frustration-detector.js', () => ({
  frustrationDetector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/cache-break-detector.js', () => ({
  cacheBreakDetector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/handoff-injector.js', () => ({
  handoffInjector: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../prompt/executor-route-nudge.js', () => ({
  executorRouteNudge: () => stubs.executor,
}));
vi.mock('../../prompt/visual-style-nudge.js', () => ({
  visualStyleNudge: () => ({ continue: true, suppressOutput: true }),
}));
vi.mock('../../lib/session-identity-state.js', () => ({
  manageSessionIdentity: () => null,
  resolveTranscriptPath: () => null,
}));

import { syncTaskDispatcher } from '../../pretool/task/sync-task-dispatcher.js';
import { unifiedPromptDispatcher } from '../../prompt/unified-dispatcher.js';
import { agentTaskAutoRegister } from '../../posttool/task/agent-task-auto-register.js';
import { getSessionStorageDir } from '../../lib/paths.js';

const QUALIFYING = 'Fix the docs counts, add a drift gate, then rebuild the plugins and verify CI passes';
const EXPLICIT = 'Please keep a todo list for this session while we work through the release';

let data: string;
let projectDir: string;
let sid: string;
let n = 0;

beforeEach(() => {
  n += 1;
  sid = `delivery-${n}`;
  data = mkdtempSync(join(tmpdir(), 'nudge-delivery-'));
  projectDir = mkdtempSync(join(tmpdir(), 'nudge-delivery-proj-'));
  vi.stubEnv('CLAUDE_PLUGIN_DATA', data);
  vi.stubEnv('ORK_SESSION_IDENTITY', '0');
  vi.stubEnv('CLAUDE_EFFORT', undefined);
  vi.stubEnv('CLAUDE_MODEL', undefined);
  stubs.validator = silent();
  stubs.executor = silent();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(data, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
});

const contextOf = (r: HookResult): string =>
  (r.hookSpecificOutput as { additionalContext?: string } | undefined)?.additionalContext ?? '';
const marker = (id = sid) => join(getSessionStorageDir(), `${id}-task-nudge.sent`);

function agent(extra: Record<string, unknown> = {}): HookInput {
  return {
    hook_event: 'PreToolUse',
    tool_name: 'Agent',
    session_id: sid,
    project_dir: projectDir,
    tool_input: { subagent_type: 'security-auditor', description: 'x' },
    ...extra,
  } as unknown as HookInput;
}
function promptInput(prompt: string, sessionId: string | undefined = sid): HookInput {
  return {
    hook_event: 'UserPromptSubmit',
    tool_name: 'UserPromptSubmit',
    session_id: sessionId,
    project_dir: projectDir,
    tool_input: {},
    prompt,
  } as unknown as HookInput;
}
const ASK = {
  continue: true,
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'unknown agent' },
};

describe('the Agent dispatcher spends the nudge only on delivery', () => {
  it('an ask from a later hook discards the text and leaves the nudge unspent', () => {
    stubs.validator = ASK;
    const result = syncTaskDispatcher(agent());
    expect((result.hookSpecificOutput as { permissionDecision?: string }).permissionDecision).toBe('ask');
    expect(contextOf(result)).toBe('');
    expect(existsSync(marker())).toBe(false);
  });

  it('the post hook can still deliver after that undelivered pre hook', () => {
    stubs.validator = ASK;
    syncTaskDispatcher(agent());
    expect(contextOf(agentTaskAutoRegister(agent({ hook_event: 'PostToolUse' })))).toContain('[Auto-Task]');
  });

  it('a delivered nudge is spent, so the next spawn and the post hook stay quiet', () => {
    expect(contextOf(syncTaskDispatcher(agent()))).toContain('[Task Tracking]');
    expect(existsSync(marker())).toBe(true);
    expect(contextOf(syncTaskDispatcher(agent()))).toBe('');
    expect(contextOf(agentTaskAutoRegister(agent({ hook_event: 'PostToolUse' })))).toBe('');
  });

  it('both agent reminders are conditional on the tool being available', () => {
    expect(contextOf(syncTaskDispatcher(agent()))).toContain("If TaskCreate is in this session's tool set");
    sid = `${sid}-post`;
    expect(contextOf(agentTaskAutoRegister(agent({ hook_event: 'PostToolUse' })))).toContain(
      "If TaskCreate is in this session's tool set",
    );
  });
});

describe('the prompt dispatcher spends the nudge only on delivery', () => {
  it('a nudge dropped by the turn budget stays unspent and is sent on a later prompt', () => {
    vi.stubEnv('CLAUDE_EFFORT', 'low');
    stubs.executor = {
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `[budget filler] ${'alpha '.repeat(105)}`,
      },
    };
    const crowded = unifiedPromptDispatcher(promptInput(QUALIFYING));
    expect(contextOf(crowded)).toContain('[budget filler]');
    expect(contextOf(crowded)).not.toContain('[task-nudge]');
    expect(existsSync(marker())).toBe(false);

    stubs.executor = silent();
    expect(contextOf(unifiedPromptDispatcher(promptInput(QUALIFYING)))).toContain('[task-nudge]');
    expect(existsSync(marker())).toBe(true);
  });

  it('a prompt with no session id stays silent and writes no shared marker', () => {
    expect(contextOf(unifiedPromptDispatcher(promptInput(QUALIFYING, '')))).not.toContain('[task-nudge]');
    expect(existsSync(marker('unknown-session'))).toBe(false);
  });

  it('an explicit todo-list ask still gets an answer after the one nudge', () => {
    expect(contextOf(unifiedPromptDispatcher(promptInput(QUALIFYING)))).toContain('[task-nudge]');
    expect(contextOf(unifiedPromptDispatcher(promptInput(QUALIFYING)))).not.toContain('[task-nudge]');
    expect(contextOf(unifiedPromptDispatcher(promptInput(EXPLICIT)))).toContain('[task-nudge]');
  });

  it('an explicit ask stays silent once the session has a task', () => {
    const logDir = join(projectDir, '.claude', 'logs');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(
      join(logDir, 'task-creations.jsonl'),
      `${JSON.stringify({ event: 'task_created', session_id: sid })}\n`,
    );
    expect(contextOf(unifiedPromptDispatcher(promptInput(EXPLICIT)))).not.toContain('[task-nudge]');
  });
});
