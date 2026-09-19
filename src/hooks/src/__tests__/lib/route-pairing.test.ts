import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { FILE_ROUTE_RECORDS, routeJudgment, routeSessionDir, type RouteRecord } from '../../lib/route-judgment.js';
import { metricsDispatcher } from '../../posttool/metrics-dispatcher.js';
import { skillTracker } from '../../pretool/skill/skill-tracker.js';
import { syncTaskDispatcher } from '../../pretool/task/sync-task-dispatcher.js';
import { sessionSummary } from '../../stop/session-summary.js';
import { NOOP_CTX } from '../../lib/context.js';
vi.mock('../../lib/analytics-buffer.js', () => ({ bufferWrite: vi.fn() }));
vi.mock('../../lib/session-registry.js', () => ({ recordInvocation: vi.fn() }));
vi.mock('../../lib/skill-channels.js', () => ({ recordSkillChannel: vi.fn() }));
vi.mock('../../lib/metrics.js', () => ({ getTotalTools: () => 0 }));
vi.mock('../../lib/analytics.js', () => ({ appendAnalytics: vi.fn(), hashProject: () => 'test', getTeamContext: () => null }));
vi.mock('../../pretool/task/unified-agent-safety-dispatcher.js', () => ({ unifiedAgentSafetyDispatcher: () => ({ continue: false }) }));
vi.mock('../../pretool/task/fable-spend-consent.js', () => ({ fableSpendConsent: () => ({ continue: true }) }));
vi.mock('../../pretool/task/task-existence-gate.js', () => ({ taskExistenceGate: () => ({ continue: true }) }));
vi.mock('../../pretool/task/task-agent-advisor.js', () => ({ taskAgentAdvisor: () => ({ continue: true }) }));
vi.mock('../../pretool/task/agent-registry-validator.js', () => ({ agentRegistryValidator: () => ({ continue: true }) }));
vi.mock('../../pretool/task/spawn-intent-logger.js', () => ({ spawnIntentLogger: () => ({ continue: true }) }));
vi.mock('../../pretool/tool-invocation-linter.js', () => ({ toolInvocationLinter: () => ({ continue: true }) }));
vi.mock('../../lifecycle/webhook-forwarder.js', () => ({ webhookForwarder: () => ({ continue: true }) }));
vi.mock('../../posttool/metrics-bridge.js', () => ({ metricsBridge: () => ({ continue: true }) }));
vi.mock('../../posttool/context-crossing-warn.js', () => ({ contextCrossingWarn: () => ({ continue: true }) }));

let projectDir: string;
const env = { ORK_ROUTE_JEV: 'shadow', ORK_TYPESAFE_API_KEY: 'test-only' };
const body = { answers: { intent: { choice: 'dev_fix', confidence: 0.95, probabilities: { dev_fix: 0.95 } } } };
const keys = ['session_id', 'prompt_id', 'router', 'handoff_to', 'jev_pick', 'jev_confidence', 'incumbent_pick', 'agree', 'floor', 'decided_by'];
beforeEach(() => { projectDir = mkdtempSync(join(tmpdir(), 'route-pairing-')); vi.stubEnv('CLAUDE_PLUGIN_DATA', ''); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(projectDir, { recursive: true, force: true }); });
function judge(promptId: string, fetchImpl: typeof fetch = vi.fn(async () => new Response(JSON.stringify(body))) as typeof fetch, sessionId = 'session-a') {
  return routeJudgment({ prompt: 'Fix the upload retry failure and write regression coverage', promptId, sessionId, projectDir, env, fetchImpl });
}
function toolInput(promptId: string, skill: string, sessionId = 'session-a', extra: Partial<HookInput> = {}): HookInput {
  return { prompt_id: promptId, session_id: sessionId, project_dir: projectDir, tool_name: 'Skill', tool_input: { skill }, tool_use_id: `tool-${promptId}`, ...extra };
}
function observe(promptId: string, skill: string, sessionId = 'session-a', extra: Partial<HookInput> = {}) {
  const input = toolInput(promptId, skill, sessionId, extra);
  return input.tool_name === 'Agent' ? syncTaskDispatcher(input) : skillTracker(input, { ...NOOP_CTX, projectDir });
}
function stop(promptId: string, extra: Partial<HookInput> = {}) {
  return sessionSummary({ prompt_id: promptId, session_id: 'session-a', project_dir: projectDir, tool_name: '', tool_input: {}, last_assistant_message: 'Answered inline.', ...extra });
}
function rows(sessionId = 'session-a'): RouteRecord[] {
  return readFileSync(join(routeSessionDir(sessionId, projectDir, env), FILE_ROUTE_RECORDS), 'utf8').trim().split('\n').map(line => JSON.parse(line));
}
function contract(records: RouteRecord[]) {
  for (const row of records) expect(Object.keys(row)).toEqual(expect.arrayContaining(keys));
  for (const row of records) {
    expect(row.prompt_id).toEqual(expect.any(String));
    expect(typeof row.prompt_id === 'string' && row.prompt_id.length > 0).toBe(true);
  }
}

