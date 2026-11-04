#!/usr/bin/env node
// ============================================================================
// Vercel Labs MCP servers (portless, emulate, agent-browser, vercel) in the
// OrchestKit MCP templates
// ============================================================================
// Decided 2026-10-29 (yellow-refactor-desk, operator scope):
//
//   portless, emulate  every template that carries servers, default profile,
//                      absolute /opt/homebrew/bin command.
//   agent-browser      Claude Code templates, the pi example and the Codex
//                      profile, `mcp --tools core`. NOT Muse, NOT Devin: MCP
//                      tool loading is not measured there (~20.6k tokens of
//                      schema if loaded up front). OrchestKit ships no Muse or
//                      Devin template, so there is nothing to wire and nothing
//                      to add.
//   vercel (hosted)    OUT of the Claude Code templates. Present and disabled
//                      in the pi example and the Codex profile.
//
// The agent-browser entry carries the settings the CLI path uses (mock
// keychain, basic password store, its own session and namespace, tab pin).
// It carries NO --cdp port: the per-identity automation Chrome is operator
// local (hq-ext browser-identity.sh), and this is a public plugin template.
//
// Reads files only. Starts no server, touches no account.
// ============================================================================

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const json = (rel) => JSON.parse(read(rel));
const BIN = "/opt/homebrew/bin";
const CHROME_ARGS = "--mute-audio,--use-mock-keychain,--password-store=basic";

let passed = 0;
let failed = 0;
function check(name, fn) {
	try {
		fn();
		passed += 1;
		console.log(`ok   ${name}`);
	} catch (error) {
		failed += 1;
		console.log(`FAIL ${name}\n     ${String(error.message).split("\n")[0]}`);
	}
}

const CLAUDE = {
	enabled: ".claude/templates/mcp-enabled.json",
	disabled: ".claude/templates/mcp-disabled.json",
};

function agentBrowserSettings(spec, session, namespace) {
	assert.equal(spec.command, `${BIN}/agent-browser`);
	assert.deepEqual(spec.args, ["mcp", "--tools", "core"]);
	assert.equal(spec.env.AGENT_BROWSER_ARGS, CHROME_ARGS);
	assert.equal(spec.env.AGENT_BROWSER_SESSION, session);
	assert.equal(spec.env.AGENT_BROWSER_NAMESPACE, namespace);
	assert.equal(spec.env.AGENT_BROWSER_PIN_TAB, "1");
	for (const key of Object.keys(spec.env)) assert.match(key, /^AGENT_BROWSER_/);
	assert.ok(!JSON.stringify(spec).match(/op:\/\/|ops_|Bearer|op read|op run|op inject|--cdp/));
}

for (const [label, rel] of Object.entries(CLAUDE)) {
	check(`${label}: portless and emulate on the default profile`, () => {
		const servers = json(rel).mcpServers;
		for (const name of ["portless", "emulate"]) {
			assert.equal(servers[name].command, `${BIN}/${name}`);
			assert.deepEqual(servers[name].args, ["mcp"]);
		}
	});
	check(`${label}: agent-browser core profile with the CLI-path settings`, () => {
		agentBrowserSettings(json(rel).mcpServers["agent-browser"], "ork-mcp-cc", "abmcp-ork");
	});
	check(`${label}: vercel is not in the Claude Code template`, () => {
		assert.ok(!("vercel" in json(rel).mcpServers));
	});
}

check("enabled template: the three new servers are not disabled", () => {
	const servers = json(CLAUDE.enabled).mcpServers;
	for (const name of ["portless", "emulate", "agent-browser"]) {
		assert.notEqual(servers[name].disabled, true);
	}
});

check("disabled template: the three new servers ship disabled", () => {
	const servers = json(CLAUDE.disabled).mcpServers;
	for (const name of ["portless", "emulate", "agent-browser"]) {
		assert.equal(servers[name].disabled, true);
	}
});

// ---- pi example (attended pi: copy to .pi/mcp.json) ----
const PI = ".pi/mcp.json.example";

check("pi example: portless and emulate defined, unrestricted on purpose", () => {
	const servers = json(PI).mcpServers;
	for (const name of ["portless", "emulate"]) {
		assert.equal(servers[name].command, `${BIN}/${name}`);
		assert.deepEqual(servers[name].args, ["mcp"]);
		assert.equal(servers[name].$allowAll, true);
		assert.ok(!("type" in servers[name]));
	}
});

check("pi example: agent-browser enabled on the core profile (attended pi)", () => {
	const spec = json(PI).mcpServers["agent-browser"];
	agentBrowserSettings(spec, "ork-mcp-pi", "abmcp-pi");
	assert.notEqual(spec.disabled, true);
	assert.equal(spec.$allowAll, true);
	assert.ok(!("type" in spec));
});

check("pi example: vercel present and natively disabled", () => {
	const spec = json(PI).mcpServers.vercel;
	assert.equal(spec.url, "https://mcp.vercel.com");
	assert.equal(spec.disabled, true);
	assert.ok(!("type" in spec));
});

check("pi example still passes the pi template validator", () => {
	execFileSync("python3", [
		`${root}tests/plugins/pi/check-mcp-template.py`,
		`${root}${PI}`,
		`${root}tests/agents/mcp-servers.manifest.json`,
	]);
});

// The Codex profile (src/codex/ork-codex/mcp.json) is deliberately NOT wired:
// it is a public manifest, absolute /opt/homebrew/bin paths would break every
// other user, and tests/plugins/test-codex-plugin.sh pins it to context7 only.

// ---- README (the configure skill's MCP reference; src is the source) ----
for (const rel of [
	"src/skills/configure/references/mcp-config.md",
	"plugins/ork/skills/configure/references/mcp-config.md",
]) {
	check(`${rel} says why Muse and Devin keep the CLI skill`, () => {
		assert.ok(
			read(rel).includes(
				"MCP tool loading not measured on Muse and Devin; ~20.6k tokens of schema if loaded up front",
			),
		);
	});
	check(`${rel} lists the unwired settings and the 1Password rule`, () => {
		const text = read(rel);
		assert.ok(text.includes("not wired: env name unconfirmed"));
		assert.ok(text.includes("allowed-domains") && text.includes("action-policy"));
		assert.ok(text.includes("op-read.sh"));
		assert.ok(text.includes("--cdp"));
	});
	check(`${rel} documents isolated by default, with no CDP pin`, () => {
		const text = read(rel);
		assert.ok(text.includes("isolated by default"));
		assert.ok(
			text.includes("A lane attaches to an identity Chrome per task through the browser-login skill"),
		);
		assert.ok(!text.includes("also pass `--cdp 9222`"));
		assert.ok(!text.includes("Add `--cdp <port>` before `mcp`"));
	});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
