// Single source of truth for all site-wide values.
// Update here once — every page picks it up.

export const SITE = {
  name: "OrchestKit",
  version: "6.0.2",
  domain: "https://orchestkit.dev",
  github: "https://github.com/yonatangross/orchestkit",
  installCommand: "claude install orchestkit/ork",
  ccVersion: "2.1.34+",
} as const;

export const COUNTS = {
  skills: 200,
  agents: 36,
  hooks: 119,
} as const;

export const BANNER_TEXT = `OrchestKit v${SITE.version} — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks with Opus 4.6 support`;
