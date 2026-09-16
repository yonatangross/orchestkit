// secrets-veil: entropy-corpus.test.ts - both-directions proof for the
// entropy tokenizer rule (HOLD comment 5696523717, blocker 1).
//
// NEGATIVE: tests/fixtures/repo-output.txt is real output from THIS public
// repository only (github.com/yonatangross/orchestkit): remote branch names,
// tracked paths, one statuses URL with a 40-hex sha, one actions run URL,
// plus the exact examples quoted in the HOLD comment. The entropy layer must
// mask 0 spans over every content line. Provenance rules are documented in
// the fixture header.
//
// POSITIVE: synthetic values generated in this file (never real ones) must
// still be masked with NO env names and NO patterns set:
//   - a 40-char AWS-secret-shaped value from [A-Za-z0-9/+] containing both
//     '/' and '+'
//   - a 64-char base64 value ending in '='
//   - a 32-char random [A-Za-z0-9] token
//
// Mutation proofs recorded for #4189:
//   [M1] score whole runs again (old alphabet keeping / - _ in tokens):
//        the corpus test fails (paths and branches score past 4.3).
//   [M2] split every '/' unconditionally: the AWS-shaped positive fails
//        (the secret falls apart under the 20-char floor and is not masked).
//   [M3] FIX ROUND: score a run whole on ANY '=' again (drop the mid-run
//        key=value split): the '?ref=<branch>' corpus line fails.
//   [M4] HOLD 4189 round-3 proof: split on '-' and '_' unconditionally (the
//        round-2 rule): R fails (recall collapses on base64url shapes).
//   [M5] HOLD 4189 round-3 proof: never split on '-' and '_' (the round-1
//        rule): P fails (the '?ref=<branch>' corpus line masks).
//   [M6] FIX ROUND B proof: remove the camelCase/PascalCase chunk allowance
//        (isWordLikeSegment rejects every mixed-case 8+ segment again): P
//        fails on docs/site/public/thumbnails/CIN-ReviewPR.png and the
//        other PascalCase ls-files paths in the FIX ROUND B section.
//
// FIX ROUND additions:
//   NEGATIVE: a gh api '?ref=<remote branch>' URL line and three real npm
//   integrity lines (sha512-<86 base64>== style, public hashes) from THIS
//   repo's package-lock.json are in the fixture and must mask 0 spans; the
//   SRI exemption and the mid-run '=' split are also unit-tested below.
//   POSITIVE: R (below) replaces the two single-sample JWT/base64url
//   positives: 500 SEEDED random samples per real secret shape, each
//   embedded in a line of ordinary text, must mask at or above a per-shape
//   floor. Masked means no 16-character run of the secret survives in the
//   output. Floors are per shape because short random strings hit an
//   entropy-threshold ceiling: even the old whole-run rule (6876c107)
//   reaches only 96.8% on sk_live_24 and 96.1% on alnum-32 (calibrated
//   independently by the conductor over 2,000 samples per shape).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildTable,
  mask,
  shannonEntropy,
  wouldMask,
  SRI_VALUE_RE,
  DEFAULT_PATTERNS,
} from "../src/mask";

// Deterministic PRNG (mulberry32). A fixed seed family keeps the synthetic
// values reproducible while still being generated, not hardcoded, and never
// derived from any real credential.
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
const B64 = `${ALNUM}/+`;

