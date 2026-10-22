// secrets-veil: anthropic-ids.test.ts - Anthropic API ids are not secrets.
//
// Dogfood 2026-10-20: a tool_use id (toolu_01 + 22 base62 characters) shows
// in transcripts, hook logs and error text, and the entropy layer masked it
// as bullets. Measured: 890 of 1000 ids of that shape crossed 4.3 bits/char.
// These ids are public request handles, not credentials, so the entropy
// layer skips a whole token that is exactly one of them (like the SRI rule).
// The named-value and vendor-prefix layers still run on every token.
//
// Every id below is generated at runtime from a seeded PRNG: none is a real
// id and none is a real secret.

import { describe, it, expect } from "vitest";
import { buildTable, mask, wouldMask, ANTHROPIC_ID_RE, DEFAULT_PATTERNS } from "../src/mask";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function body(rng: () => number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALNUM[Math.floor(rng() * ALNUM.length)];
  return out;
}

const ENTROPY_TABLE = buildTable([], {}, [], { entropy: true });
const DEFAULT_TABLE = buildTable([], {}, DEFAULT_PATTERNS, { entropy: true });

// Prefix and body length per id kind, as they show in API responses.
const KINDS: ReadonlyArray<[string, number]> = [
  ["toolu_01", 22],
  ["srvtoolu_01", 22],
  ["msg_01", 22],
  ["req_011C", 20],
];

describe("Anthropic API ids pass the entropy layer", () => {
  for (const [prefix, len] of KINDS) {
    it(`does not mask 300 generated ${prefix}... ids`, () => {
      const rng = mulberry32(4242 + prefix.length);
      for (let i = 0; i < 300; i++) {
        const id = `${prefix}${body(rng, len)}`;
        expect(ANTHROPIC_ID_RE.test(id)).toBe(true);
        const line = `tool_use_id: ${id} (Bash) failed`;
        const result = mask(line, DEFAULT_TABLE);
        expect(result.spans.length, id).toBe(0);
        expect(result.text).toBe(line);
        expect(wouldMask(id, ENTROPY_TABLE), id).toBe(false);
      }
    });
  }

  it("does not mask an id inside JSON or after key=", () => {
    const id = `toolu_01${body(mulberry32(7), 22)}`;
    for (const line of [`{"tool_use_id":"${id}"}`, `tool_use_id=${id}`]) {
      expect(mask(line, DEFAULT_TABLE).spans.length, line).toBe(0);
    }
  });
});

describe("the exemption stays narrow", () => {
  it("still masks a random token that only borrows the prefix shape", () => {
    // wrong lead digits, too long, or a hyphen body: none is an API id
    const rng = mulberry32(99);
    const shapes = [
      `toolu_${body(rng, 30)}`,
      `toolu_01${body(rng, 40)}`,
      `msg_01${body(rng, 10)}-${body(rng, 16)}`,
    ];
    for (const s of shapes) {
      expect(ANTHROPIC_ID_RE.test(s), s).toBe(false);
    }
    // at least the long body still crosses the bar and masks
    expect(wouldMask(shapes[1], ENTROPY_TABLE)).toBe(true);
  });

  it("still masks a vendor-prefix secret next to an id", () => {
    const rng = mulberry32(11);
    const id = `toolu_01${body(rng, 22)}`;
    const secret = `sk-ant-${body(rng, 40)}`;
    const result = mask(`${id} ${secret}`, DEFAULT_TABLE);
    expect(result.text).toContain(id);
    expect(result.text).not.toContain(secret.slice(7, 23));
  });

  it("still masks an id when it is a named value", () => {
    const id = `toolu_01${body(mulberry32(12), 22)}`;
    const table = buildTable(["X_TOKEN"], { X_TOKEN: id }, [], { entropy: true });
    expect(mask(`got ${id}`, table).text).not.toContain(id);
  });
});
