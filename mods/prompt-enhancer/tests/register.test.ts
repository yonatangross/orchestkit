import { afterEach, describe, expect, test, vi } from "vitest";
import { register } from "../hooks/register.js";
import type { BandState, Dollar, Events, Handler, Node, On } from "../src/api.js";

afterEach(() => vi.unstubAllGlobals());

function harness(initial: string) {
  let box = initial;
  let state: BandState | undefined;
  const handlers = new Map<string, unknown>();
  const sent: string[] = [];
  const displayed: string[] = [];
  const toasts: string[] = [];
  const drops: { text: string; modelCalls: number }[] = [];
  const complete = vi.fn<Dollar["model"]["complete"]>(async () => ({ isAnswered: true, text: "Add a login page. Read the repo first. Ask when unclear. Verify the page renders." }));
  const $: Dollar = {
    prompt: {
      read: async () => ({ text: box, cursor: box.length }),
      fill: async ({ text }) => { box = text; displayed.push(text); return { isFilled: true }; },
      submit: async ({ text, asUser }) => { expect(asUser).toBe(true); sent.push(text); return { text }; },
    },
    model: { complete },
    state: {
      get: async () => ({ value: state, version: 0 }),
      set: async (_ref, value) => { state = value; return { isSet: true, version: 1 }; },
    },
    ui: {
      toast: async text => { toasts.push(text); },
      resolve: () => ({ Box: props => ({ tag: "Box", props, children: [] }), Text: props => ({ tag: "Text", props, children: [] }), Button: props => ({ tag: "Button", props, children: [] }) }),
    },
  };
  vi.stubGlobal("h", (tag: string | ((props: Record<string, unknown>) => Node), props: Record<string, unknown> | null, ...children: unknown[]) => {
    const node = typeof tag === "function" ? tag(props ?? {}) : { tag, props: props ?? {}, children: [] };
    return { ...node, children };
  });
  const catches = new Map<string, unknown>();
  const on = ((name: string, ...args: unknown[]) => {
    handlers.set(name, args.at(-1));
    return { catch: (handler: unknown) => { catches.set(name, handler); } };
  }) as On;
  register(on);
  async function fire<K extends keyof Events>(name: K, event: Events[K]) {
    const handler = handlers.get(name) as Handler<K> | undefined;
    expect(handler, `missing ${name} hook`).toBeDefined();
    const composer = name === "prompt.submit" && (event as Events["prompt.submit"]).origin.kind === "composer";
    const handedBack = composer && box.trim() === (event as Events["prompt.submit"]).text ? box : (event as Events["prompt.submit"]).text;
    if (composer && box.trim() === (event as Events["prompt.submit"]).text) {
      await fire("prompt.change", { text: box, cursor: box.length, origin: { kind: "input" } });
      box = "";
    }
    let settled: Events[K];
    const next = Object.assign(async (e: Events[K]) => { if (next.called) return settled; next.called = true; settled = e; if (name === "prompt.submit") sent.push((e as Events["prompt.submit"]).text); return e; }, { called: false });
    let result: unknown;
    try { result = await handler!($, event, next); }
    catch (error) {
      const fallback = catches.get(name) as Handler<K> | undefined;
      if (!fallback) throw error;
      result = await fallback($, event, next);
    }
    if (composer && result && typeof result === "object" && "drop" in result) {
      drops.push({ text: box, modelCalls: complete.mock.calls.length });
      if (!box) await fire("prompt.change", { text: "", cursor: 0, origin: { kind: "clear" } });
      box = box.trim() ? `${box}\n${handedBack}` : handedBack;
      await fire("prompt.change", { text: box, cursor: box.length, origin: { kind: "engine" } });
    }
    return result;
  }
  async function press(label: string) {
    const tree = await fire("ui.render", { component: "AbovePrompt", props: { hasSurvey: false, isWorking: false } });
    function find(value: unknown): Node | undefined {
      if (!value || typeof value !== "object") return;
      const node = value as Node;
      if (node.props?.label === label) return node;
      for (const child of node.children ?? []) { const hit = find(child); if (hit) return hit; }
    }
    const button = find(tree);
    expect(button, `missing ${label} button`).toBeDefined();
    await (button!.props.onPress as () => Promise<unknown>)();
  }
  return { $, fire, press, sent, displayed, toasts, drops, complete, box: () => box, edit: (text: string) => { box = text; } };
}
const submit = (text: string): Events["prompt.submit"] => ({ text: text.trim(), origin: { kind: "composer" }, wait: false });

