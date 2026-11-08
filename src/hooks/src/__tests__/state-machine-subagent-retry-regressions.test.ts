import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { agentTaskAutoRegister } from '../posttool/task/agent-task-auto-register.js';
import { getTaskByAgent, updateTaskStatus, getTaskById } from '../lib/task-integration.js';
import { retryHandler } from '../subagent-stop/retry-handler.js';
import { loadState } from '../lib/orchestration-state.js';
import { contextGate } from '../subagent-start/context-gate.js';
import { taskProgressInitializer } from '../task-created/task-progress-initializer.js';
import { createTestContext } from './fixtures/test-context.js';

describe('State machine subagent task, retry, and batch progress regressions', () => {
  let tmpDir: string;
  const origProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const origSessionId = process.env.CLAUDE_SESSION_ID;
  const origLogDir = process.env.CLAUDE_HOOK_LOG_DIR;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ork-sm-subagent-test-'));
    process.env.CLAUDE_PROJECT_DIR = tmpDir;
    process.env.CLAUDE_SESSION_ID = 'session-subagent-sm-test';
    process.env.CLAUDE_HOOK_LOG_DIR = join(tmpDir, '.claude', 'logs');
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = origProjectDir;
    if (origSessionId === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = origSessionId;
    if (origLogDir === undefined) delete process.env.CLAUDE_HOOK_LOG_DIR;
    else process.env.CLAUDE_HOOK_LOG_DIR = origLogDir;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getTaskByAgent matches ork: prefixed tasks registered by agentTaskAutoRegister', () => {
    const ctx = createTestContext({ projectDir: tmpDir, sessionId: 'session-subagent-sm-test' });
    agentTaskAutoRegister(
      {
        tool_name: 'Task',
        session_id: 'session-subagent-sm-test',
        tool_input: {
          subagent_type: 'ork:backend-system-architect',
          description: 'Design API layer',
        },
      },
      ctx,
    );

    const task = getTaskByAgent('backend-system-architect');
    expect(task).toBeDefined();
    expect(task?.status).toBe('pending');

    updateTaskStatus(task!.taskId, 'completed');
    expect(getTaskById(task!.taskId)?.status).toBe('completed');
  });

  test('retryHandler persists and increments retryCount when agent was not pre-tracked and resolves ork: alternatives', () => {
    const ctx = createTestContext({ projectDir: tmpDir, sessionId: 'session-subagent-sm-test' });
    const failInput = {
      tool_name: 'Task',
      session_id: 'session-subagent-sm-test',
      tool_input: {
        subagent_type: 'ork:backend-system-architect',
      },
      exit_code: 1,
      error: 'Agent execution failed',
    };

    const res1 = retryHandler(failInput, ctx);
    const ctx1 = res1.hookSpecificOutput?.additionalContext as string;
    expect(ctx1).toContain('Retry Scheduled');
    expect(loadState().activeAgents.find(a => a.agent.endsWith('backend-system-architect'))?.retryCount).toBe(1);

    const res2 = retryHandler(failInput, ctx);
    const ctx2 = res2.hookSpecificOutput?.additionalContext as string;
    expect(ctx2).toContain('Retry Scheduled');
    expect(loadState().activeAgents.find(a => a.agent.endsWith('backend-system-architect'))?.retryCount).toBe(2);

    const res3 = retryHandler(failInput, ctx);
    const ctx3 = res3.hookSpecificOutput?.additionalContext as string;
    expect(ctx3).toContain('Retry Not Recommended');
    expect(ctx3).toContain('database-engineer');
    expect(loadState().activeAgents.find(a => a.agent.endsWith('backend-system-architect'))?.status).toBe('failed');
  });

  test('contextGate warns on expensive agent types with ork: prefix when 2 background agents are active', () => {
    const logDir = join(tmpDir, '.claude', 'logs');
    mkdirSync(logDir, { recursive: true });
    const now = Date.now();
    const spawnLines = `${[
      JSON.stringify({ timestamp: new Date(now - 60_000).toISOString(), subagent_type: 'ork:a' }),
      JSON.stringify({ timestamp: new Date(now - 50_000).toISOString(), subagent_type: 'ork:b' }),
    ].join('\n')}\n`;
    writeFileSync(join(logDir, 'subagent-spawns.jsonl'), spawnLines, 'utf8');

    const ctx = createTestContext({ projectDir: tmpDir, sessionId: 'session-subagent-sm-test' });
    const res = contextGate(
      {
        tool_name: 'Task',
        session_id: 'session-subagent-sm-test',
        tool_input: {
          subagent_type: 'ork:test-generator',
          description: 'Generate unit tests',
        },
      },
      ctx,
    );

    expect(res.continue).toBe(true);
    expect(res.systemMessage).toContain('expensive agent');
  });

  test('taskProgressInitializer resets completed and task_ids when a new [1/N] batch starts after prior batch completed', () => {
    const logDir = join(tmpDir, '.claude', 'logs');
    mkdirSync(logDir, { recursive: true });
    const statePath = join(logDir, 'task-progress-state.json');
    writeFileSync(
      statePath,
      JSON.stringify({
        total: 5,
        completed: 5,
        task_ids: ['t1', 't2', 't3', 't4', 't5'],
        session_id: 'session-subagent-sm-test',
      }),
      'utf8',
    );

    const ctx = createTestContext({ projectDir: tmpDir, sessionId: 'session-subagent-sm-test' });
    taskProgressInitializer(
      {
        hook_event: 'TaskCreated',
        tool_name: 'TaskCreate',
        tool_input: {},
        session_id: 'session-subagent-sm-test',
        task_id: 'batch2-t1',
        task_subject: '[1/3] First step of second batch',
      },
      ctx,
    );

    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    expect(saved).toEqual({
      total: 3,
      completed: 0,
      task_ids: [],
      session_id: 'session-subagent-sm-test',
    });
  });
});
