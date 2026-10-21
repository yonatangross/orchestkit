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
  let submitHold: Promise<void> | null = null;
  let failChange = false;
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
    const next = Object.assign(async (e: Events[K]) => {
      if (next.called) return settled;
      next.called = true;
      if (name === "prompt.change" && failChange) { failChange = false; throw new Error("downstream prompt.change failed"); }
      if (name === "prompt.submit" && submitHold) { const hold = submitHold; submitHold = null; await hold; }
      settled = e;
      if (name === "prompt.submit") sent.push((e as Events["prompt.submit"]).text);
      return e;
    }, { called: false });
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
      await settle();
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
  return {
    $, fire, press, settle, sent, displayed, toasts, drops, complete, box: () => box, edit: (text: string) => { box = text; },
    holdSubmit: (hold: Promise<void>) => { submitHold = hold; },
    failNextChange: () => { failChange = true; },
  };
}
// One macrotask lets detached mod work (the Enhance model call) run to completion
// when the fake model answers at once, as the host's event loop would.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
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
  test("Enter sends a reviewed rewrite that ends in ++, with no second model call", async () => {
    const h = harness("Fix the parser in C++++");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "Fix the parser in C++" });
    await h.fire("prompt.submit", submit(h.box()));
    expect(h.box()).toBe("Fix the parser in C++");
    await h.fire("prompt.submit", submit(h.box()));
    expect(h.complete).toHaveBeenCalledTimes(1);
    expect(h.sent).toEqual(["Fix the parser in C++"]);
  });
  test("a failed Enhance leaves no original behind: Undo after the next Enhance keeps the newer draft", async () => {
    const h = harness("draft one");
    h.complete.mockResolvedValueOnce({ isAnswered: false, text: "" });
    await h.press("Enhance");
    expect(h.box()).toBe("draft one");
    h.edit("draft two");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "Rewrite of draft two" });
    await h.press("Enhance");
    expect(h.box()).toBe("Rewrite of draft two");
    await h.press("Undo");
    expect(h.box()).toBe("draft two");
  });
  test("an edit during Enhance leaves no original behind: Undo keeps the edit", async () => {
    const h = harness("draft");
    let answer: (value: { isAnswered: boolean; text: string }) => void = () => undefined;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const pending = h.press("Enhance");
    await h.settle();
    h.edit("mine");
    await h.fire("prompt.change", { text: "mine", cursor: 4, origin: { kind: "input" } });
    answer({ isAnswered: true, text: "Rewrite" });
    await pending;
    await h.settle();
    expect(h.box()).toBe("mine");
    await h.press("Undo");
    expect(h.box()).toBe("mine");
  });
  for (const held of [1, 2]) {
    test(`an edit while state write ${held} of Enhance is pending leaves no stale original`, async () => {
      const h = harness("draft one");
      const realSet = h.$.state.set;
      let calls = 0;
      let release: () => void = () => undefined;
      h.$.state.set = async (...args: Parameters<typeof realSet>) => {
        calls += 1;
        if (calls === held) await new Promise<void>(resolve => { release = resolve; });
        return realSet(...args);
      };
      h.complete.mockImplementation(async ({ prompt }) => ({ isAnswered: true, text: `Rewrite of ${prompt}` }));
      const pending = h.press("Enhance");
      await h.settle();
      h.edit("draft two");
      const changing = h.fire("prompt.change", { text: "draft two", cursor: 9, origin: { kind: "input" } });
      await h.settle();
      release();
      await changing;
      await pending;
      await h.settle();
      expect(h.box()).toBe("draft two");
      // Held at write 1, the canceled Enhance stops before the model call.
      expect(h.complete).toHaveBeenCalledTimes(held === 1 ? 0 : 1);
      await h.press("Enhance");
      expect(h.box()).toBe("Rewrite of draft two");
      await h.press("Undo");
      expect(h.box()).toBe("draft two");
    });
  }
  test("Undo pressed while the original save is pending still restores the draft", async () => {
    const h = harness("draft one");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "Rewrite of draft one" });
    const realSet = h.$.state.set;
    let calls = 0;
    let release: () => void = () => undefined;
    h.$.state.set = async (...args: Parameters<typeof realSet>) => {
      calls += 1;
      if (calls === 2) await new Promise<void>(resolve => { release = resolve; });
      return realSet(...args);
    };
    const enhancing = h.press("Enhance");
    await h.settle();
    expect(h.box()).toBe("Rewrite of draft one");
    const undoing = h.press("Undo");
    await h.settle();
    release();
    await enhancing;
    await undoing;
    await h.settle();
    expect(h.box()).toBe("draft one");
  });
  test("Undo during the model call cancels Enhance and keeps the draft", async () => {
    const h = harness("draft");
    let answer: (value: { isAnswered: boolean; text: string }) => void = () => undefined;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const enhancing = h.press("Enhance");
    await h.settle();
    await h.press("Undo");
    answer({ isAnswered: true, text: "Late rewrite" });
    await enhancing;
    await h.settle();
    expect(h.box()).toBe("draft");
    expect((await h.$.state.get({ plugin: "prompt-enhancer", key: "band" })).value?.busy).toBe(false);
  });
  test("a canceled Enhance leaves the band not busy", async () => {
    const h = harness("draft");
    const realSet = h.$.state.set;
    let release: () => void = () => undefined;
    let first = true;
    h.$.state.set = async (...args: Parameters<typeof realSet>) => {
      if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
      return realSet(...args);
    };
    const pending = h.press("Enhance");
    await h.settle();
    h.edit("mine");
    const changing = h.fire("prompt.change", { text: "mine", cursor: 4, origin: { kind: "input" } });
    await h.settle();
    release();
    await changing;
    await pending;
    await h.settle();
    expect((await h.$.state.get({ plugin: "prompt-enhancer", key: "band" })).value?.busy).toBe(false);
  });
  test("an edited rewrite starts a new chain: Undo after its Enhance gives the edit", async () => {
    const h = harness("draft");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "R1" });
    await h.press("Enhance");
    h.edit("R1 with my change");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "R2" });
    await h.press("Enhance");
    await h.press("Undo");
    expect(h.box()).toBe("R1 with my change");
  });
  test("a failed second Enhance keeps the first original for Undo", async () => {
    const h = harness("draft");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "R1" });
    await h.press("Enhance");
    h.complete.mockResolvedValueOnce({ isAnswered: false, text: "" });
    await h.press("Enhance");
    expect(h.box()).toBe("R1");
    await h.press("Undo");
    expect(h.box()).toBe("draft");
  });
  test("Send passes a typed prompt that ends in ++ as is", async () => {
    const h = harness("what changed in C++");
    await h.press("Send");
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.sent).toEqual(["what changed in C++"]);
  });
  test("an edited rewrite that ends in ++ is a new trigger", async () => {
    const h = harness("login++");
    h.complete.mockResolvedValueOnce({ isAnswered: true, text: "Add a login page." });
    await h.fire("prompt.submit", submit(h.box()));
    h.edit("Add a login page with SSO++");
    await h.fire("prompt.submit", submit(h.box()));
    expect(h.complete).toHaveBeenCalledTimes(2);
    expect(h.complete).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: "Add a login page with SSO" }));
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
    await h.settle();
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
    await h.settle();
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
    await h.settle();
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
    await h.settle();
    expect(h.box()).toBe("Visible rewrite");
    expect(h.complete).toHaveBeenCalledTimes(1);
    expect(h.sent).toEqual([]);
  });
  test("the host restore notification settles before the model answers", async () => {
    const h = harness("login++");
    let answer!: (value: { isAnswered: boolean; text: string }) => void;
    h.complete.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    const held = Symbol("held");
    const settled = await Promise.race([
      h.fire("prompt.submit", submit("login++")),
      new Promise(resolve => setTimeout(resolve, 50, held)),
    ]);
    expect(settled).not.toBe(held);
    expect(h.complete).toHaveBeenCalledTimes(1);
    answer({ isAnswered: true, text: "Visible rewrite" });
    await vi.waitFor(() => expect(h.box()).toBe("Visible rewrite"));
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
    await h.settle();
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

// Golden corpus: every place an Undo, an edit (which cancels) or a second
// Enhance can land inside one Enhance, with the end state each must leave.
// Enhance A runs on "draft one" (rewrite RA), Enhance B on "draft two" (RB).
// Phases of an Enhance: W1 busy write, model call, the box check read after
// the reply, fill, W2 original save, W3 busy-off write.
//
//  row  where the action lands          action            end state
//  U0   W1 pending                      Undo              box draft one, no model call
//  U1   model pending                   Undo              box draft one, late reply ignored
//  U2   box check after the reply       Undo              box draft one, no fill
//  U3   fill pending                    Undo              waits, box draft one
//  U4   W2 pending                      Undo              waits, box draft one
//  U5   W3 pending                      Undo              box draft one
//  U6   A done                          Undo, Undo        box draft one, second is a no-op
//  E0   W1 pending                      edit, B, Undo     box draft two, model called once (B)
//  E1   model pending                   edit, B, Undo     box draft two, late reply ignored
//  E2   box check after the reply       edit, B, Undo     box draft two
//  E3   fill pending                    edit, Undo        fill is committed: box RA, Undo gives draft one
//  E4   W2 pending                      edit, Undo        box draft one (Undo goes back past the edit)
//  E6   A done                          edit, B, Undo     box is the edit
//  X1   A late reply during B's fill    Undo during fill  waits for B, box draft two
//  X2   A late reply during B's model   Undo              cancels B, box draft two
//  X3   A late reply after B is done    Undo              box draft two
//  Y1   Undo's state read pending       edit, B           edit cancels Undo, B runs: box RB, Undo gives draft two
//  Y2   Undo's fill pending             edit, B           Undo is committed, B is refused: box draft one
//  Z1   prompt.change hook throws       (during A)        catch cancels A and the band is not busy
//  Z2   prompt.submit hook throws       (during A)        catch cancels A and the band is not busy
// Every row also ends with the band not busy.
//
// Ownership table (45 rows, one per await in hooks/register.tsx; line numbers
// as of 4f98e9e8; round 8 corrected L120, L213 and L252, the three rows whose
// await comes before their claim). Columns: line, action, what the normal continuation
// writes and its guard, where a rejection goes and what it may touch, rows.
// Guards: E = epoch stamp taken before a pre-claim await, checked after it;
// Q = the write queue keeps order; L = writes only while live(); C =
// the run is committed (filling); S = no shared write follows; T = a catch
// acts only on the run its own event saw (seen), never on c.current.
//  L17  read helper  state.get      S; reject -> caller                         R-F
//  L22  patch queue  read           set below, Q; reject -> run rejects, queue   R-F
//                                   continues (c.writes swallows)
//  L23  patch queue  state.set      Q; reject -> caller of patch                 Z1 R-A
//  L41  enhance      busy toast     S (no token taken); caught                   W4
//  L46  enhance      empty toast    S (no token taken); caught                   typed tests
//  L54  enhance      W1 busy        L; reject -> catch (L toast) -> finally      U0 E0 R-F
//  L56  enhance      model          L; reject -> catch -> finally                U1 E1 X1 X2
//  L62  enhance      fail toast     L in finally; reject -> catch -> finally     R-E
//  L65  enhance      box read       L; reject -> catch -> finally                U2 E2
//  L70  enhance      changed toast  L in finally; reject -> catch -> finally     R-B E2
//  L75  enhance      fill           C, L before save; reject -> catch -> finally U3 E3 W1 W2
//  L80  enhance      W2 original    Q L; reject -> catch -> finally              U4 E4
//  L83  enhance      refused toast  L in finally; reject -> catch -> finally     rejected-fill test
//  L86  enhance      catch toast    L; swallowed                                 R-E
//  L91  enhance      finally busy   only if it owned the token; swallowed        U5 Z1
//  L116 undo         cancel busy    cancels only `active`; swallowed             U1
//  L120 undo         await done     pre-claim: E (epoch stamp) and no current     U3 U4
//                                   before the claim, so a claim meanwhile stops it
//  L124 undo         c.writes       L; reject n/a (swallowed queue)              U4
//  L126 undo         state read     L; reject -> undo catch (L toast) -> release Y1 R-C
//  L131 undo         fill           C, L before writes; reject -> catch, release Y2 W3 R-C
//  L131 undo         box read       C, L before writes; reject -> catch, release R-C
//  L134 undo         clear original L; reject -> catch -> release                U6
//  L136 undo         busy (failed)  L; reject -> catch -> release                undo-saved-bytes test
//  L137 undo         failed toast   L; reject -> catch -> release                undo-saved-bytes R-C
//  L140 undo         catch toast    L; swallowed                                 R-C
//  L148 send         busy toast     S (no token taken); propagates to button     W4
//  L153 send         box read       C; reject -> send catch (toast) -> release   R-D
//  L155 send         submit         C, L after; reject -> catch -> release       R-D W4
//  L158 send         dropped toast  C; reject -> catch -> release                R-D
//  L161 send         clear original C Q; reject -> catch -> release              W4
//  L162 send         box read       C L; reject -> catch -> release              W4
//  L162 send         clear box      C L; reject -> catch -> release              W4
//  L164 send         catch toast    swallowed                                    R-D
//  L177 submit       busy toast     no token taken; reject -> .catch: T cancels  Z2 R-B
//                                   only the run it saw, busy only if it did
//  L192 submit       next(e)        C, L after; reject -> finally release ->     W5
//                                   .catch returns next(e), no cancel
//  L193 submit       clear original C L; reject -> finally -> .catch, no cancel  R-G
//  L203 submit .catch busy          T; swallowed                                 Z2
//  L204 submit .catch toast         swallowed                                    Z2
//  L213 change       box read (++)  pre-claim: E, a claim during the read (Undo) P3 typed ++ tests
//                                   makes the stamp stale and no Enhance starts;
//                                   reject -> .catch: T (nothing seen) no cancel
//  L226 change       cancel busy    cancels only the run it saw; reject ->       E1 R-A
//                                   .catch: T, busy only if no run owns it
//  L235 change .catch busy          T; swallowed                                 Z1 R-A
//  L236 change .catch toast         swallowed                                    Z1
//  L241 render       state read     S (draw only)                                all press tests
//  L252 button       box read       pre-claim: E, a claim during the read stops  P1 P2 E0
//                                   the press before enhance() is called
//  L252 button       enhance        enhance owns its own errors                  E0
// Round 9 (one rule): (a) every state-changing action bumps c.epoch: claim()
// for Enhance, Undo, Send and Enter; cancel() (Undo's cancel branch, an edit,
// a hook failure); a user edit (prompt.change, origin input); collapse.
// (b) every continuation checks after each await: a run holding a token checks
// live() (the token; so an edit during a committed fill does not abort it), and
// a continuation holding no token (L120, L213, L252) checks its epoch stamp.
// Send is cancelable until its submit starts, like an Enhance until its fill.
// Q1 and the seeded property test (300 seeds) pin it; both fail on 5188aaed.
// Rule: each action that writes after an await (Enhance, Undo, Send, Enter)
// takes a run token before its first await and writes only while it holds it;
// an entry path that must await before claiming stamps c.epoch first and stops
// if any claim happened meanwhile; cancel(c, run) drops only that run and never
// a committed one; every catch cleans up only after the run its own event saw.
describe("interleavings golden corpus", () => {
  type Gate = { promise: Promise<void>; open: () => void };
  const gate = (): Gate => { let open = () => undefined as void; const promise = new Promise<void>(resolve => { open = resolve; }); return { promise, open }; };
  const RA = "Rewrite of draft one";

  function rig(initial: string, holds: { set?: number[]; fill?: number[]; readAfterReply?: boolean; model?: "held" | "auto" } = {}) {
    const h = harness(initial);
    const gates = { set: new Map<number, Gate>(), fill: new Map<number, Gate>(), read: gate(), get: gate(), model: [] as Gate[] };
    // holdGet(skip): hold the state read that comes after `skip` more reads.
    let getArm = -1;
    const realGet = h.$.state.get;
    h.$.state.get = async (...args: Parameters<typeof realGet>) => {
      if (getArm === 0) { getArm = -1; await gates.get.promise; }
      else if (getArm > 0) getArm -= 1;
      return realGet(...args);
    };
    const holdGet = (skip: number) => { getArm = skip; };
    for (const n of holds.set ?? []) gates.set.set(n, gate());
    for (const n of holds.fill ?? []) gates.fill.set(n, gate());
    let sets = 0, fills = 0, replies = 0, readHeld = !holds.readAfterReply;
    const realSet = h.$.state.set, realFill = h.$.prompt.fill, realRead = h.$.prompt.read;
    h.$.state.set = async (...args: Parameters<typeof realSet>) => { sets += 1; await gates.set.get(sets)?.promise; return realSet(...args); };
    h.$.prompt.fill = async (...args: Parameters<typeof realFill>) => { fills += 1; await gates.fill.get(fills)?.promise; return realFill(...args); };
    let readArm = false;
    const entry = gate();
    h.$.prompt.read = async () => {
      if (readArm) { readArm = false; await entry.promise; }
      else if (!readHeld && replies > 0) { readHeld = true; await gates.read.promise; }
      return realRead();
    };
    // holdNextRead(): hold the next prompt.read (an Enhance entry path's first await).
    const holdNextRead = () => { readArm = true; return entry; };
    h.complete.mockImplementation(async ({ prompt }) => {
      const g = gate();
      gates.model.push(g);
      if (holds.model !== "held") g.open();
      await g.promise;
      replies += 1;
      return { isAnswered: true, text: `Rewrite of ${prompt}` };
    });
    const edit = (text: string) => { h.edit(text); return h.fire("prompt.change", { text, cursor: text.length, origin: { kind: "input" } }); };
    const band = async () => (await h.$.state.get({ plugin: "prompt-enhancer", key: "band" })).value;
    return { h, gates, edit, band, holdGet, holdNextRead };
  }
  async function ends(r: ReturnType<typeof rig>, box: string) {
    await r.h.settle();
    expect(r.h.box()).toBe(box);
    // An unwritten band is the initial state, which is not busy.
    expect((await r.band())?.busy ?? false).toBe(false);
  }

  test("U0 Undo while W1 is pending cancels before the model call", async () => {
    const r = rig("draft one", { set: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const u = r.h.press("Undo"); await r.h.settle();
    r.gates.set.get(1)!.open(); await a; await u;
    expect(r.h.complete).not.toHaveBeenCalled();
    await ends(r, "draft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("U1 Undo while the model is pending ignores the late reply", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.h.press("Undo");
    r.gates.model[0].open(); await a;
    await ends(r, "draft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("U2 Undo during the box check after the reply stops the fill", async () => {
    const r = rig("draft one", { readAfterReply: true });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.h.press("Undo");
    r.gates.read.open(); await a;
    await ends(r, "draft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("U3 Undo while the fill is pending waits, then restores", async () => {
    const r = rig("draft one", { fill: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const u = r.h.press("Undo"); await r.h.settle();
    r.gates.fill.get(1)!.open(); await a; await u;
    await ends(r, "draft one");
  });
  test("U4 Undo while the original save is pending waits, then restores", async () => {
    const r = rig("draft one", { set: [2] });
    const a = r.h.press("Enhance"); await r.h.settle();
    expect(r.h.box()).toBe(RA);
    const u = r.h.press("Undo"); await r.h.settle();
    r.gates.set.get(2)!.open(); await a; await u;
    await ends(r, "draft one");
  });
  test("U5 Undo while the busy-off write is pending restores", async () => {
    const r = rig("draft one", { set: [3] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const u = r.h.press("Undo"); await r.h.settle();
    r.gates.set.get(3)!.open(); await a; await u;
    await ends(r, "draft one");
  });
  test("U6 Undo after Enhance restores, a second Undo is a no-op", async () => {
    const r = rig("draft one");
    await r.h.press("Enhance");
    await r.h.press("Undo");
    await r.h.press("Undo");
    await ends(r, "draft one");
  });
  test("E0 an edit while W1 is pending, then B and Undo, gives the edit", async () => {
    const r = rig("draft one", { set: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const e = r.edit("draft two"); await r.h.settle();
    r.gates.set.get(1)!.open(); await e; await a;
    await r.h.press("Enhance");
    expect(r.h.complete).toHaveBeenCalledTimes(1);
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("E1 an edit while the model is pending, then B and Undo, gives the edit", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    r.gates.model[0].open(); await a; await r.h.settle();
    expect(r.h.box()).toBe("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    r.gates.model[1].open(); await b;
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("E2 an edit during the box check, then B and Undo, gives the edit", async () => {
    const r = rig("draft one", { readAfterReply: true });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    r.gates.read.open(); await a;
    expect(r.h.box()).toBe("draft two");
    await r.h.press("Enhance");
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("E3 an edit while the fill is pending does not cancel it: Undo gives draft one", async () => {
    const r = rig("draft one", { fill: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    r.gates.fill.get(1)!.open(); await a;
    await ends(r, RA);
    await r.h.press("Undo");
    await ends(r, "draft one");
  });
  test("E4 an edit while the original save is pending, then Undo, goes back to draft one", async () => {
    const r = rig("draft one", { set: [2] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const e = r.edit(`${RA} edited`); await r.h.settle();
    r.gates.set.get(2)!.open(); await e; await a;
    await r.h.press("Undo");
    await ends(r, "draft one");
  });
  test("E6 an edit after A, then B and Undo, gives the edit", async () => {
    const r = rig("draft one");
    await r.h.press("Enhance");
    await r.edit(`${RA} edited`);
    await r.h.press("Enhance");
    await r.h.press("Undo");
    await ends(r, `${RA} edited`);
  });
  test("X1 A's late reply during B's fill does not clear B: Undo waits for B", async () => {
    const r = rig("draft one", { model: "held", fill: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    r.gates.model[1].open(); await r.h.settle();
    r.gates.model[0].open(); await a; await r.h.settle();
    const u = r.h.press("Undo"); await r.h.settle();
    r.gates.fill.get(1)!.open(); await b; await u;
    await ends(r, "draft two");
  });
  test("X2 A's late reply during B's model call does not clear B: Undo cancels B", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    r.gates.model[0].open(); await a; await r.h.settle();
    await r.h.press("Undo");
    r.gates.model[1].open(); await b;
    await ends(r, "draft two");
    expect((await r.band())?.original).toBeNull();
  });
  test("X3 A's late reply after B is done changes nothing: Undo gives draft two", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.edit("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    r.gates.model[1].open(); await b;
    r.gates.model[0].open(); await a; await r.h.settle();
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("Y1 an edit while Undo's state read is pending cancels Undo; B runs and stays", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    r.gates.model[0].open(); await a; await r.h.settle();
    expect(r.h.box()).toBe(RA);
    r.holdGet(1);
    const u = r.h.press("Undo"); await r.h.settle();
    await r.edit("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    r.gates.get.open(); await u; await r.h.settle();
    r.gates.model[1].open(); await b;
    await ends(r, "Rewrite of draft two");
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("Y2 an Enhance while Undo's fill is pending is refused; Undo completes", async () => {
    const r = rig("draft one", { fill: [2] });
    await r.h.press("Enhance");
    expect(r.h.box()).toBe(RA);
    const u = r.h.press("Undo"); await r.h.settle();
    await r.edit("draft two");
    await r.h.press("Enhance");
    expect(r.h.toasts).toContain("Wait for the current action to finish.");
    r.gates.fill.get(2)!.open(); await u;
    expect(r.h.complete).toHaveBeenCalledTimes(1);
    await ends(r, "draft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("Z1 a prompt.change hook that throws cancels Enhance and clears busy", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    const realSet = r.h.$.state.set;
    let threw = false;
    r.h.$.state.set = async (...args: Parameters<typeof realSet>) => {
      if (!threw) { threw = true; throw new Error("state unavailable"); }
      return realSet(...args);
    };
    await r.edit("draft two");
    r.gates.model[0].open(); await a;
    await ends(r, "draft two");
  });
  test("Z2 a prompt.submit hook that throws cancels Enhance and clears busy", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    const realToast = r.h.$.ui.toast;
    let threw = false;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (!threw) { threw = true; throw new Error("toast unavailable"); }
      return realToast(...args);
    };
    await r.h.fire("prompt.submit", submit("draft one"));
    r.gates.model[0].open(); await a;
    await ends(r, "draft one");
  });
  test("W1 a submit hook failure during Enhance's fill keeps the committed result", async () => {
    const r = rig("draft one", { fill: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    const realToast = r.h.$.ui.toast;
    let threw = false;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (!threw) { threw = true; throw new Error("toast unavailable"); }
      return realToast(...args);
    };
    await r.h.fire("prompt.submit", submit("draft one"));
    r.gates.fill.get(1)!.open(); await a;
    await ends(r, RA);
    await r.h.press("Undo");
    await ends(r, "draft one");
  });
  test("W2 a change hook failure during Enhance's fill keeps the committed result", async () => {
    const r = rig("draft one", { fill: [1] });
    const a = r.h.press("Enhance"); await r.h.settle();
    r.h.failNextChange();
    await r.edit("typing");
    r.gates.fill.get(1)!.open(); await a;
    await ends(r, RA);
    await r.h.press("Undo");
    await ends(r, "draft one");
  });
  test("W3 a hook failure during Undo's fill keeps Undo; a new Enhance is refused", async () => {
    const r = rig("draft one", { fill: [2] });
    await r.h.press("Enhance");
    const u = r.h.press("Undo"); await r.h.settle();
    const realToast = r.h.$.ui.toast;
    let threw = false;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (!threw) { threw = true; throw new Error("toast unavailable"); }
      return realToast(...args);
    };
    await r.h.fire("prompt.submit", submit(RA));
    await r.h.press("Enhance");
    r.gates.fill.get(2)!.open(); await u;
    expect(r.h.complete).toHaveBeenCalledTimes(1);
    await ends(r, "draft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("W4 an Enhance during Send is refused (guard)", async () => {
    const r = rig("ready to send");
    const g = gate();
    const realSubmit = r.h.$.prompt.submit;
    r.h.$.prompt.submit = async (...args: Parameters<typeof realSubmit>) => { await g.promise; return realSubmit(...args); };
    const s = r.h.press("Send"); await r.h.settle();
    await r.h.press("Enhance");
    g.open(); await s;
    expect(r.h.complete).not.toHaveBeenCalled();
    expect(r.h.sent).toEqual(["ready to send"]);
  });
  test("W5 an older Enter that resumes after a newer Enhance does not clear its original", async () => {
    const r = rig("send old draft");
    const g = gate();
    r.h.holdSubmit(g.promise);
    const s = r.h.fire("prompt.submit", submit("send old draft")); await r.h.settle();
    await r.edit("draft two");
    await r.h.press("Enhance");
    g.open(); await s; await r.h.settle();
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  test("W6 two quick collapse presses toggle twice", async () => {
    const r = rig("draft");
    await Promise.all([r.h.press("-"), r.h.press("-")]);
    await r.h.settle();
    expect((await r.band())?.collapsed).toBe(false);
  });
  // Error twins (round 7): each await's rejection path acts only on its own token.
  test("R-A an older change write that rejects late does not cancel a newer Enhance", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    // The edit's busy:false write (state write 2) is held, then rejects on release.
    const realSet = r.h.$.state.set;
    const old = gate();
    let calls = 1;
    r.h.$.state.set = async (...args: Parameters<typeof realSet>) => {
      calls += 1;
      if (calls === 2) { await old.promise; throw new Error("old write rejected"); }
      return realSet(...args);
    };
    const e = r.edit("draft two"); await r.h.settle();
    const b = r.h.press("Enhance"); await r.h.settle();
    old.open(); await e; await r.h.settle();
    r.gates.model[0].open(); await a; await r.h.settle();
    expect(r.gates.model).toHaveLength(2);
    r.gates.model[1].open(); await b;
    await ends(r, "Rewrite of draft two");
    await r.h.press("Undo");
    await ends(r, "draft two");
  });
  // R-B is a guard: a dropped composer submit makes the host put the text back,
  // and that box change itself cancels an Enhance that has not filled yet, so
  // the submit-catch race cannot be isolated end to end. R-A pins the shared
  // event-scoped rule; this row pins the outcome: B started, nothing left busy.
  test("R-B an older submit whose toast rejects late leaves no stale state (guard)", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    const toastGate = gate();
    const realToast = r.h.$.ui.toast;
    let first = true;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (first) { first = false; await toastGate.promise; throw new Error("toast rejected late"); }
      return realToast(...args);
    };
    const s = r.h.fire("prompt.submit", submit("draft one")); await r.h.settle();
    await r.edit("draft two");
    const b = r.h.press("Enhance"); await r.h.settle();
    toastGate.open(); await s; await r.h.settle();
    r.gates.model[0].open(); await a;
    expect(r.gates.model).toHaveLength(2);
    r.gates.model[1].open(); await b;
    await ends(r, "draft two\ndraft one");
    expect((await r.band())?.original).toBeNull();
  });
  test("R-C an Undo whose fill fails says so and frees the token", async () => {
    const r = rig("draft one");
    await r.h.press("Enhance");
    const realFill = r.h.$.prompt.fill;
    let fail = true;
    r.h.$.prompt.fill = async (...args: Parameters<typeof realFill>) => {
      if (fail) { fail = false; throw new Error("fill failed"); }
      return realFill(...args);
    };
    await r.h.press("Undo");
    expect(r.h.toasts).toContain("Undo failed. Kept the box.");
    await r.edit("draft two");
    await r.h.press("Enhance");
    await ends(r, "Rewrite of draft two");
  });
  test("R-D Send whose submit and toast both fail frees the token without throwing", async () => {
    const r = rig("ready");
    r.h.$.prompt.submit = async () => { throw new Error("submit failed"); };
    const realToast = r.h.$.ui.toast;
    let fail = true;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (fail) { fail = false; throw new Error("toast failed"); }
      return realToast(...args);
    };
    await r.h.press("Send");
    await r.h.press("Enhance");
    await ends(r, "Rewrite of ready");
  });
  test("R-E an Enhance whose failure toast rejects still frees the token and clears busy (guard)", async () => {
    const r = rig("draft one");
    r.h.complete.mockImplementationOnce(async () => ({ isAnswered: false, text: "" }));
    const realToast = r.h.$.ui.toast;
    let fail = true;
    r.h.$.ui.toast = async (...args: Parameters<typeof realToast>) => {
      if (fail) { fail = false; throw new Error("toast failed"); }
      return realToast(...args);
    };
    await r.h.press("Enhance");
    await ends(r, "draft one");
    await r.h.press("Enhance");
    await ends(r, RA);
  });
  test("R-F a state read that fails inside the write queue does not poison it (guard)", async () => {
    const r = rig("draft one");
    const realGet = r.h.$.state.get;
    let fail = true;
    r.h.$.state.get = async (...args: Parameters<typeof realGet>) => {
      if (fail) { fail = false; throw new Error("state read failed"); }
      return realGet(...args);
    };
    await r.h.press("Enhance").catch(() => undefined);
    await r.h.press("Enhance");
    await ends(r, RA);
  });
  test("R-G an Enter whose original clear fails frees the token (guard)", async () => {
    const r = rig("sent text");
    const realSet = r.h.$.state.set;
    let fail = true;
    r.h.$.state.set = async (...args: Parameters<typeof realSet>) => {
      if (fail) { fail = false; throw new Error("clear failed"); }
      return realSet(...args);
    };
    await r.h.fire("prompt.submit", submit("sent text"));
    expect(r.h.sent).toEqual(["sent text"]);
    r.h.edit("next draft");
    await r.h.press("Enhance");
    await ends(r, "Rewrite of next draft");
  });
  // Pre-claim entry reads (round 8): the button and the ++ path read the box
  // before any token exists; an action that claims meanwhile makes them stale.
  test("P1 Undo during the Enhance button's first read cancels that Enhance", async () => {
    const r = rig("draft one");
    const read = r.holdNextRead();
    const a = r.h.press("Enhance"); await r.h.settle();
    await r.h.press("Undo");
    read.open(); await a;
    expect(r.h.complete).not.toHaveBeenCalled();
    await ends(r, "draft one");
  });
  test("P2 after a reviewed rewrite, Undo during the next Enhance's first read wins", async () => {
    const r = rig("draft one");
    await r.h.press("Enhance");
    expect(r.h.box()).toBe(RA);
    const read = r.holdNextRead();
    const b = r.h.press("Enhance"); await r.h.settle();
    await r.h.press("Undo");
    expect(r.h.box()).toBe("draft one");
    read.open(); await b;
    expect(r.h.complete).toHaveBeenCalledTimes(1);
    await ends(r, "draft one");
  });
  test("P3 Undo during the ++ restore read cancels the triggered Enhance", async () => {
    const r = rig("draft one++");
    const read = r.holdNextRead();
    const s = r.h.fire("prompt.submit", submit("draft one++")); await r.h.settle();
    await r.h.press("Undo");
    read.open(); await s; await r.h.settle();
    expect(r.h.complete).not.toHaveBeenCalled();
    await ends(r, "draft one++");
  });
  test("Q1 Undo that cancels Enhance A also cancels Enhance B waiting on its first read", async () => {
    const r = rig("draft one", { model: "held" });
    const a = r.h.press("Enhance"); await r.h.settle();
    const read = r.holdNextRead();
    const b = r.h.press("Enhance"); await r.h.settle();
    await r.h.press("Undo");
    read.open(); await r.h.settle();
    for (const g of r.gates.model) g.open();
    await r.h.settle();
    for (const g of r.gates.model) g.open();
    await b; await a; await r.h.settle();
    expect(r.h.complete).toHaveBeenCalledTimes(1);
    await ends(r, "draft one");
  });
});

// Generated interleavings (round 9). Seeded, so a failure replays exactly.
// Random sequences of Enhance, edit, Undo and Send, with random holds on the
// box reads and the model replies, end with a user edit to "final"; then all
// holds are released in random order. Invariant: the last user action wins,
// so the box is "final" and the band is not busy. Fills are never held: a
// committed fill landing after an edit is the decided E3 behaviour.
describe("interleavings property", () => {
  const prng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  test("the last user action wins over every stale continuation (300 seeds)", async () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const rand = prng(seed);
      const h = harness("start");
      const held: Array<() => void> = [];
      const hold = async () => { if (rand() < 0.5) await new Promise<void>(resolve => { held.push(resolve); }); };
      const realRead = h.$.prompt.read;
      h.$.prompt.read = async () => { await hold(); return realRead(); };
      h.complete.mockImplementation(async ({ prompt }) => { await hold(); return { isAnswered: true, text: `Rewrite of ${prompt}` }; });
      const pending: Promise<unknown>[] = [];
      const steps: string[] = [];
      const n = 1 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const pick = rand();
        if (pick < 0.4) { steps.push("E"); pending.push(h.press("Enhance")); }
        else if (pick < 0.65) { const t = `edit ${i}`; steps.push(`T(${t})`); h.edit(t); pending.push(h.fire("prompt.change", { text: t, cursor: t.length, origin: { kind: "input" } })); }
        else if (pick < 0.9) { steps.push("U"); pending.push(h.press("Undo")); }
        else { steps.push("S"); pending.push(h.press("Send")); }
        await h.settle();
      }
      steps.push("T(final)");
      h.edit("final");
      pending.push(h.fire("prompt.change", { text: "final", cursor: 5, origin: { kind: "input" } }));
      await h.settle();
      for (let guard = 0; guard < 200 && held.length > 0; guard++) {
        const [open] = held.splice(Math.floor(rand() * held.length), 1);
        open();
        await h.settle();
      }
      await Promise.allSettled(pending);
      await h.settle();
      const band = (await h.$.state.get({ plugin: "prompt-enhancer", key: "band" })).value;
      if (h.box() !== "final" || (band?.busy ?? false)) failures.push(`seed ${seed} [${steps.join(" ")}] box=${JSON.stringify(h.box())} busy=${band?.busy}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });
});

// Dogfood 2026-10-20: in the default (non-fullscreen) terminal, Claude Code
// asks for no mouse reporting, so a click on the band never reached a Button.
// The keyboard path is ctrl+x tab, then a hotkey (or Tab and Enter); the band
// must give each action a hotkey and say how to reach it.
describe("band keyboard access", () => {
  async function band() {
    const h = harness("draft");
    const tree = await h.fire("ui.render", { component: "AbovePrompt", props: { hasSurvey: false, isWorking: false } });
    const buttons: Record<string, unknown>[] = [];
    const texts: string[] = [];
    function walk(value: unknown): void {
      if (typeof value === "string") { texts.push(value); return; }
      if (!value || typeof value !== "object") return;
      const node = value as Node;
      if (node.tag === "Button") buttons.push(node.props ?? {});
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
    return { buttons, text: texts.join("") };
  }

  test("Enhance, Undo and Send carry the hotkeys e, u and s", async () => {
    const { buttons } = await band();
    const keys = Object.fromEntries(buttons.map(b => [b.label, b.hotkey]));
    expect(keys).toMatchObject({ Enhance: "e", Undo: "u", Send: "s" });
  });

  test("every hotkey is one lowercase letter or digit and none clash", async () => {
    const { buttons } = await band();
    const keys = buttons.map(b => b.hotkey).filter(k => k !== undefined);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]$/);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("the band says how to reach the buttons from the keyboard", async () => {
    const { text } = await band();
    expect(text).toContain("ctrl+x tab");
    expect(text).toMatch(/\be\b.*\bu\b.*\bs\b/);
  });
});
