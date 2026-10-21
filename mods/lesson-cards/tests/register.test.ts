/**
 * Unit tests for the shipped hooks module (hooks/register.ts).
 *
 * Drives the real register(on, options) export with a captured on() and a
 * fake $ facade shaped like the CC 2.1.282 mods API, then invokes the
 * registered hooks directly.
 */

import { describe, test, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { register } from '../hooks/register.js';

type RegisteredHook = (...args: unknown[]) => unknown;

/** FsEntry / FsStat as the 2.1.282 mods API sends them (kind, mtimeMs). */
type FakeFsEntry = { name: string; kind: 'file' | 'dir' | 'other' };
type FakeFsStat = { size: number; mtimeMs: number; kind: 'file' | 'dir' | 'other'; realPath?: string };

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
    tool_names: ['Bash'], // as the live entry: a Bash-only rule must not reach a file write
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
  /** When set, $.env.get answers from this map instead of the default HOME only. */
  env?: Record<string, string>;
  /** $.settings.read answers: by source, and `merged` for a read with no source. */
  settings?: Partial<Record<'user' | 'project' | 'local' | 'merged', Record<string, unknown>>>;
  /** $.settings.read throws. */
  settingsThrows?: boolean;
  /**
   * $.fs.stat(path, { resolve: true }) answers from the real filesystem (realpath), the way the
   * engine does. Unset: it answers the path itself, so the lexical tests keep their meaning.
   */
  realFs?: boolean;
}

/** askAnswer sentinel: the dialog throws, the way Escape does on CC 2.1.283 (captured live). */
const ESCAPE = '<escape>';

/** askAnswer sentinel: the Escape throw when the dialog returns no text (CC's fallback). */
const ESCAPE_NO_TEXT = '<escape-no-text>';

/** askAnswer sentinel: the dialog throws for a reason other than Escape. */
const REFUSED = '<refused>';

/** askAnswer sentinel: a host deny, which also throws "no answer (...)". */
const HOST_DENY = '<host-deny>';

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
  statuses: Array<string | undefined>;
  settingsReads: Array<string | undefined>;
}

