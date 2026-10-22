#!/usr/bin/env node
// Writes lib/contributors-data.json from the GitHub contributors API, the
// source of the Contributors section on /about.
//
// Run by hand when the list should be refreshed:
//   node docs/site/scripts/snapshot-contributors.mjs
// It needs an authenticated `gh` CLI. It is NOT part of the build: a build-time
// API call would fail without a token and hit the rate limit, so the page
// renders a committed snapshot and prints the date it was taken.
//
// Bots are kept and marked: GitHub reports them with type "Bot", and their
// login ends in "[bot]".

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "yonatangross/orchestkit";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "contributors-data.json");

const raw = execFileSync(
	"gh",
	["api", "--paginate", `repos/${REPO}/contributors?per_page=100`, "--jq", ".[]"],
	{ encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

const contributors = raw
	.split("\n")
	.filter((line) => line.trim() !== "")
	.map((line) => JSON.parse(line))
	.map((c) => ({
		login: c.login,
		url: c.html_url,
		avatar: c.avatar_url,
		contributions: c.contributions,
		isBot: c.type === "Bot" || String(c.login).endsWith("[bot]"),
	}))
	.sort((a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login));

if (contributors.length === 0) {
	console.error("snapshot-contributors: the API returned no contributors; nothing written");
	process.exit(1);
}

const data = {
	source: `https://api.github.com/repos/${REPO}/contributors`,
	snapshotDate: new Date().toISOString().slice(0, 10),
	contributors,
};

writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
const bots = contributors.filter((c) => c.isBot).length;
console.log(
	`snapshot-contributors: ${contributors.length} contributors (${contributors.length - bots} people, ${bots} bots) -> ${OUT}`,
);
