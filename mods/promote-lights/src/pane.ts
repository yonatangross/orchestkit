/**
 * Band rendering for promote-lights.
 * Draws one row of lights above the prompt using Box and Text.
 * No Client module needed - static between ticks.
 */

import type { ClassifiedLight } from "./classify.ts";

export const LIGHT_SYMBOLS: Record<string, string> = {
  green: "\u{1F7E2}", // green circle
  yellow: "\u{1F7E1}", // yellow circle
  red: "\u{1F534}", // red circle
  cancelled: "\u26A0\uFE0F", // warning sign
};

/**
 * Build the status line string for $.ui.status().
 * Format: "promote #N: 9/11 green, 1 yellow, 1 cancelled, BEHIND"
 */
export function buildStatusLine(
  prNumber: number,
  lights: ClassifiedLight[],
  mergeStateStatus: string,
  hold: boolean
): string {
  const counts = {
    green: lights.filter((l) => l.color === "green").length,
    yellow: lights.filter((l) => l.color === "yellow").length,
    red: lights.filter((l) => l.color === "red").length,
    cancelled: lights.filter((l) => l.color === "cancelled").length,
  };

  const parts: string[] = [`promote #${prNumber}`];

  if (counts.green > 0) parts.push(`${counts.green} green`);
  if (counts.yellow > 0) parts.push(`${counts.yellow} yellow`);
  if (counts.red > 0) parts.push(`${counts.red} red`);
  if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);

  if (mergeStateStatus && mergeStateStatus !== "CLEAN") {
    parts.push(mergeStateStatus);
  }

  if (hold) {
    parts.unshift("HOLD");
  }

  return parts.join(", ");
}

/**
 * Build the band content for AbovePrompt.
 * Returns an array of [name, symbol] pairs plus trailing info.
 */
export function buildBandContent(
  lights: ClassifiedLight[],
  headSha: string,
  mergeStateStatus: string,
  hold: boolean
): Array<{ name: string; symbol: string }> {
  const result: Array<{ name: string; symbol: string }> = lights.map((l) => ({
    name: l.name,
    symbol: LIGHT_SYMBOLS[l.color] ?? "?",
  }));

  // Add trailing info cell
  const head = headSha.slice(0, 7);
  const status = mergeStateStatus || "";
  const holdPrefix = hold ? "HOLD " : "";

  result.push({
    name: `${holdPrefix}${head} ${status}`.trim(),
    symbol: "",
  });

  return result;
}

/**
 * Shorten context name for display.
 * Truncates to ~20 chars.
 */
export function shortName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "\u2026"; // ellipsis
}
