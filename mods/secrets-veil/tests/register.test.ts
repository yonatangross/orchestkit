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

function makeFake$(env: Record<string, string> = {}): {
  $: unknown;
  notices: string[];
} {
  const notices: string[] = [];
  const $ = {
    env: {
      get: async (name: string): Promise<string | undefined> => env[name],
    },
    ui: {
      notice: async (id: string, message: string): Promise<void> => {
        notices.push(`${id}: ${message}`);
      },
    },
  };
  return { $, notices };
}

function captureHooks(): Map<string, RegisteredHook> {
  const hooks = new Map<string, RegisteredHook>();
  register((event: string, hook: unknown) => {
    hooks.set(event, hook as RegisteredHook);
  }, {});
  return hooks;
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
});

describe("named masking", () => {
  test("a: masks a synthetic secret named by a vendor variable in result text", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
      await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

    expect(notices.length).toBe(1);
    expect(notices[0]).toMatch(/patterns and entropy/);
  });

  test("d: emits no notice when at least one named value resolves", async () => {
    const hooks = captureHooks();
    const { $, notices } = makeFake$({ GITHUB_TOKEN: SYNTHETIC });
    await hooks.get("session.start")!($);

    expect(notices.length).toBe(0);
  });

  test("still masks shapes and entropy when the named list is empty", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await hooks.get("session.start")!($);

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
  const LONG_PATH = "/Users/yonatangross/coding/yonatangross/orchestkit/src/hooks/src/session";

  test("e: masks a high-entropy token", async () => {
    const hooks = captureHooks();
    const { $ } = makeFake$({});
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);

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
    await hooks.get("session.start")!($);
    expect(notices.length).toBe(0);

    const out = await hooks.get("tool.call")!(
      $,
      { tool: "Bash", args: {} },
      asNext({ result: `value ${SYNTHETIC} end` })
    );
    expect(resultText(out)).not.toContain(SYNTHETIC);
  });
});
