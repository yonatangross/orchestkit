import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { SITE } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.domain, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...source.getPages().map((page) => ({
      url: `${SITE.domain}/docs/${page.slugs.join("/")}`,
      lastModified: page.data.lastModified instanceof Date ? page.data.lastModified : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
