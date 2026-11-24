// Hosted orchestkit_docs_get must read every published docs page, including the
// hand-authored /docs/mcp and /docs/sdk landing pages that are not Fumadocs MDX.

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

async function docsGet(path: string) {
	const { POST } = await import("@/app/api/mcp/route");
	const res = await POST(
		new Request("https://orchestkit.dev/api/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "orchestkit_docs_get", arguments: { path } },
			}),
		}),
	);
	return (await res.json()).result;
}

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
