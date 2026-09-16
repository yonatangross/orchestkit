// secrets-veil: types.ts - shared type definitions
// Reused from commit 30720692 and trimmed: the reveal surface (RevealedState,
// UIPressEvent, CommandRegisterEvent, ui.render/ui.press on OnFn) and ui.log
// are gone by design. This mod has no reveal path and no ui.log.

/**
 * Configuration for the high-entropy value layer.
 */
export interface EntropyConfig {
  /** Minimum token length to consider */
  minLength: number;
  /** Minimum Shannon entropy in bits per character */
  thresholdBitsPerChar: number;
}

/**
 * An entry in the mask table.
 */
export type MaskTableEntry =
  | {
      type: "env";
      name: string;
      value: string;
      pattern: string;
    }
  | {
      type: "pattern";
      pattern: string;
    };

/**
 * The mask table built at session.start from named values and patterns.
 * The optional entropy layer is a scan config, not an entry: it applies to
 * whole tokens found in text, not to a fixed value.
 */
export interface MaskTable {
  entries: readonly MaskTableEntry[];
  entropy?: EntropyConfig | null;
}

/**
 * A span in the original text that was masked.
 */
export interface MaskSpan {
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
  /** The original value that was masked */
  value: string;
  /** The env var name, if applicable */
  name?: string;
}

/**
 * Result of masking text.
 */
export interface MaskResult {
  /** The masked text (with secrets replaced by bullets) */
  text: string;
  /** Spans indicating where secrets were found */
  spans: MaskSpan[];
}

/**
 * The $ dependency object (subset used by secrets-veil).
 * Deliberately minimal: env reads and one notice. No ui.log, no ui.render,
 * no ui.press, no commands, no process, no http, no store.
 */
export interface DollarAPI {
  env: {
    get(name: string): Promise<string | undefined>;
  };
  ui: {
    notice(id: string, message: string): void;
  };
}

/**
 * Event types for function hooks.
 */
export interface ToolCallEvent {
  tool: string;
  args: Record<string, unknown>;
  tool_use_id?: string;
}

export interface ToolCallResult {
  deny?: { reason: string };
  result?: unknown;
  text?: string;
  isError?: boolean;
  context?: string[];
}

export interface SessionStartEvent {
  surface?: "terminal" | "desktop" | "mobile";
  isInteractive?: boolean;
}

/**
 * Event filter passed to on() (e.g. { component: "ToolResult" }).
 */
export type HookMatcher = Record<string, unknown>;

/**
 * The next() function signature: pass the event down the hook chain
 * and await the (possibly modified) result.
 */
export type NextFn<E, R = unknown> = (event: E) => Promise<R>;

/**
 * A function-hook handler: receives the $ API, the event and next().
 */
export type HookHandler<E, R = unknown> = (
  api: DollarAPI,
  event: E,
  next: NextFn<E, R>
) => Promise<unknown>;

/**
 * The on() registrar Claude Code passes to a function-hooks module.
 * Only two events: session.start arms the veil, tool.call masks results.
 * There is no ui.render, no ui.press and no command.register on purpose.
 */
export interface OnFn {
  (event: "session.start", matcher: HookMatcher, handler: HookHandler<SessionStartEvent>): void;
  (event: "tool.call", matcher: HookMatcher, handler: HookHandler<ToolCallEvent, ToolCallResult>): void;
}

/**
 * The register() entry point a function-hooks module exports.
 */
export type Register = (on: OnFn) => void;
