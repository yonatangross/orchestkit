/**
 * Unit tests for the pure modules: tokenize, memory, rank, format.
 */

import { describe, test, expect } from 'vitest';
import { tokenize } from '../src/tokenize.js';
import { isIndexFile, parentProjectKey, parseMemory, parseMirror, projectKey } from '../src/memory.js';
import { LensIndex, FLOOR } from '../src/rank.js';
import { contextText, isClient, looksSecret, MAX_CONTEXT_CHARS, percentiles, screenLines } from '../src/format.js';
import type { Hit, MemoryDoc } from '../src/types.js';

/** A credential-shaped fake, assembled at runtime so no key-shaped literal sits in the repo. */
const FAKE_KEY = ['sk', 'x'.repeat(24)].join('-');

function doc(name: string, desc: string, body = '', id = `/h/.claude/projects/-p/memory/${name}.md`): MemoryDoc {
  return { id, name, desc, type: 'feedback', body, source: 'local' };
}

describe('tokenize', () => {
  test('drops filler and profanity, keeps topic words', () => {
    expect(tokenize('why not do it yourself with agent-browser, wtf')).toEqual(['yourself', 'agent-browser', 'agent', 'browser']);
  });
  test('splits compound slugs', () => {
    expect(tokenize('og-card_v2')).toContain('card');
  });
  test('empty and punctuation-only input yields nothing', () => {
    expect(tokenize('... !!! ,,,')).toEqual([]);
  });
});

describe('parseMemory', () => {
  test('reads frontmatter, body head and the first image', () => {
    const d = parseMemory('/m/x.md', '---\nname: portless-url\ndescription: "Use the portless URL"\nmetadata:\n  type: feedback\n---\nSee shot.png for the proof.');
    expect(d.name).toBe('portless-url');
    expect(d.desc).toBe('Use the portless URL');
    expect(d.type).toBe('feedback');
    expect(d.image).toBe('shot.png');
    expect(d.body).toContain('proof');
  });
  test('no frontmatter: name from the file name', () => {
    expect(parseMemory('/m/some_note.md', 'plain text').name).toBe('some_note');
  });
});

describe('project keys', () => {
  test('encodes a cwd the way Claude Code names project folders', () => {
    expect(projectKey('/Users/a/code/orchestkit/.worktrees/81983-lens')).toBe('-Users-a-code-orchestkit--worktrees-81983-lens');
  });
  test('a worktree maps to its parent repo', () => {
    expect(parentProjectKey('-Users-a-code-orchestkit--worktrees-81983-lens')).toBe('-Users-a-code-orchestkit');
    expect(parentProjectKey('-Users-a-code-orchestkit')).toBe('-Users-a-code-orchestkit');
  });
  test('index files are never recalled', () => {
    expect(isIndexFile('MEMORY.md')).toBe(true);
    expect(isIndexFile('MEMORY-archive.md')).toBe(true);
    expect(isIndexFile('feedback_x.md')).toBe(false);
  });
});

describe('parseMirror', () => {
  test('keeps well-formed items, drops the rest', () => {
    const docs = parseMirror(JSON.stringify({ items: [{ id: 'kb-1', title: 'Deploy runbook', summary: 's', source: 'kb' }, { id: 2 }, { id: 'x', title: '' }] }), 'mirror');
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ id: 'kb-1', name: 'Deploy runbook', source: 'kb', type: 'remote' });
  });
  test('malformed JSON yields nothing, never throws', () => {
    expect(parseMirror('{nope', 'mirror')).toEqual([]);
    expect(parseMirror('[]', 'mirror')).toEqual([]);
  });
});