function makeFake$(options: Fake$Options = {}): Fake$Record {
  const notices: string[] = [];
  const invalidateCalls: string[] = [];
  const envGets: string[] = [];
  const registeredCommands: Array<{ name: string; description: string }> = [];
  const asks: Array<{ question: string; options: readonly string[] }> = [];
  const statuses: Array<string | undefined> = [];
  const settingsReads: Array<string | undefined> = [];

  const ask = async (question: string, opts: readonly string[]): Promise<string> => {
    asks.push({ question, options: opts });
    if (options.askAnswer === ESCAPE) {
      throw new Error(
        "lesson-cards: $.ui.ask: no answer (The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.)",
      );
    }
    if (options.askAnswer === ESCAPE_NO_TEXT) {
      throw new Error('$.ui.ask: no answer (the dialog was dismissed)');
    }
    if (options.askAnswer === REFUSED) {
      throw new Error('$.ui.ask: no answer (a hook refused the dialog)');
    }
    if (options.askAnswer === HOST_DENY) {
      throw new Error('lesson-cards: $.ui.ask: no answer (no surface)');
    }
    return options.askAnswer as string;
  };

  const fake$ = {
    settings: {
      read: async (args?: { source?: 'user' | 'project' | 'local' }): Promise<Record<string, unknown>> => {
        settingsReads.push(args?.source);
        if (options.settingsThrows) throw new Error('settings unavailable');
        return options.settings?.[args?.source ?? 'merged'] ?? {};
      },
    },
    env: {
      get: async (name: string): Promise<string | undefined> => {
        envGets.push(name);
        if (options.env) return options.env[name];
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
      stat: async (path: string, opts?: { resolve?: boolean }): Promise<FakeFsStat | null> => {
        if (opts?.resolve) {
          // Engine shape (CC 2.1.304 fs.stat): realPath only when resolve is asked; a failure throws.
          if (options.realFs) return { size: 0, mtimeMs: 0, kind: 'dir', realPath: realpathSync(path) };
          return { size: 0, mtimeMs: 0, kind: 'dir', realPath: path };
        }
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
      status: async (text?: string): Promise<void> => {
        statuses.push(text);
      },
      ...(options.askAnswer === undefined ? {} : { ask }),
    },
    command: {
      register: async (spec: { name: string; description: string }): Promise<void> => {
        registeredCommands.push(spec);
      },
    },
  };

  return { $: fake$, notices, invalidateCalls, envGets, registeredCommands, asks, statuses, settingsReads };
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

  // CC reads a tool.call answer whose context lacks an entry a hook below
  // attached as the wrong shape and skips the hook (seen live 2026-10-12 with
  // memory-lens enabled beside lesson-cards): a hook adds to the context its
  // next() returned, it never replaces it.
  test('keeps the context a hook below attached and adds its own after it', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({ result: 'ok', context: ['memory-lens: related memory'] });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { result?: string; context?: string[] };
    expect(result.result).toBe('ok');
    expect(result.context?.length).toBe(2);
    expect(result.context?.[0]).toBe('memory-lens: related memory');
    expect(result.context?.[1]).toContain('lesson:cancelled-check-is-not-pass');
  });

  test('keeps only non-empty string entries from the context below', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({ result: 'ok', context: ['ok', '', 42] });
    const result = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { context?: unknown[] };
    expect(result.context?.length).toBe(2);
    expect(result.context?.[0]).toBe('ok');
    expect(String(result.context?.[1])).toContain('lesson:cancelled-check-is-not-pass');
  });

  test('adds its card once when the context below already holds it', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const call = (prior: string[]) =>
      hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ok', context: prior })) as Promise<{ context?: string[] }>;
    const own = (await call([])).context?.[0] as string;
    expect(own).toContain('lesson:cancelled-check-is-not-pass');

    expect((await call([own])).context).toEqual([own]);
    expect((await call(['memory', own])).context).toEqual(['memory', own]);
    expect((await call(['memory'])).context).toEqual(['memory', own]);
  });

  test('keeps every prior context entry for an Edit match too', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Proceed anyway' });
    await startSession(hooks, $);

    const next = asNext<never>({ result: 'ran', context: ['a', 'b'] });
    const result = (await hooks.get('tool.call')!($, { tool: 'Edit', file_path: 'tests/run.py', old_string: 'pass', new_string: 'pytest.main()' }, next)) as { context?: string[] };
    expect(result.context?.slice(0, 2)).toEqual(['a', 'b']);
    expect(result.context?.length).toBe(3);
    expect(result.context?.[2]).toContain('[lesson:no-pytest-main]');
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
    expect(out.deny).toContain('Cancelled: by you; not run.');
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
  const cases: Array<[string, string | undefined, boolean | undefined, string]> = [
    ['Escape (the live 2.1.283 rejection throw)', ESCAPE, true, 'Cancelled: by you; not run.'],
    ['Escape with no dialog text (the dismiss fallback)', ESCAPE_NO_TEXT, true, 'Cancelled: by you; not run.'],
    ['a throw that is not the dismiss', REFUSED, true, 'Not run: no dialog to confirm.'],
    ['a host deny ("no answer" without a rejection text)', HOST_DENY, true, 'Not run: no dialog to confirm.'],
    ['a typed free-text answer', 'sure, go ahead', true, 'Not run: no "Proceed anyway".'],
    ['a lowercase "proceed anyway"', 'proceed anyway', true, 'Not run: no "Proceed anyway".'],
    ['an uppercase "PROCEED ANYWAY"', 'PROCEED ANYWAY', true, 'Not run: no "Proceed anyway".'],
    ['a cut short "Proceed"', 'Proceed', true, 'Not run: no "Proceed anyway".'],
    ['a trailing space "Proceed anyway "', 'Proceed anyway ', true, 'Not run: no "Proceed anyway".'],
    ['a padded " Proceed anyway "', ' Proceed anyway ', true, 'Not run: no "Proceed anyway".'],
    ['both labels "Proceed anyway, Cancel"', 'Proceed anyway, Cancel', true, 'Not run: no "Proceed anyway".'],
    ['a missing $.ui.ask (the call throws, the try/catch denies)', undefined, true, 'Not run: no dialog to confirm.'],
    ['a headless session (isInteractive false)', 'Proceed anyway', false, 'Not run: no dialog to confirm.'],
    ['a session.start without isInteractive', 'Proceed anyway', undefined, 'Not run: no dialog to confirm.'],
  ];
  for (const [label, answer, isInteractive, why] of cases) {
    test(`${label} denies without running the tool`, async () => {
      const { hooks } = captureHooks();
      const { $, asks } = makeFake$(answer === undefined ? {} : { askAnswer: answer });
      const event = isInteractive === undefined ? { cwd: '/repo' } : { ...SESSION_EVENT, isInteractive };
      await hooks.get('session.start')!($, event, async (ev: unknown) => ev);

      let ran = false;
      const next = async (): Promise<unknown> => {
        ran = true;
        return { result: 'ran' };
      };
      const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { deny?: string; result?: string };
      expect(ran).toBe(false);
      expect(out.result).toBeUndefined();
      const cancel = why === 'Cancelled: by you; not run.';
      expect(out.deny?.startsWith(`${why} [lesson:cancelled-check-is-not-pass]`)).toBe(true);
      expect(out.deny).not.toMatch(/error/i);
      if (cancel) {
        expect(out.deny).not.toContain('Fix:');
        expect(out.deny).not.toMatch(/^Cancelled: Cancelled/);
        expect(out.deny?.startsWith('Cancelled: ')).toBe(true);
      }
      if (isInteractive !== true) expect(asks).toHaveLength(0);
    });
  }
});

