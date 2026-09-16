/**
 * Pure classifier for CI check status.
 * Maps check-run conclusions to light colors.
 * Cancelled gets its own bucket and is never pass.
 * Missing is red (not run).
 */

export type LightColor = "green" | "yellow" | "red" | "cancelled";

export interface CheckRun {
  name: string;
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, timed_out, action_required, skipped
}

export interface ClassifiedLight {
  name: string;
  color: LightColor;
  conclusion: string | null;
}

/**
 * Classify a single check run into a light color.
 * Rules from the brief:
 * - success -> green
 * - queued, in_progress, conclusion null -> yellow
 * - cancelled -> cancelled (its own bucket, never pass)
 * - failure, timed_out, action_required -> red
 * - missing (no run found) -> red (not run)
 */
export function classifyCheckRun(run: CheckRun): ClassifiedLight {
  const { conclusion, status } = run;

  // Cancelled gets its own bucket
  if (conclusion === "cancelled") {
    return { name: run.name, color: "cancelled", conclusion };
  }

  // Success is green
  if (conclusion === "success") {
    return { name: run.name, color: "green", conclusion };
  }

  // Failure states are red
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "action_required"
  ) {
    return { name: run.name, color: "red", conclusion };
  }

  // In-progress states are yellow
  if (
    status === "queued" ||
    status === "in_progress" ||
    conclusion === null
  ) {
    return { name: run.name, color: "yellow", conclusion };
  }

  // Skipped - we still classify but it depends on context
  // In the brief, skipped runs don't count for the aggregate if there's a non-skipped run
  // For classification purposes, we mark skipped as yellow (waiting)
  if (conclusion === "skipped") {
    return { name: run.name, color: "yellow", conclusion };
  }

  // Unknown - treat as red (not run)
  return { name: run.name, color: "red", conclusion };
}

/**
 * Aggregate light colors for the status line.
 * Returns counts by color.
 */
export function aggregateLights(
  lights: readonly ClassifiedLight[]
): { green: number; yellow: number; red: number; cancelled: number } {
  return {
    green: lights.filter((l) => l.color === "green").length,
    yellow: lights.filter((l) => l.color === "yellow").length,
    red: lights.filter((l) => l.color === "red").length,
    cancelled: lights.filter((l) => l.color === "cancelled").length,
  };
}

/**
 * Determine if the aggregate status is passing.
 * Only an all-green set passes. Missing (red), pending or in progress
 * (yellow), skipped (yellow with a skipped conclusion), cancelled, and any
 * failing run all block the pass. A CI monitor that reports green when it
 * cannot see is worse than no monitor (GH-4177 class of bug).
 */
export function isPassing(lights: readonly ClassifiedLight[]): boolean {
  if (lights.length === 0) return false; // total_count: 0 is not-pass
  return lights.every((l) => l.color === "green");
}

/**
 * Given required contexts and check runs, match and classify.
 *
 * Worst case wins per context. Reruns can put several runs under one name
 * at the same sha (GH-4177: three workflows emit a run named Build), so
 * the answer must not depend on API ordering. Any matching run that
 * classifies red (failure, timed_out, action_required, or an unknown
 * conclusion) makes the context red even when a later rerun under the
 * same name is green. A cancelled run keeps its own bucket: it does not
 * force red, but it is a missing verdict and never reads as a pass.
 * Otherwise the first non-skipped run is the representative.
 */
export function matchAndClassify(
  requiredContexts: string[],
  checkRuns: CheckRun[]
): ClassifiedLight[] {
  const result: ClassifiedLight[] = [];

  for (const ctx of requiredContexts) {
    // Find all runs matching this context name
    const matching = checkRuns.filter((r) => r.name === ctx);

    if (matching.length === 0) {
      // Missing - red (not run)
      result.push({ name: ctx, color: "red", conclusion: null });
      continue;
    }

    // A red run anywhere in the history of this context at this sha is
    // red, regardless of a later green rerun.
    const failed = matching.find((r) => classifyCheckRun(r).color === "red");
    if (failed) {
      result.push(classifyCheckRun(failed));
      continue;
    }

    // Cancelled keeps its own bucket and is never a verified pass: a
    // cancellation is a missing verdict, so it surfaces as cancelled even
    // when a later rerun under the same name is green.
    const cancelled = matching.find((r) => r.conclusion === "cancelled");
    if (cancelled) {
      result.push(classifyCheckRun(cancelled));
      continue;
    }

    // Prefer non-skipped, then pick the first one
    // Script lines 22-23: pick first non-skipped, else skipped
    const nonSkipped = matching.find((r) => r.conclusion !== "skipped");
    const run = nonSkipped ?? matching[0];

    result.push(classifyCheckRun(run));
  }

  return result;
}
