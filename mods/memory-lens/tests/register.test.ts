/**
 * Unit tests for the shipped hooks module (hooks/register.ts).
 *
 * Drives the real register(on) export with a captured on() and a fake $ shaped
 * like the CC 2.1.283 mods API, then calls the registered hooks directly.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { register } from '../hooks/register.js';

type Hook = (...args: unknown[]) => Promise<unknown>;

const HOME = '/home/lens-tester';
const CWD = '/work/repo/.worktrees/lane-1';
const MEMDIR = `${HOME}/.claude/projects/-work-repo/memory`;

const FILES: Record<string, string> = {
  [`${MEMDIR}/MEMORY.md`]: '- index line agent-browser agent-browser',
  [`${MEMDIR}/feedback_portless.md`]: '---\nname: feedback_portless\ndescription: portless by default; never open the page yourself with agent-browser\n---\nbody',
  [`${MEMDIR}/project_acme.md`]: '---\nname: project_acme_lane\ndescription: acme roadmap for this week\n---\nbody',
  ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`${MEMDIR}/filler_${i}.md`, `---\nname: filler_${i}\ndescription: databases and queues ${i}\n---\n`])),
  [`${HOME}/.claude/memory-lens/private.json`]: JSON.stringify({ clientTerms: ['acme'] }),
  [`${HOME}/.claude/memory-lens/mirror--work-repo.json`]: JSON.stringify({ items: [{ id: 'kb-9', title: 'Deploy runbook for staging', summary: 'staging deploy steps', source: 'kb' }] }),
};

function fake$() {
  const logs: Array<{ text: string; to?: string }> = [];
  const $ = {
    env: { get: async (n: string) => (n === 'HOME' ? HOME : undefined) },
    fs: {
      read: async (p: string) => {
        if (!(p in FILES)) throw new Error(`ENOENT ${p}`);
        return FILES[p];
      },
      list: async (p: string) => {
        const prefix = p.endsWith('/') ? p : p + '/';
        const names = Object.keys(FILES).filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'));
        return names.length ? names.map((f) => ({ name: f.slice(prefix.length), kind: 'file' as const })) : null;
      },
    },
    ui: { log: async (text: string, o?: { to?: string }) => void logs.push({ text, to: o?.to }) },
    command: { register: async () => undefined },
    clock: { after: (ms: number, fn: () => void) => { const t = setTimeout(fn, ms); return { cancel: () => clearTimeout(t) }; } },
  };
  return { $, logs };
}

function capture() {
  const hooks: Record<string, Hook> = {};
  register((event: string, a: unknown, b?: unknown) => {
    hooks[event] = (typeof a === 'function' ? a : b) as Hook;
  });
  return hooks;
}

async function start(hooks: Record<string, Hook>, $: unknown) {
  await hooks['session.start']($, { cwd: CWD }, async (e: unknown) => e);
  // the index builds in the background; the stats command awaits it
  await hooks['command.run']($, { args: 'stats' });
}

describe('memory-lens hooks', () => {
  let hooks: Record<string, Hook>;
  let f: ReturnType<typeof fake$>;
  beforeEach(async () => {
    hooks = capture();
    f = fake$();
    await start(hooks, f.$);
  });

  test('registers the four events', () => {
    expect(Object.keys(hooks).sort()).toEqual(['command.run', 'prompt.submit', 'session.start', 'tool.call']);
  });

  test('a matching prompt gets one context entry and one transcript line', async () => {
    const r = (await hooks['prompt.submit'](f.$, { text: 'why not do it yourself with agent-browser' }, async (e: unknown) => e)) as { text: string; context: string[] };
    expect(r.text).toBe('why not do it yourself with agent-browser');
    expect(r.context).toHaveLength(1);
    expect(r.context[0]).toContain('feedback_portless');
    expect(r.context[0]).not.toContain('MEMORY.md');
    const shown = f.logs.filter((l) => l.to !== 'debug').map((l) => l.text).join('\n');
    expect(shown).toContain('1/1 ');
    const rows = f.logs.filter((l) => l.to !== 'debug');
    // one log call per prompt, no newline inside it (2.1.283 TUI draws only the first call)
    expect(rows).toHaveLength(1);
    expect(rows[0].text).not.toContain('\n');
  });

  test('context from an earlier hook is kept, not replaced', async () => {
    const r = (await hooks['prompt.submit'](f.$, { text: 'agent-browser yourself' }, async () => ({ text: 'agent-browser yourself', context: ['earlier'] }))) as { context: string[] };
    expect(r.context[0]).toBe('earlier');
    expect(r.context).toHaveLength(2);
  });

  test('a vague prompt passes through untouched', async () => {
    const r = (await hooks['prompt.submit'](f.$, { text: 'ok continue, fix all' }, async (e: unknown) => e)) as Record<string, unknown>;
    expect(r.context).toBeUndefined();
  });

  test('a dropped prompt is left alone', async () => {
    const drop = { drop: 'no' };
    expect(await hooks['prompt.submit'](f.$, { text: 'agent-browser yourself' }, async () => drop)).toBe(drop);
  });

  test('client memories reach the model but not the screen', async () => {
    const r = (await hooks['prompt.submit'](f.$, { text: 'show me the acme roadmap this week' }, async (e: unknown) => e)) as { context: string[] };
    expect(r.context[0]).toContain('project_acme_lane');
    const shown = f.logs.filter((l) => l.to !== 'debug').map((l) => l.text).join('\n');
    expect(shown).not.toMatch(/acme/i);
    expect(shown).toContain('client memory (title hidden)');
  });

  test('mirrored remote titles are recalled with their store id', async () => {
    const r = (await hooks['prompt.submit'](f.$, { text: 'staging deploy runbook' }, async (e: unknown) => e)) as { context: string[] };
    expect(r.context[0]).toContain('kb id kb-9');
  });

  test('mid-task: a path query adds one memory not yet recalled', async () => {
    const r = (await hooks['tool.call'](f.$, { tool: 'Read', file_path: '/work/repo/docs/agent-browser/yourself.md' }, async () => ({ text: 'file' }))) as { context?: string[] };
    expect(r.context).toHaveLength(1);
    const again = (await hooks['tool.call'](f.$, { tool: 'Read', file_path: '/work/repo/docs/agent-browser/yourself.md' }, async () => ({ text: 'file' }))) as { context?: string[] };
    expect(again.context).toBeUndefined();
  });

  test('other tools pass through', async () => {
    const res = { stdout: 'x' };
    expect(await hooks['tool.call'](f.$, { tool: 'Bash', command: 'agent-browser yourself' }, async () => res)).toBe(res);
  });

  test('writing a memory re-indexes it for the next prompt', async () => {
    const path = `${MEMDIR}/feedback_new_lesson.md`;
    FILES[path] = '---\nname: feedback_new_lesson\ndescription: zebracorn gates must never skip\n---\n';
    await hooks['tool.call'](f.$, { tool: 'Write', file_path: path }, async () => ({ ok: true }));
    const r = (await hooks['prompt.submit'](f.$, { text: 'zebracorn gates' }, async (e: unknown) => e)) as { context?: string[] };
    expect(r.context?.[0]).toContain('feedback_new_lesson');
    delete FILES[path];
  });

  test('stats and show commands', async () => {
    await hooks['prompt.submit'](f.$, { text: 'acme roadmap this week' }, async (e: unknown) => e);
    const stats = (await hooks['command.run'](f.$, { args: 'stats' })) as { text: string };
    expect(stats.text).toMatch(/memory-lens: 33 memories/);
    const show = (await hooks['command.run'](f.$, { args: 'show 1' })) as { text: string };
    expect(show.text).toContain('project_acme_lane');
  });

  test('the first prompt waits for an index still building', async () => {
    const h = capture();
    const g = fake$();
    await h['session.start'](g.$, { cwd: CWD }, async (e: unknown) => e);
    // no stats call here: the build has not been awaited yet
    const r = (await h['prompt.submit'](g.$, { text: 'why not do it yourself with agent-browser' }, async (e: unknown) => e)) as { context?: string[] };
    expect(r.context?.[0]).toContain('feedback_portless');
  });

  test('the context travels down the chain before next() runs', async () => {
    let seen: unknown;
    await hooks['prompt.submit'](f.$, { text: 'agent-browser yourself' }, async (e: unknown) => { seen = e; return e; });
    expect((seen as { context?: string[] }).context?.[0]).toContain('feedback_portless');
  });

  test('no memory folder: prompts pass through', async () => {
    const h = capture();
    const g = fake$();
    await h['session.start'](g.$, { cwd: '/nowhere' }, async (e: unknown) => e);
    await h['command.run'](g.$, { args: 'stats' });
    const r = (await h['prompt.submit'](g.$, { text: 'agent-browser yourself' }, async (e: unknown) => e)) as Record<string, unknown>;
    expect(r.context).toBeUndefined();
  });
});
