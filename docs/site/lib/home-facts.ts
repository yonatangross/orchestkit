// Key facts and the home FAQ as Markdown, for the body an AI crawler gets at /
// (SEO gaps row 15, 15.11.2026). middleware.ts serves Markdown at / to
// OAI-SearchBot, PerplexityBot and the other AI user agents, and that body had
// none of the JSON-LD facts the HTML carries. Same sources as the HTML: COUNTS,
// SITE and HOME_FAQS.

import { HOME_FAQS } from "@/components/structured-data";
import { COUNTS, SITE, SITE_HOSTS } from "@/lib/constants";

export function homeFactsMarkdown(): string {
	return [
		"## Key facts",
		"",
		`- What: ${SITE.name} is a toolkit for AI coding agents: ${COUNTS.skills} skills, ${COUNTS.agents} agents and ${COUNTS.hooks} hooks in one install.`,
		`- Hosts: Claude Code and ${SITE_HOSTS.length - 1} more agent hosts.`,
		"- Licence and price: open source under the MIT licence, free, no account.",
		`- Install in Claude Code: \`${SITE.installCommand}\``,
		`- Version: ${SITE.version}`,
		`- Source: ${SITE.github}`,
		"- Publisher: Yonyon, an independent software studio founded by Yonatan Gross.",
		"",
		"## Questions",
		"",
		...HOME_FAQS.flatMap((f) => [`### ${f.question}`, "", f.answer, ""]),
	].join("\n");
}
