/**
 * Band rendering for promote-lights.
 * Draws a summary line plus one line per non-green check above the prompt.
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

/** Order for the problem lines: red first, then cancelled, then yellow. */
const PROBLEM_ORDER: Record<string, number> = { red: 0, cancelled: 1, yellow: 2 };

/** The non-green lights, red then cancelled then yellow, stable within a color. */
export function problemLights(lights: ClassifiedLight[]): ClassifiedLight[] {
  return lights
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.color !== "green")
    .sort((a, b) => (PROBLEM_ORDER[a.l.color] ?? 0) - (PROBLEM_ORDER[b.l.color] ?? 0) || a.i - b.i)
    .map(({ l }) => l);
}

/** The summary label: "#N" for a promote PR, "owner/repo#N" when watching. */
export function summaryLabel(label: string): string {
  return label.replace(/^(watch|promote) /, "");
}

/**
 * Build the AbovePrompt band from the elements $.ui.resolve(e) hands out.
 * A plain { type: "Box" } object is not an element on CC 2.1.282 and never
 * draws, so every node here comes from a constructor.
 *
 * Layout (approved 2026-09-26): one summary line always, then one line per
 * check that is not green, full name, red first. All green is one line.
 *
 *   🚦 #4435  3afff24  BLOCKED   19 🟢  0 🟡  2 🔴
 *      🔴 PR Playground
 *      🔴 CI Summary
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
  const count = (color: string) => lights.filter((l) => l.color === color).length;
  const green = count("green");
  const yellow = count("yellow");
  const red = count("red");
  const cancelled = count("cancelled");

  const runs: unknown[] = [];
  if (hold) runs.push(Text({ color: "red", bold: true, children: "HOLD " }));
  runs.push(Text({ bold: true, children: `\u{1F6A6} ${summaryLabel(label)}  ` }));
  const state = `${headSha.slice(0, 7)}  ${mergeStateStatus}`.trim();
  if (state) runs.push(Text({ dimColor: true, children: `${state}   ` }));
  runs.push(Text({ color: "green", children: `${green} ${LIGHT_SYMBOLS.green}  ` }));
  runs.push(Text({ color: "yellow", children: `${yellow} ${LIGHT_SYMBOLS.yellow}  ` }));
  runs.push(Text({ color: "red", children: `${red} ${LIGHT_SYMBOLS.red}` }));
  if (cancelled > 0) {
    runs.push(Text({ color: "yellow", children: `  ${cancelled} ${LIGHT_SYMBOLS.cancelled}` }));
  }

  const lines: unknown[] = [Text({ children: runs })];
  for (const l of problemLights(lights)) {
    lines.push(
      Text({
        color: LIGHT_COLORS[l.color] ?? "red",
        children: `   ${LIGHT_SYMBOLS[l.color] ?? "?"} ${l.name}`,
      })
    );
  }
  return Box({ flexDirection: "column", children: lines });
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
