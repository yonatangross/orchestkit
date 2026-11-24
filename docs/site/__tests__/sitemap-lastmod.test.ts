import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetadataRoute } from "next";
import { docsHtmlCanonical } from "@/lib/docs-canonical";

// The real generator (app/sitemap.ts) over the real docs tree. Only the
// fumadocs loader is replaced: it needs the generated .source runtime, so the
// mock walks content/docs the same way and hands back one page per .mdx file
// with no lastModified of its own (the sitemap reads dates from git itself).
vi.mock("@/lib/source", async () => {
  const { readdirSync } = await import("node:fs");
  const { join, relative, resolve } = await import("node:path");
  const root = resolve(__dirname, "../content/docs");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".mdx")) files.push(relative(root, p));
    }
  };
  walk(root);
  const pages = files.map((path) => {
    const slugs = path.replace(/\.mdx$/, "").split("/");
    if (slugs[slugs.length - 1] === "index") slugs.pop();
    return { path, slugs, data: {} };
  });
  return { source: { getPages: () => pages } };
});

const BUILD_TIME = new Date("2031-01-01T00:00:00.000Z");

async function entries(): Promise<MetadataRoute.Sitemap> {
  const mod = await import("@/app/sitemap");
  return mod.default();
}

function stamp(d: string | Date | undefined): string | undefined {
  if (d === undefined) return undefined;
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

describe("sitemap lastmod and loc", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BUILD_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("no lastmod is the build time", async () => {
    const atBuild = (await entries()).filter(
      (e) => stamp(e.lastModified) === BUILD_TIME.toISOString(),
    );
    expect(atBuild.map((e) => e.url)).toEqual([]);
  });

  // The live failure was 264 of 359 URLs (74 %) on one shallow clone boundary.
  // The bar is one third, not 20 %: commit 522646b90 (#4414, 2026-09-26) is
  // the real last change of 85 of 352 pages (24 %), and that date is true.
  it("no single lastmod covers more than a third of URLs", async () => {
    const all = await entries();
    const counts = new Map<string, number>();
    for (const e of all) {
      const s = stamp(e.lastModified);
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["none", 0];
    expect(n / all.length, `${n} of ${all.length} URLs share ${top}`).toBeLessThanOrEqual(1 / 3);
  });

  it("a full git history dates nearly every URL", async () => {
    const all = await entries();
    const dated = all.filter((e) => e.lastModified !== undefined);
    expect(dated.length / all.length).toBeGreaterThanOrEqual(0.9);
  });

  it("lists HTML pages only (no .json, .txt, .xml, .yaml or well-known loc)", async () => {
    const nonHtml = (await entries())
      .map((e) => e.url)
      .filter((u) => /\.(json|txt|xml|ya?ml)$/.test(u) || u.includes("/.well-known/"));
    expect(nonHtml).toEqual([]);
  });

  it("lists each canonical URL once, without docs aliases", async () => {
    const urls = (await entries()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.filter((url) => url.endsWith("/changelog"))).toEqual([
      docsHtmlCanonical(["changelog"]),
    ]);
  });
});
