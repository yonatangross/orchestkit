import { SITE } from "@/lib/constants";

// Custom robots.txt route (replaces the app/robots.ts metadata convention, which
// cannot emit arbitrary directives). Permissive stance: OrchestKit is an
// open-source project that WANTS agents to discover, search, train on, and learn
// from its docs — so named AI crawlers are explicitly allowed (and ai-train=yes
// is kept) rather than blocked. The schemamap directive points at the NLWeb
// Schema Feeds map.
export const revalidate = false;

// AI crawlers we explicitly welcome. Listing them by name (each with Allow: /)
// is the discoverability signal orank rewards, and it documents intent: nothing
// here is blocked.
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
	"CCBot",
	"Applebot-Extended",
	"Bytespider",
	"meta-externalagent",
];

export function GET() {
	const lines: string[] = [
		"User-agent: *",
		"Allow: /",
		"",
		"# OrchestKit is open source (MIT) and welcomes AI crawlers explicitly.",
	];

	for (const bot of AI_BOTS) {
		lines.push("", `User-agent: ${bot}`, "Allow: /");
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
