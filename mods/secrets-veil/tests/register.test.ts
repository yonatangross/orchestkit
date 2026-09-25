/**
 * Unit tests for the shipped hooks module (hooks/register.ts).
 *
 * Drives the real register(on, options) export with a captured on() and a
 * fake $ facade, then invokes the registered hooks directly. Synthetic
 * secret values are built here (the VEIL_TEST_ prefix marks non-vendor
 * variable names); no real value is ever used.
 */

import { describe, test, expect } from "vitest";
import { register } from "../hooks/register.js";

/** The 21 vendor variable names the mod reads, one literal call site each. */
const ALL_VENDOR_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "MISTRAL_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "HF_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "GITLAB_TOKEN",
  "NPM_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "SLACK_BOT_TOKEN",
  "VERCEL_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "OP_SERVICE_ACCOUNT_TOKEN",
] as const;

type RegisteredHook = (...args: unknown[]) => unknown;

/** Synthetic value: no DEFAULT_PATTERNS prefix, entropy 3.69 bits/char (below 4.3),
 *  so masking it proves the named-value path, not the shape or entropy paths. */
const SYNTHETIC = "veiltest-synthetic-value-42";

interface CopyOptions {
  /** When set, $.ui.ask exists and answers with this label. */
  askAnswer?: string;
  /** What $.ui.copy reports; defaults to copied. */
  copyResult?: { isCopied: boolean; reason?: string };
}

function makeFake$(env: Record<string, string> = {}, copyOptions: CopyOptions = {}): {
  $: unknown;
  notices: string[];
  toasts: string[];
  statuses: string[];
  logs: string[];
  asks: string[];
  copies: string[];
} {
  const asks: string[] = [];
  const copies: string[] = [];
  const notices: string[] = [];
  const toasts: string[] = [];
  const statuses: string[] = [];
  const logs: string[] = [];
  const $ = {
    env: {
      get: async (name: string): Promise<string | undefined> => env[name],
    },
    ui: {
      notice: async (id: string, message: string): Promise<void> => {
        notices.push(`${id}: ${message}`);
      },
      toast: async (text: string): Promise<void> => {
        toasts.push(text);
      },
      status: async (line: string): Promise<void> => {
        statuses.push(line);
      },
      log: async (text: string): Promise<void> => {
        logs.push(text);
      },
      ...(copyOptions.askAnswer === undefined
        ? {}
        : {
            ask: async (question: string): Promise<string> => {
              asks.push(question);
              return copyOptions.askAnswer as string;
            },
            copy: async (spec: { text: string }): Promise<{ isCopied: boolean; reason?: string }> => {
              copies.push(spec.text);
              return copyOptions.copyResult ?? { isCopied: true };
            },
          }),
    },
  };
  return { $, notices, toasts, statuses, logs, asks, copies };
}

function captureHooks(): Map<string, RegisteredHook> {
  const hooks = new Map<string, RegisteredHook>();
  register((event: string, hook: unknown) => {
    hooks.set(event, hook as RegisteredHook);
  }, {});
  return hooks;
}

/** The session.start event CC 2.1.282 passes; the hook hands it to next(e). */
const SESSION_EVENT = { cwd: "/tmp/veil-test" };

/** Sentinel next(e) answer, so a test can prove the hook returned it. */
const SESSION_NEXT_ANSWER = { answered: "session.start" };

/**
 * Run session.start the way CC 2.1.282 does: ($, e, next). Asserts the hook
 * forwarded the same event to next exactly once and returned next's answer.
 */
async function startSession(hooks: Map<string, RegisteredHook>, $: unknown): Promise<void> {
  const seen: unknown[] = [];
  const next = async (ev: unknown): Promise<unknown> => {
    seen.push(ev);
    return SESSION_NEXT_ANSWER;
  };
  const answer = await hooks.get("session.start")!($, SESSION_EVENT, next);
  expect(seen).toEqual([SESSION_EVENT]);
  expect(answer).toBe(SESSION_NEXT_ANSWER);
}

function asNext<E>(result: unknown): (ev: E) => Promise<unknown> {
  return async () => result;
}

