import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/[token]/route";
import { POST } from "@/app/api/md/batch/route";

vi.mock("@/lib/source", () => ({
	source: {
		getPage: (slugs: string[]) =>
			slugs.join("/") === "getting-started/installation"
				? { slugs, data: { title: "Installation", description: "Install it." } }
				: undefined,
	},
}));
vi.mock("@/lib/docs-content", () => ({ readDocBody: async () => "Body." }));

const origin = "https://orchestkit.dev";
const boundaryPath = "/docs/" + "a".repeat(
	3072 - Buffer.byteLength(JSON.stringify({ v: 1, kind: "md-batch", paths: ["/docs/"] })),
);
const oversizedPaths = Array.from({ length: 20 }, (_, index) => "/docs/" + "a".repeat(160) + index);

function submit(paths: string[], { prefer, query = "" }: { prefer?: string; query?: string } = {}) {
	return POST(new Request(origin + "/api/md/batch" + query, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
		body: JSON.stringify({ paths }),
	}));
}

describe("Markdown batch job tokens", () => {
	it("returns a working poll URL at the inclusive 4096-character boundary", async () => {
		const submission = await submit([boundaryPath], { prefer: "respond-async" });
		expect(submission.status).toBe(202);
		const { job_id: token, status_url: statusUrl } = await submission.json();
		expect(token).toHaveLength(4096);
		expect(submission.headers.get("Location")).toBe(statusUrl);
		expect(statusUrl).toBe(`/api/jobs/${token}`);
		const poll = await GET(new Request(origin + statusUrl), {
			params: Promise.resolve({ token: statusUrl.split("/").at(-1)! }),
		});
		expect(poll.status).toBe(200);
		expect(await poll.json()).toMatchObject({
			job_id: token,
			status: "completed",
			result: { results: [{ path: boundaryPath, ok: false, status: 404 }] },
		});
	});

	it.each([
		{ paths: oversizedPaths, options: { prefer: "respond-async" } },
		{ paths: [boundaryPath.slice(0, -1) + "é"], options: { query: "?async=1" } },
	])("rejects oversize async tokens instead of advertising a poll URL ($options)", async ({ paths, options }) => {
		const submission = await submit(paths, options);
		expect(submission.status).toBe(400);
		expect(submission.headers.has("Location")).toBe(false);
		expect(submission.headers.has("Preference-Applied")).toBe(false);
		expect(submission.headers.has("RateLimit-Limit")).toBe(true);
		expect(await submission.json()).toMatchObject({
			status: 400,
			detail: expect.stringContaining("smaller batches"),
		});
	});

	it("still allows the same oversized input in synchronous mode", async () => {
		const submission = await submit(oversizedPaths);
		expect(submission.status).toBe(200);
		expect((await submission.json()).results).toHaveLength(oversizedPaths.length);
	});
});

describe("Markdown batch reads every published docs page", () => {
	const paths = ["/docs/mcp", "/docs/sdk.md", "/docs/getting-started/installation", "/docs/nope"];
	const expected = [
		{ path: "/docs/mcp", ok: true, title: "OrchestKit MCP server", markdown: expect.stringMatching(/^# OrchestKit MCP server\n/) },
		{ path: "/docs/sdk.md", ok: true, title: "OrchestKit SDK packages", markdown: expect.stringMatching(/^# OrchestKit SDK packages\n/) },
		{ path: "/docs/getting-started/installation", ok: true, title: "Installation", markdown: "# Installation\n\nInstall it.\n\nBody.\n" },
		{ path: "/docs/nope", ok: false, status: 404 },
	];

	it("resolves the /docs/mcp and /docs/sdk landing pages in a synchronous batch", async () => {
		const res = await submit(paths);
		expect(res.status).toBe(200);
		expect((await res.json()).results).toMatchObject(expected);
	});

	it("resolves the same landing pages when the async job is polled", async () => {
		const { status_url: statusUrl } = await (await submit(paths, { prefer: "respond-async" })).json();
		const poll = await GET(new Request(origin + statusUrl), {
			params: Promise.resolve({ token: statusUrl.split("/").at(-1)! }),
		});
		expect(poll.status).toBe(200);
		expect((await poll.json()).result.results).toMatchObject(expected);
	});
});