describe('LensIndex', () => {
  const docs = [
    doc('feedback_serve_playgrounds_portless_open_via_cdp', 'portless by default; never open the page yourself with agent-browser'),
    doc('feedback_paper_kit_renders_dark_in_headless_browser', 'paper kit screenshots dark in agent-browser'),
    doc('reference_six_claude_accounts', 'which account to login to for each seat'),
    doc('project_handoff_2026_09_20', 'agent browser agent browser yourself agent-browser handoff digest'),
    ...Array.from({ length: 40 }, (_, i) => doc(`filler_${i}`, `unrelated topic number ${i} about databases and queues`)),
  ];
  const idx = new LensIndex(docs);

  test('ranks the matching memories first and says why', () => {
    const hits = idx.query('why not do it yourself with agent-browser');
    expect(hits[0].doc.name).toBe('feedback_serve_playgrounds_portless_open_via_cdp');
    expect(hits[0].why).toContain('agent-browser');
    expect(hits.every((h) => h.score >= FLOOR)).toBe(true);
  });
  test('a handoff digest counts half and ranks below real lessons', () => {
    const names = idx.query('yourself agent-browser').map((h) => h.doc.name);
    expect(names.indexOf('project_handoff_2026_09_20')).not.toBe(0);
  });
  test('a vague prompt shows nothing rather than noise', () => {
    expect(idx.query('fix all, make it better')).toEqual([]);
  });
  test('skipped ids are never returned', () => {
    const first = idx.query('agent-browser yourself')[0];
    const again = idx.query('agent-browser yourself', 3, new Set([first.doc.id]));
    expect(again.map((h) => h.doc.id)).not.toContain(first.doc.id);
  });
  test('caps at k', () => {
    expect(idx.query('agent-browser yourself paper kit account', 2).length).toBeLessThanOrEqual(2);
  });
  test('an empty index answers nothing', () => {
    expect(new LensIndex([]).query('anything at all')).toEqual([]);
  });
  test('query stays fast on a platform-sized corpus', () => {
    const big = new LensIndex(Array.from({ length: 2000 }, (_, i) => doc(`m_${i}`, `memory about topic ${i % 97} and gate ${i % 13}`, 'body '.repeat(80))));
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) big.query(`topic ${i} gate ${i % 13} verify`);
    // 150 ms per prompt is the budget; this asserts a generous ceiling for slow CI runners
    expect((Date.now() - t0) / 20).toBeLessThan(150);
  });
});

describe('format', () => {
  const hit = (d: MemoryDoc, why = ['agent-browser']): Hit => ({ doc: d, score: 10, why });
  const priv = { clientTerms: ['acme'] };

  test('screen line: title, why, short path', () => {
    const lines = screenLines([hit(doc('feedback_x', 'Serve with portless, hand over the URL'))], priv, '/h');
    expect(lines[0]).toBe('memory-lens · 1 related · matched agent-browser');
    expect(lines[1]).toBe('1. Serve with portless, hand over the URL');
    // the project folder shows without its leading dash, as in platform/memory/...
    expect(lines[2].trim()).toBe('p/memory/feedback_x.md');
  });
  test('client memories hide their title and the client word', () => {
    const lines = screenLines([hit(doc('project_acme_roadmap', 'Acme roadmap and contact'), ['acme', 'roadmap'])], priv);
    expect(lines.join('\n')).not.toMatch(/acme/i);
    expect(lines[1]).toContain('client memory (title hidden)');
  });
  test('a memory in a clients- project is a client memory', () => {
    expect(isClient(hit(doc('x', 'y', '', '/h/.claude/projects/-Users-a-coding-hq-clients-foo/memory/x.md')), { clientTerms: [] })).toBe(true);
  });
  test('secret-shaped text never reaches screen or context', () => {
    const s = doc('token_note', `key ${FAKE_KEY}`);
    expect(looksSecret(s.desc)).toBe(true);
    expect(contextText([hit(s)])).toBeNull();
    expect(screenLines([hit(s)], { clientTerms: [] }).join('\n')).not.toContain(FAKE_KEY);
  });
  test('context is capped near 600 tokens', () => {
    const long = Array.from({ length: 3 }, (_, i) => hit(doc(`m${i}`, 'x'.repeat(5000))));
    expect((contextText(long) ?? '').length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
  });
  test('mirrored hits point at their store id', () => {
    const m: MemoryDoc = { id: 'kb-7', name: 'Deploy runbook', desc: 'how deploys run', type: 'remote', body: '', source: 'kb' };
    expect(contextText([hit(m)])).toContain('kb id kb-7');
  });
  test('no hits, no lines', () => {
    expect(screenLines([], priv)).toEqual([]);
    expect(contextText([])).toBeNull();
  });
  test('percentiles', () => {
    expect(percentiles([5, 1, 3, 2, 4])).toEqual({ p50: 3, p95: 4, n: 5 });
    expect(percentiles([])).toEqual({ p50: 0, p95: 0, n: 0 });
  });
});
