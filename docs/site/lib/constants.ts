// Single source of truth for all site-wide values.
// Version is read from the root manifest (manifests/ork.json).
// Counts are read from generated data (scripts/generate-docs-data.js).

import orkManifest from "../../../manifests/ork.json";
import { TOTALS } from "./generated/shared-data";

export const SITE = {
  name: "OrchestKit",
  version: orkManifest.version,
  domain: "https://orchestkit.vercel.app",
  github: "https://github.com/yonatangross/orchestkit",
  installCommand: "claude install orchestkit/ork",
  ccVersion: "2.1.34+",
} as const;

export const COUNTS = {
  skills: TOTALS.skills,
  agents: TOTALS.agents,
  hooks: TOTALS.hooks,
} as const;

export const BANNER_TEXT = `OrchestKit v${SITE.version} — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks with Opus 4.6 support`;
