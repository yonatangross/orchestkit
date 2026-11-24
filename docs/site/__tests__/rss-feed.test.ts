import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/rss.xml/route";

vi.mock("@/lib/generated/changelog-data", () => ({
  CHANGELOG_ENTRIES: Array.from({ length: 31 }, (_, i) => ({
    version: `10.0.${i}`,
    date: "2026-11-24",
    sections: [
      {
        heading: "Features & fixes",
        items: [
          "**cc:** accept `--help` ([#7](https://github.com/yonatangross/orchestkit/issues/7))",
          ...Array.from({ length: 18 }, (_, n) => `Change ${n}`),
        ],
      },
      {
        heading: "Other changes",
        items: ["Keep <b>literal HTML</b> & ]]>", "Omitted extra item"],
      },
      { heading: "Omitted section", items: ["Another extra item"] },
    ],
  })),
}));

describe("release RSS", () => {
  it("renders Markdown as XML-escaped HTML and retains clickable references", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await response.text();
    const description = xml.match(/<description>(&lt;h3&gt;[\s\S]*?)<\/description>/)?.[1];

    expect(description).toContain("&lt;h3&gt;Features &amp;amp; fixes&lt;/h3&gt;");
    expect(description).toContain("&lt;ul&gt;&lt;li&gt;&lt;p&gt;&lt;strong&gt;cc:&lt;/strong&gt;");
    expect(description).toContain("&lt;code&gt;--help&lt;/code&gt;");
    expect(description).toContain(
      "&lt;a href=&quot;https://github.com/yonatangross/orchestkit/issues/7&quot;&gt;#7&lt;/a&gt;",
    );
    expect(description).toContain("&amp;lt;b&amp;gt;literal HTML&amp;lt;/b&amp;gt; &amp;amp; ]]&amp;gt;");
  });

  it("keeps 30 releases and at most 20 changes across each release's sections", async () => {
    const xml = await GET().text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    expect(items).toHaveLength(30);
    expect(items[0][1]).toContain("Other changes");
    expect(items[0][1].match(/&lt;li&gt;/g)).toHaveLength(20);
    expect(xml).not.toContain("Omitted extra item");
    expect(xml).not.toContain("Omitted section");
  });
});
