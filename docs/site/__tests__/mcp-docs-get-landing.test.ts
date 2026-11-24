// Hosted orchestkit_docs_get must read every published docs page, including the
// hand-authored /docs/mcp and /docs/sdk landing pages that are not Fumadocs MDX,
// and the absolute URLs orchestkit_docs_search returns.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/source", () => ({
	source: {
		getPage: (slugs: string[]) =>
			slugs.join("/") === "getting-started/installation"
				? { slugs, data: { title: "Installation", description: "Install it." } }
				: undefined,
	},
}));
vi.mock("@/lib/docs-content", () => ({ readDocBody: async () => "Body." }));
vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: () => {} }));

async function callTool(name: string, args: Record<string, unknown>) {
	const { POST } = await import("@/app/api/mcp/route");
	const res = await POST(
		new Request("https://orchestkit.dev/api/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		}),
	);
	return (await res.json()).result;
}

const docsGet = (path: string) => callTool("orchestkit_docs_get", { path });

describe("orchestkit_docs_get on docs landing pages", () => {
	it.each([
		["/docs/mcp", "# OrchestKit MCP server\n"],
		["/docs/sdk", "# OrchestKit SDK packages\n"],
	])("reads %s", async (path, heading) => {
		const r = await docsGet(path);
		expect(r.isError).toBeUndefined();
		expect(r.structuredContent.path).toBe(path);
		expect(r.structuredContent.markdown.startsWith(heading)).toBe(true);
	});

	it("keeps the ordinary page Markdown and still reports a miss", async () => {
		const page = await docsGet("/docs/getting-started/installation");
		expect(page.structuredContent.markdown).toBe("# Installation\n\nInstall it.\n\nBody.\n");
		const miss = await docsGet("/docs/nope");
		expect(miss.isError).toBe(true);
	});
});

describe("orchestkit_docs_get with orchestkit_docs_search result URLs", () => {
	it("reads the URL a search result returns, the same as its path", async () => {
		const search = await callTool("orchestkit_docs_search", { query: "installation" });
		const url: string = search.structuredContent.results[0].url;
		expect(url).toBe("https://orchestkit.dev/docs/getting-started/installation");

		const byUrl = await docsGet(url);
		const byPath = await docsGet(new URL(url).pathname);
		expect(byUrl.isError).toBeUndefined();
		expect(byUrl.structuredContent).toEqual(byPath.structuredContent);
		expect(byUrl.structuredContent.path).toBe("/docs/getting-started/installation");
	});

	it.each([
		"https://example.com/docs/getting-started/installation",
		"https://orchestkit.dev.example.com/docs/getting-started/installation",
		"https://orchestkit.dev/mcp",
		"http://orchestkit.dev/docs/getting-started/installation",
		"file:///docs/getting-started/installation",
	])("rejects %s without fetching it", async (url) => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		try {
			const r = await docsGet(url);
			expect(r.isError).toBe(true);
			expect(r.content[0].text).toContain("is not an OrchestKit docs URL");
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
