import type { BandState } from "../types/index.js";
export type { BandState } from "../types/index.js";
export interface Node {
  tag: string;
  props: Record<string, unknown>;
  children: unknown[];
}
export type Component = (props: Record<string, unknown>) => Node;
export interface Events {
  "prompt.submit": { text: string; origin: { kind: string }; wait: boolean; command?: object; attachments?: readonly object[] };
  "prompt.change": { text: string; cursor: number; origin: { kind: string } };
  "ui.render": { component: "AbovePrompt"; props: { hasSurvey: boolean; isWorking: boolean } };
}
/**
 * One text block of a `$.model.complete` prompt or system. `cache: true` on the
 * last block of the static content sets a prompt-cache breakpoint: Claude Code
 * sends that block with the API's `cache_control` field. Arrays of blocks need
 * Claude Code 2.1.292 or later (mods API docs, "Use prompt caching"; the 2.1.308
 * host check reads "the prompt a string or a list of blocks, each { text } and
 * at most `cache: true`").
 */
export interface Block { text: string; cache?: true }
/** The API's cache fields, as the mods API docs describe `r.usage`. */
export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
export interface Dollar {
  prompt: {
    read(): Promise<{ text: string; cursor: number }>;
    fill(input: { text: string; mode?: "replace" }): Promise<{ isFilled: boolean }>;
    submit(input: { text: string; asUser: true }): Promise<{ text?: string; drop?: string }>;
  };
  model: {
    complete(input: { model: string; system: string | readonly Block[]; prompt: string | readonly Block[]; maxTokens: number; effort: "low"; timeoutMs: number }): Promise<{ isAnswered: boolean; text?: string; reason?: string; usage?: Usage }>;
  };
  env: {
    get(name: "HOME"): Promise<string | undefined>;
  };
  fs: {
    /** Absent on older engines, where the call throws; callers catch it. */
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
  };
  state: {
    get(ref: { plugin: "prompt-enhancer"; key: "band" }): Promise<{ value?: BandState; version: number }>;
    set(ref: { plugin: "prompt-enhancer"; key: "band" }, value: BandState): Promise<{ isSet: boolean; version: number }>;
  };
  ui: {
    toast(text: string): Promise<void>;
    resolve(event: Events["ui.render"]): { Box: Component; Text: Component; Button: Component };
  };
}
export type Handler<K extends keyof Events> = ($: Dollar, event: Events[K], next: ((event: Events[K]) => Promise<unknown>) & { readonly called: boolean }) => unknown;
export interface On {
  <K extends keyof Events>(event: K, handler: Handler<K>): { catch(handler: Handler<K>): void };
  <K extends keyof Events>(event: K, filter: { component: "AbovePrompt" }, handler: Handler<K>): { catch(handler: Handler<K>): void };
}
