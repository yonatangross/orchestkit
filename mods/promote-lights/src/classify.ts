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
 * Order-independent worst case wins per context (GH-4177): reruns can put
 * several runs under one name at the same sha and the API order is not a
 * contract, so the verdict for a name is computed from the SET of its runs,
 * never from which run arrived first or last. ANY run under a name that is
 * not success means that name is NOT passing: a pending, skipped, cancelled,
 * failed, or unknown run each blocks the pass even when a green rerun sits
 * next to it. The representative color shown is the worst color present:
 * red beats cancelled beats yellow beats green. A name with no runs is red
 * (not run).
 */
export function matchAndClassify(
  requiredContexts: string[],
  checkRuns: CheckRun[]
): ClassifiedLight[] {
  const result: ClassifiedLight[] = [];

  // Severity ranking for the representative color. Higher wins. green is
  // only shown when every run under the name classified green.
  const SEVERITY: Record<string, number> = {
    green: 0,
    yellow: 1,
    cancelled: 2,
    red: 3,
  };

  for (const ctx of requiredContexts) {
    // Find all runs matching this context name
    const matching = checkRuns.filter((r) => r.name === ctx);

    if (matching.length === 0) {
      // Missing - red (not run)
      result.push({ name: ctx, color: "red", conclusion: null });
      continue;
    }

    // Classify EVERY run under the name and take the worst color. This is
    // the order-independent core: sorting the same runs into any order
    // yields the same worst color, so [success, in_progress] and
    // [in_progress, success] both read pending, and a green rerun next to
    // a failure never resuscitates the name.
    const classified = matching.map((r) => classifyCheckRun(r));
    const worst = classified.reduce((a, b) =>
      SEVERITY[b.color] > SEVERITY[a.color] ? b : a
    );

    result.push(worst);
  }

  return result;
}
