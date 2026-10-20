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
export interface Dollar {
  prompt: {
    read(): Promise<{ text: string; cursor: number }>;
    fill(input: { text: string; mode?: "replace" }): Promise<{ isFilled: boolean }>;
    submit(input: { text: string; asUser: true }): Promise<{ text?: string; drop?: string }>;
  };
  model: {
    complete(input: { model: string; system: string; prompt: string; maxTokens: number; effort: "low"; timeoutMs: number }): Promise<{ isAnswered: boolean; text?: string; reason?: string }>;
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
