import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE, SITE_HOSTS, SITE_TITLE } from "@/lib/constants";

/** Pull the Python HOSTS id list from design/og-card/brand.py. */
function brandHostIds(): string[] {
	const brandPath = join(process.cwd(), "..", "..", "design", "og-card", "brand.py");
	const src = readFileSync(brandPath, "utf8");
	const block = src.match(/HOSTS\s*=\s*\[([\s\S]*?)\]/)?.[1];
	if (!block) throw new Error(`HOSTS list not found in ${brandPath}`);
	return [...block.matchAll(/\(\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

describe("SITE_TITLE host parity", () => {
	it("counts more-agents from SITE_HOSTS (claude first)", () => {
		expect(SITE_HOSTS[0]).toBe("claude");
		expect(SITE_TITLE).toBe(
			`${SITE.name}: for Claude Code and ${SITE_HOSTS.length - 1} more agents`,
		);
	});

	it("matches design/og-card/brand.py HOSTS ids and order", () => {
		expect([...SITE_HOSTS]).toEqual(brandHostIds());
	});
});