describe("Prompt Enhancer review boundary", () => {
  test("typed ++ enhances into the box instead of sending", async () => {
    const h = harness("add a login opage++");
    const result = await h.fire("prompt.submit", submit(h.box()));
    expect(result).toHaveProperty("drop");
    expect(h.drops).toEqual([{ text: "", modelCalls: 0 }]);
    expect(h.complete).toHaveBeenCalledWith(expect.objectContaining({ model: "haiku", prompt: "add a login opage" }));
    expect(h.box()).toContain("Read the repo first");
    expect(h.box()).not.toContain("login opage++");
    expect(h.sent).toEqual([]);
  });
  test("Undo restores the exact original bytes", async () => {
    const original = "  login\r\n😀 é ++";
    const h = harness(original);
    await h.fire("prompt.submit", submit(original));
    await h.press("Undo");
    expect(Buffer.from(h.box())).toEqual(Buffer.from(original));
    expect(h.sent).toEqual([]);
  });
  test("Undo retains the saved bytes when another fill changes them", async () => {
    const original = "  login\r\n😀 é ++";
    const h = harness(original);
    await h.fire("prompt.submit", submit(original));
    const fill = h.$.prompt.fill;
    h.$.prompt.fill = input => fill({ ...input, text: input.text.trim() });
    await h.press("Undo");
    expect(h.toasts).toContain("Undo could not write the prompt box. Nothing was sent.");
    h.$.prompt.fill = fill;
    await h.press("Undo");
    expect(Buffer.from(h.box())).toEqual(Buffer.from(original));
    expect(h.sent).toEqual([]);
  });
  test("the normalized trigger preserves trailing bytes for Undo", async () => {
    const original = "  login++ \r\n";
    const h = harness(original);
    await h.fire("prompt.submit", submit(original));
    expect(h.complete).toHaveBeenCalledWith(expect.objectContaining({ prompt: "  login \r\n" }));
    await h.press("Undo");
    expect(Buffer.from(h.box())).toEqual(Buffer.from(original));
  });
  test("the rewrite fill notification cannot start another enhancement", async () => {
    const h = harness("login++");
    await h.fire("prompt.submit", submit(h.box()));
    await h.fire("prompt.change", { text: h.box(), cursor: h.box().length, origin: { kind: "plugin" } });
    expect(h.complete).toHaveBeenCalledTimes(1);
    await h.fire("prompt.submit", submit(h.box()));
    expect(h.sent).toHaveLength(1);
    expect(h.complete).toHaveBeenCalledTimes(1);
  });
  test("Send submits the edited box as the user's own words", async () => {
    const h = harness("login++");
    await h.fire("prompt.submit", submit(h.box()));
    h.edit("My edited login request");
    await h.press("Send");
    expect(h.sent).toEqual(["My edited login request"]);
  });
  test("a failed model call restores the original and shows a toast", async () => {
    const original = "login++";
    const h = harness(original);
    h.complete.mockRejectedValueOnce(new Error("unavailable"));
    await h.fire("prompt.submit", submit(original));
    expect(h.box()).toBe(original);
    expect(h.toasts.length).toBeGreaterThan(0);
    expect(h.sent).toEqual([]);
  });
  test("nothing reaches the conversation until the visible draft is sent", async () => {
    const h = harness("login++");
    await h.fire("prompt.submit", submit(h.box()));
    const visible = h.box();
    expect(h.displayed).toContain(visible);
    expect(h.sent).toEqual([]);
    await h.fire("prompt.submit", submit(visible));
    expect(h.sent).toEqual([visible]);
  });
});

