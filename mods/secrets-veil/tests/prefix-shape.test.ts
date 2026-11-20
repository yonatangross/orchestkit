// secrets-veil: prefix-shape.test.ts
//
// A bare vendor prefix masked every word that merely CONTAINED it. The
// 1Password service-account prefix sits inside every hq-ops MCP tool name
// (mcp__hq-<prefix>_...), so the veil masked those names and the tools never
// resolved in a seat that loads it (estate outage, 2026-11-03). The Stripe
// live prefix sat inside ordinary identifiers such as a risk_live_status
// column. A shaped prefix now matches only a real token: not preceded by an
// identifier character and followed by a long body.
//
// Every token-shaped value here is built at runtime from split parts; the
// repo secret scan refuses literal token shapes.

import { describe, it, expect } from "vitest";
import { buildTable, mask, wouldMask, DEFAULT_PATTERNS } from "../src/mask";

const table = buildTable([], {}, DEFAULT_PATTERNS, { entropy: true });
const shapesOnly = buildTable([], {}, DEFAULT_PATTERNS);

const SA = "op" + "s_";
const STRIPE = "sk" + "_live_";

/** Deterministic body over an alphabet (mulberry32), never a literal. */
function body(seed: number, alphabet: string, n: number): string {
  let a = seed >>> 0;
  let out = "";
  for (let i = 0; i < n; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out += alphabet[Math.floor(r * alphabet.length)];
  }
  return out;
}

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A service-account token shape: prefix plus a long base64url body (JWT-like head). */
const saToken = SA + "eyJ" + body(0x5a1, B64URL, 120);

const HQ_OPS = "mcp__hq-" + "ops" + "__";
const toolNames = [
  HQ_OPS + "observability_recent_traces",
  HQ_OPS + "uptime_status_all",
  HQ_OPS + "costs_run_detection",
  HQ_OPS + "slack_send",
];

describe("service-account prefix matches only a real token shape", () => {
  it("(a) masks a real-shaped service-account token", () => {
    for (const t of [table, shapesOnly]) {
      const out = mask(saToken, t);
      expect(out.text).not.toContain(saToken.slice(0, 12));
      expect(out.spans).toHaveLength(1);
      expect(out.spans[0]).toMatchObject({ start: 0, end: saToken.length });
      expect(wouldMask(saToken, t)).toBe(true);
    }
  });

  it("(b) leaves hq-ops MCP tool names unmasked", () => {
    for (const name of toolNames) {
      for (const t of [table, shapesOnly]) {
        const out = mask(name, t);
        expect(out.text).toBe(name);
        expect(out.spans).toHaveLength(0);
        expect(wouldMask(name, t)).toBe(false);
      }
    }
  });

  it("(b) leaves a tool list and ordinary identifiers holding the prefix unmasked", () => {
    const text = [
      "tools: " + toolNames.join(", "),
      "table hq_" + "ops_tasks and hq_" + "ops_marketing_pin",
      "const devops_" + "pipeline = loops_" + "count + props_" + "list;",
    ].join("\n");
    const out = mask(text, table);
    expect(out.text).toBe(text);
    expect(out.spans).toHaveLength(0);
  });

  it("(c) masks the token inside surrounding text and keeps the text", () => {
    const cases = [
      { pre: "export OP_SERVICE_ACCOUNT_TOKEN=", post: "\nnext line" },
      { pre: '{"token":"', post: '"}' },
      { pre: "token: ", post: " (rotated)" },
      { pre: "", post: "" },
    ];
    for (const { pre, post } of cases) {
      const text = pre + saToken + post;
      const out = mask(text, table);
      expect(out.text).not.toContain(saToken.slice(0, 12));
      expect(out.text.startsWith(pre)).toBe(true);
      expect(out.spans.some((s) => s.start === pre.length)).toBe(true);
      // the tail after the token survives when whitespace separates it
      if (post.startsWith("\n") || post.startsWith(" ")) {
        expect(out.text.endsWith(post)).toBe(true);
      }
    }
  });

  it("(c) masks the token on a line that also lists hq-ops tool names", () => {
    const text = toolNames[0] + " " + saToken + " " + toolNames[1];
    const out = mask(text, table);
    expect(out.text).toBe(toolNames[0] + " " + "•".repeat(8) + " " + toolNames[1]);
  });

  // HOLD 6603957379: in escaped text the character before a token is a
  // letter ("\n", "\t", "%3D"); a left-context lookbehind leaked these.
  // One test per escape, so each leak row is pinned red on its own (a loop
  // stops at its first failing row and hid the other two).
  it.each([
    ["literal \\n", '"line one' + "\\" + "n" + saToken + "\\" + 'n"'],
    ["literal \\t", "col" + "\\" + "t" + saToken],
    ["%3D", "token%3" + "D" + saToken],
  ])("masks the token right after %s (HOLD 6603957379)", (_escape, text) => {
    const out = mask(text, shapesOnly);
    expect(out.text).not.toContain(saToken.slice(0, 12));
    expect(out.spans).toHaveLength(1);
  });

  it("leaves an identifier that starts with the prefix unmasked", () => {
    const ident = SA + "status_summary_for_dashboard";
    expect(mask("see " + ident + " here", table).spans).toHaveLength(0);
  });

  it("does not mask the prefix with a short body", () => {
    const short = SA + body(0x5a2, B64URL, 12);
    expect(mask("see " + short + " here", shapesOnly).spans).toHaveLength(0);
  });
});

describe("Stripe live prefix matches only a real key shape", () => {
  it("masks a real-shaped live key, alone and inside text", () => {
    const key = STRIPE + body(0x5a3, ALNUM, 24);
    expect(mask(key, shapesOnly).spans).toHaveLength(1);
    const out = mask("STRIPE_KEY=" + key + " ok", shapesOnly);
    expect(out.text).toBe("STRIPE_KEY=" + "•".repeat(8) + " ok");
  });

  it("masks a live key right after a literal \\n (HOLD 6603957379)", () => {
    const key = STRIPE + body(0x5a4, ALNUM, 30);
    const out = mask('"first' + "\\" + "n" + key + '"', shapesOnly);
    expect(out.text).not.toContain(key.slice(0, 14));
    expect(out.spans).toHaveLength(1);
  });

  it("leaves identifiers that contain the prefix unmasked", () => {
    const text = "the ri" + STRIPE + "status column, di" + STRIPE + "backup nightly";
    const out = mask(text, table);
    expect(out.text).toBe(text);
    expect(out.spans).toHaveLength(0);
  });
});
