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
  lights: ClassifiedLight[]
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
 * Cancelled is never pass, missing is never pass.
 */
export function isPassing(lights: ClassifiedLight[]): boolean {
  if (lights.length === 0) return false; // total_count: 0 is not-pass
  return lights.every(
    (l) => l.color === "green" || l.color === "yellow" // yellow is in-progress, still potentially passing
  );
}

/**
 * Given required contexts and check runs, match and classify.
 * Prefers the first non-skipped run for each context.
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

    // Prefer non-skipped, then pick the first one
    // Script lines 22-23: pick first non-skipped, else skipped
    const nonSkipped = matching.find((r) => r.conclusion !== "skipped");
    const run = nonSkipped ?? matching[0];

    result.push(classifyCheckRun(run));
  }

  return result;
}
