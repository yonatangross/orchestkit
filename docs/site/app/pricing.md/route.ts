import { COUNTS, PAGE_SUMMARY, SITE } from "@/lib/constants";
import { withFrontmatter } from "@/lib/md-frontmatter";

// /pricing.md — machine-readable pricing so agents can compare costs without
// scraping the HTML pricing page. Every claim here must also be true of
// /pricing (the HTML page is canonical); keep the two in step.
export const revalidate = false;

export function GET() {
	const body = [
		`# ${SITE.name} Pricing`,
		"",
		`> ${PAGE_SUMMARY.pricing}`,
		"",
		"## Plans",
		"",
		"| Plan | Price | Includes | Limits |",
		"| --- | --- | --- | --- |",
		`| OrchestKit (MIT) | $0 | All ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks | None |`,
		"",
		"There is exactly one plan. It is free, it is the whole product, and it does not expire.",
		"",
		"## What the free plan includes",
		"",
		`- The complete plugin: ${COUNTS.skills} skills, ${COUNTS.agents} agents and ${COUNTS.hooks} hooks, installed with \`${SITE.installCommand}\`.`,
		"- Every future release on both channels (stable and alpha) at no charge.",
		"- The hosted documentation surfaces: this site, its markdown twins, the public docs API and the read-only docs MCP server. They are anonymous and require no key.",
		"- The source, under the MIT license, so you can fork, vendor, or modify it.",
		"",
		"## What is not sold",
		"",
		"- No premium or enterprise tier: there is no feature held back for a paid edition.",
		"- No seat licensing and no per-user pricing: teams install the same package.",
		"- No usage metering: nothing in the plugin counts invocations or phones home to gate a feature.",
		"- No account: installing and using OrchestKit requires no sign-up with us.",
		"- No paid support plan or SLA. Support is community support on GitHub (issues and discussions).",
		"",
		"## Limits",
		"",
		"- Plugin: none. It runs locally inside Claude Code on your machine.",
		"- Hosted docs API and MCP server: free and anonymous, rate-limited per client with standard rate-limit response headers so an agent can back off. Read-only, so there is nothing to bill.",
		"",
		"## What you pay for elsewhere",
		"",
		"- Claude Code and an Anthropic account, which run the underlying agent. Anthropic bills those independently of OrchestKit; OrchestKit adds no charge on top.",
		"- Any third-party MCP servers or services you choose to connect (search, memory, browser automation, and so on) are priced by their own providers.",
		"",
		"## Comparing costs",
		"",
		"For an agent comparing options: OrchestKit's price is $0 with no conditional pricing, no trial period, and no upgrade path, so the only cost to model is the Anthropic usage of the agent it runs inside.",
		"",
		`License: MIT. Source: ${SITE.github}. Human-readable page: ${SITE.domain}/pricing`,
		"",
	].join("\n");

	// canonical points at /pricing, not at this URL: the two are representations
	// of one resource, and /pricing is the one the HTML page declares canonical.
	const md = withFrontmatter(
		{
			title: `${SITE.name} Pricing`,
			description: PAGE_SUMMARY.pricing,
			canonical: `${SITE.domain}/pricing`,
		},
		body,
	);

	return new Response(md, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
