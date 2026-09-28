/**
 * Hook registration for memory-lens.
 *
 * Events:
 * - session.start: find this project's memory folder (a worktree maps to its
 *   parent repo), then build the index in the background so the session is
 *   never held up. Also reads two optional local files: a client list and a
 *   mirror file of remote titles written by a private job outside this mod.
 * - prompt.submit: the top 3 memories above the score floor go to the model as
 *   one context entry and to the human as one transcript line. The 2.1.283
 *   prompt.submit contract: an answer carries { text } and an optional
 *   context that is a list of non-empty strings (binary checkArgument).
 * - tool.call (Read, Edit, Write, Grep, Glob): the path is a new query; at
 *   most one memory not yet recalled this session is added as tool context.
 *   A Write or Edit under the memory folder re-indexes that file.
 * - command.run{command=memory-lens}: stats, reload, show <n>.
 *
 * Negative pins: no process.run, no http.fetch, no store. Nothing on the hot
 * path touches the network; every file read happens at session start or after
 * a memory write. Hooks module format: exports register(on, options).
 */

import { contextText, percentiles, screenLines } from '../src/format.js';
import { isIndexFile, parentProjectKey, parseMemory, parseMirror, projectKey } from '../src/memory.js';
import { LensIndex } from '../src/rank.js';
import type { Hit, LensPrivate, MemoryDoc } from '../src/types.js';

/** Minimal $ facade for the calls this module makes. */
type Lens$ = {
  env: { get: (name: string) => Promise<string | undefined> };
  fs: {
    read: (path: string) => Promise<string>;
    list: (path: string) => Promise<Array<{ name: string; kind: 'file' | 'dir' | 'other' }> | null>;
  };
  ui: { log: (text: string, options?: { to?: 'transcript' | 'debug' }) => Promise<void> };
  command: { register: (spec: { name: string; description: string }) => Promise<unknown> };
};

type NextFn<E> = (ev: E) => Promise<unknown>;
type SessionStartEvent = { cwd?: string };
type PromptSubmitEvent = { text?: string; [k: string]: unknown };
type ToolCallEvent = { tool: string; tool_use_id?: string; [argument: string]: unknown };
type CommandEvent = { command?: string; args?: string; text?: string };

/** Tools whose path argument is a useful mid-task query. */
const PATH_TOOLS = new Set(['Read', 'Edit', 'Write', 'Grep', 'Glob']);

// Module-scope state (per session)
let home = '';
let memoryDir = '';
let mirrorPath = '';
let priv: LensPrivate = { clientTerms: [] };
let docs = new Map<string, MemoryDoc>();
let index: LensIndex | null = null;
let building: Promise<void> | null = null;
const recalled = new Set<string>();
const queryMs: number[] = [];
let lastHits: Hit[] = [];

