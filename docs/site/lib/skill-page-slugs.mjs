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
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_PAGES_REL = "content/docs/reference/skills";

// next.config.mjs loads this file as a real file: module, so the folder is
// found next to it. The site tests run in happy-dom, where import.meta.url is
// not the file's real location (it may not be file: at all), so when that
// path does not exist the folder is found from the working directory (vitest
// and next build both run from docs/site), the same way the tests find it.
function defaultSkillPagesDir() {
	if (import.meta.url.startsWith("file:")) {
		const besideThisFile = fileURLToPath(new URL(`../${SKILL_PAGES_REL}/`, import.meta.url));
		if (existsSync(besideThisFile)) return besideThisFile;
	}
	return join(process.cwd(), SKILL_PAGES_REL);
}

export function singlePageSkillSlugs(dir = defaultSkillPagesDir()) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
		.map((name) => name.slice(0, -".mdx".length))
		.filter((slug) => /^[a-z0-9][a-z0-9-]*$/.test(slug))
		.sort();
}