describe('card-only lanes: trust comes from user settings, never from a project', () => {
  const DESKS = '/home/lesson-tester/.floor/desks';
  const LANE = `${DESKS}/mods-1`;
  const userDirs = (dirs: string) => ({ user: { env: { ORK_LESSON_CARDS_CARD_ONLY_DIRS: dirs } } });

  async function startAt(hooks: Map<string, RegisteredHook>, $: unknown, cwd: string, isInteractive = true): Promise<void> {
    await hooks.get('session.start')!($, { cwd, isInteractive }, async (ev: unknown) => ev);
  }
  async function call(hooks: Map<string, RegisteredHook>, $: unknown): Promise<{ ran: boolean; out: { deny?: string; result?: string; context?: string[] } }> {
    let ran = false;
    const next = async (): Promise<unknown> => {
      ran = true;
      return { result: 'ran' };
    };
    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'tu-card' }, next)) as { deny?: string; result?: string; context?: string[] };
    return { ran, out };
  }

  test('a lane under a user-listed folder gets the card and the call runs, with no dialog', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs(DESKS) });
    await startAt(hooks, $, LANE);
    const { ran, out } = await call(hooks, $);
    const tree = await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-card' }, asNext<never>(null));
    expect(asks).toHaveLength(0);
    expect(ran).toBe(true);
    expect(out.deny).toBeUndefined();
    expect(out.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');
    expect(JSON.stringify(tree)).toContain('cancelled-check-is-not-pass');
  });

  test('a project cannot turn it on: project settings, merged settings and env are not trusted', async () => {
    const { hooks } = captureHooks();
    const projectEnv = { env: { ORK_LESSON_CARDS_CARD_ONLY_DIRS: LANE, ORK_LESSON_CARDS_MODE: 'card-only' } };
    const { $, asks } = makeFake$({
      askAnswer: 'Cancel',
      settings: { project: projectEnv, local: projectEnv, merged: projectEnv },
      env: { HOME: FAKE_HOME, ORK_LESSON_CARDS_MODE: 'card-only', ORK_LESSON_CARDS_CARD_ONLY_DIRS: LANE },
    });
    await startAt(hooks, $, LANE);
    const { ran, out } = await call(hooks, $);
    expect(asks).toHaveLength(1);
    expect(ran).toBe(false);
    expect(out.deny).toContain('Cancelled: by you; not run.');
  });

  test('reads the user source only', async () => {
    const { hooks } = captureHooks();
    const { $, settingsReads } = makeFake$({ settings: userDirs(DESKS) });
    await startAt(hooks, $, LANE);
    expect(settingsReads).toEqual(['user']);
  });

  test('a sibling folder with the same prefix is not under the listed folder', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs(DESKS) });
    await startAt(hooks, $, `${DESKS}-other/lane`);
    await call(hooks, $);
    expect(asks).toHaveLength(1);
  });

  test('the listed folder itself, and any one of several ;-separated folders, match', async () => {
    for (const [dirs, cwd] of [[LANE, LANE], [`/elsewhere; ${DESKS}/`, LANE]] as const) {
      const { hooks } = captureHooks();
      const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs(dirs) });
      await startAt(hooks, $, cwd);
      const { ran } = await call(hooks, $);
      expect(asks).toHaveLength(0);
      expect(ran).toBe(true);
    }
  });

  test('on POSIX a backslash is part of a folder name, not a separator', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs('/safe/desks') });
    await startAt(hooks, $, '/safe/desks\\evil');
    const { ran } = await call(hooks, $);
    expect(asks).toHaveLength(1);
    expect(ran).toBe(false);
  });

  test('Windows paths still match inside a listed folder, and not beside it', async () => {
    for (const [cwd, inside] of [
      ['C:\\Users\\you\\desks\\lane', true],
      ['C:\\Users\\you\\desks', true],
      ['C:\\Users\\you\\desks-other\\lane', false],
    ] as const) {
      const { hooks } = captureHooks();
      const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs('C:\\Users\\you\\desks\\') });
      await startAt(hooks, $, cwd);
      await call(hooks, $);
      expect(asks).toHaveLength(inside ? 0 : 1);
    }
  });

  test('a headless session in a listed lane keeps the fail-closed deny', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Proceed anyway', settings: userDirs(DESKS) });
    await startAt(hooks, $, LANE, false);
    const { ran, out } = await call(hooks, $);
    expect(ran).toBe(false);
    expect(asks).toHaveLength(0);
    expect(out.deny?.startsWith('Not run: no dialog to confirm. [lesson:cancelled-check-is-not-pass]')).toBe(true);
  });

  test('a settings read that fails keeps the dialog', async () => {
    const { hooks } = captureHooks();
    const { $, asks } = makeFake$({ askAnswer: 'Cancel', settingsThrows: true });
    await startAt(hooks, $, LANE);
    await call(hooks, $);
    expect(asks).toHaveLength(1);
  });

  describe('containment is decided on canonical filesystem paths (Codex XREVIEW HOLD 6288423031)', () => {
    // Real folders and symlinks in a temp dir; realpath also folds macOS /tmp into /private/tmp.
    function tree(): { root: string; desks: string; outside: string } {
      const root = mkdtempSync(join(tmpdir(), 'lesson-cards-lane-'));
      const desks = join(root, 'desks');
      const outside = join(root, 'outside');
      mkdirSync(join(desks, 'lane'), { recursive: true });
      mkdirSync(join(outside, 'lane'), { recursive: true });
      return { root, desks, outside };
    }
    async function asksAt(dirs: string, cwd: string): Promise<number> {
      const { hooks } = captureHooks();
      const { $, asks } = makeFake$({ askAnswer: 'Cancel', settings: userDirs(dirs), realFs: true });
      await startAt(hooks, $, cwd);
      await call(hooks, $);
      return asks.length;
    }

    test('a symlinked folder component that leads outside the listed folder keeps the dialog', async () => {
      const { desks, outside } = tree();
      symlinkSync(outside, join(desks, 'escape'));
      // Lexically under desks, really under outside.
      expect(await asksAt(desks, join(desks, 'escape', 'lane'))).toBe(1);
    });

    test('a lane reached through a symlink that leads into the listed folder is card-only', async () => {
      const { root, desks } = tree();
      symlinkSync(desks, join(root, 'alias'));
      expect(await asksAt(desks, join(root, 'alias', 'lane'))).toBe(0);
    });

    test('a listed folder given through a symlink still contains the real lane', async () => {
      const { root, desks } = tree();
      symlinkSync(desks, join(root, 'desks-link'));
      expect(await asksAt(join(root, 'desks-link'), join(desks, 'lane'))).toBe(0);
    });

    test('a real lane inside the real listed folder is card-only', async () => {
      const { desks } = tree();
      expect(await asksAt(desks, join(desks, 'lane'))).toBe(0);
    });

    test('a session folder that cannot be resolved keeps the dialog', async () => {
      const { desks } = tree();
      expect(await asksAt(desks, join(desks, 'gone', 'lane'))).toBe(1);
    });

    test('a listed folder that cannot be resolved does not count', async () => {
      const { root, desks } = tree();
      expect(await asksAt(join(root, 'missing'), join(desks, 'lane'))).toBe(1);
      // A second, resolvable folder in the same list still counts.
      expect(await asksAt(`${join(root, 'missing')};${desks}`, join(desks, 'lane'))).toBe(0);
    });
  });

  test('shows a status line in a card-only lane, and none otherwise', async () => {
    const on = captureHooks();
    const lane = makeFake$({ settings: userDirs(DESKS) });
    await startAt(on.hooks, lane.$, LANE);
    expect(lane.statuses).toEqual(['lesson-cards: card only, no dialogs']);

    const off = captureHooks();
    const normal = makeFake$({ settings: userDirs(DESKS) });
    await startAt(off.hooks, normal.$, '/repo');
    expect(normal.statuses).toEqual([]);
  });
});

