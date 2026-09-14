import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { SITE } from "@/lib/constants";
import { STATIC_PAGES } from "@/lib/static-pages";

// Machine-readable developer surfaces (all GET 200, no auth). Listed so a
// crawler or agent walking the sitemap finds the OrchestKit API spec and MCP
// server card by URL, not only via /llms.txt. /api/mcp itself is POST-only
// (GET answers 405) so it is deliberately absent; the server card points at it.
const MACHINE_SURFACES = [
  "/openapi.json",
  "/api/openapi.yaml",
  "/.well-known/mcp/server-card.json",
  "/.well-known/api-catalog",
  "/llms.txt",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.domain, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE.domain}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...MACHINE_SURFACES.map((path) => ({
      url: `${SITE.domain}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...source.getPages().map((page) => ({
      url: `${SITE.domain}/docs/${page.slugs.join("/")}`,
      lastModified: page.data.lastModified instanceof Date ? page.data.lastModified : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
