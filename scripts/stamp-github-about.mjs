#!/usr/bin/env node
// Stamp the GitHub repo "About" description from the canonical component counts.
//
// The About blurb ("… 113 skills, 37 agents, 212 hooks …") is a GitHub repo
// SETTING, not a tracked file — so `scripts/stamp-counts.sh` (which keeps every
// in-repo count surface in sync) can't touch it, and it drifts silently on the
// next skill/agent/hook change. This closes that gap by deriving the blurb from
// the already-stamped `<!--ork:*-->` count markers in README.md.
//
//   node scripts/stamp-github-about.mjs          # PATCH the About to match README
//   node scripts/stamp-github-about.mjs --check   # exit 1 if it has drifted (read-only)
//
// Needs `gh` authenticated. --check is read-only; apply needs repo admin scope.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(ROOT, "README.md"), "utf8");

function count(kind) {
	const m = readme.match(new RegExp(`<!--ork:${kind}-->(\\d+)<!--/ork-->`));
	if (!m) {
		console.error(`stamp-github-about: no <!--ork:${kind}--> marker in README.md`);
		process.exit(1);
	}
	return m[1];
}

const skills = count("skills");
const agents = count("agents");
const hooks = count("hooks");
const desc = `The Complete AI Development Toolkit for Claude Code — ${skills} skills, ${agents} agents, ${hooks} hooks. Production-ready patterns for full-stack development.`;

function gh(args) {
	return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
const check = process.argv.includes("--check");

if (check) {
	const live = gh(["api", `repos/${repo}`, "--jq", ".description"]);
	if (live === desc) {
		console.log(`stamp-github-about: in sync (${repo})`);
		process.exit(0);
	}
	console.error("stamp-github-about: About description DRIFTED from canonical counts.");
	console.error(`  live:      ${live}`);
	console.error(`  canonical: ${desc}`);
	console.error("  Fix: node scripts/stamp-github-about.mjs");
	process.exit(1);
}

execFileSync("gh", ["api", `repos/${repo}`, "-X", "PATCH", "-f", `description=${desc}`], {
	stdio: "inherit",
});
console.log(
	`stamp-github-about: About stamped → ${skills} skills, ${agents} agents, ${hooks} hooks`,
);
