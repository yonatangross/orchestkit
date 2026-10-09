/**
 * #4297: route executor observation stays at PreToolUse but off the hot path.
 * Every PreToolUse handler that calls observeRouteExecutor must be registered
 * `async: true`, and the sync Agent dispatcher must not do the file I/O.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookInput } from '../../../types.js';
import { routeSessionDir, sha256 } from '../../../lib/route-judgment.js';

const SRC = resolve(__dirname, '..', '..', '..');
const HOOKS_JSON = resolve(SRC, '..', 'hooks.json');

interface Hook { args?: string[]; async?: boolean }
interface Group { matcher?: string; hooks: Hook[] }

function preToolHandlers(): Array<{ matcher: string; path: string; async: boolean }> {
  const config = JSON.parse(readFileSync(HOOKS_JSON, 'utf8')) as { hooks: { PreToolUse: Group[] } };
  return config.hooks.PreToolUse.flatMap(group => group.hooks.map(hook => ({
    matcher: group.matcher ?? '*',
    path: (hook.args ?? []).find(arg => !arg.includes('run-hook')) ?? '',
    async: hook.async === true,
  })));
}

const callsObserver = (hookPath: string): boolean => {
  const file = join(SRC, `${hookPath}.ts`);
  return existsSync(file) && readFileSync(file, 'utf8').includes('observeRouteExecutor(');
};

describe('route executor observation is async PreToolUse telemetry (#4297)', () => {
  it('registers every PreToolUse handler that calls observeRouteExecutor as async', () => {
    const observers = preToolHandlers().filter(h => callsObserver(h.path));
    expect(observers.map(h => h.matcher).sort()).toEqual(['Agent', 'Skill']);
    for (const handler of observers) expect(handler, handler.path).toMatchObject({ async: true });
  });

  it('keeps the sync Agent dispatcher free of route observation file I/O', () => {
    const source = readFileSync(join(SRC, 'pretool/task/sync-task-dispatcher.ts'), 'utf8');
    expect(source).not.toContain('observeRouteExecutor');
  });

  it('wires the Agent route observer in both hooks.json and the entries map', async () => {
    const agent = preToolHandlers().filter(h => h.matcher === 'Agent').map(h => h.path);
    expect(agent).toContain('pretool/task/route-observer');
    const { hooks: entries } = await import('../../../entries/pretool.js');
    expect(entries['pretool/task/route-observer']).toBeTypeOf('function');
  });
});

describe('routeObserver', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = mkdtempSync(join(tmpdir(), 'route-observer-')); vi.stubEnv('CLAUDE_PLUGIN_DATA', ''); });
  afterEach(() => { vi.unstubAllEnvs(); rmSync(projectDir, { recursive: true, force: true }); });

  it('records the requested Agent as executor.json and stays silent', async () => {
    const { routeObserver } = await import('../../../pretool/task/route-observer.js');
    const sessionDir = routeSessionDir('session-a', projectDir);
    const stem = join(sessionDir, `jev-route-${sha256('prompt-a')}`);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(`${stem}.active`, '');
    const input: HookInput = {
      session_id: 'session-a', prompt_id: 'prompt-a', project_dir: projectDir, tool_name: 'Agent',
      tool_input: { subagent_type: 'Explore', model: 'haiku' }, tool_use_id: 'tool-1',
    };
    const result = routeObserver(input);
    expect(result).toEqual({ continue: true, suppressOutput: true });
    expect(JSON.parse(readFileSync(`${stem}.executor.json`, 'utf8'))).toMatchObject({ pick: 'agent:Explore', toolUseId: 'tool-1', model: 'haiku' });
  });
});
