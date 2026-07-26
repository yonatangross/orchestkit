/**
 * Analytics JSONL rotation with bounded archive retention.
 *
 * WHY THIS FILE EXISTS
 *
 *   Rotation used to be implemented twice: once in `bin/run-hook.mjs` (a plain
 *   .mjs dispatcher that runs before and outside the compiled TS bundles, so it
 *   cannot import from src/lib) and once in `src/lib/analytics.ts`. The two
 *   copies drifted, and both carried the same two defects described below. This
 *   module is plain ESM with no side effects so BOTH callers can import it: the
 *   dispatcher loads it at runtime, and the TS bundles inline it at build time.
 *
 * WHAT #3151 GOT WRONG
 *
 *   #3151 bounded the ACTIVE file (hook-timing.jsonl) at 10 MB, and nothing
 *   else. Measured afterwards: hook-timing.jsonl was 236 KB while the ROTATED
 *   archive hook-timing.2026-07.jsonl was 300 MB. 99% of the 304 MB the fix was
 *   meant to reclaim lived in archives that nothing capped, counted, or pruned.
 *   Rotation without retention just moves unbounded growth one filename over.
 *
 *   Second defect, latent in both copies: the archive name is derived from the
 *   CURRENT month, so every rotation within the same month resolved to the same
 *   path and `renameSync` silently overwrote (and destroyed) the previous
 *   archive. A busy month therefore lost every archive but the last, with no
 *   error and no log line. Archives now get a numeric discriminator instead.
 *
 * GUARANTEES
 *
 *   1. The active file is rotated only once it exceeds `maxBytes`.
 *   2. Rotation never clobbers an existing archive.
 *   3. Total archive footprint is bounded by BOTH a count cap and a byte cap,
 *      pruning oldest-first.
 *   4. The newest archive is never pruned, so a rotation always leaves the data
 *      it just moved intact.
 *   5. Every failure mode is swallowed. Telemetry must never break a hook.
 */

import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';

/** Default active-file cap: 10 MB, matching every other analytics file. */
export const DEFAULT_MAX_BYTES = 10_485_760;

/** Default retention: keep at most this many rotated archives per base name. */
export const DEFAULT_MAX_ARCHIVES = 3;

/** Default retention: total bytes allowed across all archives of one base name. */
export const DEFAULT_MAX_ARCHIVE_BYTES = 52_428_800; // 50 MB

/**
 * Split "/a/b/hook-timing.jsonl" into its directory, base name and suffix.
 *
 * @param {string} filePath - Absolute path to the active JSONL.
 * @returns {{ dir: string, base: string } | null} null when the path is not a .jsonl.
 */
function splitJsonlPath(filePath) {
  if (!filePath.endsWith('.jsonl')) return null;
  const slash = filePath.lastIndexOf('/');
  const dir = slash === -1 ? '.' : filePath.slice(0, slash) || '/';
  const name = slash === -1 ? filePath : filePath.slice(slash + 1);
  return { dir, base: name.slice(0, -'.jsonl'.length) };
}

/**
 * Build a regex matching archives of one base name:
 *   <base>.<YYYY-MM>.jsonl        (first rotation of that month)
 *   <base>.<YYYY-MM>.<n>.jsonl    (subsequent rotations of that month)
 *
 * @param {string} base - Base name without the .jsonl suffix.
 * @returns {RegExp}
 */
function archivePattern(base) {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\.\\d{4}-\\d{2}(\\.\\d+)?\\.jsonl$`);
}

/**
 * Resolve an archive path that does not already exist, so rotation can never
 * destroy a previous archive from the same month.
 *
 * @param {string} dir - Directory holding the analytics files.
 * @param {string} base - Base name without the .jsonl suffix.
 * @param {string} month - YYYY-MM stamp.
 * @returns {string | null} A free path, or null if 1000 candidates were taken.
 */
function resolveFreeArchivePath(dir, base, month) {
  const first = `${dir}/${base}.${month}.jsonl`;
  if (!existsSync(first)) return first;
  // Cap the probe so a pathological directory cannot spin the hook.
  for (let n = 2; n < 1000; n++) {
    const candidate = `${dir}/${base}.${month}.${n}.jsonl`;
    if (!existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Delete oldest archives until both retention caps are satisfied.
 *
 * Ordering is by mtime rather than filename: the numeric discriminator added by
 * `resolveFreeArchivePath` does not sort chronologically (".2.jsonl" sorts
 * before ".jsonl"), so a name sort would prune the wrong file.
 *
 * @param {string} dir - Directory holding the analytics files.
 * @param {string} base - Base name without the .jsonl suffix.
 * @param {number} maxArchives - Maximum archive count to keep.
 * @param {number} maxArchiveBytes - Maximum total archive bytes to keep.
 * @returns {string[]} Paths that were pruned (useful for tests and diagnostics).
 */
export function pruneArchives(dir, base, maxArchives, maxArchiveBytes) {
  const pattern = archivePattern(base);
  /** @type {{ path: string, size: number, mtimeMs: number }[]} */
  const archives = [];
  for (const entry of readdirSync(dir)) {
    if (!pattern.test(entry)) continue;
    const path = `${dir}/${entry}`;
    try {
      const stats = statSync(path);
      archives.push({ path, size: stats.size, mtimeMs: stats.mtimeMs });
    } catch {
      // Vanished between readdir and stat. Nothing to account for.
    }
  }

  archives.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first

  let count = archives.length;
  let total = archives.reduce((sum, a) => sum + a.size, 0);
  /** @type {string[]} */
  const pruned = [];

  for (const archive of archives) {
    // Guarantee 4: never prune down to zero archives. The last one standing is
    // the newest, which is what the rotation that triggered this just wrote.
    if (count <= 1) break;
    if (count <= maxArchives && total <= maxArchiveBytes) break;
    try {
      unlinkSync(archive.path);
      pruned.push(archive.path);
      count--;
      total -= archive.size;
    } catch {
      // Locked or already gone. Skip it, keep trying the rest.
    }
  }

  return pruned;
}

/**
 * Rotate an analytics JSONL once it exceeds `maxBytes`, then enforce archive
 * retention. Best effort: never throws.
 *
 * @param {string} filePath - Absolute path to the active JSONL.
 * @param {{ maxBytes?: number, maxArchives?: number, maxArchiveBytes?: number }} [options]
 * @returns {void}
 */
export function rotateAnalyticsIfNeeded(filePath, options = {}) {
  const {
    maxBytes = DEFAULT_MAX_BYTES,
    maxArchives = DEFAULT_MAX_ARCHIVES,
    maxArchiveBytes = DEFAULT_MAX_ARCHIVE_BYTES,
  } = options;

  try {
    if (statSync(filePath).size <= maxBytes) return;
  } catch {
    // Missing file (first write) or an unreadable path: nothing to rotate.
    return;
  }

  const parts = splitJsonlPath(filePath);
  if (!parts) return;
  const { dir, base } = parts;

  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const archivePath = resolveFreeArchivePath(dir, base, month);
    if (!archivePath) return;
    renameSync(filePath, archivePath);
  } catch {
    // A failed rename leaves the active file in place. Retention below would
    // then be operating on a set we did not change, so stop here.
    return;
  }

  try {
    pruneArchives(dir, base, maxArchives, maxArchiveBytes);
  } catch {
    // Retention is opportunistic. A failure here costs disk, never a hook.
  }
}
