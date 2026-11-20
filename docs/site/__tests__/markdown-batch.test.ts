import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/[token]/route";
import { POST } from "@/app/api/md/batch/route";

vi.mock("@/lib/source", () => ({ source: { getPage: () => undefined } }));
vi.mock("@/lib/docs-content", () => ({ readDocBody: vi.fn() }));

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