function resultText(result: unknown): string {
  return (result as { result?: string }).result ?? "";
}

describe("registration", () => {
  test("registers only session.start and tool.call (no reveal surface)", () => {
    const hooks = captureHooks();
    expect([...hooks.keys()].sort()).toEqual(["session.start", "tool.call"]);
  });

  test("session.start answers with next(e) (CC 2.1.282 skips a hook that returns nothing)", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);
  });

  test("tool.call runs the tool via next(e) with the same event before masking", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await startSession(hooks, $);

    const event = { tool: "Bash", args: { command: "echo" }, tool_use_id: "toolu_veiltest" };
    const seen: unknown[] = [];
    const out = await hooks.get("tool.call")!($, event, async (ev: unknown) => {
      seen.push(ev);
      return { result: `ran ${SYNTHETIC}` };
    });
    expect(seen).toEqual([event]);
    expect(resultText(out)).not.toContain(SYNTHETIC);
  });
});

describe("named masking", () => {
  test("a: masks a synthetic secret named by a vendor variable in result text", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `cloned with ${SYNTHETIC} ok` })
    );
    expect(resultText(out)).not.toContain(SYNTHETIC);
    expect(resultText(out)).toContain("\u2022".repeat(8));
  });

  test("b: masks the same secret inside a structured result (result.stdout)", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await startSession(hooks, $);

    const out = (await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: { stdout: `deploy printed ${SYNTHETIC} to the log`, exitCode: 0 } })
    )) as { result?: { stdout?: string; exitCode?: number } };
    expect(out.result?.stdout).not.toContain(SYNTHETIC);
    expect(out.result?.stdout).toContain("\u2022".repeat(8));
    expect(out.result?.exitCode).toBe(0);
  });

  test("c: masks each of the 21 vendor names' values (table-driven)", async () => {
    for (const name of ALL_VENDOR_NAMES) {
      const hooks = captureHooks();
      const value = `veiltest-${name.toLowerCase()}-42`;
      const { $ } = makeFake$({ [name]: value });
      await startSession(hooks, $);

      const out = await hooks.get("tool.call")!(
        $,
        { tool: "Bash", args: {} },
        asNext({ result: `echo ${value}` })
      );
      expect(resultText(out), `value of ${name} must be masked`).not.toContain(value);
    }
  });

  test("f: does not mask a named value shorter than 8 characters", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ GITHUB_TOKEN: "short" });
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: "token short ok" })
    );
    expect(resultText(out)).toBe("token short ok");
  });
});

describe("empty named list", () => {
  test("d: emits exactly one notice when no named value resolves", async () => {
    const hooks = captureHooks();
    const { $, notices } = makeFake$({});
    await startSession(hooks, $);

    expect(notices.length).toBe(1);
    expect(notices[0]).toMatch(/patterns and entropy/);
  });

  test("d: emits no notice when at least one named value resolves", async () => {
    const hooks = captureHooks();
    const { $, notices } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await startSession(hooks, $);

    expect(notices.length).toBe(0);
  });

  test("still masks shapes and entropy when the named list is empty", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: "key: sk-ant-api1234567890abcd" })
    );
    expect(resultText(out)).not.toContain("sk-ant-api1234567890abcd");
  });
});

describe("entropy masking through the shipped register", () => {
  // 32 distinct characters, entropy exactly log2(32) = 5.0 bits/char
  const HI_ENTROPY = "aB3dE6fG9hI2jK5lM8nO1pQ4rS7tU0vW";
  const GIT_SHA = "0e5b3f2a1c9d8e7b6a5f4c3d2e1f0a9b8c7d6e5f";
  const SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  const UUID = "550e8400-e29b-41d4-a716-446655440000";
  const LONG_PATH = "/Users/me/coding/yonatangross/orchestkit/src/hooks/src/session";

  test("e: masks a high-entropy token", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `token ${HI_ENTROPY} end` })
    );
    expect(resultText(out)).not.toContain(HI_ENTROPY);
  });

  test("e: keeps a 40-char hex git sha readable", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `HEAD is at ${GIT_SHA} now` })
    );
    expect(resultText(out)).toBe(`HEAD is at ${GIT_SHA} now`);
  });

  test("e: keeps a 64-char hex hash readable", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `integrity ${SHA256} ok` })
    );
    expect(resultText(out)).toBe(`integrity ${SHA256} ok`);
  });

  test("e: keeps a UUID readable", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `request ${UUID} done` })
    );
    expect(resultText(out)).toBe(`request ${UUID} done`);
  });

  test("e: keeps a long file path readable", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `wrote ${LONG_PATH}/index.ts` })
    );
    expect(resultText(out)).toBe(`wrote ${LONG_PATH}/index.ts`);
  });
});

