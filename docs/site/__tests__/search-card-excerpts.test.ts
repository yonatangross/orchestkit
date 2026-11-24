import { compile } from "@mdx-js/mdx";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { describe, expect, it } from "vitest";
import config from "@/source.config";

describe("MDX search excerpts", () => {
  it("indexes editorial Card labels as text without changing code or links", async () => {
    const { mdxOptions } = config;
    const options = typeof mdxOptions === "function" ? await mdxOptions() : mdxOptions;
    const file = await compile(
      [
        "## Hook guides",
        "",
        '<Cards>',
        '  <Card',
        '    title="Writing hooks"',
        '    description="Set up hooks &amp; register them."',
        '    href="/docs/hooks/writing-hooks"',
        '  />',
        '  <Card title={<Counter />} description="See lifecycle events." href="/docs/hooks" />',
        '  <Card title="Overview" href="/docs/overview" />',
        '</Cards>',
        "",
        'Use `<Card title="Code" />` in this example.',
      ].join("\n"),
      await applyMdxPreset(options)("runtime"),
    );

    expect(file.data.structuredData?.contents).toEqual([
      { heading: "hook-guides", content: "Writing hooks: Set up hooks & register them." },
      { heading: "hook-guides", content: "See lifecycle events." },
      { heading: "hook-guides", content: "Overview" },
      { heading: "hook-guides", content: 'Use `<Card title="Code" />` in this example.' },
    ]);
    expect(String(file)).toContain('href: "/docs/hooks/writing-hooks"');
  });
});
