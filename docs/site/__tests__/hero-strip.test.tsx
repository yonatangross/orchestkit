import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroStrip } from "@/components/hero-strip";
import { BANNER_TEXT, SITE_HOSTS } from "@/lib/constants";
import { HOST_INSTALLS } from "@/lib/host-installs";

// Approved mockup (strip and table, Yonatan 16.11.2026 09:28): stars, MIT and free, and every
// host by name, the strip linking to /docs/compatibility. OrchestKit is never described as a
// plugin for Claude Code only.
describe("HeroStrip", () => {
	it("names every host, in the site's host order, and links to the compatibility table", () => {
		render(<HeroStrip stars={304} />);
		const link = screen.getByRole("link", { name: /works in 8 agents/i });
		expect(link.getAttribute("href")).toBe("/docs/compatibility");
		const text = link.textContent ?? "";
		let at = -1;
		for (const h of HOST_INSTALLS) {
			const next = text.indexOf(h.name);
			expect(next, h.name).toBeGreaterThan(at);
			at = next;
		}
	});

	it("says MIT, free, no account", () => {
		render(<HeroStrip stars={304} />);
		expect(screen.getByText(/MIT, free, no account/)).toBeTruthy();
	});

	it("does not name Claude Code alone with a version", () => {
		const { container } = render(<HeroStrip stars={304} />);
		expect(container.textContent).not.toMatch(/Claude Code ≥/);
	});

	it("the hero no longer calls OrchestKit a Claude Code plugin library, in text or hidden h1 text", () => {
		const page = readFileSync(join(__dirname, "../app/(home)/page.tsx"), "utf8");
		expect(page).not.toContain("A Claude Code plugin library");
		expect(page).not.toContain("OrchestKit, Claude Code plugin.");
	});

	it("the banner on every page names the agent count, not one host's version", () => {
		expect(BANNER_TEXT).not.toMatch(/Claude Code \d/);
		expect(BANNER_TEXT).toContain(`works in ${SITE_HOSTS.length} agents`);
	});
});
