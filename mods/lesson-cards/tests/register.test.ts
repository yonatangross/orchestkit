/**
 * Unit tests for the shipped hooks module (hooks/register.ts).
 *
 * Drives the real register(on, options) export with a captured on() and a
 * fake $ facade shaped like the CC 2.1.282 mods API, then invokes the
 * registered hooks directly.
 */

import { describe, test, expect } from 'vitest';
import { register } from '../hooks/register.js';

type RegisteredHook = (...args: unknown[]) => unknown;

/** FsEntry / FsStat as the 2.1.282 mods API sends them (kind, mtimeMs). */
type FakeFsEntry = { name: string; kind: 'file' | 'dir' | 'other' };
type FakeFsStat = { size: number; mtimeMs: number; kind: 'file' | 'dir' | 'other' };

/**
 * A mod has no process.env, so HOME must come from $.env. The fake fs only
 * answers under this path; a module that fell back to process.env.HOME would
 * load an empty corpus and every match assertion below would fail.
 */
const FAKE_HOME = '/home/lesson-tester';

const PATTERNS = [
  {
    id: 'cancelled-check-is-not-pass',
    severity: 'block',
    category: 'ci',
    pattern: 'gh pr checks',
    message: 'Cancelled CI tiers are not pass. Never trust a green rollup on a moved head.',
    example_fix: 'Use gh pr view with --json to check mergeStateStatus.',
  },
  {
    id: 'no-pytest-main',
    severity: 'warn',
    category: 'test',
    file_glob: '**/*.py',
    check_patterns: ['pytest\\.main'],
    tool_names: ['Edit', 'Write'],
    message: 'Run tests with uv run pytest, not pytest.main.',
  },
];

const FLOOR_ALPHA_LESSONS = '## gh-api-pagination\n\n- gh api --paginate for endpoints that return arrays\n';
const FLOOR_BETA_LESSONS = '## git-safety\n\n- Always verify merge state before trusting green\n';

/** 2 patterns + 1 bullet per floor lessons.md. */
const CORPUS_ENTRIES = PATTERNS.length + 2;

interface Fake$Options {
  noticeThrows?: boolean;
  /** When set, $.ui.ask exists and answers with this label; unset = no dialog (headless). */
  askAnswer?: string;
}

/** askAnswer sentinel: the dialog throws, the way Escape does on CC 2.1.282. */
const ESCAPE = '<escape>';

/** A node built by a fake element constructor: the name as type, props spread. */
type FakeNode = { type: string; key?: string; children?: unknown; [prop: string]: unknown };

/** Stand-in for $.ui.resolve(e): each name is a constructor, like the real table. */
const fakeElements = {
  Box: (props: Record<string, unknown> = {}): FakeNode => ({ type: 'Box', ...props }),
  Text: (props: Record<string, unknown> = {}): FakeNode => ({ type: 'Text', ...props }),
};

interface Fake$Record {
  $: unknown;
  notices: string[];
  invalidateCalls: string[];
  envGets: string[];
  registeredCommands: Array<{ name: string; description: string }>;
  asks: Array<{ question: string; options: readonly string[] }>;
}

