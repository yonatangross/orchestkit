import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

// The reporter holds module-scoped per-session state (sent counter + seen
// signatures). Each test re-imports the module after vi.resetModules() so that
// state is fresh, then drives the FETCH fallback path (sendBeacon removed) so we
// can read the JSON body synchronously.

async function load() {
	return import("@/components/client-error-reporter");
}

function lastBody(fetchMock: ReturnType<typeof vi.fn>): { project_id: string; events: Array<{ name: string; path: string; properties: Record<string, unknown> }> } {
	const call = fetchMock.mock.calls.at(-1);
	return JSON.parse((call?.[1] as RequestInit).body as string);
}

describe("client-error-reporter", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("NODE_ENV", "production");
		// Force the fetch fallback (inspectable string body) instead of sendBeacon(Blob).
		Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });
		fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("beacons an error as an {name:'error'} event to /api/analytics", async () => {
		const { reportClientError } = await load();
		reportClientError(new Error("boom"), { kind: "fetch", component: "Foo" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe("/api/analytics");
		const body = lastBody(fetchMock);
		expect(body.project_id).toBe("orchestkit");
		expect(body.events[0].name).toBe("error");
		expect(body.events[0].properties.message).toBe("boom");
		expect(body.events[0].properties.kind).toBe("fetch");
		expect(body.events[0].properties.component).toBe("Foo");
	});

	it("deduplicates repeated error signatures within a session", async () => {
		const { reportClientError } = await load();
		const err = new Error("same");
		reportClientError(err);
		reportClientError(err);
		reportClientError(new Error("same")); // same message+stack-head signature
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("is a no-op in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const { reportClientError } = await load();
		reportClientError(new Error("dev-error"));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails open when the sink throws", async () => {
		vi.stubGlobal("fetch", vi.fn(() => {
			throw new Error("network down");
		}));
		const { reportClientError } = await load();
		expect(() => reportClientError(new Error("kaboom"))).not.toThrow();
	});

	it("caps beacons per session to protect the ingest", async () => {
		const { reportClientError } = await load();
		for (let i = 0; i < 40; i++) reportClientError(new Error(`distinct-${i}`));
		expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(25);
		expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
	});

	it("ClientErrorReporter beacons uncaught window error events", async () => {
		const { ClientErrorReporter } = await load();
		render(<ClientErrorReporter />);
		window.dispatchEvent(new ErrorEvent("error", { error: new Error("uncaught"), message: "uncaught" }));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(lastBody(fetchMock).events[0].properties.kind).toBe("onerror");
	});

	it("ClientErrorReporter beacons unhandled promise rejections", async () => {
		const { ClientErrorReporter } = await load();
		render(<ClientErrorReporter />);
		// happy-dom has no PromiseRejectionEvent constructor — build a plain Event
		// and attach `reason`, matching the shape the reporter reads (e.reason).
		const rejectionEvent = Object.assign(new Event("unhandledrejection"), {
			reason: new Error("rejected"),
		});
		window.dispatchEvent(rejectionEvent);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(lastBody(fetchMock).events[0].properties.kind).toBe("unhandledrejection");
	});
});
