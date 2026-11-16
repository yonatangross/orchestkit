import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLUGIN_INSTALL_COMMAND, run } from "../src/cli-core.js";
import { HOSTS, type HostEnv, detectHosts, installText } from "../src/hosts.js";

// Detection is injected (env + a PATH lookup), so no test depends on the
// machine running it.
function hostEnv(bins: string[], env: Record<string, string> = {}): HostEnv {
	return { env, hasBin: (b) => bins.includes(b) };
}

describe("detectHosts", () => {
	it("finds nothing on a bare machine", () => {
		expect(detectHosts(hostEnv([]))).toEqual([]);
	});

	it("finds Claude Code from CLAUDECODE=1 even without the binary on PATH", () => {
		expect(detectHosts(hostEnv([], { CLAUDECODE: "1" }))).toEqual(["claude"]);
	});

	it("finds Codex and Cursor from their binaries, in the site's host order", () => {
		expect(detectHosts(hostEnv(["codex", "cursor"]))).toEqual(["cursor", "codex"]);
	});

	it("finds every host whose binary is present", () => {
		const all = HOSTS.flatMap((h) => h.bins);
		expect(detectHosts(hostEnv(all))).toEqual(HOSTS.map((h) => h.id));
	});
});

describe("installText", () => {
	it("prints only the detected hosts' commands", () => {
		const out = installText(["codex"]);
		expect(out).toContain("Codex");
		expect(out).toContain("codex plugin add ork-codex@orchestkit-codex");
		expect(out).not.toContain(PLUGIN_INSTALL_COMMAND);
	});

	it("with no host detected, lists every host and how to pick one", () => {
		const out = installText([]);
		for (const h of HOSTS) expect(out).toContain(h.name);
		expect(out).toContain("orchestkit install <host>");
	});
});

describe("orchestkit install", () => {
	it("install <host> prints that host, whatever is detected", async () => {
		const res = await run(["install", "codex"], { version: "1.2.3", hostEnv: hostEnv(["claude"]) });
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("codex plugin marketplace add yonatangross/orchestkit");
		expect(res.stdout).not.toContain(PLUGIN_INSTALL_COMMAND);
	});

	it("install with no host uses detection", async () => {
		const res = await run(["install"], { version: "1.2.3", hostEnv: hostEnv([], { CLAUDECODE: "1" }) });
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain(PLUGIN_INSTALL_COMMAND);
	});

	it("install --all prints every host", async () => {
		const res = await run(["install", "--all"], { version: "1.2.3", hostEnv: hostEnv([]) });
		for (const h of HOSTS) expect(res.stdout).toContain(h.name);
	});

	it("an unknown host exits 2 and names the valid ones", async () => {
		const res = await run(["install", "vscode"], { version: "1.2.3", hostEnv: hostEnv([]) });
		expect(res.exitCode).toBe(2);
		expect(res.stderr).toContain("claude");
		expect(res.stderr).toContain("codex");
	});

	it("help no longer calls OrchestKit a Claude Code plugin only", async () => {
		const res = await run(["help"], { version: "1.2.3" });
		expect(res.stdout).toContain("Cursor");
		expect(res.stdout).toContain("Codex");
		expect(res.stdout).not.toContain("the Claude Code plugin by Yonyon");
	});
});

// The site's lib/host-installs.ts is the source of truth for install commands.
// The CLI is a published package and cannot import site code, so this test
// fails when the two drift apart.
describe("drift against docs/site/lib/host-installs.ts", () => {
	const here = dirname(fileURLToPath(import.meta.url));
	const site = readFileSync(resolve(here, "../../../docs/site/lib/host-installs.ts"), "utf8");
	const starter = /SKILLS_SH_STARTER =\s*"([^"]+)"/.exec(site)?.[1];

	it("reads the site's starter command", () => {
		expect(starter).toBeDefined();
	});

	it("every CLI command is the site's command", () => {
		const claudeParts = PLUGIN_INSTALL_COMMAND.split(" && ");
		for (const host of HOSTS) {
			for (const cmd of host.commands) {
				const known =
					cmd === PLUGIN_INSTALL_COMMAND ||
					claudeParts.includes(cmd) ||
					cmd === starter ||
					site.includes(JSON.stringify(cmd));
				expect(known, `${host.id}: ${cmd}`).toBe(true);
			}
		}
	});

	it("the CLI knows every host id the site lists", () => {
		// Only the HOST_INSTALLS array: the same file also lists STACK_HINTS ids.
		const start = site.indexOf("export const HOST_INSTALLS");
		const block = site.slice(start, site.indexOf("\n];", start));
		const siteIds = [...block.matchAll(/^\t\tid: "([a-z]+)",$/gm)].map((m) => m[1]);
		expect(siteIds.length).toBeGreaterThan(0);
		expect(HOSTS.map((h) => h.id)).toEqual(siteIds);
	});
});
