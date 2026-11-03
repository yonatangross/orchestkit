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

/**
 * The skills under <projectDir>/.claude/skills that have a SKILL.md, sorted by
 * name. [] when the folder is missing or unreadable.
 */
export function readRepoSkills(projectDir: string): RepoSkill[] {
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
  for (const name of names) {
    const head = readHead(join(dir, name, 'SKILL.md'));
    if (head) skills.push({ name, description: frontmatterDescription(head) });
  }
  cache.set(dir, { mtimeMs, skills });
  return skills;
}
