// Slugs of the skill reference pages the build wrote as ONE file, read from
// the content folder the build just wrote. Feeds siteRedirects() in
// next.config.mjs, so the sub-URLs of a skill that shrank under the docs
// generator's byte budget redirect to its page, and a skill that grows back
// into a folder stops being redirected (a config redirect runs before the
// file router and would hide its real pages).
//
// Kept apart from lib/site-redirects.mjs on purpose: that file is also
// bundled into middleware and API routes (through lib/constants.ts), where
// node:fs cannot be used. Import this file from Node only (config, tests).

import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SKILL_PAGES_DIR = fileURLToPath(
	new URL("../content/docs/reference/skills/", import.meta.url),
);

export function singlePageSkillSlugs(dir = SKILL_PAGES_DIR) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
		.map((name) => name.slice(0, -".mdx".length))
		.filter((slug) => /^[a-z0-9][a-z0-9-]*$/.test(slug))
		.sort();
}
