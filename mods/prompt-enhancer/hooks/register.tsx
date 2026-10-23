import type { BandState, Dollar, On } from "../src/api.js";
import { SYSTEM } from "../src/system.js";

const BAND = { plugin: "prompt-enhancer", key: "band" } as const;
// Collapsed by default: one line above the prompt until there is a rewrite to
// review (Enhance expands it). The band is shared, so an idle mod stays small.
const INITIAL: BandState = { visible: true, collapsed: true, busy: false, original: null };

// One rule for every action that writes shared state after an await (Enhance,
// Undo, Send, Enter): it takes a run token in Control.current before its first
// await and writes only while it still holds that token. A run that lost its
// token (an edit, Undo, a failure) keeps going until its next check and then
// stops, so it can never clear or overwrite what a newer run owns. Before its
// fill a run can be canceled; once its fill (or send) starts it is committed:
// nothing cancels it and other actions wait or are refused.
interface Run { kind: "enhance" | "undo" | "send" | "submit"; filling: boolean; expected: string; done: Promise<void> }
// epoch moves on every state-changing action: a claim, a cancel, a user edit,
// a collapse. A continuation that holds no run token (the Enhance button and
// the ++ path read the box before they can claim; Undo waits for a run) stamps
// it before its await and does nothing if it moved. A run that holds a token
// checks the token instead, so an edit during a committed fill does not abort
// the fill (E3).
interface Control { current: Run | null; held: string | null; reviewed: string | null; writes: Promise<void>; epoch: number }

const read = async ($: Dollar): Promise<BandState> => (await $.state.get(BAND)).value ?? { ...INITIAL };
// State writes run one at a time, in the order they were asked for, so a write
// that a canceled Enhance started cannot land after the cancel's own write.
const patch = ($: Dollar, c: Control, fields: Partial<BandState> | ((state: BandState) => Partial<BandState>)): Promise<void> => {
  const run = c.writes.then(async () => {
    const state = await read($);
    await $.state.set(BAND, { ...state, ...(typeof fields === "function" ? fields(state) : fields) });
  });
  c.writes = run.catch(() => undefined);
  return run;
};

/** Takes the token. The caller checks c.current first, with no await between. */
const claim = (c: Control, kind: Run["kind"], filling: boolean, expected = "") => {
  let finish: () => void = () => undefined;
  const run: Run = { kind, filling, expected, done: new Promise<void>(resolve => { finish = resolve; }) };
  c.current = run;
  c.epoch += 1;
  const live = () => c.current === run;
  const release = () => { finish(); if (live()) c.current = null; };
  return { run, live, release };
};

const enhance = async ($: Dollar, c: Control, original: string): Promise<void> => {
  if (c.current) {
    await $.ui.toast("Wait for the current action to finish.").catch(() => undefined);
    return;
  }
  const draft = original.replace(/\+\+(\s*)$/, "$1");
  if (!draft.trim()) {
    await $.ui.toast("Type a prompt before using Enhance.").catch(() => undefined);
    return;
  }
  const { run, live, release } = claim(c, "enhance", false, original);
  // Undo goes back past an earlier Enhance only while the box still holds the
  // rewrite that Enhance filled. Any edit makes this draft the new original.
  const chained = c.reviewed !== null && original === c.reviewed;
  try {
    await patch($, c, { visible: true, collapsed: false, busy: true });
    if (!live()) return;
    const result = await $.model.complete({
      model: "haiku", system: SYSTEM, prompt: draft,
      maxTokens: 1024, effort: "low", timeoutMs: 12000,
    });
    if (!live()) return;
    if (!result.isAnswered || !result.text?.trim()) {
      await $.ui.toast("Enhance failed. Kept your original prompt.");
      return;
    }
    const box = (await $.prompt.read()).text;
    // From here Undo waits for this run instead of canceling it. The check and
    // the flag sit with no await between them, so Undo sees one or the other.
    if (!live()) return;
    if (box !== original) {
      await $.ui.toast("The draft changed. Kept your edit.");
      return;
    }
    run.filling = true;
    run.expected = result.text;
    if ((await $.prompt.fill({ text: result.text })).isFilled) {
      // The original is saved only after a fill, and only by a run that is
      // still current, so a canceled or failed run never leaves one behind.
      if (live()) {
        c.reviewed = result.text;
        await patch($, c, state => ({ original: chained && state.original !== null ? state.original : original }));
      }
    } else {
      await $.ui.toast("The prompt box could not take the rewrite. Nothing was sent.");
    }
  } catch {
    if (live()) await $.ui.toast("Enhance failed. Kept your original prompt.").catch(() => undefined);
  } finally {
    const owned = live();
    release();
    // enhance can run detached from prompt.change, so a failed state write must not reject.
    if (owned) await patch($, c, { busy: false }).catch(() => undefined);
  }
};

