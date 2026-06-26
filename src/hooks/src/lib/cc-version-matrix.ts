/**
 * CC Version Constants
 *
 * Minimal CC version metadata for the SessionStart version-check hook.
 *
 * Was a 478-row hand-maintained feature catalogue ("Mirror" of CC's changelog).
 * #2229 thinned it: the catalogue had zero production feature-gate consumers — its
 * `hasFeature`/`getAvailableFeatures`/`getMissingFeatures` helpers were called only by
 * tests, and the one production reader (`cc-version-check.ts`) needed a single scalar
 * (the latest known version). So the table collapsed to two constants + the comparator.
 * ork adopts CC features by USE, not by runtime gating, so the rows earned nothing.
 *
 * Keep in sync with: shared/cc-support.json (the floor SoT) — `MIN_CC_VERSION` is stamped
 * from there by scripts/stamp-cc-support.mjs.
 */

/** Minimum CC version OrchestKit supports (the floor). Stamped from shared/cc-support.json. */
export const MIN_CC_VERSION = '2.1.183';

/**
 * Highest CC version OrchestKit's adoption is known to cover. The version-check hook nudges
 * Claude to look for new features when the running CC exceeds this. Bump this one line per
 * adoption cycle (replaces the old "append rows to the matrix" ritual).
 */
export const LATEST_KNOWN_CC = '2.1.193';

/**
 * Compare two semver-like CC version strings (e.g. "2.1.47").
 * Returns -1, 0, or 1.
 */
export function compareCCVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}
