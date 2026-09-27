import { SITE } from "@/lib/constants";
import {
	DEVELOPER_RESOURCES,
	developerResourceLines,
} from "@/lib/developer-resources";

export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const lines = [
		`# ${SITE.name} developer resources`,
		"",
		"> Scoped index for agents working on API docs, the OpenAPI spec, the MCP server, and SDK packages.",
		"",
		"## Named landing pages",
		"",
		...developerResourceLines(d),
		`- [OrchestKit llms.txt](${d}/llms.txt)`,
		`- [OrchestKit llms-full.txt](${d}/llms-full.txt)`,
		"",
		"## Machine-readable",
		"",
		...DEVELOPER_RESOURCES.map((r) => {
			const href = r.href.startsWith("http") ? r.href : `${d}${r.href}`;
			return `- [${r.title}](${href}): ${r.desc}`;
		}),
		"",
	];
	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