describe("failure and race handling", () => {
  test("Enhance button rewrites an ordinary draft without sending it", async () => {
    const h = harness("login");
    await h.press("Enhance");
    expect(h.box()).toContain("Read the repo first");
    expect(h.sent).toEqual([]);
    await h.press("Undo");
    expect(h.box()).toBe("login");
  });
  test.each([false, true])("a missing or empty model answer keeps the original (%s)", async isAnswered => {
    const h = harness("login++");
    h.complete.mockResolvedValueOnce({ isAnswered, text: "" });
    await h.fire("prompt.submit", submit("login++"));
    expect(h.box()).toBe("login++");
    expect(h.toasts).toContain("Enhance failed. Kept your original prompt.");
    expect(h.sent).toEqual([]);
  });
  test("a late model answer cannot replace a user edit", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.fire("prompt.submit", submit("login++"));
    await vi.waitFor(() => expect(h.complete).toHaveBeenCalled());
    h.edit("My newer draft");
    answer({ isAnswered: true, text: "Stale rewrite" });
    await pending;
    expect(h.box()).toBe("My newer draft");
    expect(h.sent).toEqual([]);
  });
  test("Undo cancels a pending rewrite", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.fire("prompt.submit", submit("login++"));
    await vi.waitFor(() => expect(h.complete).toHaveBeenCalled());
    await h.press("Undo");
    answer({ isAnswered: true, text: "Stale rewrite" });
    await pending;
    expect(h.box()).toBe("login++");
    expect(h.sent).toEqual([]);
  });
  test("Send cannot race a pending model call", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.fire("prompt.submit", submit("login++"));
    await vi.waitFor(() => expect(h.complete).toHaveBeenCalled());
    await h.press("Send");
    expect(h.sent).toEqual([]);
    answer({ isAnswered: true, text: "Visible rewrite" });
    await pending;
  });
  test("Enter during Enhance restores one draft and sends nothing", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.fire("prompt.submit", submit("login++"));
    await vi.waitFor(() => expect(h.complete).toHaveBeenCalled());
    expect(await h.fire("prompt.submit", submit(h.box()))).toHaveProperty("drop");
    expect(h.box()).toBe("login++");
    answer({ isAnswered: true, text: "Visible rewrite" });
    await pending;
    expect(h.box()).toBe("Visible rewrite");
    expect(h.complete).toHaveBeenCalledTimes(1);
    expect(h.sent).toEqual([]);
  });
  test("prompt.change cancels a pending result without rewriting its event", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.fire("prompt.submit", submit("login++"));
    await vi.waitFor(() => expect(h.complete).toHaveBeenCalled());
    h.edit("History draft");
    const change: Events["prompt.change"] = { text: h.box(), cursor: 13, origin: { kind: "history" } };
    expect(await h.fire("prompt.change", change)).toBe(change);
    await h.press("Enhance");
    expect(h.complete).toHaveBeenCalledTimes(2);
    const current = h.box();
    answer({ isAnswered: true, text: "Stale rewrite" });
    await pending;
    expect(h.box()).toBe(current);
  });
  test("a rejected rewrite fill retains the host restored draft", async () => {
    const h = harness("login++");
    h.$.prompt.fill = async () => ({ isFilled: false });
    await h.fire("prompt.submit", submit("login++"));
    expect(h.complete).toHaveBeenCalledTimes(1);
    expect(h.box()).toBe("login++");
    expect(h.sent).toEqual([]);
    expect(h.toasts).toContain("The prompt box could not take the rewrite. Nothing was sent.");
  });
  test("a state error after host restoration holds the prompt", async () => {
    const h = harness("login++");
    h.$.state.get = async () => { throw new Error("state unavailable"); };
    expect(await h.fire("prompt.submit", submit("login++"))).toHaveProperty("drop");
    expect(h.box()).toBe("login++");
    expect(h.sent).toEqual([]);
  });
  test("ordinary prompts and prompts from plugins pass through", async () => {
    const h = harness("ordinary prompt");
    const ordinary = submit("ordinary prompt");
    await h.fire("prompt.submit", ordinary);
    await h.fire("prompt.submit", { ...submit("plugin++"), origin: { kind: "plugin" } });
    expect(h.sent).toEqual(["ordinary prompt", "plugin++"]);
    expect(h.complete).not.toHaveBeenCalled();
  });
  test("collapse keeps the draft intact and expand restores the controls", async () => {
    const h = harness("login");
    await h.press("-");
    expect(h.box()).toBe("login");
    await h.press("+");
    await h.press("Enhance");
    expect(h.complete).toHaveBeenCalledTimes(1);
  });
});

describe("submission errors", () => {
  test("a refused Send retains the visible draft for review", async () => {
    const h = harness("login++");
    await h.fire("prompt.submit", submit("login++"));
    const visible = h.box();
    h.$.prompt.submit = async () => ({ drop: "Another mod refused" });
    await h.press("Send");
    expect(h.box()).toBe(visible);
    expect(h.sent).toEqual([]);
    expect(h.toasts).toContain("The prompt was not sent. Kept the draft.");
    await h.press("Undo");
    expect(h.box()).toBe("login++");
  });
  test("state errors after next do not send the prompt twice", async () => {
    const h = harness("ordinary prompt");
    h.$.state.get = async () => { throw new Error("state unavailable"); };
    await h.fire("prompt.submit", submit("ordinary prompt"));
    expect(h.sent).toEqual(["ordinary prompt"]);
  });
});
