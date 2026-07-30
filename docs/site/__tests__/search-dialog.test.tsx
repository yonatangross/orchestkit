// Renders the REAL ⌘K dialog against a stubbed search response and asserts the
// matched excerpts reach the DOM.
//
// This exists because the defect it covers was invisible to every other layer.
// The API was returning correct, <mark>-highlighted rows the whole time; the
// dialog filtered them out on the way to the screen. The lib/search-display
// tests prove the rows survive grouping, but only a render proves they survive
// fumadocs' SearchDialogListItem and actually paint.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Content strings are copied VERBATIM from a real /api/search?query=tavily
// response. That matters: an invented fixture that put <mark> inside a code
// span produced escaped "&lt;mark&gt;" output and looked like a rendering bug.
// It is not one — fumadocs highlights by visiting markdown TEXT nodes, and an
// `inlineCode` node is not a text node, so a match inside backticks is never
// marked in the first place. Of 86 real rows, 19 contain backticks and 52
// contain a mark; in all 5 that contain both, the mark sits OUTSIDE the code
// span. Keep these fixtures real.
const QUERY_DATA = [
	{
		id: "/docs/foundations/mcp-servers",
		url: "/docs/foundations/mcp-servers",
		type: "page",
		content: "MCP Servers",
	},
	{
		id: "/docs/foundations/mcp-servers-1",
		url: "/docs/foundations/mcp-servers#tools",
		type: "text",
		content: "<mark>Tavily</mark> search API",
	},
	{
		id: "/docs/foundations/mcp-servers-2",
		url: "/docs/foundations/mcp-servers#quick-start",
		type: "text",
		content:
			"**<mark>Tavily</mark>**: If you set `TAVILY_API_KEY`, web research skills use <mark>Tavily</mark>'s search API",
	},
];

vi.mock("fumadocs-core/search/client", () => ({
	useDocsSearch: () => ({
		search: "tavily",
		setSearch: () => {},
		query: { data: QUERY_DATA, isLoading: false },
	}),
}));

import { FrameworkProvider } from "fumadocs-core/framework";
import CustomSearchDialog from "@/components/search-dialog";

// fumadocs components read router/link bindings from a framework context, so
// the dialog throws "You need to wrap your application inside FrameworkProvider"
// without one. In the app that context comes from RootProvider in app/layout.
//
// Use the GENERIC provider with stub bindings, not NextProvider: the latter
// calls Next's real useRouter, which throws "invariant expected app router to
// be mounted" under jsdom. Nothing asserted here depends on navigation.
function renderDialog() {
	return render(
		<FrameworkProvider
			usePathname={() => "/docs"}
			useParams={() => ({})}
			useRouter={() => ({ push: () => {}, refresh: () => {} })}
			Link={({ prefetch: _prefetch, ...props }) => <a {...props} />}
		>
			<CustomSearchDialog open onOpenChange={() => {}} />
		</FrameworkProvider>,
	);
}

describe("⌘K dialog renders matched snippets", () => {
	it("paints the page title AND its matched excerpts", async () => {
		renderDialog();
		await screen.findByText("MCP Servers");

		// The dialog renders through a portal, so assert against document.body,
		// not the render container (which is empty).
		const text = document.body.textContent ?? "";

		expect(text).toContain("MCP Servers");
		// Excerpt bodies. Before the fix these rows were filtered out of the item
		// list entirely and every result rendered as a bare title.
		expect(text).toContain("search API");
		expect(text).toContain("TAVILY_API_KEY");
	});

	it("renders the highlight as markup, not as literal <mark> text", async () => {
		renderDialog();
		await screen.findByText("MCP Servers");

		// fumadocs maps `mark` to a styled <span> via its mdComponents, so assert
		// on the rendered highlight class rather than a <mark> tag.
		expect(
			document.body.querySelector(".text-fd-primary"),
		).not.toBeNull();
		// The failure this guards: if the markdown pipeline stops allowing raw
		// HTML, users see the literal string "<mark>" on screen.
		expect(document.body.textContent ?? "").not.toContain("<mark>");
	});

	it("indents excerpt rows beneath their page row", async () => {
		renderDialog();
		await screen.findByText("MCP Servers");

		// ps-4 is fumadocs' indent for type "text". Its presence is what makes the
		// list read as "page, then why it matched" instead of a flat sitemap.
		expect(document.body.querySelectorAll(".ps-4").length).toBeGreaterThan(0);
	});
});
