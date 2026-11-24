import { describe, expect, it, vi } from "vitest";
import { POST as actionsPost } from "@/app/api/mcp/actions/route";
import { POST as docsPost } from "@/app/api/mcp/route";
import { reportServerEvents } from "@/lib/analytics-server";

vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: vi.fn() }));
vi.mock("@/lib/doc-markdown", () => ({ getDocMarkdown: async () => null }));

const ping = { jsonrpc: "2.0", id: 1, method: "ping" };
const notification = { jsonrpc: "2.0", method: "notifications/initialized" };
const pong = { jsonrpc: "2.0", id: 1, result: {} };
const invalidRequest = {
	jsonrpc: "2.0",
	id: null,
	error: { code: -32600, message: "Invalid Request" },
};

function request(path: string, body: string) {
	return new Request(`https://orchestkit.dev${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});
}

describe.each([
	{ path: "/api/mcp", post: docsPost },
	{ path: "/api/mcp/actions", post: actionsPost },
])("$path JSON-RPC envelopes", ({ path, post }) => {
	it.each([
		["null", "null"],
		["scalar", '"ping"'],
		["empty object", "{}"],
		["empty batch", "[]"],
		["missing version", '{"id":1,"method":"ping"}'],
		["wrong version", JSON.stringify({ ...ping, jsonrpc: "1.0" })],
		["non-string method", JSON.stringify({ ...ping, method: 1 })],
		["invalid ID", JSON.stringify({ ...ping, id: false })],
		["scalar params", JSON.stringify({ ...ping, params: "invalid" })],
		["null params", JSON.stringify({ ...ping, params: null })],
	])("returns Invalid Request for %s", async (_name, body) => {
		const response = await post(request(path, body));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual(invalidRequest);
	});

	it("keeps syntax errors distinct", async () => {
		const response = await post(request(path, "{"));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" },
		});
	});

	it("still answers valid requests, including ones with positional params", async () => {
		const response = await post(request(path, JSON.stringify({ ...ping, params: [] })));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(pong);
	});

	it.each([
		JSON.stringify(notification),
		JSON.stringify([notification, notification]),
	])("does not answer initialized notifications: %s", async (body) => {
		const response = await post(request(path, body));
		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});

	it("answers valid and invalid entries in order without answering the notification", async () => {
		const response = await post(request(path, JSON.stringify([
			ping, {}, notification, null, [ping], { ...ping, id: "last" },
		])));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			pong, invalidRequest, invalidRequest, invalidRequest, { ...pong, id: "last" },
		]);
	});
});

it("reports only dispatched docs MCP calls, not invalid envelopes", async () => {
	vi.mocked(reportServerEvents).mockClear();
	const response = await docsPost(request("/api/mcp", JSON.stringify([
		{ jsonrpc: "1.0", id: 1, method: "initialize" },
		{ jsonrpc: "2.0", id: 2, method: "tools/list" },
	])));
	expect(response.status).toBe(200);
	expect(reportServerEvents).toHaveBeenCalledExactlyOnceWith(expect.anything(), [
		expect.objectContaining({ properties: expect.objectContaining({ method: "tools/list" }) }),
	]);
});
