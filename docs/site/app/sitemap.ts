import type { MetadataRoute } from "next";
import { join } from "node:path";
import { source } from "@/lib/source";
import { SITE } from "@/lib/constants";
import { docsHtmlCanonical } from "@/lib/docs-canonical";
import { STATIC_PAGES } from "@/lib/static-pages";
import { gitLastModified, newestUnder } from "@/lib/git-last-modified";

// HTML developer pages, listed so a crawler walking the sitemap finds the MCP
// and SDK docs by URL. Each maps to the route folder whose last commit dates
// it. The machine-readable surfaces (openapi.json, the MCP server cards,
// api-catalog, llms.txt) are not HTML pages and stay out of the sitemap;
// /llms.txt, the api-catalog link relation and the docs pages point at them.
const DEVELOPER_PAGES = [
  { path: "/docs/mcp", dir: "app/docs/mcp" },
  { path: "/docs/sdk", dir: "app/docs/sdk" },
] as const;

// lastmod is the last git commit date of the page's own source, never the
// build time. A URL with no known date (no git, or a file whose only visible
// commit is a shallow clone boundary) gets no lastmod at all.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.cwd();
  const dates = gitLastModified(site, ["app", "content/docs"]);
  const dirDate = (dir: string) => newestUnder(dates, join(site, dir));

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE.domain,
      lastModified: dates.get(join(site, "app/(home)/page.tsx")),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE.domain}${path}`,
      lastModified: dirDate(`app/(home)${path}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...DEVELOPER_PAGES.map(({ path, dir }) => ({
      url: `${SITE.domain}${path}`,
      lastModified: dirDate(dir),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...source.getPages().map((page) => ({
      url: docsHtmlCanonical(page.slugs),
      lastModified: dates.get(join(site, "content/docs", page.path)),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const seen = new Set<string>();
  return entries.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
