import type { BandState, Dollar, On } from "../src/api.js";
import { SYSTEM } from "../src/system.js";

const BAND = { plugin: "prompt-enhancer", key: "band" } as const;
const INITIAL: BandState = { visible: true, collapsed: false, busy: false, original: null };

interface Control { request: number; enhancing: boolean; sending: boolean; expectedDraft: string; held: string | null }

const read = async ($: Dollar): Promise<BandState> => (await $.state.get(BAND)).value ?? { ...INITIAL };
const patch = async ($: Dollar, fields: Partial<BandState>): Promise<void> => {
  await $.state.set(BAND, { ...await read($), ...fields });
};

const enhance = async ($: Dollar, c: Control, original: string): Promise<void> => {
  if (c.enhancing || c.sending) {
    await $.ui.toast("Wait for the current action to finish.");
    return;
  }
  const draft = original.replace(/\+\+(\s*)$/, "$1");
  if (!draft.trim()) {
    await $.ui.toast("Type a prompt before using Enhance.");
    return;
  }
  const id = ++c.request;
  c.enhancing = true;
  c.expectedDraft = original;
  try {
    await patch($, { visible: true, collapsed: false, busy: true });
    const before = await read($);
    await patch($, { original: before.original ?? original });
    const result = await $.model.complete({
      model: "haiku", system: SYSTEM, prompt: draft,
      maxTokens: 1024, effort: "low", timeoutMs: 12000,
    });
    if (id !== c.request) return;
    if (!result.isAnswered || !result.text?.trim()) {
      await $.ui.toast("Enhance failed. Kept your original prompt.");
      return;
    }
    if ((await $.prompt.read()).text !== original) {
      await $.ui.toast("The draft changed. Kept your edit.");
      return;
    }
    c.expectedDraft = result.text;
    if (!(await $.prompt.fill({ text: result.text })).isFilled) {
      await $.ui.toast("The prompt box could not take the rewrite. Nothing was sent.");
    }
  } catch {
    if (id === c.request) await $.ui.toast("Enhance failed. Kept your original prompt.");
  } finally {
    if (id === c.request) {
      c.enhancing = false;
      await patch($, { busy: false });
    }
  }
};

const undo = async ($: Dollar, c: Control): Promise<void> => {
  const state = await read($);
  if (state.original === null || c.sending) return;
  c.request += 1;
  c.enhancing = false;
  c.expectedDraft = state.original;
  if ((await $.prompt.fill({ text: state.original, mode: "replace" })).isFilled && (await $.prompt.read()).text === state.original) {
    await patch($, { original: null, busy: false });
  } else {
    await patch($, { busy: false });
    await $.ui.toast("Undo could not write the prompt box. Nothing was sent.");
  }
};

const send = async ($: Dollar, c: Control): Promise<void> => {
  if (c.enhancing || c.sending) {
    await $.ui.toast("Wait for Enhance to finish before sending.");
    return;
  }
  c.sending = true;
  try {
    const { text } = await $.prompt.read();
    if (!text.trim()) return;
    const result = await $.prompt.submit({ text, asUser: true });
    if (result.drop !== undefined) {
      await $.ui.toast("The prompt was not sent. Kept the draft.");
      return;
    }
    await patch($, { original: null });
    if ((await $.prompt.read()).text === text) await $.prompt.fill({ text: "" });
  } catch {
    await $.ui.toast("Send failed. Kept the draft.");
  } finally {
    c.sending = false;
  }
};


export const register = (on: On): void => {
  const c: Control = { request: 0, enhancing: false, sending: false, expectedDraft: "", held: null };
  on("prompt.submit", async ($, e, next) => {
    if (e.origin.kind !== "composer" || e.command || e.attachments?.length) return next(e);
    if (c.enhancing || c.sending) {
      await $.ui.toast("Wait for the current action to finish.");
      return { drop: "Prompt held for review." };
    }
    if (e.text.endsWith("++")) {
      c.held = e.text;
      return { drop: "Prompt held for review. Edit it, then use Send or Enter." };
    }
    const result = await next(e);
    if (!(result && typeof result === "object" && "drop" in result)) await patch($, { original: null });
    return result;
  }).catch(async ($, e, next) => {
    if (next.called) return next(e);
    c.request += 1;
    c.enhancing = false;
    c.held = null;
    await $.ui.toast("Prompt Enhancer failed. Nothing was sent.").catch(() => undefined);
    return { drop: "Prompt held because Prompt Enhancer failed." };
  });

  on("prompt.change", async ($, e, next) => {
    if (c.held !== null && e.origin.kind === "engine") {
      const held = c.held;
      c.held = null;
      if (e.text.trim() === held && (await $.prompt.read()).text === e.text) {
        await enhance($, c, e.text);
      }
      return next(e);
    }
    if (c.enhancing && e.text !== c.expectedDraft && e.origin.kind !== "clear") {
      c.request += 1;
      c.enhancing = false;
      await patch($, { busy: false });
    }
    return next(e);
  }).catch(async ($, e, next) => {
    c.held = null;
    c.request += 1;
    c.enhancing = false;
    await $.ui.toast("Prompt Enhancer failed. Kept the draft.").catch(() => undefined);
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const state = await read($);
    if (e.props.hasSurvey || !state.visible) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    return (
      <Box flexDirection="column">
        <Box>
          <Text>✨ Prompt Enhancer </Text>
          <Button key="collapse" label={state.collapsed ? "+" : "-"} onPress={async () => patch($, { collapsed: !(await read($)).collapsed })} />
        </Box>
        {!state.collapsed && <Box flexDirection="column">
          <Box>
            <Button key="enhance" label="Enhance" onPress={async () => { c.held = null; await enhance($, c, (await $.prompt.read()).text); }} />
            <Button key="undo" label="Undo" onPress={() => undo($, c)} />
            <Button key="send" label="Send" onPress={() => send($, c)} />
          </Box>
          <Text dimColor>Enhanced below: edit it, then Send (or Enter). Undo puts your original back.</Text>
          {state.busy && <Text dimColor>Enhancing...</Text>}
        </Box>}
      </Box>
    );
  });
};
