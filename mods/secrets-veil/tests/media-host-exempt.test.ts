// secrets-veil: media-host-exempt.test.ts (#5134).
//
// An https image URL on a named media host is readable. Everything near that
// shape keeps masking: signed URLs, other hosts, other schemes, other file
// types. The exemption covers the entropy layer only, so a named value inside
// such a URL still masks. Paths are generated here, never real ones.

import { describe, it, expect } from "vitest";
import { buildTable, mask, shannonEntropy, MEDIA_HOSTS } from "../src/mask";

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

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const ALPHABET = LOWER + LOWER.toUpperCase() + "0123456789";

function randomSegment(seed: number): string {
  for (let s = seed; ; s++) {
    const rng = mulberry32(s);
    let out = "";
    for (let i = 0; i < 40; i++) out += ALPHABET[Math.floor(rng() * ALPHABET.length)];
    if (shannonEntropy(out) >= 4.7) return out;
  }
}

const SEG = randomSegment(5134);
const QUERY = randomSegment(9000);
const HOST = MEDIA_HOSTS[0];
const table = buildTable([], {}, [], { entropy: true });

describe("media host list", () => {
  it("names exact hosts only", () => {
    expect(MEDIA_HOSTS.length).toBeGreaterThan(0);
    for (const h of MEDIA_HOSTS) expect(h).toMatch(/^[a-z0-9.-]+$/);
  });
});

describe("exempt: https image URL on a named host", () => {
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
    it(`.${ext}`, () => {
      const url = `https://${HOST}/${SEG}.${ext}`;
      expect(mask(url, table).text).toBe(url);
    });
  }

  it("a folder path before the file", () => {
    const url = `https://${HOST}/${SEG}/result_min.webp`;
    expect(mask(url, table).text).toBe(url);
  });

  for (const [open, close] of [["see ", " now"], ['"', '"'], ["(", ")"], ["", "\n"], ["Saved to ", "."]]) {
    it(`inside text ending ${JSON.stringify(close)}`, () => {
      const line = `${open}https://${HOST}/${SEG}.png${close}`;
      expect(mask(line, table).text).toBe(line);
    });
  }
});

describe("still masked", () => {
  const cases: Array<[string, string]> = [
    ["signed query", `https://${HOST}/${SEG}.png?Signature=${QUERY}`],
    ["empty query", `https://${HOST}/${SEG}.png?`],
    ["fragment", `https://${HOST}/${SEG}.png#x`],
    ["other cloudfront host", `https://d1example2host.cloudfront.net/${SEG}.png`],
    ["http scheme", `http://${HOST}/${SEG}.png`],
    ["host as a prefix of another domain", `https://${HOST}.example.com/${SEG}.png`],
    ["host in the path of another domain", `https://example.com/${HOST}/${SEG}.png`],
    ["upper-case host", `https://${HOST.toUpperCase()}/${SEG}.png`],
    ["not an image", `https://${HOST}/${SEG}.json`],
    ["no extension", `https://${HOST}/${SEG}`],
    ["image extension then more", `https://${HOST}/${SEG}.png.exe`],
    ["image extension as a folder", `https://${HOST}/${SEG}.png/next`],
    ["bare value", SEG],
  ];
  for (const [name, input] of cases) {
    it(name, () => {
      const out = mask(input, table);
      expect(out.spans.length).toBeGreaterThan(0);
      expect(out.text).not.toContain(SEG);
    });
  }

  it("a second, non-exempt value on the same line", () => {
    const line = `https://${HOST}/${SEG}.png ${QUERY}`;
    const out = mask(line, table);
    expect(out.text).toContain(SEG);
    expect(out.text).not.toContain(QUERY);
  });

  it("a named value inside an exempt URL", () => {
    const named = buildTable(["MY_VALUE"], { MY_VALUE: SEG }, [], { entropy: true });
    const out = mask(`https://${HOST}/${SEG}.png`, named);
    expect(out.text).not.toContain(SEG);
  });
});