function makeFake$(options: Fake$Options = {}): Fake$Record {
  const notices: string[] = [];
  const invalidateCalls: string[] = [];
  const envGets: string[] = [];
  const registeredCommands: Array<{ name: string; description: string }> = [];
  const asks: Array<{ question: string; options: readonly string[] }> = [];

  const ask = async (question: string, opts: readonly string[]): Promise<string> => {
    asks.push({ question, options: opts });
    if (options.askAnswer === ESCAPE) {
      throw new Error('$.ui.ask: no answer (the dialog was dismissed)');
    }
    return options.askAnswer as string;
  };

  const fake$ = {
    env: {
      get: async (name: string): Promise<string | undefined> => {
        envGets.push(name);
        return name === 'HOME' ? FAKE_HOME : undefined;
      },
    },
    fs: {
      list: async (path: string): Promise<FakeFsEntry[] | null> => {
        if (!path.startsWith(`${FAKE_HOME}/`)) {
          return null;
        }
        if (path.includes('hq-ext')) {
          return [
            { name: '1.62.9', kind: 'dir' },
            { name: '1.62.10', kind: 'dir' },
            { name: 'loose-file', kind: 'file' },
          ];
        }
        return [
          { name: 'floor-alpha', kind: 'dir' },
          { name: 'floor-beta', kind: 'dir' },
          { name: 'floor-file', kind: 'file' },
          { name: 'notes', kind: 'dir' },
        ];
      },
      read: async (path: string): Promise<string> => {
        if (!path.startsWith(`${FAKE_HOME}/`)) {
          throw new Error(`read outside HOME: ${path}`);
        }
        if (path.includes('1.62.10/configs/lesson-patterns.json')) {
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
      stat: async (path: string): Promise<FakeFsStat | null> => {
        if (!path.startsWith(`${FAKE_HOME}/`)) {
          return null;
        }
        if (path.includes('floor-alpha')) {
          return { size: 10, mtimeMs: 200, kind: 'file' };
        }
        if (path.includes('floor-beta')) {
          return { size: 10, mtimeMs: 100, kind: 'file' };
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
      resolve: async (): Promise<typeof fakeElements> => fakeElements,
      ...(options.askAnswer === undefined ? {} : { ask }),
    },
    command: {
      register: async (spec: { name: string; description: string }): Promise<void> => {
        registeredCommands.push(spec);
      },
    },
  };

  return { $: fake$, notices, invalidateCalls, envGets, registeredCommands, asks };
}

interface CapturedHooks {
  hooks: Map<string, RegisteredHook>;
  matchers: Map<string, unknown>;
}

/** Captures both on(event, hook) and on(event, matcher, hook) registrations. */
function captureHooks(): CapturedHooks {
  const hooks = new Map<string, RegisteredHook>();
  const matchers = new Map<string, unknown>();
  register((event: string, matcherOrHook: unknown, hook?: unknown) => {
    if (hook === undefined) {
      hooks.set(event, matcherOrHook as RegisteredHook);
    } else {
      matchers.set(event, matcherOrHook);
      hooks.set(event, hook as RegisteredHook);
    }
  }, {});
  return { hooks, matchers };
}

function asNext<E>(result: unknown): (ev: E) => Promise<unknown> {
  return async () => result;
}

const SESSION_EVENT = { cwd: '/repo', isInteractive: true };

/** session.start must hand the event on: CC 2.1.282 skips a hook that returns nothing. */
async function startSession(hooks: Map<string, RegisteredHook>, $: unknown): Promise<unknown> {
  return hooks.get('session.start')!($, SESSION_EVENT, async (ev: unknown) => ({ forwarded: ev }));
}

describe('registration', () => {
  test('registers the four required hooks', () => {
    const { hooks } = captureHooks();
    expect([...hooks.keys()].sort()).toEqual(['command.run', 'session.start', 'tool.call', 'ui.render']);
  });

  test('scopes command.run to the lessons command', () => {
    const { matchers } = captureHooks();
    expect(matchers.get('command.run')).toEqual({ command: 'lessons' });
    expect(matchers.get('ui.render')).toEqual({ component: 'ToolUse' });
    expect([...matchers.keys()].sort()).toEqual(['command.run', 'ui.render']);
  });
});

describe('session.start', () => {
  // corpus is module state: this must run before any test starts a session
  test('tool.call passes through before session.start loads the corpus', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as Record<string, unknown>;
    expect(result).toEqual({});
  });

  test('returns next(e) so the hook is not skipped', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    const result = await startSession(hooks, $);
    expect(result).toEqual({ forwarded: SESSION_EVENT });
  });

  test('declares /lessons with $.command.register', async () => {
    const { hooks } = captureHooks();
    const { $, registeredCommands } = makeFake$();
    await startSession(hooks, $);
    expect(registeredCommands).toEqual([{ name: 'lessons', description: 'Reload the lesson cards corpus' }]);
  });

  test('reads HOME from $.env', async () => {
    const { hooks } = captureHooks();
    const { $, envGets } = makeFake$();
    await startSession(hooks, $);
    expect(envGets).toContain('HOME');
  });

  test('loads patterns and newest three floor lessons', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({});
    const matched = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr view && gh pr checks' }, next)) as { context?: string[] };
    expect(matched.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');

    const bullet = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh api --paginate repos/o/r/issues' }, next)) as { context?: string[] };
    expect(bullet.context?.[0]).toContain('[lesson:gh-api-pagination]');
  });

  test('clears the match map between sessions', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();

    await startSession(hooks, $);
    const next = asNext<never>({});
    await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'seed-1' }, next);

    await startSession(hooks, $);
    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'seed-1' }, asNext<never>({ children: [] }))) as { children: unknown[] };
    expect(tree.children.length).toBe(0);
  });
});

