// MCP server card at <server>/server-card, listed in ai-catalog.
//
// Two separate facts are checked here.
// 1. $schema is the draft server-card identifier (SEP-2127) that
//    agent-readiness scanners match on. It is an identifier, not a fetch
//    target: the draft has no published schema file (the v1 URL answered
//    HTTP 404 on 2026-10-21, Codex XREVIEW on #4819).
// 2. The card's shape is checked against a schema that does exist: the
//    published MCP registry server.json schema (2025-12-11, HTTP 200 the same
//    day), pinned in __tests__/fixtures/. To move to a newer one: download
//    it, change SHAPE_SCHEMA_URL and the fixture name.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { GET as serverCardGET } from "@/app/api/mcp/server-card/route";
import { GET as catalogGET } from "@/app/api/well-known/ai-catalog/route";
import { SERVER_CARD_SCHEMA, serverCard } from "@/lib/server-card";

const DRAFT_CARD_ID =
	"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";

// Pinned copy of the published schema, checked with curl when pinned: HTTP 200.
const SHAPE_SCHEMA_URL =
	"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const SHAPE_SCHEMA_FILE = "mcp-server.schema.2025-12-11.json";

function loadShapeSchema(): Record<string, unknown> {
	return JSON.parse(readFileSync(join(__dirname, "fixtures", SHAPE_SCHEMA_FILE), "utf8"));
}

function validator() {
	// strictRequired is a lint of how the schema is written (the published
	// file lists a required name inside anyOf without a local property); it
	// says nothing about the card, so only that check is off.
	const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
	ajv.addVocabulary(["example"]); // annotation only, used by the MCP schema
	addFormats(ajv);
	return ajv.compile(loadShapeSchema());
}

describe("MCP server card", () => {
	it("declares the draft server-card identifier as $schema", async () => {
		const card = await serverCardGET().json();
		expect(card.$schema).toBe(SERVER_CARD_SCHEMA);
		expect(card.$schema).toBe(DRAFT_CARD_ID);
	});

	it("the pinned shape schema is the published file at its URL", () => {
		expect(loadShapeSchema().$id).toBe(SHAPE_SCHEMA_URL);
	});

	it("the whole card validates against the published schema", async () => {
		const card = await serverCardGET().json();
		const validate = validator();
		const ok = validate(card);
		expect(validate.errors ?? []).toEqual([]);
		expect(ok).toBe(true);
	});

	it("the validator rejects a card that breaks the schema", () => {
		const validate = validator();
		const tooLong = { ...serverCard(), description: "x".repeat(101) };
		const noVersion: Record<string, unknown> = { ...serverCard() };
		delete noVersion.version;
		const badRemote = {
			...serverCard(),
			remotes: [{ type: "carrier-pigeon", url: "https://orchestkit.dev/api/mcp" }],
		};
		for (const bad of [tooLong, noVersion, badRemote]) {
			expect(validate(bad)).toBe(false);
		}
	});

	it("has the card fields and no tools[]", async () => {
		const card = await serverCardGET().json();
		expect(card.name).toBe("dev.orchestkit/mcp");
		expect(card.description.length).toBeLessThanOrEqual(100);
		expect(card.remotes).toEqual([
			{ type: "streamable-http", url: "https://orchestkit.dev/api/mcp" },
		]);
		expect(card).not.toHaveProperty("tools");
		expect(card).toEqual(serverCard());
	});

	it("is the MCP entry in ai-catalog.json", async () => {
		const catalog = await catalogGET().json();
		const urls = catalog.entries.map((e: { url: string }) => e.url);
		expect(urls).toContain("https://orchestkit.dev/api/mcp/server-card");
	});
});