describe('the lesson paragraph is drawn once: the card, never the question or the deny', () => {
  const MESSAGE = 'Cancelled CI tiers are not pass.';
  const copies = (text: string): number => text.split(MESSAGE).length - 1;

  for (const [label, answer] of [['Cancel', 'Cancel'], ['Escape', ESCAPE]]) {
    test(`${label}: one copy across card, question and deny`, async () => {
      const { hooks } = captureHooks();
      const { $, asks } = makeFake$({ askAnswer: answer });
      await startSession(hooks, $);

      const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks', tool_use_id: 'tu-once' }, asNext<never>({ result: 'ran' }))) as { deny?: string };
      const tree = await hooks.get('ui.render')!($, { component: 'ToolUse', requestId: 'tu-once' }, asNext<never>(null));

      const card = JSON.stringify(tree);
      const question = asks[0]?.question ?? '';
      const deny = out.deny ?? '';
      expect(copies(card)).toBe(1);
      expect(copies(question)).toBe(0);
      expect(copies(deny)).toBe(0);
      expect(copies(card + question + deny)).toBe(1);
      expect(question).toBe('lesson cancelled-check-is-not-pass: Proceed anyway?');
    });
  }

  test('Cancel deny is exact: Cancelled: by you; not run. [lesson:id], no Fix', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'Cancel' });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ran' }))) as { deny?: string };
    expect(out.deny).toBe('Cancelled: by you; not run. [lesson:cancelled-check-is-not-pass]');
    expect(out.deny?.startsWith('Cancelled: ')).toBe(true);
    expect(out.deny).not.toContain('Fix:');
    expect(out.deny).not.toMatch(/^Cancelled: Cancelled/);
  });

  test('Escape deny is the same exact cancel line (no Fix)', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: ESCAPE });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ran' }))) as { deny?: string };
    expect(out.deny).toBe('Cancelled: by you; not run. [lesson:cancelled-check-is-not-pass]');
    expect(out.deny?.startsWith('Cancelled: ')).toBe(true);
    expect(out.deny).not.toContain('Fix:');
  });

  test('a typed free-text deny still keeps the short Fix for the model', async () => {
    const { hooks } = captureHooks();
    const { $ } = makeFake$({ askAnswer: 'sure, go ahead' });
    await startSession(hooks, $);

    const out = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, asNext<never>({ result: 'ran' }))) as { deny?: string };
    expect(out.deny).toBe(`Not run: no "Proceed anyway". [lesson:cancelled-check-is-not-pass] Fix: ${PATTERNS[0].example_fix}`);
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

