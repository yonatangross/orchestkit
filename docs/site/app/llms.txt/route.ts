import { source } from "@/lib/source";
import { COUNTS } from "@/lib/constants";

export const revalidate = false;

export function GET() {
  const pages = source.getPages();

  const lines = [
    "# OrchestKit",
    "",
    `> AI development toolkit for Claude Code — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks`,
    "",
    "## Docs",
    "",
    ...pages.map(
      (page) => `- [${page.data.title}](${page.url}): ${page.data.description || ""}`,
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
