import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
	HELP,
	PLUGIN_INSTALL_COMMAND,
	parseArgs,
	run,
} from "../src/cli-core.js";
import { mcpConfig } from "../src/mcp-config.js";
import { ApiError, createClient, getJson, getMarkdown, readDoc, search } from "../src/api.js";

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

	it("reads help and version as flags, never as positional words", () => {
		expect(parseArgs(["read", "--help", "x", "-v"])).toMatchObject({
			command: "help",
			help: true,
			version: true,
		});
		expect(parseArgs(["mcp", "-v"]).command).toBe("version");
	});

	it("collects the command and its positional words", () => {
		const args = parseArgs(["search", "parallel", "agents"]);
		expect(args.command).toBe("search");
		expect(args.positional).toEqual(["parallel", "agents"]);
	});
	it("parses --all as a flag without adding a positional", () => {
		expect(parseArgs(["install", "--all"])).toMatchObject({ all: true, positional: [] });
	});
	it.each(["search", "ask"])("ends option parsing for %s", (command) => {
		expect(parseArgs([command, "--", "-foo", "--json"])).toMatchObject({
			command, positional: ["-foo", "--json"], json: false,
		});
	});

	it("accepts --limit from 1 to 100 without clamping", () => {
		expect(parseArgs(["search", "x", "--limit", "3"]).limit).toBe(3);
		expect(parseArgs(["search", "x", "--limit", "1"]).limit).toBe(1);
		expect(parseArgs(["search", "x", "--limit", "80"]).limit).toBe(80);
		expect(parseArgs(["search", "x", "--limit", "100"]).limit).toBe(100);
	});

	it.each(["abc", "3abc", "", " 3 "])("rejects an invalid --limit value (%j)", (value) => {
		expect(() => parseArgs(["search", "x", "--limit", value])).toThrow(
			"--limit requires an integer",
		);
	});
});

