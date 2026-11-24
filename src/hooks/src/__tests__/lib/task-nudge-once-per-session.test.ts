/**
 * Cross-hook proof: across multi-step-task-nudge (UserPromptSubmit),
 * task-existence-gate (PreToolUse[Agent]) and agent-task-auto-register
 * (PostToolUse[Agent]) at most ONE task-tracking nudge reaches the model per
 * session, whichever hook speaks first, and the side effects still run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../../types.js';

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

import { multiStepTaskNudge } from '../../prompt/multi-step-task-nudge.js';
import { taskExistenceGate } from '../../pretool/task/task-existence-gate.js';
import { agentTaskAutoRegister } from '../../posttool/task/agent-task-auto-register.js';
import { registerTask } from '../../lib/task-integration.js';
import { claimTaskNudge, claimTaskNudgeForInput } from '../../lib/task-nudge-gate.js';

const QUALIFYING =
  'Fix the docs counts, add a drift gate, then rebuild the plugins and verify CI passes';

let data: string;
let projectDir: string;
let n = 0;
let sid: string;

beforeEach(() => {
  n += 1;
  sid = `once-${n}`;
  data = mkdtempSync(join(tmpdir(), 'nudge-once-'));
  projectDir = mkdtempSync(join(tmpdir(), 'nudge-once-proj-'));
  process.env.CLAUDE_PLUGIN_DATA = data;
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(data, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env.CLAUDE_PLUGIN_DATA;
});

function base(extra: Record<string, unknown>): HookInput {
  return { session_id: sid, project_dir: projectDir, ...extra } as unknown as HookInput;
}

/** A dispatcher hook plus the claim its dispatcher makes when the text is delivered. */
function delivered(result: HookResult, input: HookInput): HookResult {
  if (speaks(result)) claimTaskNudgeForInput(input);
  return result;
}
const prompt = () => {
  const input = base({ tool_name: '', prompt: QUALIFYING, tool_input: {} });
  return delivered(multiStepTaskNudge(input), input);
};
const pre = () => {
  const input = base({ tool_name: 'Agent', tool_input: { subagent_type: 'security-auditor' } });
  return delivered(taskExistenceGate(input), input);
};
const post = () =>
  agentTaskAutoRegister(
    base({ tool_name: 'Agent', tool_input: { subagent_type: 'security-auditor', description: 'x' } }),
  );

function speaks(r: { hookSpecificOutput?: unknown }): boolean {
  const out = r.hookSpecificOutput as { additionalContext?: string } | undefined;
  return typeof out?.additionalContext === 'string' && out.additionalContext.length > 0;
}

describe('one task-tracking nudge per session across all three hooks', () => {
  it('prompt first: the pre and post agent hooks stay quiet', () => {
    expect(speaks(prompt())).toBe(true);
    expect(speaks(pre())).toBe(false);
    expect(speaks(post())).toBe(false);
  });

  it('pre first: the prompt and post hooks stay quiet', () => {
    expect(speaks(pre())).toBe(true);
    expect(speaks(prompt())).toBe(false);
    expect(speaks(post())).toBe(false);
  });

  it('post first: the prompt and pre hooks stay quiet', () => {
    expect(speaks(post())).toBe(true);
    expect(speaks(prompt())).toBe(false);
    expect(speaks(pre())).toBe(false);
  });

  it('many calls in any mix still produce exactly one nudge', () => {
    const results = [prompt(), pre(), post(), pre(), prompt(), post(), post()];
    expect(results.filter(speaks)).toHaveLength(1);
  });

  it('side effect survives suppression: registerTask runs on every post call', () => {
    prompt(); // takes the one nudge
    post();
    post();
    expect(registerTask).toHaveBeenCalledTimes(2);
  });

  it('a session that already has a task gets no nudge from any hook', () => {
    const logDir = join(projectDir, '.claude', 'logs');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(
      join(logDir, 'task-creations.jsonl'),
      `${JSON.stringify({ event: 'task_created', session_id: sid })}\n`,
    );
    expect([prompt(), pre(), post()].filter(speaks)).toHaveLength(0);
    expect(registerTask).toHaveBeenCalledTimes(1);
  });

  it('sessions are independent', () => {
    expect(speaks(pre())).toBe(true);
    sid = `${sid}-other`;
    expect(speaks(pre())).toBe(true);
  });

  it('claimTaskNudge fails closed with no session id and wins exactly once otherwise', () => {
    expect(claimTaskNudge('', projectDir)).toBe(false);
    expect(claimTaskNudge(undefined, projectDir)).toBe(false);
    expect(claimTaskNudge(sid, projectDir)).toBe(true);
    expect(claimTaskNudge(sid, projectDir)).toBe(false);
  });
});
