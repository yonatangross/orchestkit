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

function submit(
	paths: string[],
	{ prefer, query = "", idempotencyKey }: { prefer?: string; query?: string; idempotencyKey?: string } = {},
) {
	return POST(new Request(origin + "/api/md/batch" + query, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(prefer ? { Prefer: prefer } : {}),
			...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
		},
		body: JSON.stringify({ paths }),
	}));
}

describe("Markdown batch async preferences", () => {
	const paths = ["/docs/getting-started/installation"];

	it.each([
		'return=representation; note="respond-async"',
		'return="a; b", wait=5; note="escaped \\" quote, respond-async, tail"',
		"return=respond-async; respond-async",
		"not-respond-async, respond-async-extra",
	])("keeps the response synchronous for Prefer: %s", async (prefer) => {
		const res = await submit(paths, { prefer });
		expect(res.status).toBe(200);
		expect(res.headers.has("Preference-Applied")).toBe(false);
		expect(await res.json()).toMatchObject({ results: [{ path: paths[0], ok: true }] });
	});

	it.each([
		{ prefer: 'return="a, b; c", ReSpOnD-AsYnC; wait=5' },
		{ query: "?async=1" },
	])("accepts an explicit async request ($prefer $query)", async (options) => {
		const res = await submit(paths, options);
		expect(res.status).toBe(202);
		expect(res.headers.get("Preference-Applied")).toBe("respond-async");
		expect(res.headers.get("Location")).toMatch(/^\/api\/jobs\//);
	});
});

describe("Markdown batch retry correlation", () => {
	const paths = ["/docs/getting-started/installation"];
	const idempotencyKey = "batch-retry";

	it.each([
		{ prefer: "respond-async" },
		{ query: "?async=1" },
	])("echoes the key on async acceptance ($prefer $query)", async (options) => {
		const sync = await submit(paths, { idempotencyKey });
		expect(sync.status).toBe(200);
		expect(sync.headers.get("Idempotency-Key")).toBe(idempotencyKey);

		const submission = await submit(paths, { ...options, idempotencyKey });
		expect(submission.status).toBe(202);
		expect(submission.headers.get("Idempotency-Key")).toBe(idempotencyKey);

		const { job_id: token, status_url: statusUrl } = await submission.json();
		expect(submission.headers.get("Location")).toBe(statusUrl);
		expect(statusUrl).toBe(`/api/jobs/${token}`);
		const poll = await GET(new Request(origin + statusUrl), {
			params: Promise.resolve({ token }),
		});
		expect(poll.status).toBe(200);
		expect(poll.headers.has("Idempotency-Key")).toBe(false);
		expect(await poll.json()).toEqual({
			job_id: token,
			status: "completed",
			result: await sync.json(),
		});
	});

	it("omits the key from async acceptance when it was not sent", async () => {
		const submission = await submit(paths, { prefer: "respond-async" });
		expect(submission.status).toBe(202);
		expect(submission.headers.has("Idempotency-Key")).toBe(false);
	});
});

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
