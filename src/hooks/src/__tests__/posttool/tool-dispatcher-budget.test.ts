/**
 * Codex HOLD 6556943971 on #4962: in flag-on mode the PostToolUse dispatcher
 * awaited every handler in file order, plain async observers included, under
 * one entry timeout, so a slow observer listed before stale-import-detector
 * (rewake) or check-plugins-drift (sync) could use the budget up and CC would
 * kill the process before any guard produced a verdict.
 *
 * Contract: guards (sync and rewake) run first; every handler gets its own
 * hooks.json timeout as a budget, capped by what is left of RUN_BUDGET_MS;
 * RUN_BUDGET_MS stays under the variant's entry timeout; a handler over its
 * budget is abandoned (as CC killed it before), never awaited.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../../types.js';
import { posttoolDispatch, POSTTOOL_GROUPS, RUN_BUDGET_MS } from '../../posttool/tool-dispatcher.js';
import { unifiedToolHooks, POSTTOOL_ENTRY_TIMEOUT_S } from '../../../scripts/unified-pretool-hooks.mjs';
import { createTestContext } from '../fixtures/test-context.js';

const SILENT: HookResult = { continue: true, suppressOutput: true };
const never = () => new Promise<HookResult>(() => {});
const HOOKS_JSON = join(__dirname, '..', '..', '..', 'hooks.json');
const shipped = JSON.parse(readFileSync(HOOKS_JSON, 'utf8'));

function input(tool_name: string): HookInput {
  return { hook_event_name: 'PostToolUse', tool_name, tool_input: {}, tool_response: {}, session_id: 's' } as unknown as HookInput;
}

describe('posttool/tool-dispatcher budgets', () => {
  it('a hung observer listed first does not stop a later guard from blocking', async () => {
    const order: string[] = [];
    const groups = [
      {
        matcher: 'Edit',
        hooks: [
          { id: 'slow-observer', async: true, timeout: 0.05 },
          { id: 'guard', async: false, timeout: 0.05 },
          { id: 'rewake-guard', async: true, rewake: true as const, timeout: 0.05 },
        ],
      },
    ];
    const map = {
      'slow-observer': () => {
        order.push('slow-observer');
        return never();
      },
      guard: () => {
        order.push('guard');
        return { continue: true, decision: 'block', reason: 'sync guard says no' } as HookResult;
      },
      'rewake-guard': () => {
        order.push('rewake-guard');
        return { continue: false, stopReason: 'stale import' } as HookResult;
      },
    };
    const started = Date.now();
    const r = await posttoolDispatch(input('Edit'), createTestContext(), map, groups);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(order).toEqual(['guard', 'rewake-guard', 'slow-observer']);
    expect(r.decision).toBe('block');
    expect(r.reason).toContain('sync guard says no');
    expect(r.reason).toContain('stale import');
  });

  it('a hung guard is abandoned at its own budget and the next guard still decides', async () => {
    const groups = [
      {
        matcher: 'Edit',
        hooks: [
          { id: 'hung-guard', async: false, timeout: 0.05 },
          { id: 'guard', async: false, timeout: 0.05 },
        ],
      },
    ];
    const map = { 'hung-guard': never, guard: () => ({ continue: true, decision: 'block', reason: 'no' }) as HookResult };
    const started = Date.now();
    const r = await posttoolDispatch(input('Edit'), createTestContext(), map, groups);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r.decision).toBe('block');
  });

  it('a handler that never settles is not awaited past the run', async () => {
    const groups = [{ matcher: 'Edit', hooks: [{ id: 'slow-observer', async: true, timeout: 0.05 }] }];
    const r = await posttoolDispatch(input('Edit'), createTestContext(), { 'slow-observer': never }, groups);
    expect(r.continue).toBe(true);
    void SILENT;
  });

  it('every tool: the guards fit in RUN_BUDGET_MS, and RUN_BUDGET_MS fits in the entry timeout', () => {
    const tools = ['Bash', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Agent', 'Skill', 'TaskUpdate', 'Grep', 'WebFetch', 'mcp__x__y'];
    for (const tool of tools) {
      let guards = 0;
      for (const g of POSTTOOL_GROUPS) {
        const re = /^[\w|-]+$/.test(g.matcher) ? null : new RegExp(g.matcher);
        const hit = g.matcher === '*' || (re ? re.test(tool) : g.matcher.split('|').includes(tool));
        if (hit) for (const h of g.hooks) if (!h.async || h.rewake) guards += (h.timeout ?? 15) * 1000;
      }
      expect(guards, tool).toBeLessThanOrEqual(RUN_BUDGET_MS);
    }
    expect(RUN_BUDGET_MS).toBeLessThan(POSTTOOL_ENTRY_TIMEOUT_S * 1000);
    const entry = unifiedToolHooks(shipped).hooks.PostToolUse[0].hooks[0] as { timeout: number };
    expect(entry.timeout).toBe(POSTTOOL_ENTRY_TIMEOUT_S);
  });

  it('run-hook.mjs exits after a dispatcher emits, so an abandoned handler cannot hold the verdict', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', 'bin', 'run-hook.mjs'), 'utf8');
    const m = src.match(/EXIT_AFTER_EMIT = new Set\(\[([^\]]*)\]\)/);
    expect(m?.[1]).toContain("'posttool/tool-dispatcher'");
    expect(m?.[1]).toContain("'pretool/tool-dispatcher'");
  });
});
