import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { RATE_LIMIT } from "@/lib/rate-limit";
import { middleware } from "@/middleware";

vi.mock("@/lib/analytics-server", () => ({
	reportServerEvent: vi.fn(),
	reportServerEvents: vi.fn(),
}));

function request(path: string, accept = "application/json") {
	return new NextRequest(`https://orchestkit.dev${path}`, {
		headers: { accept, "x-real-ip": "192.0.2.5" },
	});
}

describe("middleware rate limits", () => {
	it("meters the API discovery route and its aliases in the same window", async () => {
		for (const [path, remaining] of [
			["/api", RATE_LIMIT - 1],
			["/api/", RATE_LIMIT - 2],
			["/api/v1", RATE_LIMIT - 3],
			["/api/v1/", RATE_LIMIT - 4],
		] as const) {
			const response = await middleware(request(path));

			expect(response.headers.get("x-middleware-next"), path).toBe("1");
			expect(response.headers.get("RateLimit-Policy"), path).toBe(`${RATE_LIMIT};w=60`);
			expect(response.headers.get("RateLimit-Limit"), path).toBe(String(RATE_LIMIT));
			expect(response.headers.get("RateLimit-Remaining"), path).toBe(String(remaining));
			const reset = Number(response.headers.get("RateLimit-Reset"));
			expect(reset, path).toBeGreaterThan(0);
			expect(reset, path).toBeLessThanOrEqual(60);
		}
	});

	it("keeps health metered and HTML and analytics unmetered", async () => {
		const health = await middleware(request("/api/health"));
		expect(health.headers.get("RateLimit-Remaining")).toBe(String(RATE_LIMIT - 1));

		for (const [path, accept] of [
			["/docs/foundations/overview", "text/html"],
			["/api/analytics", "application/json"],
		]) {
			const response = await middleware(request(path, accept));
			expect(response.headers.get("x-middleware-next"), path).toBe("1");
			expect([...response.headers.keys()].some((name) => name.includes("ratelimit")), path)
				.toBe(false);
		}
	});
});
