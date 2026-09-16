/**
 * Unit tests for the shipped hooks module (hooks/register.ts).
 *
 * Drives the real register(on, options) export with a captured on() and a
 * fake $ facade, then invokes the registered hooks directly.
 */

import { describe, test, expect } from 'vitest';
import { register } from '../hooks/register.js';
import type { FsEntry, FileStat, $ } from '../src/types.js';

type RegisteredHook = (...args: unknown[]) => unknown;

const PATTERNS = [
  {
    id: 'cancelled-check-is-not-pass',
    severity: 'block',
    category: 'ci',
    pattern: 'gh pr checks',
    message: 'Cancelled CI tiers are not pass. Never trust a green rollup on a moved head.',
    example_fix: 'Use gh pr view with --json to check mergeStateStatus.',
  },
];

const FLOOR_ALPHA_LESSONS = '## gh-api-pagination\n\n- gh api --paginate for endpoints that return arrays\n';
const FLOOR_BETA_LESSONS = '## git-safety\n\n- Always verify merge state before trusting green\n';

interface Fake$Options {
  noticeThrows?: boolean;
}

function makeFake$(options: Fake$Options = {}): { $: $; notices: string[]; invalidateCalls: string[] } {
  const notices: string[] = [];
  const invalidateCalls: string[] = [];

  const fake$ = {
    fs: {
      list: async (path: string): Promise<FsEntry[] | null> => {
        if (path.includes('hq-ext')) {
          return [
            { name: '1.62.9', isDirectory: true, isFile: false },
            { name: '1.62.10', isDirectory: true, isFile: false },
            { name: 'loose-file', isDirectory: false, isFile: true },
          ];
        }
        return [
          { name: 'floor-alpha', isDirectory: true, isFile: false },
          { name: 'floor-beta', isDirectory: true, isFile: false },
          { name: 'notes', isDirectory: true, isFile: false },
        ];
      },
      read: async (path: string): Promise<string | Uint8Array> => {
        if (path.includes('lesson-patterns.json')) {
          return JSON.stringify(PATTERNS);
        }
        if (path.includes('floor-alpha')) {
          return FLOOR_ALPHA_LESSONS;
        }
        if (path.includes('floor-beta')) {
          return FLOOR_BETA_LESSONS;
        }
        throw new Error(`unexpected read: ${path}`);
      },
      stat: async (path: string): Promise<FileStat | null> => {
        if (path.includes('floor-alpha')) {
          return { size: 10, mtime: 200, isFile: true, isDirectory: false };
        }
        if (path.includes('floor-beta')) {
          return { size: 10, mtime: 100, isFile: true, isDirectory: false };
        }
        return null;
      },
    },
    ui: {
      notice: async (toolUseId: string, message: string): Promise<void> => {
        if (options.noticeThrows) {
          throw new Error('no permission dialog open');
        }
        notices.push(`${toolUseId}: ${message}`);
      },
      invalidate: async (component: string): Promise<void> => {
        invalidateCalls.push(component);
      },
    },
  } as unknown as $;

  return { $: fake$, notices, invalidateCalls };
}

function captureHooks(): Map<string, RegisteredHook> {
  const hooks = new Map<string, RegisteredHook>();
  register((event: string, hook: unknown) => {
    hooks.set(event, hook as RegisteredHook);
  }, {});
  return hooks;
}

function asNext<E>(result: unknown): (ev: E) => Promise<unknown> {
  return async () => result;
}

describe('registration', () => {
  test('registers the four required hooks', () => {
    const hooks = captureHooks();
    expect([...hooks.keys()].sort()).toEqual(['command.register', 'session.start', 'tool.call', 'ui.render']);
  });
});

