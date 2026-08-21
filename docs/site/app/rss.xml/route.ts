import { CHANGELOG_ENTRIES, type ChangelogEntry } from "@/lib/generated/changelog-data";

// Release feed for orchestkit.yonyon.ai. Until this route existed there was no
// subscribable surface anywhere: releases landed on the changelog page and
// nowhere a feed reader could see. Zero new data plumbing, the same generated
// changelog-data.ts the timeline renders.
export const revalidate = 3600;

const SITE = "https://orchestkit.yonyon.ai";
const FEED_LIMIT = 30;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entryDescription(entry: ChangelogEntry): string {
  const lines: string[] = [];
  for (const section of entry.sections) {
    for (const item of section.items) {
      lines.push(`[${section.type}] ${item}`);
    }
  }
  return lines.slice(0, 20).join("\n");
}

export function GET(): Response {
  const items = CHANGELOG_ENTRIES.slice(0, FEED_LIMIT)
    .map((entry) => {
      const url = `${SITE}/docs/changelog#${entry.version}`;
      // Changelog dates are YYYY-MM-DD with no time component; noon UTC keeps
      // the date stable in every reader timezone.
      const pubDate = new Date(`${entry.date}T12:00:00Z`).toUTCString();
      return [
        "    <item>",
        `      <title>${escapeXml(`OrchestKit ${entry.version}`)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(`orchestkit-${entry.version}`)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${escapeXml(entryDescription(entry))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>OrchestKit Releases</title>",
    `    <link>${SITE}/docs/changelog</link>`,
    "    <description>Release notes for OrchestKit, the Claude Code plugin.</description>",
    "    <language>en</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
