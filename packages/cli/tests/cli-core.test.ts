import { describe, expect, it } from "vitest";
import {
	HELP,
	PLUGIN_INSTALL_COMMAND,
	parseArgs,
	run,
} from "../src/cli-core.js";
import { mcpConfig } from "../src/mcp-config.js";
import { ApiError, createClient, readDoc, search } from "../src/api.js";

// A stub origin: every command that touches the network is exercised against a
// fetch stub, so the suite is hermetic and never depends on the live site.
function stubFetch(handler: (url: string) => Response) {
	const original = globalThis.fetch;
	globalThis.fetch = (input: RequestInfo | URL) =>
		Promise.resolve(handler(String(input)));
	return () => {
		globalThis.fetch = original;
	};
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: {
			"content-type": "application/json",
			"ratelimit-limit": "120",
			"ratelimit-remaining": "119",
			"ratelimit-reset": "60",
			...(init.headers as Record<string, string>),
		},
	});
}

describe("parseArgs", () => {
	it("defaults to help with no argv", () => {
		expect(parseArgs([]).command).toBe("help");
	});

	it("collects the command and its positional words", () => {
		const args = parseArgs(["search", "parallel", "agents"]);
		expect(args.command).toBe("search");
		expect(args.positional).toEqual(["parallel", "agents"]);
	});

	it("clamps --limit into a sane range instead of trusting it", () => {
		expect(parseArgs(["search", "x", "--limit", "3"]).limit).toBe(3);
		expect(parseArgs(["search", "x", "--limit", "9999"]).limit).toBe(50);
		expect(parseArgs(["search", "x", "--limit", "0"]).limit).toBe(1);
		// A non-numeric value keeps the default rather than becoming NaN.
		expect(parseArgs(["search", "x", "--limit", "abc"]).limit).toBe(5);
	});
});

describe("offline commands", () => {
	it("help exits 0 and names every command", async () => {
		const res = await run(["help"], { version: "1.2.3" });
		expect(res.exitCode).toBe(0);
		for (const cmd of ["install", "search", "ask", "read", "mcp", "doctor"]) {
			expect(res.stdout).toContain(cmd);
		}
	});

	it("version prints the injected version", async () => {
		expect((await run(["--version"], { version: "1.2.3" })).stdout).toBe("1.2.3\n");
	});

	it("install prints the documented Claude Code command", async () => {
		const res = await run(["install"], { version: "1.2.3" });
		expect(res.stdout).toContain(PLUGIN_INSTALL_COMMAND);
		expect(res.exitCode).toBe(0);
	});

	it("mcp emits valid client config for both transports", async () => {
		for (const transport of ["http", "stdio"] as const) {
			const res = await run(["mcp", transport], { version: "1.2.3" });
			expect(res.exitCode).toBe(0);
			const parsed = JSON.parse(res.stdout) as {
				mcpServers: Record<string, unknown>;
			};
			expect(parsed.mcpServers.orchestkit).toBeDefined();
		}
		expect(JSON.parse(mcpConfig("stdio")).mcpServers.orchestkit.command).toBe(
			"docker",
		);
	});

	it("rejects an unknown transport with exit 2, not a silent default", async () => {
		const res = await run(["mcp", "carrier-pigeon"], { version: "1.2.3" });
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain("carrier-pigeon");
	});

	it("an unknown command exits 2 and shows help", async () => {
		const res = await run(["frobnicate"], { version: "1.2.3" });
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain(HELP.split("\n")[0] as string);
	});

	it("search with no query is a usage error, not an empty search", async () => {
		expect((await run(["search"], { version: "1.2.3" })).exitCode).toBe(2);
	});
});