describe('route prompt correlation through registered PreToolUse and Stop hooks', () => {
  it('observes Skill synchronously before execution so Stop cannot overtake it', () => {
    const config = JSON.parse(readFileSync(new URL('../../../hooks.json', import.meta.url), 'utf8'));
    const registration = config.hooks.PreToolUse.find((entry: { matcher?: string }) => entry.matcher === 'Skill').hooks.find((hook: { args?: string[] }) => hook.args?.includes('pretool/skill/skill-tracker'));
    expect(registration).toBeDefined();
    expect(registration.async).not.toBe(true);
  });
  it('writes pending then actual Skill comparison and dedupes retries and later executors', async () => {
    await judge('prompt-a');
    await observe('prompt-a', 'ork:implement');
    await observe('prompt-a', 'ork:implement');
    await observe('prompt-a', 'ork:verify');
    const records = rows();
    contract(records);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ phase: 'pending', incumbent_pick: null, incumbent_pick_reason: 'model_route_not_run_at_prompt_submit' });
    expect(records[1]).toMatchObject({ phase: 'paired', jev_pick: 'skill:ork:fix-issue', incumbent_pick: 'skill:ork:implement', agree: false, high_confidence_disagreement: true, tool_use_id: 'tool-prompt-a', incumbent_pick_reason: null });
    expect(records[1].decision_id).toBe(records[0].decision_id);
  });
  it('pairs when the actual executor finishes before the asynchronous Jev request', async () => {
    let finish!: (response: Response) => void;
    const pending = judge('slow-jev', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })) as typeof fetch);
    await observe('slow-jev', 'ork:fix-issue');
    finish(new Response(JSON.stringify(body)));
    const verdict = await pending;
    expect(verdict.incumbent_pick).toBe('skill:ork:fix-issue');
    const records = rows();
    contract(records);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ phase: 'paired', incumbent_pick: 'skill:ork:fix-issue', agree: true, incumbent_pick_reason: null });
  });
  it('never joins a different prompt or session and ignores nested choices and ork:auto', async () => {
    await judge('prompt-a');
    await judge('prompt-b');
    await judge('prompt-a', undefined, 'session-b');
    await observe('prompt-b', 'ork:auto');
    await observe('prompt-b', 'ork:implement', 'session-a', { agent_id: 'nested' });
    await observe('unobserved-prompt', 'ork:implement');
    await observe('prompt-b', 'ork:verify');
    expect(rows().filter(row => row.phase === 'paired')).toEqual([expect.objectContaining({ prompt_id: 'prompt-b', incumbent_pick: 'skill:ork:verify' })]);
    expect(rows('session-b')).toHaveLength(1);
    expect(rows('session-b')[0].incumbent_pick).toBeNull();
  });
  it('preserves the runtime prompt through HQ auto and Ork auto to the final executor', async () => {
    await judge('shared-hq-ork-prompt');
    await observe('shared-hq-ork-prompt', '/hq-ext:auto');
    await observe('shared-hq-ork-prompt', 'ork:auto');
    expect(rows()).toHaveLength(1);
    await observe('shared-hq-ork-prompt', 'ork:fix-issue');
    const records = rows();
    contract(records);
    expect(records).toHaveLength(2);
    for (const row of records) expect(row).toMatchObject({
      session_id: 'session-a', prompt_id: 'shared-hq-ork-prompt', router: 'ork:auto', handoff_to: null,
    });
    expect(records[1]).toMatchObject({ incumbent_pick: 'skill:ork:fix-issue', agree: true, phase: 'paired' });
  });
  it('records actual Agent name and explicit model without guessing an intent', async () => {
    await judge('agent-prompt');
    await observe('agent-prompt', '', 'session-a', { tool_name: 'Agent', tool_input: { subagent_type: 'Explore', model: 'haiku' } });
    const records = rows();
    contract(records);
    expect(records[1]).toMatchObject({ incumbent_pick: 'agent:Explore', incumbent_model: 'haiku', incumbent_intent: null, agree: false });
  });
  it('keeps every canonical field when Jev fails and an actual executor is observed', async () => {
    await judge('failed-jev', vi.fn(async () => new Response('{}', { status: 503 })) as typeof fetch);
    await observe('failed-jev', 'ork:implement');
    const records = rows();
    contract(records);
    expect(records[1]).toMatchObject({ jev_pick: null, jev_confidence: null, incumbent_pick: 'skill:ork:implement', agree: null, phase: 'paired' });
  });
  it('keeps requested first Agent when its gate blocks and a later Skill completes', async () => {
    await judge('blocked-choice');
    const denied = observe('blocked-choice', '', 'session-a', { tool_name: 'Agent', tool_input: { subagent_type: 'Explore', model: 'haiku' } });
    expect(denied.continue).toBe(false);
    await observe('blocked-choice', 'ork:implement');
    await metricsDispatcher(toolInput('blocked-choice', 'ork:implement'));
    stop('blocked-choice');
    expect(rows().filter(row => row.phase === 'paired')).toEqual([expect.objectContaining({ incumbent_pick: 'agent:Explore', incumbent_model: 'haiku' })]);
  });
  it('does not choose an incumbent from out-of-order PostToolUse completions', async () => {
    await judge('order');
    await observe('order', 'ork:fix-issue');
    await observe('order', 'ork:implement');
    await metricsDispatcher(toolInput('order', 'ork:implement'));
    await metricsDispatcher(toolInput('order', 'ork:fix-issue'));
    expect(rows()[1].incumbent_pick).toBe('skill:ork:fix-issue');
    await judge('completion-only');
    await metricsDispatcher(toolInput('completion-only', 'ork:implement'));
    expect(rows().filter(row => row.prompt_id === 'completion-only')).toEqual([expect.objectContaining({ incumbent_pick: null, phase: 'pending' })]);
  });
  it('pairs an inline response at Stop despite the summary low-tool-count early return', async () => {
    await judge('inline');
    stop('other-prompt');
    stop('inline', { agent_id: 'nested' });
    expect(rows()).toHaveLength(1);
    stop('inline');
    stop('inline');
    const records = rows();
    contract(records);
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ incumbent_pick: 'no_executor', incumbent_pick_reason: null, agree: false, phase: 'paired' });
  });
  it('pairs Stop arriving before the asynchronous Jev response', async () => {
    let finish!: (response: Response) => void;
    const pending = judge('inline-first', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })) as typeof fetch);
    stop('inline-first');
    finish(new Response(JSON.stringify(body)));
    await pending;
    expect(rows()).toEqual([expect.objectContaining({ incumbent_pick: 'no_executor', incumbent_pick_reason: null, phase: 'paired' })]);
  });
  it.each(['continuation', 'ambiguous', 'ops_comms'])('compares a no-target %s classification with a completed no-executor response', async (intent) => {
    await judge('no-target', vi.fn(async () => new Response(JSON.stringify({ answers: { intent: { choice: intent, confidence: 0.95, probabilities: { [intent]: 0.95 } } } }))) as typeof fetch);
    stop('no-target');
    expect(rows()[1]).toMatchObject({ intent, jev_pick: 'no_executor', incumbent_pick: 'no_executor', agree: true, high_confidence_disagreement: false, phase: 'paired' });
  });
});
