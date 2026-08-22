// End-to-end tests of the BUILT binary.
//
// The unit suite stubs fetch in-process, which cannot catch the failures that
// only appear once the package is installed: a missing shebang, a bin without
// the executable bit, a broken ESM specifier in the emitted JS. Those surface
// for the first time on someone else's machine after `npm i -g orchestkit`, so
// they get a real spawn here.
//
// Offline commands are spawned via the bin path directly, which exercises the
// shebang and the exec bit. Networked commands are spawned through
// `node --import tests/fixtures/fetch-stub.mjs`, so the real emitted code runs
// against fixtures with no socket and no network.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BIN = resolve(__dirname, "../dist/cli.js");
const STUB = resolve(__dirname, "fixtures/fetch-stub.mjs");
const built = existsSync(BIN);

type Out = { stdout: string; stderr: string; code: number };

function spawnBin(args: string[], viaNodeStub = false): Promise<Out> {
	const [cmd, argv] = viaNodeStub
		? ["node", ["--import", STUB, BIN, ...args]]
		: [BIN, args];
	return new Promise((res) => {
		const child = spawn(cmd as string, argv as string[], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (c) => {
			stdout += String(c);
		});
		child.stderr.on("data", (c) => {
			stderr += String(c);
		});
		child.on("close", (code) => res({ stdout, stderr, code: code ?? -1 }));
	});
}

describe.skipIf(!built)("built binary, direct exec", () => {
	it("has a working shebang and exec bit, and prints help", async () => {
		const { stdout, code } = await spawnBin(["help"]);
		expect(code).toBe(0);
		expect(stdout).toContain("orchestkit <command>");
	});

	it("reports the version from its own package.json", async () => {
		const { stdout, code } = await spawnBin(["--version"]);
		expect(code).toBe(0);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("mcp stdio emits parseable client config", async () => {
		const { stdout, code } = await spawnBin(["mcp", "stdio"]);
		expect(code).toBe(0);
		expect(JSON.parse(stdout).mcpServers.orchestkit.command).toBe("docker");
	});

	it("an unknown command exits 2", async () => {
		expect((await spawnBin(["frobnicate"])).code).toBe(2);
	});
});

describe.skipIf(!built)("built binary, networked commands", () => {
	const base = ["--base-url", "https://fixture.test"];

	it("doctor reports a healthy API, the quota, and exits 0", async () => {
		const { stdout, code } = await spawnBin(["doctor", ...base], true);
		expect(stdout).toContain("ok    API reachable");
		expect(stdout).toContain("rate limit 118/120");
		expect(code).toBe(0);
	});

	it("doctor exits non-zero when the API is unreachable", async () => {
		const { stdout, code } = await spawnBin(
			["doctor", "--base-url", "https://unreachable.test"],
			true,
		);
		expect(stdout).toContain("FAIL  API unreachable");
		expect(code).toBe(1);
	});

	it("search prints a formatted hit and the remaining quota", async () => {
		const { stdout, code } = await spawnBin(["search", "doc", ...base], true);
		expect(code).toBe(0);
		expect(stdout).toContain("A doc");
		expect(stdout).toContain("118/120");
	});

	it("read fetches the Markdown twin of a docs page", async () => {
		const { stdout, code } = await spawnBin(
			["read", "foundations/overview", ...base],
			true,
		);
		expect(code).toBe(0);
		expect(stdout).toContain("# A doc");
	});

	it("a 429 surfaces the problem detail and Retry-After on stderr", async () => {
		const { stderr, code } = await spawnBin(
			["search", "over-limit", ...base],
			true,
		);
		expect(code).toBe(1);
		expect(stderr).toContain("Rate limit exceeded.");
		expect(stderr).toContain("Retry after 42s");
	});
});
