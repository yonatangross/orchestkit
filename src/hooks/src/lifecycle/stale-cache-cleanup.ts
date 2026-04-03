/**
 * Stale Plugin Cache Cleanup — SessionStart Hook
 *
 * Prunes old plugin cache versions, keeping only current + previous.
 * Prevents unbounded disk growth from accumulated plugin updates.
 *
 * Hook: SessionStart (async, non-blocking)
 */
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';

/** Keep the N most recent versions */
const KEEP_VERSIONS = 2;

/** Cache root for OrchestKit plugin */
const CACHE_DIR = join(homedir(), '.claude', 'plugins', 'cache', 'orchestkit', 'ork');

/**
 * Compare two semver-like version strings (e.g. "7.11.2").
 * Returns negative if a < b, positive if a > b, 0 if equal.
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

export function staleCacheCleanup(_input: HookInput, ctx?: HookContext): HookResult {
  try {
    const entries = readdirSync(CACHE_DIR, { withFileTypes: true });
    const versionDirs = entries
      .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+/.test(e.name))
      .map((e) => e.name)
      .sort(compareVersions);

    if (versionDirs.length <= KEEP_VERSIONS) return outputSilentSuccess();

    const toRemove = versionDirs.slice(0, -KEEP_VERSIONS);
    let cleaned = 0;

    for (const ver of toRemove) {
      const dirPath = join(CACHE_DIR, ver);
      try {
        // Safety: verify it's actually a directory and inside the cache dir
        const stat = statSync(dirPath);
        if (!stat.isDirectory()) continue;

        rmSync(dirPath, { recursive: true, force: true });
        cleaned++;
      } catch {
        (ctx?.log ?? logHook)('stale-cache-cleanup', `Failed to remove ${ver}`);
      }
    }

    if (cleaned > 0) {
      (ctx?.log ?? logHook)(
        'stale-cache-cleanup',
        `Pruned ${cleaned} stale version(s): ${toRemove.join(', ')} (kept ${versionDirs.slice(-KEEP_VERSIONS).join(', ')})`,
      );
    }
  } catch {
    // Cache dir doesn't exist or isn't readable — nothing to clean
  }

  return outputSilentSuccess();
}
