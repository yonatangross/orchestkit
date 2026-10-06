import { describe, expect, it } from "vitest";
import {
  AUDIENCES,
  SIGNOFF_LABELS,
  SURFACES,
  buildFlag,
  buildJson,
  buildPrompt,
  type Mode,
} from "@/lib/output-modes";

const allModes: Mode[] = SURFACES.flatMap((surface) =>
  AUDIENCES.flatMap((audience) =>
    [false, true].map((signoff) => ({ surface, audience, signoff })),
  ),
);

describe("output modes picker", () => {
  it("covers 3 surfaces x 2 audiences x sign-off on/off", () => {
    expect(SURFACES).toEqual(["chat", "ask", "page"]);
    expect(AUDIENCES).toEqual(["operator", "novice"]);
    expect(allModes).toHaveLength(12);
  });

  it("defaults to the bare chat flag", () => {
    expect(buildFlag({ surface: "chat", audience: "operator", signoff: false })).toBe(
      "/ork:glyph --chat",
    );
  });

  it("always names the surface, so --eli5 never silently forces a page", () => {
    expect(buildFlag({ surface: "chat", audience: "novice", signoff: false })).toBe(
      "/ork:glyph --chat --eli5",
    );
    expect(buildFlag({ surface: "ask", audience: "novice", signoff: true })).toBe(
      "/ork:glyph --ask --eli5 --signoff",
    );
  });

  it("gives every mode a distinct flag string", () => {
    const flags = new Set(allModes.map(buildFlag));
    expect(flags.size).toBe(allModes.length);
  });

  it("puts the three exact sign-off labels in the prompt only when sign-off is on", () => {
    expect(SIGNOFF_LABELS).toEqual(["Accept done", "Show me the evidence", "Not satisfied"]);
    const on = buildPrompt({ surface: "page", audience: "novice", signoff: true });
    expect(on).toBe(
      "Answer with /ork:glyph --page --eli5 --signoff, and end with the done sign-off (Accept done | Show me the evidence | Not satisfied).",
    );
    const off = buildPrompt({ surface: "page", audience: "novice", signoff: false });
    expect(off).toBe("Answer with /ork:glyph --page --eli5.");
  });

  it("emits JSON that round-trips to the same mode and flag", () => {
    for (const mode of allModes) {
      const parsed = JSON.parse(buildJson(mode));
      expect(parsed).toEqual({ skill: "ork:glyph", ...mode, flag: buildFlag(mode) });
    }
  });

  it("never emits an em dash, en dash or double hyphen outside a flag", () => {
    for (const mode of allModes) {
      const text = buildPrompt(mode).replace(/ --[a-z0-9]+/g, "");
      expect(text).not.toMatch(/[–—]|--/);
    }
  });
});
