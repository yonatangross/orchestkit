// Single source of truth for all site-wide values.
// Version is read from the root manifest (manifests/ork.json).
// Counts are read from generated data (scripts/generate-docs-data.js).

import orkManifest from "../../../manifests/ork.json";
import { TOTALS, MIN_CC_VERSION } from "./generated/shared-data";

export const SITE = {
  name: "OrchestKit",
  version: orkManifest.version,
  domain: "https://orchestkit.yonyon.ai",
  github: "https://github.com/yonatangross/orchestkit",
  installCommand: "claude install orchestkit/ork",
  ccVersion: `${MIN_CC_VERSION}+`,
} as const;

export const COUNTS = {
  skills: TOTALS.skills,
  agents: TOTALS.agents,
  hooks: TOTALS.hooks,
  commands: TOTALS.commands,
} as const;

// Identity + entity-linking values for JSON-LD structured data.
// Only verifiable URLs are listed in `sameAs` — sameAs is the single
// highest-leverage property for AI entity disambiguation, so it must never
// point at a profile we don't control or that doesn't exist. Off-site anchors
// still to be created (Wikidata, LinkedIn, npm) are tracked as follow-ups.
export const PERSON = {
  name: "Yonatan Gross",
  url: "https://github.com/yonatangross",
} as const;

export const ORG = {
  legalName: "OrchestKit",
  // The canonical support channel — there is no hosted contact desk; issues are
  // triaged on GitHub. Used for schema.org contactPoint (contactType + url).
  supportUrl: `${SITE.github}/issues`,
} as const;

// Authoritative external references for the OrchestKit entity. Reused verbatim
// in every Organization JSON-LD block so the entity graph never sees conflicting
// identifiers (a documented anti-pattern).
export const SAME_AS = [
  SITE.github, // GitHub repository
  PERSON.url, // Maintainer GitHub profile
  "https://www.wikidata.org/wiki/Q140128295", // Wikidata entity
] as const;

export const BANNER_TEXT = `OrchestKit v${SITE.version} — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks · Claude Code ${SITE.ccVersion}`;