describe('session.start', () => {
  test('tool.call passes through before session.start loads the corpus', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' } }, next)) as Record<string, unknown>;
    expect(result).toEqual({});
  });

  test('loads patterns and newest three floor lessons', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    const next = asNext<never>({});
    const matched = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr view && gh pr checks' } }, next)) as { context?: string[] };
    expect(matched.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');

    const bullet = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh api --paginate repos/o/r/issues' } }, next)) as { context?: string[] };
    expect(bullet.context?.[0]).toContain('[lesson:gh-api-pagination]');
  });

  test('clears the match map between sessions', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();

    await hooks.get('session.start')!($);
    const next = asNext<never>({});
    await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' }, tool_use_id: 'seed-1' }, next);

    await hooks.get('session.start')!($);
    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'seed-1' }, asNext<never>({ children: [] }))) as { children: unknown[] };
    expect(tree.children.length).toBe(0);
  });
});

describe('tool.call', () => {
  test('returns context for a matched block pattern', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    const next = asNext<never>({ result: 'ok' });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' } }, next)) as { result?: string; context?: string[] };
    expect(result.result).toBe('ok');
    expect(result.context?.length).toBe(1);
    expect(result.context?.[0]).toContain('lesson:cancelled-check-is-not-pass');
  });

  test('returns the next result unchanged when nothing matches', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    const next = asNext<never>({ result: 'ok' });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'echo hello' } }, next)) as Record<string, unknown>;
    expect(result).toEqual({ result: 'ok' });
  });

  test('notifies the ui when a dialog is open', async () => {
    const hooks = captureHooks();
    const { $, notices } = makeFake$();
    await hooks.get('session.start')!($);

    await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' }, tool_use_id: 'tu-9' }, asNext<never>({}));
    expect(notices).toEqual(['tu-9: lesson: cancelled-check-is-not-pass']);
  });

  test('survives a refused ui.notice', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ noticeThrows: true });
    await hooks.get('session.start')!($);

    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' } }, next)) as { context?: string[] };
    expect(result.context?.length).toBe(1);
  });

  test('matches Write content against patterns via file_path', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    // No file_glob or check_patterns on the ci pattern, so Write does not match
    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Write', args: { file_path: 'notes.md', content: 'gh pr checks' } }, next)) as Record<string, unknown>;
    expect(result).toEqual({});
  });
});

describe('ui.render', () => {
  test('appends a lesson card for a matched requestId', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' }, tool_use_id: 'tu-1' }, asNext<never>({}));

    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-1' }, asNext<never>({ children: [] }))) as { children: Array<{ type: string; props: Record<string, unknown> }> };
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].type).toBe('Box');
    expect(tree.children[0].props.key).toBe('lesson-tu-1');
  });

  test('passes through non-ToolUse components', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    const passthrough = { children: ['keep'] };
    const tree = await hooks.get('ui.render')!($, { component: 'Tool' }, asNext<never>(passthrough));
    expect(tree).toBe(passthrough);
  });

  test('returns the tree unchanged for an unknown requestId', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    await hooks.get('session.start')!($);

    const passthrough = { children: [] };
    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-unknown' }, asNext<never>(passthrough))) as { children: unknown[] };
    expect(tree.children.length).toBe(0);
  });
});

describe('command.register', () => {
  test('/lessons reloads the corpus and invalidates ui.render', async () => {
    const hooks = captureHooks();
    const { $, invalidateCalls } = makeFake$();
    await hooks.get('session.start')!($);

    const result = (await hooks.get('command.register')!($, { command: '/lessons' })) as { message?: string };
    expect(result.message).toBe('Lessons reloaded');
    expect(invalidateCalls).toEqual(['ui.render']);

    // Corpus still works after the reload
    const next = asNext<never>({});
    const matched = (await hooks.get('tool.call')!($, { tool: 'Bash', args: { command: 'gh pr checks' } }, next)) as { context?: string[] };
    expect(matched.context?.length).toBe(1);
  });

  test('unknown commands return an empty object', async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$();
    const result = await hooks.get('command.register')!($, { command: '/something-else' });
    expect(result).toEqual({});
  });
});