/**
 * Drops `run`, and only `run`: never whatever happens to be current when an
 * error arrives, so a late failure of an older action cannot cancel a newer
 * one. A committed run (its fill or send has started) is never dropped.
 */
const cancel = (c: Control, run: Run | null | undefined): boolean => {
  if (!run || c.current !== run || run.filling) return false;
  c.current = null;
  c.epoch += 1;
  return true;
};

// The run each hook invocation saw when it started, keyed by its event, so its
// .catch handler cleans up after that run and no other.
const seen = new WeakMap<object, Run | null>();

const undo = async ($: Dollar, c: Control): Promise<void> => {
  const active = c.current;
  if (active && active.kind !== "enhance") return;
  if (active && !active.filling) {
    // Nothing filled yet: Undo cancels Enhance and keeps the box.
    cancel(c, active);
    await patch($, c, { busy: false }).catch(() => undefined);
    return;
  }
  // A fill is under way: let that run finish, then undo from settled state.
  const stamp = c.epoch;
  if (active) await active.done;
  if (c.current || c.epoch !== stamp) return;
  const { run, live, release } = claim(c, "undo", false);
  try {
    await c.writes;
    if (!live()) return;
    const state = await read($);
    if (!live() || state.original === null) return;
    run.filling = true;
    run.expected = state.original;
    c.reviewed = null;
    const restored = (await $.prompt.fill({ text: state.original, mode: "replace" })).isFilled && (await $.prompt.read()).text === state.original;
    if (!live()) return;
    if (restored) {
      await patch($, c, { original: null, busy: false });
    } else {
      await patch($, c, { busy: false });
      await $.ui.toast("Undo could not write the prompt box. Nothing was sent.");
    }
  } catch {
    if (live()) await $.ui.toast("Undo failed. Kept the box.").catch(() => undefined);
  } finally {
    release();
  }
};

const send = async ($: Dollar, c: Control): Promise<void> => {
  if (c.current) {
    await $.ui.toast("Wait for Enhance to finish before sending.");
    return;
  }
  // Send is cancelable (a user edit wins) until its submit starts; the check and
  // the flag sit with no await between them, like an Enhance fill.
  const { run, live, release } = claim(c, "send", false);
  try {
    const { text } = await $.prompt.read();
    if (!text.trim() || !live()) return;
    run.filling = true;
    const result = await $.prompt.submit({ text, asUser: true });
    if (!live()) return;
    if (result.drop !== undefined) {
      await $.ui.toast("The prompt was not sent. Kept the draft.");
      return;
    }
    await patch($, c, { original: null });
    if (live() && (await $.prompt.read()).text === text) await $.prompt.fill({ text: "" });
  } catch {
    await $.ui.toast("Send failed. Kept the draft.").catch(() => undefined);
  } finally {
    release();
  }
};


