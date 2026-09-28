/**
 * Reading memory: frontmatter parsing, the project folder for a cwd, and mirror files.
 * Pure over strings; the hooks module owns every file read.
 */

import { looksSecret } from './format.js';
import type { MemoryDoc, MirrorItem } from './types.js';

/** Body characters kept for matching. Past this, a memory is detail, not topic. */
export const BODY_CHARS = 1200;

const IMAGE = /[~/A-Za-z0-9._-]+\.(?:png|jpe?g|svg|webp)\b/;

/** Parse one memory file. Frontmatter keys may be top level or under metadata. */
export function parseMemory(id: string, text: string): MemoryDoc {
  const fm: Record<string, string> = {};
  let body = text;
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end > 0) {
      for (const line of text.slice(3, end).split('\n')) {
        const m = /^\s*(name|description|type):\s*(.*)$/.exec(line);
        if (m && !(m[1] in fm)) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
      body = text.slice(end + 4);
    }
  }
  const base = id.split('/').pop() ?? id;
  const image = IMAGE.exec(text)?.[0];
  return {
    id,
    name: fm.name || base.replace(/\.md$/, ''),
    desc: fm.description ?? '',
    type: fm.type ?? '',
    body: body.slice(0, BODY_CHARS),
    ...(image ? { image } : {}),
    source: 'local',
  };
}

/** Claude Code's project folder name for a cwd: every non-alphanumeric becomes "-". */
export function projectKey(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

/**
 * A worktree under <repo>/.worktrees/<name> gets its own, usually empty, project
 * folder; its lessons live under the parent repo's folder.
 */
export function parentProjectKey(key: string): string {
  return key.split('--worktrees-')[0];
}

/** Index files that only point at other memories; never recalled themselves. */
export function isIndexFile(name: string): boolean {
  return /^MEMORY(-archive|-ARCHIVE)?\.md$/.test(name);
}

/** Parse a mirror file. Anything malformed yields no items, never a throw. */
export function parseMirror(text: string, fallbackSource: string): MemoryDoc[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: MemoryDoc[] = [];
  for (const raw of items as MirrorItem[]) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string' || !raw.title) continue;
    const source = typeof raw.source === 'string' && raw.source ? raw.source : fallbackSource;
    // the id and source are printed on screen and sent to the model: a
    // credential-shaped one drops the whole item (review of #4530)
    if (looksSecret(raw.id) || looksSecret(source)) continue;
    out.push({
      id: raw.id,
      name: raw.title,
      desc: typeof raw.summary === 'string' ? raw.summary : '',
      type: 'remote',
      body: '',
      source,
    });
  }
  return out;
}
