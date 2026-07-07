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

	it("sends exactly 25 distinct errors then drops the 26th (per-session cap)", async () => {
		const { reportClientError } = await load();
		for (let i = 0; i < 25; i++) reportClientError(new Error(`distinct-${i}`));
		expect(fetchMock).toHaveBeenCalledTimes(25);

		// The 26th distinct error must be dropped — no 26th send.
		reportClientError(new Error("distinct-25"));
		expect(fetchMock).toHaveBeenCalledTimes(25);

		// Further distinct errors stay dropped for the rest of the session.
		reportClientError(new Error("distinct-26"));
		expect(fetchMock).toHaveBeenCalledTimes(25);
	});

	it("uses sendBeacon instead of fetch when navigator.sendBeacon is available", async () => {
		const sendBeacon = vi.fn().mockReturnValue(true);
		Object.defineProperty(navigator, "sendBeacon", {
			value: sendBeacon,
			configurable: true,
		});
		const { reportClientError } = await load();
		reportClientError(new Error("beacon-path"));

		expect(sendBeacon).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
		const [endpoint, blob] = sendBeacon.mock.calls[0] as [string, Blob];
		expect(endpoint).toBe("/api/analytics");
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/json");
	});

	it("falls back to keepalive fetch when navigator.sendBeacon is absent", async () => {
		Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });
		const { reportClientError } = await load();
		reportClientError(new Error("fetch-fallback-path"));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [endpoint, init] = fetchMock.mock.calls[0] as [
			string,
			RequestInit & { keepalive?: boolean },
		];
		expect(endpoint).toBe("/api/analytics");
		expect(init.method).toBe("POST");
		expect(init.keepalive).toBe(true);
	});

	it("emits a payload shaped with project_id 'orchestkit' and event name <= 50 chars", async () => {
		const { reportClientError } = await load();
		reportClientError(new Error("shape-check"));

		const body = lastBody(fetchMock);
		expect(body.project_id).toBe("orchestkit");
		expect(body.events[0].name).toBe("error");
		expect(body.events[0].name.length).toBeLessThanOrEqual(50);
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
