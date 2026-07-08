import { SITE } from "@/lib/constants";

// Custom robots.txt route (replaces the app/robots.ts metadata convention, which
// cannot emit arbitrary directives). Tiered stance (2026-07-08, orank fix
// applied): OrchestKit WANTS named, accountable AI companies with a real
// product (search, assistant, or opt-in model training) to crawl and train on
// its docs — those stay explicitly allowed with ai-train=yes, including
// crawlers whose sole purpose IS training (GPTBot, Google-Extended,
// Applebot-Extended). What's blocked is different in kind, not degree:
// third-party bulk-scrape aggregators with no accountable product behind them
// (CCBot = Common Crawl, resold to unknown downstream buyers; Bytespider =
// ByteDance's crawler, widely blocked for ignoring crawl-rate limits). The
// schemamap directive points at the NLWeb Schema Feeds map.
export const revalidate = false;

// Named AI crawlers we explicitly welcome — search, assistant, or opt-in
// training, all from an accountable company with a real product. Listing them
// by name (each with Allow: /) is the discoverability signal orank rewards.
const AI_BOTS = [
	"GPTBot",
	"ChatGPT-User",
	"OAI-SearchBot",
	"ClaudeBot",
	"Claude-User",
	"Claude-SearchBot",
	"Google-Extended",
	"PerplexityBot",
	"Perplexity-User",
	"Applebot-Extended",
	"meta-externalagent",
];

// Third-party bulk-scrape aggregators — blocked, not welcomed. Distinct from
// AI_BOTS above; do not merge the two lists.
const BLOCKED_BOTS = ["CCBot", "Bytespider"];

export function GET() {
	const lines: string[] = [
		"User-agent: *",
		"Allow: /",
		"",
		"# OrchestKit is open source (MIT) and welcomes named AI crawlers explicitly.",
	];

	for (const bot of AI_BOTS) {
		lines.push("", `User-agent: ${bot}`, "Allow: /");
	}

	lines.push(
		"",
		"# Third-party bulk-scrape aggregators are blocked, not welcomed.",
	);
	for (const bot of BLOCKED_BOTS) {
		lines.push(
			"",
			`User-agent: ${bot}`,
			"Disallow: /",
			"Content-Signal: ai-train=no, search=no, ai-input=no",
		);
	}

	lines.push(
		"",
		"# Content Signals — https://contentsignals.org/",
		"Content-Signal: ai-train=yes, search=yes, ai-input=yes",
		"",
		`Sitemap: ${SITE.domain}/sitemap.xml`,
		`schemamap: ${SITE.domain}/schema-map.xml`,
		"",
	);

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