describe('tool.call', () => {
  test('returns context for a matched block pattern', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({ result: 'ok' });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { result?: string; context?: string[] };
    expect(result.result).toBe('ok');
    expect(result.context?.length).toBe(1);
    expect(result.context?.[0]).toContain('lesson:cancelled-check-is-not-pass');
  });

  test('returns the next result unchanged when nothing matches', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    const next = asNext<never>({ result: 'ok' });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'echo hello' }, next)) as Record<string, unknown>;
    expect(result).toEqual({ result: 'ok' });
  });

  test('notifies the ui when a dialog is open', async () => {
    const { hooks } = captureHooks();
    const { $, notices } = makeFake$();
    await startSession(hooks, $);

    await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'tu-9' }, asNext<never>({}));
    expect(notices).toEqual(['tu-9: lesson: cancelled-check-is-not-pass']);
  });

  test('survives a refused ui.notice', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ noticeThrows: true, askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { context?: string[] };
    expect(result.context?.length).toBe(1);
  });

  test('matches Write content against patterns via file_path', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    // No file_glob or check_patterns on the ci pattern, and notes.md is outside the py glob, so Write does not match
    const next = asNext<never>({});
    const result = (await hooks.get('tool.call')!($, { tool: 'Write', file_path: 'notes.md', content: 'gh pr checks' }, next)) as Record<string, unknown>;
    expect(result).toEqual({});
  });

  test('matches Edit new_string against check_patterns', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    const next = asNext<never>({});
    const matched = (await hooks.get('tool.call')!($, { tool: 'Edit', file_path: 'tests/run.py', old_string: 'pass', new_string: 'pytest.main()' }, next)) as { context?: string[] };
    expect(matched.context?.[0]).toContain('[lesson:no-pytest-main]');

    const clean = (await hooks.get('tool.call')!($, { tool: 'Edit', file_path: 'tests/run.py', old_string: 'pytest.main()', new_string: 'pass' }, next)) as Record<string, unknown>;
    expect(clean).toEqual({});
  });

  test('feeds matching tool.call and asserts card and lesson notice independently', async () => {
    const { hooks } = captureHooks();
    const { $, notices } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const toolUseId = 'call_1';
    const next = asNext<never>({ result: 'ok' });
    const callResult = (await hooks.get('tool.call')!(
      $,
      { tool: 'Bash', command: 'gh pr checks', tool_use_id: toolUseId },
      next
    )) as { result?: string; context?: string[] };

    expect(callResult.result).toBe('ok');
    expect(callResult.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');
    expect(notices).toContain(`${toolUseId}: lesson: cancelled-check-is-not-pass`);

    const downstream = { type: 'engine', ref: 7 };
    const renderTree = (await hooks.get('ui.render')!(
      $,
      { component: 'ToolUse', requestId: toolUseId },
      asNext<never>(downstream)
    )) as FakeNode & { children: FakeNode[] };

    // Wrapped, never mutated: the engine node stays first and untouched.
    expect(renderTree.type).toBe('Box');
    expect(renderTree.children).toHaveLength(2);
    expect(renderTree.children[0]).toBe(downstream);
    expect(downstream).toEqual({ type: 'engine', ref: 7 });
    const card = renderTree.children[1];
    expect(card.type).toBe('Box');
    expect(card.key).toBe(`lesson-${toolUseId}`);
    expect(card.borderColor).toBe('red');
    expect(JSON.stringify(card)).toContain('lesson: cancelled-check-is-not-pass');
  });
});

