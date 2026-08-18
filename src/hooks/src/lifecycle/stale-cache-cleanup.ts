/**
 * Stale Plugin Cache Cleanup — SessionStart Hook
 *
 * Prunes old plugin cache versions, keeping the current + previous per channel,
 * and never removing a version a live process is still running from.
 *
 * Hook: SessionStart (async, non-blocking)
 */
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HookInput, HookResult, HookContext } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

/** Keep the N most recent versions per channel. */
const KEEP_VERSIONS = 2;

/**
 * Marketplace root. Channels live one level below, e.g. `ork` and `ork-alpha`.
 *
 * This used to be hardcoded to `.../orchestkit/ork`. Every real install of the
 * prerelease is `orchestkit/ork-alpha`, so `readdirSync` threw ENOENT, the bare
 * `catch` swallowed it, and the hook returned success having reclaimed nothing.
 * Measured before the fix: 15 versions, 184MB, on a machine where this hook had
 * been "running" at every session start. (#3483)
 */
const MARKETPLACE_DIR = join(homedir(), '.claude', 'plugins', 'cache', 'orchestkit');

/**
 * Compare two semver-like version strings.
 *
 * Deliberately unchanged, and it handles the prerelease names this cache
 * actually holds (`10.0.0-alpha.35`) even though it looks like it should not:
 * `Number('0-alpha')` is NaN, NaN is falsy, so `|| 0` maps it to 0 for BOTH
 * sides, the comparison falls through, and the alpha ordinal in the next
 * position decides. Verified against 10.0.0-alpha.{9,21,30,35}, which sort
 * correctly. Documented because it works by accident, and a well-meaning
 * "fix" to strict parsing would change the ordering it currently gets right.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Is any process still holding this version open?
 *
 * `.in_use` is NOT a boolean marker, which is the other half of #3483. It is a
 * directory of `<pid>` files, each holding `{"pid":N,"procStart":"..."}`.
 * Measured on a real machine: 39 entries across 15 versions, of which 11 were
 * live and 28 stale. So the presence of `.in_use` proves nothing; the liveness
 * of the pids inside it is the actual signal.
 *
 * Fails CLOSED. If the directory cannot be read, assume the version is held and
 * keep it: over-retaining wastes disk, while under-retaining deletes the plugin
 * out from under a running session.
 */
function isHeldByLiveProcess(versionDir: string): boolean {
  let entries: string[];
  try {
    entries = readdirSync(join(versionDir, '.in_use'));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // No .in_use at all means nothing ever claimed it: genuinely unheld.
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    return true; // unreadable for any other reason: assume held
  }

  for (const name of entries) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      // Signal 0 performs the permission and existence checks without
      // delivering a signal. EPERM means the process exists but is not ours,
      // which still counts as alive.
      process.kill(pid, 0);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return true;
    }
  }
  return false;
}

/** List immediate subdirectory names, or null if the path is unreadable. */
function subdirs(dir: string): string[] | null {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return null;
  }
}

export function staleCacheCleanup(_input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const channels = subdirs(MARKETPLACE_DIR);
  if (channels === null) {
    // Not installed from the marketplace at all. Genuinely nothing to do, and
    // distinct from "the path was wrong", which is what used to happen here.
    return outputSilentSuccess();
  }

  for (const channel of channels) {
    const channelDir = join(MARKETPLACE_DIR, channel);
    const names = subdirs(channelDir);
    if (names === null) continue;

    const versionDirs = names.filter((n) => /^\d+\.\d+\.\d+/.test(n)).sort(compareVersions);
    if (versionDirs.length <= KEEP_VERSIONS) continue;

    const candidates = versionDirs.slice(0, -KEEP_VERSIONS);
    const removed: string[] = [];
    const held: string[] = [];

    for (const ver of candidates) {
      const dirPath = join(channelDir, ver);
      try {
        if (!statSync(dirPath).isDirectory()) continue;
        if (isHeldByLiveProcess(dirPath)) {
          held.push(ver);
          continue;
        }
        rmSync(dirPath, { recursive: true, force: true });
        removed.push(ver);
      } catch (err) {
        ctx.log(
          'stale-cache-cleanup',
          `Failed to remove ${channel}/${ver}: ${(err as Error).message}`,
          'warn',
        );
      }
    }

    if (removed.length > 0 || held.length > 0) {
      const heldNote = held.length > 0 ? `, kept ${held.length} still in use (${held.join(', ')})` : '';
      ctx.log(
        'stale-cache-cleanup',
        `${channel}: pruned ${removed.length} stale version(s)${
          removed.length > 0 ? ` (${removed.join(', ')})` : ''
        }${heldNote}; retained newest ${KEEP_VERSIONS} (${versionDirs.slice(-KEEP_VERSIONS).join(', ')})`,
      );
    }
  }

  return outputSilentSuccess();
}
