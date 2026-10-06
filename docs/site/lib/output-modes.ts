// Pure logic for the output modes try-it page (/docs/guides/output-modes).
// The flag grammar mirrors src/skills/glyph/references/dials.md; the sign-off
// labels mirror src/shared/rules/done-signoff.md. tests/skills/structure/
// test-glyph-dials.sh guards the skill side, __tests__/output-modes.test.ts this one.

export const SURFACES = ["chat", "ask", "page"] as const;
export const AUDIENCES = ["operator", "novice"] as const;
export const SIGNOFF_LABELS = ["Accept done", "Show me the evidence", "Not satisfied"] as const;

export type Surface = (typeof SURFACES)[number];
export type Audience = (typeof AUDIENCES)[number];

export interface Mode {
  surface: Surface;
  audience: Audience;
  signoff: boolean;
}

export const DEFAULT_MODE: Mode = { surface: "chat", audience: "operator", signoff: false };

// The surface flag is always written out: --eli5 alone would also force a page.
export function buildFlag(mode: Mode): string {
  const parts = ["/ork:glyph", `--${mode.surface}`];
  if (mode.audience === "novice") parts.push("--eli5");
  if (mode.signoff) parts.push("--signoff");
  return parts.join(" ");
}

export function buildPrompt(mode: Mode): string {
  const flag = buildFlag(mode);
  if (!mode.signoff) return `Answer with ${flag}.`;
  return `Answer with ${flag}, and end with the done sign-off (${SIGNOFF_LABELS.join(" | ")}).`;
}

// The page keeps the pick in the query string, so a chosen mode is a shareable link.
export function parseMode(search: string): Mode {
  const q = new URLSearchParams(search);
  const surface = q.get("surface");
  const audience = q.get("audience");
  return {
    surface: (SURFACES as readonly string[]).includes(surface ?? "")
      ? (surface as Surface)
      : DEFAULT_MODE.surface,
    audience: (AUDIENCES as readonly string[]).includes(audience ?? "")
      ? (audience as Audience)
      : DEFAULT_MODE.audience,
    signoff: q.get("signoff") === "1",
  };
}

export function modeToSearch(mode: Mode): string {
  const q = new URLSearchParams({ surface: mode.surface, audience: mode.audience });
  if (mode.signoff) q.set("signoff", "1");
  return `?${q.toString()}`;
}

export function buildJson(mode: Mode): string {
  return JSON.stringify({ skill: "ork:glyph", ...mode, flag: buildFlag(mode) }, null, 2);
}
