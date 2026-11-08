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

  // Only white space or the ends of the text delimit the token (#5145 review round 4).
  for (const [open, close] of [["see ", " now"], ["", "\n"], ["\t", "\t"], ["\n", ""]]) {
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
    // Codex on 2136496a: a legal path character ended the scan without a refusal.
    ["path parameter then signed query", `https://${HOST}/${SEG}.png;download.exe?Signature=${QUERY}`],
    ["path parameter", `https://${HOST}/${SEG}.png;x`],
    ["semicolon before the extension", `https://${HOST}/${SEG};x.png`],
    ["at sign in the path", `https://${HOST}/${SEG}@x.png`],
    ["userinfo before the host", `https://user@${HOST}/${SEG}.png`],
    ["backslash in the path", `https://${HOST}/${SEG}\\x.png`],
    ["backslash after the extension", `https://${HOST}/${SEG}.png\\x`],
    ["colon after the extension", `https://${HOST}/${SEG}.png:x`],
    ["percent-encoded query", `https://${HOST}/${SEG}%3FSignature%3Dx.png`],
    ["percent-encoded dot", `https://${HOST}/${SEG}%2epng`],
    ["plus in the path", `https://${HOST}/${SEG}+x.png`],
    ["equals in the path", `https://${HOST}/${SEG}=x.png`],
    ["tilde in the path", `https://${HOST}/${SEG}~x.png`],
    ["fragment after a path parameter", `https://${HOST}/${SEG}.png;x#y`],
    ["glued to a word before the scheme", `xhttps://${HOST}/${SEG}.png`],
    ["double-encoded dot", `https://${HOST}/${SEG}%252e.png`],
    ["encoded null byte", `https://${HOST}/${SEG}%00.png`],
    ["encoded backslash", `https://${HOST}/${SEG}%5C.png`],
    ["raw null byte", `https://${HOST}/${SEG}.png\u0000x`],
    ["inside another URL's path", `https://example.com/https://${HOST}/${SEG}.png`],
    ["inside another URL's query", `https://example.com/?u=https://${HOST}/${SEG}.png`],
    // Codex round 2 on 1c828b5c: , ' ) are legal path characters, so they are not boundaries.
    ["comma then more path", `https://${HOST}/${SEG}.png,x`],
    ["apostrophe then more path", `https://${HOST}/${SEG}.png'x`],
    ["paren then a signed query", `https://${HOST}/${SEG}.png)?Signature=${QUERY}`],
    ["in parentheses", `(https://${HOST}/${SEG}.png)`],
    ["trailing full stop", `Saved to https://${HOST}/${SEG}.png.`],
    ["trailing comma", `https://${HOST}/${SEG}.png, and more`],
    // Codex round 4 on 0b7f078e: [ and ] are legal in a URL path and query, so they are not edges.
    ["after [ in another URL's query", `https://example.com/?next=[https://${HOST}/${SEG}.png`],
    ["] then a non-image path", `https://${HOST}/${SEG}.png]private.json`],
    ["in square brackets", `[https://${HOST}/${SEG}.png]`],
    // review b125 on 0b7f078e: a URL parser keeps " < ` [ inside the outer URL, so
    // only a whole white-space-delimited token that is exactly the URL is exempt.
    ["in double quotes", `"https://${HOST}/${SEG}.png"`],
    ["in angle brackets", `<https://${HOST}/${SEG}.png>`],
    ["in backticks", `\`https://${HOST}/${SEG}.png\``],
    ["markdown image", `![x](https://${HOST}/${SEG}.png)`],
    ["quote then a non-image path", `https://${HOST}/${SEG}.png"private.json`],
    ["angle bracket then more", `https://${HOST}/${SEG}.png>x`],
  ];
  // review b125 on 1c828b5c and 0b7f078e: characters that may sit inside an outer URL's path.
  for (const d of [";", ",", "!", "$", "*", "(", "'", "~", "|", "{", "^", ")", '"', "<", "`", "["]) {
    cases.push([`nested after ${JSON.stringify(d)}`, `https://example.com/a${d}https://${HOST}/${SEG}.png`]);
  }
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