describe('ui.render', () => {
  test('appends a lesson card for a matched requestId', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'tu-1' }, asNext<never>({}));

    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-1' }, asNext<never>(null))) as FakeNode & { children: FakeNode[] };
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].type).toBe('Box');
    expect(tree.children[0].key).toBe('lesson-tu-1');
  });

  test('passes through non-ToolUse components', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    const passthrough = { children: ['keep'] };
    const tree = await hooks.get('ui.render')!($, { component: 'Tool' }, asNext<never>(passthrough));
    expect(tree).toBe(passthrough);
  });

  test('returns the tree unchanged for an unknown requestId', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$();
    await startSession(hooks, $);

    const passthrough = { children: [] };
    const tree = (await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-unknown' }, asNext<never>(passthrough))) as { children: unknown[] };
    expect(tree.children.length).toBe(0);
  });
});

describe('block lessons ask before the call runs', () => {
  test('Cancel denies the call without running the tool', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel' });
    await startSession(hooks, $);

    let ran = false;
    const next = async (): Promise<unknown> => {
      ran = true;
      return { result: 'ran' };
    };
    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'tu-c' }, next)) as { deny?: string; result?: string };

    expect(ran).toBe(false);
    expect(asks).toHaveLength(1);
    expect(asks[0].question).toContain('cancelled-check-is-not-pass');
    expect(asks[0].options).toEqual(['Proceed anyway', 'Cancel']);
    expect(out.result).toBeUndefined();
    expect(out.deny).toContain('chose Cancel');
    expect(out.deny).toContain('[lesson:cancelled-check-is-not-pass]');
  });

  test('Proceed anyway runs the tool and keeps the context', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ran' }))) as { result?: string; context?: string[] };
    expect(asks).toHaveLength(1);
    expect(out.result).toBe('ran');
    expect(out.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');
  });

  test('a warn lesson never asks', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel' });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Edit', file_path: 'tests/run.py', new_string: 'pytest.main()' }, asNext<never>({ result: 'ran' }))) as { result?: string };
    expect(asks).toHaveLength(0);
    expect(out.result).toBe('ran');
  });
});

describe('a block lesson fails closed: only an explicit Proceed anyway runs it', () => {
  const cases: Array<[string, string | undefined]> = [
    ['Escape (the dialog throws)', ESCAPE],
    ['a typed free-text answer', 'sure, go ahead'],
    ['no dialog at all (headless)', undefined],
  ];
  for (const [label, answer] of cases) {
    test(`${label} denies without running the tool`, async () => {
      const { hooks } = captureHooks();
      const { $ } = makeFake$(answer === undefined ? {} : { askAnswer: answer });
      await startSession(hooks, $);

      let ran = false;
      const next = async (): Promise<unknown> => {
        ran = true;
        return { result: 'ran' };
      };
      const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { deny?: string; result?: string };
      expect(ran).toBe(false);
      expect(out.result).toBeUndefined();
      expect(out.deny).toContain('no explicit "Proceed anyway"');
      expect(out.deny).toContain('[lesson:cancelled-check-is-not-pass]');
    });
  }
});

describe('the deny is one short line, not a red wall', () => {
  test('one line, at most 240 characters, id and first sentence only, no fix block', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Cancel' });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ran' }))) as { deny?: string };
    const deny = out.deny ?? '';
    expect(deny).not.toContain('\n');
    expect(deny.length).toBeLessThanOrEqual(240);
    expect(deny).toContain('[lesson:cancelled-check-is-not-pass]');
    expect(deny).toContain('Cancelled CI tiers are not pass.');
    expect(deny).not.toContain('Never trust a green rollup');
    expect(deny).not.toContain('Fix:');
  });
});

describe('command.run', () => {
  test('/lessons reloads the corpus and invalidates ui.render', async () => {
    const { hooks } = captureHooks();
    const { $, invalidateCalls } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const result = (await hooks.get('command.run')!($, { command: 'lessons' })) as { text?: string };
    expect(result.text).toBe(`Lessons reloaded (${CORPUS_ENTRIES} entries)`);
    expect(invalidateCalls).toEqual(['ui.render']);

    // Corpus still works after the reload
    const next = asNext<never>({});
    const matched = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { context?: string[] };
    expect(matched.context?.length).toBe(1);
  });
});