describe("networked commands", () => {
	it("search formats hits and reports the remaining quota", async () => {
		const restore = stubFetch(() =>
			jsonResponse({
				results: [
					{ id: "1", url: "/docs/foundations/overview", title: "Overview" },
				],
			}),
		);
		try {
			const res = await run(["search", "overview", "--base-url", "https://example.test"], {
				version: "1.2.3",
			});
			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("https://example.test/docs/foundations/overview");
			expect(res.stdout).toContain("119/120");
		} finally {
			restore();
		}
	});

	it("--json emits the raw array so scripts can pipe it", async () => {
		const restore = stubFetch(() => jsonResponse({ results: [{ id: "1", url: "/x" }] }));
		try {
			const res = await run(["search", "x", "--json"], { version: "1.2.3" });
			expect(JSON.parse(res.stdout)).toEqual([{ id: "1", url: "/x" }]);
		} finally {
			restore();
		}
	});

	it("surfaces an RFC 9457 problem detail verbatim and honours Retry-After", async () => {
		const restore = stubFetch(
			() =>
				new Response(
					JSON.stringify({
						type: "about:blank",
						title: "Too Many Requests",
						status: 429,
						detail: "Rate limit exceeded for /api/search.",
					}),
					{
						status: 429,
						headers: { "content-type": "application/json", "retry-after": "42" },
					},
				),
		);
		try {
			const res = await run(["search", "x"], { version: "1.2.3" });
			expect(res.exitCode).toBe(1);
			expect(res.stderr).toContain("Rate limit exceeded for /api/search.");
			expect(res.stderr).toContain("Retry after 42s");
		} finally {
			restore();
		}
	});

	it("read normalizes every accepted page form to one .md URL", async () => {
		const seen: string[] = [];
		const restore = stubFetch((url) => {
			seen.push(url);
			return new Response("# Overview\n", {
				headers: { "content-type": "text/markdown" },
			});
		});
		try {
			const client = createClient({ baseUrl: "https://example.test" });
			for (const form of [
				"foundations/overview",
				"/docs/foundations/overview",
				"foundations/overview.md",
			]) {
				await readDoc(client, form);
			}
			expect(new Set(seen).size).toBe(1);
			expect(seen[0]).toBe("https://example.test/docs/foundations/overview.md");
		} finally {
			restore();
		}
	});

	it("search() reads the IETF RateLimit headers off the response", async () => {
		const restore = stubFetch(() => jsonResponse({ results: [] }));
		try {
			const { rateLimit } = await search(
				createClient({ baseUrl: "https://example.test" }),
				"x",
				5,
			);
			expect(rateLimit).toEqual({ limit: 120, remaining: 119, reset: 60 });
		} finally {
			restore();
		}
	});

	it("ApiError carries the parsed problem object for programmatic callers", async () => {
		const restore = stubFetch(() =>
			jsonResponse(
				{ title: "Resource not found", status: 404, links: [{ href: "/llms.txt", title: "llms.txt" }] },
				{ status: 404 },
			),
		);
		try {
			await search(createClient({ baseUrl: "https://example.test" }), "x", 5);
			throw new Error("expected ApiError");
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).problem.links?.[0]?.href).toBe("/llms.txt");
		} finally {
			restore();
		}
	});
});

describe("base URL normalization", () => {
	it("drops trailing slashes", () => {
		expect(createClient({ baseUrl: "https://example.test/" }).baseUrl).toBe(
			"https://example.test",
		);
		expect(createClient({ baseUrl: "https://example.test///" }).baseUrl).toBe(
			"https://example.test",
		);
	});

	it("leaves a clean URL alone and never empties a slash-only string wrongly", () => {
		expect(createClient({ baseUrl: "https://example.test" }).baseUrl).toBe(
			"https://example.test",
		);
		expect(createClient({ baseUrl: "///" }).baseUrl).toBe("");
	});

	it("is linear on a pathological run of slashes (js/polynomial-redos)", () => {
		// The original `/\/+$/` was an anchored repetition over input reachable from
		// --base-url and ORCHESTKIT_BASE_URL, which CodeQL flagged as high severity.
		// 200k slashes would visibly stall a backtracking engine; the scan is linear.
		const pathological = `https://example.test${"/".repeat(200_000)}`;
		const started = performance.now();
		expect(createClient({ baseUrl: pathological }).baseUrl).toBe("https://example.test");
		expect(performance.now() - started).toBeLessThan(250);
	});
});
