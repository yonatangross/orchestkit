import type { ComponentProps } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";

// A docs page already has its one H1: DocsTitle renders page.data.title. A
// "# " heading inside the MDX body (every generated skill page carries the
// SKILL.md "# Title", and the reference index pages repeat their title) used to
// render as a second H1. Search engines read one H1 per page as the page topic
// (SEO gaps row 7, 15.11.2026), so a body H1 renders as an H2, with the same
// anchor id and heading style an MDX "## " gets.
const H2 = defaultMdxComponents.h2;

export function ContentH1(props: ComponentProps<"h1">) {
	return <H2 {...(props as ComponentProps<"h2">)} />;
}
