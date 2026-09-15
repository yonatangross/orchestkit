import { describe, expect, it } from "vitest";
import { isServedPath } from "@/lib/agent-404";
import {
	INDEXNOW_KEY,
	INDEXNOW_KEY_PATH,
	INDEXNOW_URLS,
	indexNowPayload,
} from "@/lib/indexnow";

describe("IndexNow", () => {
	it("hosts the key file at a served path matching the payload", () => {
		expect(INDEXNOW_KEY_PATH).toBe(`/${INDEXNOW_KEY}.txt`);
		expect(isServedPath(INDEXNOW_KEY_PATH)).toBe(true);
		expect(indexNowPayload().keyLocation).toBe(
			`https://orchestkit.yonyon.ai${INDEXNOW_KEY_PATH}`,
		);
	});

	it("submits the four named developer pages", () => {
		expect([...INDEXNOW_URLS]).toEqual([
			"https://orchestkit.yonyon.ai/developers",
			"https://orchestkit.yonyon.ai/openapi",
			"https://orchestkit.yonyon.ai/mcp-server",
			"https://orchestkit.yonyon.ai/sdk",
		]);
	});
});
