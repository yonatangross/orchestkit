/**
 * Real path of a path for the review-post gate (#4678, HOLD 6085798647):
 * symlinks resolved on the longest existing prefix, and the macOS firmlink
 * prefix /System/Volumes/Data dropped, so a string compare against a
 * protected dir cannot be beaten by another spelling of the same file.
 * Lives in lib/ because it reads the file system (FH-ready rule).
 */
import { lstatSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { posix } from 'node:path';

const FIRMLINK = /^\/system\/volumes\/data(?=\/)/i;

/**
 * Walk the path one name at a time, as the kernel does: a link is resolved
 * before a .. after it, and a dangling link is followed to where a write
 * would land (HOLD 6086210644 should 4). At most 40 links, then it throws.
 */
function walk(p: string, budget: { links: number }): string {
  let cur = '/';
  for (const name of p.split('/')) {
    if (name === '' || name === '.') continue;
    if (name === '..') {
      cur = posix.dirname(cur);
      continue;
    }
    const next = posix.join(cur, name);
    let link: string | null = null;
    try {
      if (lstatSync(next).isSymbolicLink()) link = readlinkSync(next);
    } catch {
      // Not there: the rest of the path is new names under cur.
    }
    if (link !== null) {
      // Out of links fails closed: the gate turns a throw into a deny.
      if (budget.links <= 0) throw new Error(`too many links in ${p}`);
      budget.links -= 1;
      // The payload is walked name by name too, never collapsed first: a
      // link inside it resolves before a .. after it (HOLD 6088683660).
      cur = walk(link.startsWith('/') ? link : `${cur}/${link}`, budget);
    } else {
      cur = next;
    }
  }
  return cur;
}

export function realPath(p: string): string {
  const walked = walk(p.replace(FIRMLINK, ''), { links: 40 });
  // Then the canonical spelling (case, firmlink) of the longest prefix that exists.
  const parts = walked.split('/');
  for (let i = parts.length; i > 1; i -= 1) {
    const head = parts.slice(0, i).join('/') || '/';
    try {
      const real = realpathSync.native(head).replace(FIRMLINK, '');
      const tail = parts.slice(i).join('/');
      return tail ? posix.join(real, tail) : real;
    } catch {
      // Not there: try a shorter prefix.
    }
  }
  return walked.replace(FIRMLINK, '');
}

/**
 * Whether any name of p after its first `skip` names is a symlink, by lstat.
 * An allowed root counts only when no name of its configured spelling is a
 * link: a link in a parent moves it as surely as one at its end (codex22
 * XREVIEW 6096089850). The first name is skipped by default, since /tmp and
 * /var are root-owned links on macOS. A name that does not exist ends the walk.
 */
export function hasLink(p: string, skip = 1): boolean {
  const names = posix.normalize(p).split('/').filter((n) => n !== '');
  let cur = '';
  for (let i = 0; i < names.length; i += 1) {
    cur = `${cur}/${names[i]}`;
    if (i < skip) continue;
    try {
      if (lstatSync(cur).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * The link count of an existing file, 0 when it is absent or cannot be read:
 * a file with another hard link is that other file too (codex XREVIEW
 * 6098111473 P2).
 */
export function linkCount(p: string): number {
  try {
    return statSync(p).nlink;
  } catch {
    // broad: fail-open: an absent target has no other name.
    return 0;
  }
}
