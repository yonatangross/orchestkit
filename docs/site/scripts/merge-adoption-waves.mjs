// Merge helper for the CC-adoption board, extracted from generate-lab-data.mjs
// so the rule that actually matters (a prune can never delete a published wave)
// is unit-testable without running the whole generator.
//
// Background: shared/cc-adoption-gaps.json is a transient WORK QUEUE.
// cc-release-watch.mjs rewrites it every run and prunes entries already stamped
// `issues_filed_at`, so it stays bounded. Generating the board from it by
// replacement made a published history track a shrinking queue: 18 waves on
// main against 2 at the nightly PR's head (#3645).

/** Numeric compare so "2.1.9" sorts below "2.1.10" rather than above it. */
export function compareVersionsDesc(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Union published and queue waves by version, newest first.
 *
 * Queue data wins for a version present in both, so a corrected analysis still
 * propagates; a version only the published board knows about is carried forward
 * untouched. The result is append-only with respect to versions, which is the
 * whole point.
 */
export function mergeWaves(published, queue) {
  const byVersion = new Map();
  for (const w of published ?? []) byVersion.set(w.version, w);
  for (const w of queue ?? []) byVersion.set(w.version, w);
  return [...byVersion.values()].sort((a, b) => compareVersionsDesc(a.version, b.version));
}
