/**
 * Read a repo's own skills folder (<project>/.claude/skills) cheaply.
 *
 * One stat and one readdir, plus the first HEAD_BYTES of each SKILL.md (the
 * frontmatter lives at the top), cached per process by the folder's mtime.
 * No network, no git, no child process. Any read error reads as "no skills".
 * Lives in lib/ so handlers take it through an injected deps object (the
 * FH-ready handler policy, .claude/rules/hooks-development.md).
 */

import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Bytes of SKILL.md read; enough for any frontmatter description. */
const HEAD_BYTES = 4096;

export interface RepoSkill {
  /** The skill's folder name, which is its slash command. */
  name: string;
  /** The frontmatter description, one line, '' when absent. */
  description: string;
}

const cache = new Map<string, { mtimeMs: number; skills: RepoSkill[] }>();

/** Exposed for tests: forget cached folder reads. */
export function resetRepoSkillsCache(): void {
  cache.clear();
}

function readHead(path: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, n).toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The frontmatter `description:` value on one line, or '' when absent. */
export function frontmatterDescription(head: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head);
  if (!fm) return '';
  const line = /^description:\s*(.*)$/m.exec(fm[1]);
  if (!line) return '';
  return line[1]
    .trim()
    .replace(/^["'>|-]\s*/, '')
    .replace(/["']$/, '')
    .trim();
}

/** Wall-clock budget for reading SKILL.md heads in one call. */
export const READ_BUDGET_MS = 50;
/** At most this many skill folders are read in one call. */
export const MAX_SKILL_ENTRIES = 40;

export interface ReadRepoSkillsOptions {
  budgetMs?: number;
  maxEntries?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

/**
 * The skills under <projectDir>/.claude/skills that have a SKILL.md, sorted by
 * name. [] when the folder is missing or unreadable.
 *
 * Bounded so a slow disk cannot stall every Bash call (this runs inside the
 * sync Bash advisory dispatcher, #5006 review): at most MAX_SKILL_ENTRIES
 * folders, and the SKILL.md reads stop once READ_BUDGET_MS has passed, the
 * clock checked between reads. A partial result is cached like a full one, so
 * a slow folder costs one stat per call afterwards, not a rescan.
 *
 * Limit: the stat and the one readdir are synchronous calls that a budget
 * cannot preempt; a single read that hangs still blocks. The budget bounds
 * the per-file loop, which is where the cost grows with the folder.
 */
export function readRepoSkills(projectDir: string, options: ReadRepoSkillsOptions = {}): RepoSkill[] {
  const budgetMs = options.budgetMs ?? READ_BUDGET_MS;
  const maxEntries = options.maxEntries ?? MAX_SKILL_ENTRIES;
  const now = options.now ?? Date.now;
  const dir = join(projectDir, '.claude', 'skills');
  let mtimeMs: number;
  try {
    mtimeMs = statSync(dir).mtimeMs;
  } catch {
    return [];
  }
  const hit = cache.get(dir);
  if (hit && hit.mtimeMs === mtimeMs) return hit.skills;

  let names: string[] = [];
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
  } catch {
    names = [];
  }
  const skills: RepoSkill[] = [];
  const started = now();
  for (const name of names.slice(0, maxEntries)) {
    if (now() - started > budgetMs) break;
    const head = readHead(join(dir, name, 'SKILL.md'));
    if (head) skills.push({ name, description: frontmatterDescription(head) });
  }
  cache.set(dir, { mtimeMs, skills });
  return skills;
}