describe('home lookup: HOME then USERPROFILE through $.env, never process', () => {
  test('loads the corpus under USERPROFILE when HOME is unset (the Windows shape)', async () => {
    const { hooks } = captureHooks();
    const { $, envGets } = makeFake$({ env: { USERPROFILE: FAKE_HOME }, askAnswer: 'Proceed anyway' });
    vi.stubGlobal('process', undefined);
    try {
      await startSession(hooks, $);
      expect(envGets).toContain('USERPROFILE');
      const next = asNext<never>({});
      const matched = (await hooks.get('tool.call')!($, { tool: 'Bash', command: 'gh pr checks' }, next)) as { context?: string[] };
      expect(matched.context?.[0]).toContain('[lesson:cancelled-check-is-not-pass]');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('asks for HOME before USERPROFILE', async () => {
    const { hooks } = captureHooks();
    const { $, envGets } = makeFake$({ env: { USERPROFILE: FAKE_HOME } });
    await startSession(hooks, $);
    expect(envGets.indexOf('HOME')).toBeLessThan(envGets.indexOf('USERPROFILE'));
  });

  test('registers /lessons before any env or fs read, so a load failure cannot stop it', async () => {
    const { hooks } = captureHooks();
    const order: string[] = [];
    const $ = {
      env: {
        get: async (name: string): Promise<string | undefined> => {
          order.push(`env:${name}`);
          return undefined;
        },
      },
      fs: {
        list: async (path: string): Promise<null> => {
          order.push(`list:${path}`);
          return null;
        },
        read: async (): Promise<string> => '',
        stat: async (): Promise<null> => null,
      },
      command: {
        register: async (c: { name: string }): Promise<void> => {
          order.push(`register:${c.name}`);
        },
      },
      ui: { invalidate: async (): Promise<void> => undefined },
    };
    await startSession(hooks, $);
    expect(order[0]).toBe('register:lessons');
  });
});

describe('/lessons with an empty corpus', () => {
  test('says why there are 0 lessons and where they come from (no HOME, no USERPROFILE)', async () => {
    const { hooks } = captureHooks();
    const registered: string[] = [];
    const $ = {
      env: { get: async (): Promise<string | undefined> => undefined },
      fs: {
        list: async (): Promise<null> => null,
        read: async (): Promise<string> => '',
        stat: async (): Promise<null> => null,
      },
      command: { register: async (c: { name: string }): Promise<void> => { registered.push(c.name); } },
      ui: { invalidate: async (): Promise<void> => undefined },
    };
    vi.stubGlobal('process', undefined);
    try {
      await startSession(hooks, $);
      const result = (await hooks.get('command.run')!($, { command: 'lessons' })) as { text?: string };
      expect(result.text).toContain('0 entries');
      expect(result.text).toContain('HOME');
      expect(result.text).toContain('lesson-patterns.json');
      expect(result.text).toContain('lessons.md');
      expect(registered).toEqual(['lessons']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('names the sources even without a load error (home set, nothing found)', async () => {
    const { hooks } = captureHooks();
    const $ = {
      env: { get: async (name: string): Promise<string | undefined> => (name === 'HOME' ? '/empty-home' : undefined) },
      fs: {
        list: async (): Promise<null> => null,
        read: async (): Promise<string> => { throw new Error('not found'); },
        stat: async (): Promise<null> => null,
      },
      command: { register: async (): Promise<void> => undefined },
      ui: { invalidate: async (): Promise<void> => undefined },
    };
    await startSession(hooks, $);
    const result = (await hooks.get('command.run')!($, { command: 'lessons' })) as { text?: string };
    expect(result.text).toContain('0 entries');
    expect(result.text).toContain('lesson-patterns.json');
    expect(result.text).toContain('lessons.md');
  });
});

describe('session.start with HOME unset', () => {
  test('does not throw without a process global, loads an empty corpus and still registers /lessons', async () => {
    const { hooks } = captureHooks();
    const registered: string[] = [];
    const $ = {
      env: { get: async (): Promise<string | undefined> => undefined },
      fs: {
        list: async (): Promise<null> => null,
        read: async (): Promise<string> => '',
        stat: async (): Promise<null> => null,
      },
      command: { register: async (c: { name: string }): Promise<void> => { registered.push(c.name); } },
      ui: { invalidate: async (): Promise<void> => undefined },
    };
    vi.stubGlobal('process', undefined);
    try {
      const out = await startSession(hooks, $);
      expect(out).toEqual({ forwarded: SESSION_EVENT });
      expect(registered).toEqual(['lessons']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('calls no $.fs method when HOME is unset', async () => {
    const { hooks } = captureHooks();
    const fsCalls: string[] = [];
    const $ = {
      env: { get: async (): Promise<string | undefined> => undefined },
      fs: {
        list: async (path: string): Promise<null> => { fsCalls.push(`list ${path}`); return null; },
        read: async (path: string): Promise<string> => { fsCalls.push(`read ${path}`); return ''; },
        stat: async (path: string): Promise<null> => { fsCalls.push(`stat ${path}`); return null; },
      },
      command: { register: async (): Promise<void> => undefined },
      ui: { invalidate: async (): Promise<void> => undefined },
    };
    vi.stubGlobal('process', undefined);
    try {
      await startSession(hooks, $);
      // An empty home must stop loadCorpus before any path is built: a relative
      // path would resolve under the session cwd and read the repository.
      expect(fsCalls).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('floor dirs without lessons.md are skipped before any fs.stat (mods-dogfood-2026-10-20)', () => {
  // Measured live: 88 "$.fs.stat (lesson-cards): .../floor-*/lessons.md failed: ENOENT" debug lines
  // per session start, one for every floor dir that has no lessons.md.
  function floorFake(withExists: boolean) {
    const stats: string[] = [];
    const $ = {
      env: { get: async (name: string): Promise<string | undefined> => (name === 'HOME' ? '/h' : undefined) },
      fs: {
        list: async (path: string) =>
          path === '/h/.claude/hq'
            ? [{ name: 'floor-alpha', kind: 'dir' }, ...[1, 2, 3, 4, 5].map((n) => ({ name: `floor-none-${n}`, kind: 'dir' }))]
            : null,
        read: async (path: string): Promise<string> => {
          if (path === '/h/.claude/hq/floor-alpha/lessons.md') return '## a\n\n- always read the merge state first\n';
          throw new Error(`ENOENT ${path}`);
        },
        stat: async (path: string) => {
          stats.push(path);
          if (path === '/h/.claude/hq/floor-alpha/lessons.md') return { size: 10, mtimeMs: 1, kind: 'file' as const };
          throw new Error(`ENOENT ${path}`);
        },
        ...(withExists ? { exists: async (path: string): Promise<boolean> => path === '/h/.claude/hq/floor-alpha/lessons.md' } : {}),
      },
      command: { register: async (): Promise<void> => undefined },
      ui: { invalidate: async (): Promise<void> => undefined, status: async (): Promise<void> => undefined },
      settings: { read: async () => ({}) },
    };
    return { $, stats };
  }

  test('with $.fs.exists, only the floor dir that has lessons.md is stat-ed, and its lessons still load', async () => {
    const { hooks } = captureHooks();
    const { $, stats } = floorFake(true);
    await startSession(hooks, $);
    expect(stats.filter((p) => p.includes('floor-none'))).toEqual([]);
    expect(stats).toContain('/h/.claude/hq/floor-alpha/lessons.md');
    const result = (await hooks.get('command.run')!($, { command: 'lessons' })) as { text?: string };
    expect(result.text).not.toContain('0 entries');
  });

  test('an engine without $.fs.exists falls back to fs.stat for every floor dir', async () => {
    const { hooks } = captureHooks();
    const { $, stats } = floorFake(false);
    await startSession(hooks, $);
    expect(stats.filter((p) => p.includes('floor-none'))).toHaveLength(5);
  });
});
