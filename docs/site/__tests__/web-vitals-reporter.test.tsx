import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// Capture the callback handed to useReportWebVitals so tests can drive metrics.
let capturedHandler: ((metric: unknown) => void) | null = null;
vi.mock("next/web-vitals", () => ({
	useReportWebVitals: (fn: (metric: unknown) => void) => {
		capturedHandler = fn;
	},
}));

// Imported after the mock so the component picks up the mocked hook.
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

function setNodeEnv(value: string) {
	vi.stubEnv("NODE_ENV", value);
}

function emit(metric: Record<string, unknown>) {
	if (!capturedHandler) throw new Error("handler not registered");
	capturedHandler(metric);
}

const LCP = {
	name: "LCP",
	value: 1234.567,
	rating: "good",
	id: "v3-lcp-1",
	navigationType: "navigate",
};

describe("WebVitalsReporter", () => {
	let sendBeacon: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		capturedHandler = null;
		setNodeEnv("production");
		window.sessionStorage.clear();
		// Deterministic "sampled in" by default.
		vi.spyOn(Math, "random").mockReturnValue(0);
		sendBeacon = vi.fn().mockReturnValue(true);
		Object.defineProperty(navigator, "sendBeacon", {
			value: sendBeacon,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(window, "location", {
			value: { ...window.location, pathname: "/dashboard" },
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	function fireVisibilityHidden() {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	}

	it("buffers a metric and flushes via sendBeacon with the correct body shape on visibilitychange hidden", () => {
		render(<WebVitalsReporter />);
		emit(LCP);
		expect(sendBeacon).not.toHaveBeenCalled();

		fireVisibilityHidden();

		expect(sendBeacon).toHaveBeenCalledTimes(1);
		const [endpoint, blob] = sendBeacon.mock.calls[0] as [string, Blob];
		expect(endpoint).toBe("/api/analytics");
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/json");
		return blob.text().then((text: string) => {
			const body = JSON.parse(text);
			expect(body).toEqual({
				project_id: "orchestkit",
				events: [
					{
						name: "web-vital:LCP",
						path: "/dashboard",
						referrer: "",
						properties: {
							value: 1234.57, // rounded to 2 decimals
							rating: "good",
							id: "v3-lcp-1",
							navigationType: "navigate",
						},
					},
				],
			});
		});
	});

	it("prefixes event names with web-vital: and rounds value to 2 decimals", () => {
		render(<WebVitalsReporter />);
		emit({ name: "CLS", value: 0.123456, rating: "needs-improvement" });
		fireVisibilityHidden();

		const [, blob] = sendBeacon.mock.calls[0] as [string, Blob];
		return blob.text().then((text: string) => {
			const body = JSON.parse(text);
			expect(body.events[0].name).toBe("web-vital:CLS");
			expect(body.events[0].properties.value).toBe(0.12);
			expect(body.events[0].properties.id).toBeNull();
			expect(body.events[0].properties.navigationType).toBeNull();
		});
	});

	it("respects the sessionStorage sampling gate — not sampled = no flush", () => {
		// Pre-seed the session as "not sampled".
		window.sessionStorage.setItem("hq-cwv-sampled", "0");
		render(<WebVitalsReporter />);
		emit(LCP);
		fireVisibilityHidden();
		expect(sendBeacon).not.toHaveBeenCalled();
	});

	it("reuses the cached sampling decision deterministically", () => {
		// First mount decides + persists; Math.random()=0 < 0.1 => sampled.
		render(<WebVitalsReporter />);
		expect(window.sessionStorage.getItem("hq-cwv-sampled")).toBe("1");

		// Force a would-be "not sampled" roll; cached decision must win.
		vi.spyOn(Math, "random").mockReturnValue(0.99);
		render(<WebVitalsReporter />);
		emit(LCP);
		fireVisibilityHidden();
		expect(sendBeacon).toHaveBeenCalled();
	});

	it("is a no-op in development (never samples, never flushes)", () => {
		setNodeEnv("development");
		render(<WebVitalsReporter />);
		emit(LCP);
		fireVisibilityHidden();
		expect(sendBeacon).not.toHaveBeenCalled();
		// Should not even write a sampling decision in dev.
		expect(window.sessionStorage.getItem("hq-cwv-sampled")).toBeNull();
	});

	it("ignores untracked metric names", () => {
		render(<WebVitalsReporter />);
		emit({ name: "Next.js-hydration", value: 42 });
		fireVisibilityHidden();
		expect(sendBeacon).not.toHaveBeenCalled();
	});

	it("flushes on pagehide and falls back to keepalive fetch when sendBeacon is absent", () => {
		Object.defineProperty(navigator, "sendBeacon", {
			value: undefined,
			configurable: true,
			writable: true,
		});
		const fetchMock = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("fetch", fetchMock);

		render(<WebVitalsReporter />);
		emit(LCP);
		window.dispatchEvent(new Event("pagehide"));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [endpoint, init] = fetchMock.mock.calls[0] as [
			string,
			RequestInit & { keepalive?: boolean },
		];
		expect(endpoint).toBe("/api/analytics");
		expect(init.method).toBe("POST");
		expect(init.keepalive).toBe(true);
	});
});