function synthValue(rng: () => number, alphabet: string, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

interface Spec {
  seed: number;
  alphabet: string;
  len: number;
  // retry seeds until the final value has at least this entropy, so the
  // positive cases cross the 4.3 bar with margin
  minEntropy: number;
  // positions forced to '/'; every segment between them must stay under the
  // 20-char floor, so an unconditional '/' split (mutation M2) drops the
  // value below ENTROPY_MIN_LENGTH instead of masking it
  slashAt?: number[];
  plusAt?: number[];
  // standard base64 padding: last char becomes '='
  padEnd?: boolean;
  // reject generated values matching this pattern (retry the seed)
  mustAvoid?: RegExp;
}

function synth(spec: Spec): string {
  for (let seed = spec.seed; seed < spec.seed + 200; seed++) {
    const rng = mulberry32(seed);
    let out = "";
    for (let i = 0; i < spec.len; i++) {
      out += spec.alphabet[Math.floor(rng() * spec.alphabet.length)];
    }
    if (spec.padEnd) out = out.slice(0, spec.len - 1) + "=";
    if (spec.plusAt) {
      for (const i of spec.plusAt) out = out.slice(0, i) + "+" + out.slice(i + 1);
    }
    if (spec.slashAt) {
      for (const i of spec.slashAt) out = out.slice(0, i) + "/" + out.slice(i + 1);
    }
    if (spec.mustAvoid && spec.mustAvoid.test(out)) continue;
    if (shannonEntropy(out) < spec.minEntropy) continue;
    if (spec.slashAt) {
      let start = 0;
      let segmentsShortEnough = true;
      for (const i of [...spec.slashAt, spec.len]) {
        if (i - start >= 20) segmentsShortEnough = false;
        start = i + 1;
      }
      if (!segmentsShortEnough) continue;
    }
    return out;
  }
  throw new Error("no seed in range satisfied the spec");
}

const ENTROPY_TABLE = buildTable([], {}, [], { entropy: true });
// R uses the full default table: no env names, every default pattern, and
// the entropy layer armed.
const DEFAULT_TABLE = buildTable([], {}, DEFAULT_PATTERNS, { entropy: true });

describe("entropy tokenizer rule (HOLD 5696523717)", () => {
  describe("NEGATIVE corpus: tests/fixtures/repo-output.txt", () => {
    const raw = readFileSync(
      new URL("./fixtures/repo-output.txt", import.meta.url),
      "utf8"
    );
    const lines = raw
      .split("\n")
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    it("has at least 300 content lines", () => {
      expect(lines.length).toBeGreaterThanOrEqual(300);
    });

    it("masks 0 spans on every content line", () => {
      let total = 0;
      for (const line of lines) {
        const result = mask(line, ENTROPY_TABLE);
        total += result.spans.length;
        if (result.spans.length > 0) {
          throw new Error(
            `entropy layer masked ${result.spans.length} span(s) on corpus line: ${line}`
          );
        }
      }
      expect(total).toBe(0);
    });
  });

  describe("POSITIVE: synthetic secret shapes still mask", () => {
    it("masks a synthetic 40-char AWS-secret-shaped value containing '/' and '+'", () => {
      const aws = synth({
        seed: 1,
        alphabet: B64,
        len: 40,
        minEntropy: 4.35,
        slashAt: [13, 27],
        plusAt: [6],
      });
      expect(aws.length).toBe(40);
      expect(aws).toMatch(/\+/);
      expect(aws).toMatch(/\//);
      const result = mask(`aws secret value ${aws} end`, ENTROPY_TABLE);
      expect(result.spans.length).toBe(1);
      // the run stays whole: one span covering the full value
      expect(result.spans[0].value).toBe(aws);
      expect(result.text).not.toContain(aws);
    });

    it("masks a synthetic 64-char base64 value ending in '='", () => {
      const b64 = synth({ seed: 2, alphabet: B64, len: 64, minEntropy: 4.35, padEnd: true });
      expect(b64.length).toBe(64);
      expect(b64.endsWith("=")).toBe(true);
      const result = mask(`refresh token ${b64} end`, ENTROPY_TABLE);
      expect(result.spans.length).toBe(1);
      expect(result.spans[0].value).toBe(b64);
      expect(result.text).not.toContain(b64);
    });

    it("masks a synthetic 32-char random [A-Za-z0-9] token", () => {
      const tok = synth({ seed: 3, alphabet: ALNUM, len: 32, minEntropy: 4.35 });
      expect(tok.length).toBe(32);
      const result = mask(`api token ${tok} end`, ENTROPY_TABLE);
      expect(result.spans.length).toBe(1);
      expect(result.spans[0].value).toBe(tok);
      expect(result.text).not.toContain(tok);
    });
  });

  // ---------------------------------------------------------------------
  // R: seeded recall over 500 samples per real secret shape (HOLD 4189,
  // fix round 3; replaces the two single-sample JWT/base64url positives).
  // A sample counts as masked only when NO 16-character substring of the
  // secret survives anywhere in the masked output.
  // ---------------------------------------------------------------------
  describe("R: seeded recall, 500 samples per shape", () => {
    const B64URL = `${ALNUM}-_`;
    const N = 500;

    type Shape = { make: (rng: () => number) => string; floor: number; seedBase: number };

    const b64url = (rng: () => number, len: number) => synthValue(rng, B64URL, len);

    const shapes: Record<string, Shape> = {
      JWT: {
        seedBase: 101_000,
        floor: 98,
        make: (rng) =>
          [
            "eyJ" + b64url(rng, 33),
            "eyJ" + b64url(rng, 40),
            b64url(rng, 43),
          ].join("."),
      },
      "sk-proj-48": {
        seedBase: 102_000,
        floor: 98,
        make: (rng) => "sk-proj-" + b64url(rng, 48),
      },
      sk_live_24: {
        seedBase: 103_000,
        floor: 95,
        make: (rng) => "sk_live_" + synthValue(rng, ALNUM, 24),
      },
      "base64url-43": {
        seedBase: 104_000,
        floor: 98,
        make: (rng) => b64url(rng, 43),
      },
      "AIza-35": {
        seedBase: 105_000,
        floor: 98,
        make: (rng) => "AIza" + b64url(rng, 35),
      },
      "aws-40": {
        seedBase: 106_000,
        floor: 98,
        make: (rng) => synthValue(rng, B64, 40),
      },
      "alnum-32": {
        seedBase: 107_000,
        floor: 95,
        make: (rng) => synthValue(rng, ALNUM, 32),
      },
    };

    it("masks at or above the per-shape floor over 500 seeded samples each", () => {
      const summary: string[] = [];
      const failures: string[] = [];
      for (const [shape, spec] of Object.entries(shapes)) {
        let maskedCount = 0;
        for (let i = 0; i < N; i++) {
          const rng = mulberry32(spec.seedBase + i);
          const secret = spec.make(rng);
          // a line of ordinary text around the value
          const line = `profile default uses ${secret} for service auth`;
          const out = mask(line, DEFAULT_TABLE).text;
          let survives = false;
          for (let s = 0; s + 16 <= secret.length; s++) {
            if (out.includes(secret.slice(s, s + 16))) {
              survives = true;
              break;
            }
          }
          if (!survives) maskedCount++;
        }
        const pct = (100 * maskedCount) / N;
        summary.push(`${shape}=${pct.toFixed(1)}%`);
        console.log(
          `R ${shape}: ${pct.toFixed(1)}% masked (${maskedCount}/${N}), floor ${spec.floor}%`
        );
        if (pct < spec.floor) {
          failures.push(`${shape} ${pct.toFixed(1)}% < floor ${spec.floor}%`);
        }
      }
      console.log(`R summary: ${summary.join(" ")}`);
      expect(failures, `shapes below floor: ${failures.join("; ")}`).toEqual([]);
    });
  });

  describe("FIX ROUND negatives", () => {
    it("does NOT mask a '?ref=<branch>' URL query", () => {
      const url =
        "https://api.github.com/repos/yonatangross/orchestkit/commits?ref=chore/dsp-39782-4160-allowed-devin&per_page=30";
      const result = mask(url, ENTROPY_TABLE);
      expect(result.spans.length).toBe(0);
      expect(result.text).toBe(url);
    });

    it("does NOT mask a head_sha=<40hex> query", () => {
      const sha = "5231b333cd544eaf6db866da120a9691f1f3d7e0";
      const result = mask(`check runs for head_sha=${sha} ok`, ENTROPY_TABLE);
      expect(result.spans.length).toBe(0);
      expect(result.text).toBe(`check runs for head_sha=${sha} ok`);
    });

    it("does NOT mask SRI integrity values (sha1/sha256/sha512 + base64)", () => {
      // npm publishes these in every package-lock.json; the base64 body is
      // generated high-entropy so the exemption, not low entropy, is proven.
      const body512 = synth({ seed: 6, alphabet: B64, len: 86, minEntropy: 4.35 });
      const body256 = synth({ seed: 7, alphabet: B64, len: 43, minEntropy: 4.35 });
      const body1 = synth({ seed: 8, alphabet: B64, len: 27, minEntropy: 4.35 });
      const values = [`sha512-${body512}==`, `sha256-${body256}=`, `sha1-${body1}=`];
      for (const v of values) {
        expect(SRI_VALUE_RE.test(v)).toBe(true);
        const result = mask(`"integrity": "${v}", "deps": []`, ENTROPY_TABLE);
        expect(result.spans.length).toBe(0);
        expect(result.text).toContain(v);
        expect(
          wouldMask(v, ENTROPY_TABLE),
          `wouldMask should be false for SRI value`
        ).toBe(false);
      }
    });
  });
});