describe("invalid arguments", () => {
	it.each(["-3", "0", "101", "9999"])("rejects an out-of-range --limit (%j) before creating a client", async (value) => {
		const res = await run(["search", "hooks", "--limit", value], {
			version: "1.2.3",
			clientFactory: () => { throw new Error("Unexpected client creation"); },
		});
		expect(res).toEqual({ stdout: "", stderr: "--limit must be between 1 and 100.\n", exitCode: 2 });
	});

	it.each([
		["search", "hooks", "--limt", "3"],
		["mcp", "--josn"],
		["search", "hooks", "-x"],
		["read", "--all"],
		["search", "hooks", "--all"],
	])("rejects unknown options in %j", async (...argv) => {
		const res = await run(argv);
		expect(res.exitCode).toBe(2);
		expect(res.stdout).toBe("");
		expect(res.stderr).toContain("Unknown option");
	});

	it.each([
		["install", "claude", "cursor"],
		["mcp", "stdio", "extra"],
		["read", "foundations/overview", "extra"],
	])("rejects extra positionals in %j", async (...argv) => {
		const res = await run(argv);
		expect(res.exitCode).toBe(2);
		expect(res.stdout).toBe("");
		expect(res.stderr).toContain("accepts at most one positional argument");
	});
	it.each([
		["install", "--all", "claude"],
		["install", "claude", "--all"],
	])("rejects combining --all and a host in %j", async (...argv) => {
		expect(await run(argv)).toEqual({ stdout: "", stderr: "install cannot combine --all with a host.\n", exitCode: 2 });
	});
	it.each([["install", "--all"], ["install", "claude"]])("keeps %j working", async (...argv) => {
		const res = await run(argv);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain(PLUGIN_INSTALL_COMMAND);
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

	it("install prints the documented Claude Code command inside Claude Code", async () => {
		const res = await run(["install"], {
			version: "1.2.3",
			hostEnv: { env: { CLAUDECODE: "1" }, hasBin: () => false },
		});
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

describe("help and version flags", () => {
	// Any fetch here is a bug: an information flag must never become a query,
	// a page slug or a host name.
	function forbidFetch() {
		return stubFetch((url) => {
			throw new Error(`unexpected fetch: ${url}`);
		});
	}

	it.each([
		["read", "--help"],
		["install", "--help"],
		["search", "agents", "-h"],
		["ask", "what", "is", "ork", "--help"],
		["mcp", "stdio", "-h"],
		["--help", "--version"],
		["--version", "--help"],
		["--help", "--all"],
		["search", "hooks", "--limt", "3", "--help"],
		["search", "hooks", "--help", "--limt", "3"],
	])("%j prints help without running the command", async (...argv) => {
		const restore = forbidFetch();
		try {
			expect(await run(argv, { version: "1.2.3" })).toEqual({
				stdout: HELP,
				stderr: "",
				exitCode: 0,
			});
		} finally {
			restore();
		}
	});

	it.each([
		["mcp", "--version"],
		["install", "claude", "-v"],
		["read", "foundations/overview", "--version"],
		["search", "--json", "x", "-v"],
		["--version", "--all"],
		["search", "hooks", "--limt", "3", "--version"],
		["search", "hooks", "--version", "--limt", "3"],
		["search", "hooks", "--limt", "3", "-v"],
	])("%j prints the version without running the command", async (...argv) => {
		const restore = forbidFetch();
		try {
			expect(await run(argv, { version: "1.2.3" })).toEqual({
				stdout: "1.2.3\n",
				stderr: "",
				exitCode: 0,
			});
		} finally {
			restore();
		}
	});

	it("keeps install --all as a host selector, not a flag", async () => {
		const res = await run(["install", "--all"], { version: "1.2.3" });
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain(PLUGIN_INSTALL_COMMAND);
	});
});

describe("networked commands", () => {
	it("search preserves API page titles, headings and text snippets", async () => {
		const restore = stubFetch(() =>
			jsonResponse([
				{ id: "1", url: "/docs/blocks", type: "page", content: "The 3 Building Blocks" },
				{ id: "2", url: "/docs/blocks#parallel", type: "heading", content: "Parallel Agents" },
				{ id: "3", url: "/docs/blocks#parallel", type: "text", content: "Multiple agents work simultaneously." },
			]),
		);
		try {
			const res = await run(["search", "parallel"], { version: "1.2.3" });
			expect(res.exitCode).toBe(0);
			expect(res.stdout).toContain("1. The 3 Building Blocks");
			expect(res.stdout).toContain("2. Parallel Agents");
			expect(res.stdout).toContain("3. Multiple agents work simultaneously.");
		} finally {
			restore();
		}
	});

	it.each(["json", "markdown"] as const)("times out a stalled %s response body", async (format) => {
		const server = createServer((_req, res) => {
			res.writeHead(200, { "content-type": format === "json" ? "application/json" : "text/markdown" });
			res.write(format === "json" ? '{"partial":' : "# Partial");
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		try {
			const address = server.address();
			if (!address || typeof address === "string") throw new Error("Expected TCP address");
			const client = createClient({ baseUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 100 });
			const started = performance.now();
			await expect(format === "json" ? getJson(client, "/") : getMarkdown(client, "/")).rejects.toMatchObject({ name: "AbortError" });
			expect(performance.now() - started).toBeLessThan(1000);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
	}, 2000);

	it("search formats hits and reports the remaining quota", async () => {
		const restore = stubFetch(() =>
			jsonResponse([
				{ id: "1", url: "/docs/foundations/overview", title: "Overview" },
			]),
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
		const restore = stubFetch(() => jsonResponse([{ id: "1", url: "/x" }]));
		try {
			const res = await run(["search", "x", "--json"], { version: "1.2.3" });
			expect(JSON.parse(res.stdout)).toEqual([{ id: "1", url: "/x" }]);
		} finally {
			restore();
		}
	});

	it("search reports no matches for an empty array", async () => {
		const restore = stubFetch(() => jsonResponse([]));
		try {
			const res = await run(["search", "missing"], { version: "1.2.3" });
			expect(res.exitCode).toBe(0);
			expect(res.stdout).toBe(
				"No matches. Try a broader query, or browse https://orchestkit.dev/llms.txt\n",
			);
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

	it.each([
		"https://example.test/docs/foundations/overview",
		"http://example.test/docs/foundations/overview.md?lang=en#install",
		"docs/foundations/overview",
		"docs/foundations/overview.md?lang=en#install",
		"foundations/overview#install",
		"/docs/foundations/overview#install",
		"foundations/overview.md#install",
		"/docs/foundations/overview.md#install",
		"foundations/overview#",
		"foundations/overview?lang=en#install",
		"/docs/foundations/overview.md?lang=en#install",
		"foundations/overview?lang=en",
	])("read normalizes page suffixes in %s to the .md URL", async (form) => {
		const seen: string[] = [];
		const restore = stubFetch((url) => {
			seen.push(url);
			return new Response("# Overview\n");
		});
		try {
			await readDoc(createClient({ baseUrl: "https://example.test" }), form);
			expect(seen).toEqual(["https://example.test/docs/foundations/overview.md"]);
		} finally {
			restore();
		}
	});

	it("search() reads the IETF RateLimit headers off the response", async () => {
		const restore = stubFetch(() => jsonResponse([]));
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