describe("rejected reads", () => {
  test("a rejected env read counts as absent, not as a session failure", async () => {
    const hooks = captureHooks();
    const notices: string[] = [];
    const $ = {
      env: {
        get: async (name: string): Promise<string | undefined> => {
          if (name === "GITHUB_TOKEN") return SYNTHETIC;
          throw new Error(`read refused for ${name}`);
        },
      },
      ui: {
        notice: async (id: string, message: string): Promise<void> => {
          notices.push(`${id}: ${message}`);
        },
      },
    };
    await startSession(hooks, $);
    expect(notices.length).toBe(0);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `value ${SYNTHETIC} end` })
    );
    expect(resultText(out)).not.toContain(SYNTHETIC);
  });
});

describe("visible proof: toast, status and byte counts", () => {
  // A fake GitHub token shape, assembled at runtime so no token-shaped
  // literal sits in the source: the ghp_ prefix plus 36 filler characters.
  const FAKE_GH = "gh" + "p_" + "Zq8Lm3Rt7Vx2Kp9Nw4Hy6Bc1Df5Gj0Sa8Ue3";
  const BULLET_BYTES = 3; // U+2022 is 3 bytes in UTF-8

  test("a masked value fires one toast with the count and UTF-8 byte counts", async () => {
    const hooks = captureHooks();
    const { $, toasts, statuses, logs } = makeFake$({});
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: { stdout: `FAKE_TOKEN=${FAKE_GH}\n` } })
    );
    expect(JSON.stringify(out)).not.toContain(FAKE_GH);
    expect(FAKE_GH.length).toBe(40);
    expect(toasts).toEqual([
      `masked 1 value in Bash, 40 bytes in, ${8 * BULLET_BYTES} bytes out`,
    ]);
    expect(statuses).toEqual(["1 masked this session"]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("40 bytes in, 24 bytes out");
    expect(logs[0]).toMatch(/result \d+ bytes before, \d+ bytes after/);
    // No UI line ever carries the value itself.
    for (const line of [...toasts, ...statuses, ...logs]) {
      expect(line).not.toContain(FAKE_GH);
    }
  });

  test("two values in one result count as 2 and the session total accumulates", async () => {
    const hooks = captureHooks();
    const { $, toasts, statuses } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await startSession(hooks, $);

    await hooks.get("tool.call")!(
      $,
      { tool: "Read", args: {} },
      asNext({ result: `a ${SYNTHETIC} b ${FAKE_GH}` })
    );
    await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext({ result: `again ${SYNTHETIC}` }));

    const synBytes = new TextEncoder().encode(SYNTHETIC).length;
    expect(toasts[0]).toBe(
      `masked 2 values in Read, ${synBytes + 40} bytes in, ${16 * BULLET_BYTES} bytes out`
    );
    expect(statuses).toEqual(["2 masked this session", "3 masked this session"]);
  });

  test("one value repeated in stdout and text (the live Bash shape) counts once", async () => {
    const hooks = captureHooks();
    const { $, toasts, statuses } = makeFake$({});
    await startSession(hooks, $);

    const line = `FAKE_TOKEN=${FAKE_GH}\n`;
    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: { stdout: line, stderr: "" }, text: line })
    );
    expect(JSON.stringify(out)).not.toContain(FAKE_GH);
    expect(toasts).toEqual([`masked 1 value in Bash, 40 bytes in, ${8 * BULLET_BYTES} bytes out`]);
    expect(statuses).toEqual(["1 masked this session"]);
  });

  test("nothing masked fires no toast, no status and no log", async () => {
    const hooks = captureHooks();
    const { $, toasts, statuses, logs } = makeFake$({});
    await startSession(hooks, $);

    await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext({ result: "plain output" }));
    expect(toasts).toEqual([]);
    expect(statuses).toEqual([]);
    expect(logs).toEqual([]);
  });

  test("a refused toast never unmasks the result", async () => {
    const hooks = captureHooks();
    const $ = {
      env: { get: async (): Promise<string | undefined> => undefined },
      ui: {
        notice: async (): Promise<void> => {},
        toast: async (): Promise<void> => {
          throw new Error("toast refused");
        },
        status: async (): Promise<void> => {
          throw new Error("status refused");
        },
        log: async (): Promise<void> => {
          throw new Error("log refused");
        },
      },
    };
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext({ result: `x ${FAKE_GH}` }));
    expect(resultText(out)).not.toContain(FAKE_GH);
    expect(resultText(out)).toContain("•".repeat(8));
  });
});