export const register = (on: On): void => {
  const c: Control = { current: null, held: null, reviewed: null, writes: Promise.resolve(), epoch: 0 };
  on("prompt.submit", async ($, e, next) => {
    seen.set(e, c.current);
    if (e.origin.kind !== "composer" || e.command || e.attachments?.length) return next(e);
    if (c.current) {
      await $.ui.toast("Wait for the current action to finish.");
      return { drop: "Prompt held for review." };
    }
    // A rewrite the person reviewed is sent as is, even when it ends in ++ (C++).
    // The host trims the submit, so compare trimmed.
    const reviewed = c.reviewed !== null && e.text === c.reviewed.trim();
    c.reviewed = null;
    if (e.text.endsWith("++") && !reviewed) {
      c.held = e.text;
      return { drop: "Prompt held for review. Edit it, then use Send or Enter." };
    }
    // The send is committed from here: it holds the token across next(e), so a
    // newer action cannot start and then lose its original to this clear.
    const { live, release } = claim(c, "submit", true);
    try {
      const result = await next(e);
      if (live() && !(result && typeof result === "object" && "drop" in result)) await patch($, c, { original: null });
      return result;
    } finally {
      release();
    }
  }).catch(async ($, e, next) => {
    if (next.called) return next(e);
    c.held = null;
    // Only the run this event saw is canceled; busy is cleared only when that
    // cancel happened, so a newer run keeps its own busy state.
    if (cancel(c, seen.get(e))) await patch($, c, { busy: false }).catch(() => undefined);
    await $.ui.toast("Prompt Enhancer failed. Nothing was sent.").catch(() => undefined);
    return { drop: "Prompt held because Prompt Enhancer failed." };
  });

  on("prompt.change", async ($, e, next) => {
    seen.set(e, c.current);
    // A user edit is the newest action: anything still waiting to claim is stale.
    if (e.origin.kind === "input") c.epoch += 1;
    if (c.held !== null && e.origin.kind === "engine") {
      const held = c.held;
      c.held = null;
      const stamp = c.epoch;
      if (e.text.trim() === held && (await $.prompt.read()).text === e.text && c.epoch === stamp) {
        // The host holds every later prompt.change raise until this handler returns,
        // so the model call runs detached. enhance catches its own failures.
        void enhance($, c, e.text);
      }
      return next(e);
    }
    const run = c.current;
    // Once the fill has started it is committed: the rewrite lands either way,
    // so an edit then does not cancel, and Undo can still reach the draft.
    if (run && !run.filling && e.text !== run.expected && e.origin.kind !== "clear") {
      // The person edited before the fill: this run will not save an original.
      cancel(c, run);
      await patch($, c, { busy: false });
    }
    return next(e);
  }).catch(async ($, e, next) => {
    c.held = null;
    // Only the run this event saw is canceled, and only then is busy cleared.
    // The edit path above may have canceled it already; it then cleared busy
    // itself or its write failed, so clear busy when no run owns it.
    const run = seen.get(e);
    if (cancel(c, run) || (run && !c.current)) await patch($, c, { busy: false }).catch(() => undefined);
    await $.ui.toast("Prompt Enhancer failed. Kept the draft.").catch(() => undefined);
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const state = await read($);
    if (e.props.hasSurvey || !state.visible) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    // The band is shared: what the mods below this one draw stays on screen.
    const below = await next(e);
    const enhanceButton = (
      <Button key="enhance" label="Enhance" hotkey="e" onPress={async () => {
        c.held = null;
        const stamp = c.epoch;
        const text = (await $.prompt.read()).text;
        if (c.epoch === stamp) await enhance($, c, text);
      }} />
    );
    const toggle = <Button key="collapse" label={state.collapsed ? "+" : "-"} onPress={() => { c.epoch += 1; return patch($, c, state => ({ collapsed: !state.collapsed })); }} />;
    const undoButton = <Button key="undo" label="Undo" hotkey="u" onPress={() => undo($, c)} />;
    const sendButton = <Button key="send" label="Send" hotkey="s" onPress={() => send($, c)} />;
    // Collapsed is one line with every action on it; only the review help waits.
    const mine = state.collapsed
      ? (
        <Box>
          <Text>✨ Prompt Enhancer </Text>
          {enhanceButton}
          {undoButton}
          {sendButton}
          {toggle}
          <Text dimColor> ctrl+x tab: e u s</Text>
          {state.busy && <Text dimColor> Enhancing...</Text>}
        </Box>
      )
      : (
        <Box flexDirection="column">
          <Box>
            <Text>✨ Prompt Enhancer </Text>
            {toggle}
          </Box>
          <Box>
            {enhanceButton}
            {undoButton}
            {sendButton}
          </Box>
          {state.original !== null && <Text dimColor>Enhanced below: edit it, then Send (or Enter). Undo puts your original back.</Text>}
          {/* A click reaches a Button only where the terminal reports clicks
              (fullscreen); the keyboard path works everywhere. */}
          {state.original !== null && <Text dimColor>Keys: ctrl+x tab, then e Enhance, u Undo, s Send. Esc goes back to the prompt.</Text>}
          {state.busy && <Text dimColor>Enhancing...</Text>}
        </Box>
      );
    return <Box flexDirection="column">{mine}{below}</Box>;
  });
};