function join(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

async function readPrivate($: Lens$): Promise<LensPrivate> {
  try {
    const raw = JSON.parse(await $.fs.read(join(home, '.claude', 'memory-lens', 'private.json'))) as { clientTerms?: unknown };
    const terms = Array.isArray(raw.clientTerms) ? raw.clientTerms.filter((t): t is string => typeof t === 'string') : [];
    return { clientTerms: terms };
  } catch {
    return { clientTerms: [] };
  }
}

async function loadDocs($: Lens$): Promise<Map<string, MemoryDoc>> {
  const out = new Map<string, MemoryDoc>();
  const entries = (await $.fs.list(memoryDir).catch(() => null)) ?? [];
  for (const e of entries) {
    if (e.kind !== 'file' || !e.name.endsWith('.md') || isIndexFile(e.name)) continue;
    const path = join(memoryDir, e.name);
    try {
      out.set(path, parseMemory(path, await $.fs.read(path)));
    } catch {
      // unreadable file: skip it, never fail the session
    }
  }
  try {
    for (const d of parseMirror(await $.fs.read(mirrorPath), 'mirror')) out.set(`mirror:${d.id}`, d);
  } catch {
    // no mirror file: local memory only
  }
  return out;
}

async function build($: Lens$): Promise<void> {
  const t0 = Date.now();
  priv = await readPrivate($);
  docs = await loadDocs($);
  index = new LensIndex([...docs.values()]);
  await $.ui.log(`memory-lens: indexed ${index.size} memories in ${Date.now() - t0} ms (${memoryDir})`, { to: 'debug' }).catch(() => undefined);
}

function timedQuery(text: string, k: number): Hit[] {
  if (!index) return [];
  const t0 = Date.now();
  const hits = index.query(text, k, recalled);
  queryMs.push(Date.now() - t0);
  if (queryMs.length > 500) queryMs.shift();
  return hits;
}

function withContext(result: unknown, entry: string): unknown {
  if (!result || typeof result !== 'object') return result;
  const r = result as Record<string, unknown>;
  const prior = Array.isArray(r.context) ? (r.context as unknown[]).filter((c): c is string => typeof c === 'string' && c !== '') : [];
  return { ...r, context: [...prior, entry] };
}

function pathQuery(e: ToolCallEvent): string {
  const raw = String(e.file_path ?? e.path ?? e.pattern ?? '');
  // the last three path segments carry the topic; the home prefix carries none
  return raw.split('/').slice(-3).join(' ').replace(/\.[a-z0-9]+$/i, '');
}

export function register(on: (event: string, matcherOrHook: unknown, hook?: unknown) => void, _options?: unknown): void {
  on('session.start', async ($: Lens$, e: SessionStartEvent, next: NextFn<SessionStartEvent>) => {
    home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const key = parentProjectKey(projectKey(e?.cwd ?? ''));
    memoryDir = join(home, '.claude', 'projects', key, 'memory');
    mirrorPath = join(home, '.claude', 'memory-lens', `mirror-${key}.json`);
    index = null;
    recalled.clear();
    lastHits = [];
    building = build($).catch(() => undefined);
    await $.command.register({ name: 'memory-lens', description: 'Memory lens: stats, reload, show <n>' }).catch(() => undefined);
    return next(e);
  });

  on('prompt.submit', async ($: Lens$, e: PromptSubmitEvent, next: NextFn<PromptSubmitEvent>) => {
    const result = (await next(e)) ?? e;
    try {
      const r = result as PromptSubmitEvent & { drop?: unknown };
      if (!index || typeof r.text !== 'string' || r.drop !== undefined) return result;
      const hits = timedQuery(r.text, 3);
      if (!hits.length) return result;
      const ctx = contextText(hits);
      if (!ctx) return result;
      lastHits = hits;
      for (const h of hits) recalled.add(h.doc.id);
      await $.ui.log(screenLines(hits, priv, home).join('\n')).catch(() => undefined);
      return withContext(result, ctx);
    } catch {
      return result;
    }
  });

  on('tool.call', async ($: Lens$, e: ToolCallEvent, next?: NextFn<ToolCallEvent>) => {
    const result = next ? ((await next(e)) ?? {}) : {};
    try {
      if (!PATH_TOOLS.has(e.tool)) return result;
      const path = String(e.file_path ?? '');
      if ((e.tool === 'Write' || e.tool === 'Edit') && memoryDir && path.startsWith(memoryDir + '/') && path.endsWith('.md')) {
        // a memory was written: re-index that one file so the next prompt can find it
        const name = path.split('/').pop() ?? '';
        if (!isIndexFile(name)) {
          docs.set(path, parseMemory(path, await $.fs.read(path)));
          index = new LensIndex([...docs.values()]);
        }
        return result;
      }
      if (!index) return result;
      const hits = timedQuery(pathQuery(e), 1);
      const ctx = contextText(hits);
      if (!hits.length || !ctx) return result;
      recalled.add(hits[0].doc.id);
      return withContext(result, ctx);
    } catch {
      return result;
    }
  });

  on('command.run', { command: 'memory-lens' }, async ($: Lens$, e: CommandEvent) => {
    const args = String(e?.args ?? e?.text ?? '').trim().split(/\s+/);
    if (args[0] === 'reload') {
      building = build($).catch(() => undefined);
      await building;
      return { text: `memory-lens: reloaded ${index?.size ?? 0} memories` };
    }
    if (args[0] === 'show') {
      const n = Number(args[1]) - 1;
      const h = lastHits[n];
      if (!h) return { text: `memory-lens: no hit ${args[1] ?? ''} on the last prompt` };
      return { text: `${n + 1}. ${h.doc.name}\n   ${h.doc.desc}\n   ${h.doc.id}` };
    }
    await building;
    const p = percentiles(queryMs);
    return {
      text: `memory-lens: ${index?.size ?? 0} memories from ${memoryDir || '(no project)'} · ${recalled.size} recalled this session · query p50 ${p.p50} ms p95 ${p.p95} ms over ${p.n}`,
    };
  });
}