describe("opt-in copy offer: the value goes to the clipboard, never to the model", () => {
  const FAKE_GH = "gh" + "p_" + "Zq8Lm3Rt7Vx2Kp9Nw4Hy6Bc1Df5Gj0Sa8Ue3";
  const RESULT = { result: { stdout: `FAKE_TOKEN=${FAKE_GH}\n` } };

  test("Copy to clipboard hands the raw value to $.ui.copy and the model still reads dots", async () => {
    const hooks = captureHooks();
    const { $, asks, copies, toasts, statuses, logs } = makeFake$(
      { SECRETS_VEIL_OFFER_COPY: "1" },
      { askAnswer: "Copy to clipboard" }
    );
    await startSession(hooks, $);

    const out = await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext(RESULT));

    expect(copies).toEqual([FAKE_GH]);
    expect(asks).toHaveLength(1);
    // The model-visible result stays masked: no raw value, bullets present.
    expect(JSON.stringify(out)).not.toContain(FAKE_GH);
    expect(JSON.stringify(out)).toContain("\u2022".repeat(8));
    // Nothing the terminal or the log shows carries the value either.
    for (const line of [...asks, ...toasts, ...statuses, ...logs]) {
      expect(line).not.toContain(FAKE_GH);
    }
    expect(toasts).toContain("copied 40 characters to your clipboard; Claude still sees dots");
  });

  test("Keep hidden copies nothing", async () => {
    const hooks = captureHooks();
    const { $, asks, copies } = makeFake$({ SECRETS_VEIL_OFFER_COPY: "1" }, { askAnswer: "Keep hidden" });
    await startSession(hooks, $);
    const out = await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext(RESULT));
    expect(asks).toHaveLength(1);
    expect(copies).toEqual([]);
    expect(JSON.stringify(out)).not.toContain(FAKE_GH);
  });

  test("without SECRETS_VEIL_OFFER_COPY=1 there is no dialog and no copy", async () => {
    const hooks = captureHooks();
    const { $, asks, copies } = makeFake$({}, { askAnswer: "Copy to clipboard" });
    await startSession(hooks, $);
    await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext(RESULT));
    expect(asks).toEqual([]);
    expect(copies).toEqual([]);
  });

  test("a failed copy says so and still never leaks the value", async () => {
    const hooks = captureHooks();
    const { $, copies, toasts } = makeFake$(
      { SECRETS_VEIL_OFFER_COPY: "1" },
      { askAnswer: "Copy to clipboard", copyResult: { isCopied: false, reason: "no-clipboard" } }
    );
    await startSession(hooks, $);
    const out = await hooks.get("tool.call")!($, { tool: "Bash", args: {} }, asNext(RESULT));
    expect(copies).toEqual([FAKE_GH]);
    expect(toasts).toContain("nothing copied (no-clipboard); the value stays covered");
    expect(JSON.stringify(out)).not.toContain(FAKE_GH);
  });
});
