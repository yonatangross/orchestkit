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
  hold: boolean,
  label?: string
): string {
  const counts = {
    green: lights.filter((l) => l.color === "green").length,
    yellow: lights.filter((l) => l.color === "yellow").length,
    red: lights.filter((l) => l.color === "red").length,
    cancelled: lights.filter((l) => l.color === "cancelled").length,
  };

  const parts: string[] = [label ?? `promote #${prNumber}`];

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

/** Text color per light, as the terminal Text element takes it. */
export const LIGHT_COLORS: Record<string, string> = {
  green: "green",
  yellow: "yellow",
  red: "red",
  cancelled: "yellow",
};

/** Element props: children plus whatever the element takes. */
export type ElementProps = { children?: unknown } & Record<string, unknown>;
/** A constructor from $.ui.resolve(e): Box, Text and the rest. */
export type ElementCtor = (props?: ElementProps) => unknown;
export type Elements = { Box: ElementCtor; Text: ElementCtor };

/**
 * Build the AbovePrompt band from the elements $.ui.resolve(e) hands out.
 * A plain { type: "Box" } object is not an element on CC 2.1.282 and never
 * draws, so every node here comes from a constructor. One Text holds inline
 * Text runs so a long row of lights wraps instead of being cut.
 */
export function buildBand(
  els: Elements,
  label: string,
  lights: ClassifiedLight[],
  headSha: string,
  mergeStateStatus: string,
  hold: boolean
): unknown {
  const { Box, Text } = els;
  const runs: unknown[] = [];
  if (hold) runs.push(Text({ color: "red", bold: true, children: "HOLD " }));
  runs.push(Text({ bold: true, children: `${label}  ` }));
  for (const l of lights) {
    runs.push(
      Text({
        color: LIGHT_COLORS[l.color] ?? "red",
        children: `${LIGHT_SYMBOLS[l.color] ?? "?"} ${shortName(l.name, 28)}  `,
      })
    );
  }
  const tail = `${headSha.slice(0, 7)} ${mergeStateStatus}`.trim();
  if (tail) runs.push(Text({ dimColor: true, children: tail }));
  return Box({ children: [Text({ children: runs })] });
}

/** One dim line saying why there are no lights, so a failure is never blank. */
export function buildErrorBand(els: Elements, error: string): unknown {
  const { Box, Text } = els;
  return Box({ children: [Text({ dimColor: true, children: `lights: ${error}` })] });
}

/**
 * Shorten context name for display.
 * Truncates to ~20 chars.
 */
export function shortName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "\u2026"; // ellipsis
}
