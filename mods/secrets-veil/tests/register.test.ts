// secrets-veil: register.test.ts - tests that DRIVE hooks/register.ts
//
// The first cut of this file only asserted a hardcoded event list and never
// imported the module under test: reviewer-plugins-13 put garbage in
// register.ts and 30 of 30 tests still passed. These tests import register,
// capture the handlers it registers, and drive session.start and tool.call
// end to end, including the non-empty-mask test that would have caught the
// empty env-name defect (#2276 review).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  register,
  registerWithEnvNames,
  mask,
  buildTable,
  DEFAULT_PATTERNS,
} from "../hooks/register";
import { KNOWN_ENV_NAMES } from "../src/env-names";
import type { DollarAPI, OnFn } from "../src/types";

type Reg = {
  event: string;
  matcher: Record<string, unknown>;
  handler: (api: DollarAPI, event: any, next: (e: any) => Promise<any>) => Promise<any>;
};

/** Run register() against a capturing registrar and return what it registered. */
function captureRegistrations(): Reg[] {
  const regs: Reg[] = [];
  const on = ((event: string, matcher: Record<string, unknown>, handler: Reg["handler"]) => {
    regs.push({ event, matcher, handler });
  }) as unknown as OnFn;
  register(on);
  return regs;
}

function one(regs: Reg[], event: string, matcher?: Record<string, unknown>): Reg {
  const found = regs.find(
    (r) => r.event === event && (!matcher || JSON.stringify(r.matcher) === JSON.stringify(matcher))
  );
  if (!found) throw new Error(`register() never registered ${event} ${JSON.stringify(matcher ?? "")}`);
  return found;
}

/** $ mock: env.get answers from the given map, ui calls are recorded no-ops. */
function fakeApi(env: Record<string, string>): DollarAPI {
  return {
    env: { get: async (name: string) => env[name] },
    ui: { invalidate: () => undefined, log: () => undefined, notice: () => undefined },
  };
}

const passthrough = async (e: unknown) => e;

describe("register module", () => {
  it("registers exactly the brief's hook surface", () => {
    const regs = captureRegistrations();
    expect(regs.map((r) => r.event)).toEqual([
      "session.start",
      "tool.call",
      "ui.render",
      "ui.render",
      "command.register",
      "ui.press",
    ]);
    expect(regs[2].matcher).toEqual({ component: "ToolResult" });
    expect(regs[3].matcher).toEqual({ component: "CommandOutput" });
    expect(regs[4].matcher).toEqual({ command: "/veil" });
  });

  it("carries one literal $.env.get call site per known name", () => {
    // The plugin validate contract reads the literal out of each call site;
    // this test fails if a name is added to src/env-names.ts without a
    // matching literal call in register.ts (or if one is deleted).
    const source = readFileSync(
      fileURLToPath(new URL("../hooks/register.ts", import.meta.url)),
      "utf8"
    );
    for (const name of KNOWN_ENV_NAMES) {
      expect(source).toContain(`$.env.get("${name}")`);
    }
  });

  it("fails LOUD at registration when the name list is empty", () => {
    const on = (() => undefined) as unknown as OnFn;
    expect(() => registerWithEnvNames(on, [])).toThrow(/empty/);
  });

  it("masks a planted secret end to end: the mask is NON-EMPTY", () => {
    // The test that would have caught the empty env-name defect: a value
    // that is present in the environment for a KNOWN name, appearing in a
    // tool result, must come back masked.
    const secret = "Zq9wTk7Lm2Pv8Xy4"; // 16 chars, matches no shape pattern
    const name = KNOWN_ENV_NAMES[0];
    const regs = captureRegistrations();

    return (async () => {
      const sessionStart = one(regs, "session.start").handler;
      const toolCall = one(regs, "tool.call").handler;

      // session.start builds the table from $.env.get for the known names
      await sessionStart(fakeApi({ [name]: secret }), {}, passthrough);

      const out = await toolCall(
        fakeApi({}),
        { tool: "Bash", args: {}, requestId: "req-1" },
        async () => ({ text: `ran deploy with token ${secret} done` })
      );

      expect(typeof out.text).toBe("string");
      expect(out.text).not.toContain(secret);
      expect(out.text).toContain("\u2022"); // the mask is non-empty
    })();
  });

  it("leaves tool results untouched when no known secret appears", () => {
    const regs = captureRegistrations();
    return (async () => {
      const sessionStart = one(regs, "session.start").handler;
      const toolCall = one(regs, "tool.call").handler;
      await sessionStart(fakeApi({}), {}, passthrough);
      const out = await toolCall(
        fakeApi({}),
        { tool: "Bash", args: {}, requestId: "req-2" },
        async () => ({ text: "plain output, nothing secret" })
      );
      expect(out.text).toBe("plain output, nothing secret");
    })();
  });

  it("keeps the negative pin: no forbidden $ calls in the source", () => {
    const raw = readFileSync(
      fileURLToPath(new URL("../hooks/register.ts", import.meta.url)),
      "utf8"
    );
    // Strip comments first: the footprint header DOCUMENTS the negative pin
    // by naming the banned calls, and a doc line is not a call.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["process.run", "http.fetch", "store.get", "store.set", "ui.log"]) {
      expect(source).not.toContain(banned);
    }
  });
});

describe("mask table building", () => {
  it("buildTable keeps env values of 8 chars and up only", () => {
    const table = buildTable(
      ["LONG_SECRET", "SHORT"],
      { LONG_SECRET: "abcdefgh", SHORT: "tiny" },
      DEFAULT_PATTERNS
    );
    expect(table.entries.some((e) => e.type === "env" && e.name === "LONG_SECRET")).toBe(true);
    expect(table.entries.some((e) => e.type === "env" && e.name === "SHORT")).toBe(false);
  });

  it("mask() masks a known value inside a longer token", () => {
    const table = buildTable(["K"], { K: "secret123" }, []);
    const result = mask("prefix-secret123-suffix", table);
    expect(result.spans.length).toBe(1);
    expect(result.text).not.toContain("secret123");
  });
});
