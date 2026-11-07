// PostHog consent gate: posthog-js must never be imported before the visitor
// allows analytics. Not "init it opted out": not imported at all, because an
// opted-out client still fetches remote config and installs exception handlers,
// which puts the visitor's IP in front of PostHog (posthog-connect rule).
//
// The mock is registered per boot with vi.doMock after vi.resetModules(). A
// hoisted vi.mock factory runs only on the first import and is cached across
// resetModules(), so after one load the counter would freeze and every later
// "was not loaded" assertion would pass for the wrong reason.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "phc_consent_test";
const CONSENT_KEY = "cookie-consent";
const CONSENT_EVENT = "cookie-consent-change";

let loads = 0;
let initKeys: string[] = [];

function bootMock() {
	loads = 0;
	initKeys = [];
	vi.doMock("posthog-js", () => {
		loads += 1;
		const ph = {
			init: vi.fn((key: string, opts: Record<string, unknown>) => {
				initKeys.push(key);
				const loaded = opts.loaded as ((p: unknown) => void) | undefined;
				loaded?.(ph);
			}),
			opt_in_capturing: vi.fn(),
			opt_out_capturing: vi.fn(),
			capture: vi.fn(),
			captureException: vi.fn(),
			identify: vi.fn(),
			reset: vi.fn(),
			startSessionRecording: vi.fn(),
			stopSessionRecording: vi.fn(),
		};
		return { default: ph };
	});
}

// Long enough for a dynamic import() of the mocked module to settle.
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
	vi.resetModules();
	localStorage.clear();
	vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", KEY);
	bootMock();
});

afterEach(() => {
	vi.doUnmock("posthog-js");
	vi.unstubAllEnvs();
	localStorage.clear();
});

describe("PostHog consent gate", () => {
	it("does not import posthog-js on load when no choice is stored", async () => {
		await import("@/instrumentation-client");
		await settle();
		expect(loads).toBe(0);
	});

	it("does not import posthog-js when the visitor declined", async () => {
		localStorage.setItem(CONSENT_KEY, "declined");
		await import("@/instrumentation-client");
		await settle();
		expect(loads).toBe(0);
	});

	it("mirroring an event before consent does not import posthog-js", async () => {
		await import("@/instrumentation-client");
		const { mirrorToPostHog } = await import("@/lib/posthog-mirror");
		mirrorToPostHog("search_zero_results", { length: 3, truncated: false });
		await settle();
		expect(loads).toBe(0);
	});

	it("a navigation before consent does not import posthog-js", async () => {
		const mod = await import("@/instrumentation-client");
		mod.onRouterTransitionStart("/docs/reference/skills/verify");
		await settle();
		expect(loads).toBe(0);
	});

	it("loads and inits once when consent was given on an earlier visit", async () => {
		localStorage.setItem(CONSENT_KEY, "accepted");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(loads).toBe(1);
	});

	it("loads after the visitor allows analytics in this tab", async () => {
		await import("@/instrumentation-client");
		await settle();
		expect(loads).toBe(0);
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("accepted");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(localStorage.getItem(CONSENT_KEY)).toBe("accepted");
	});

	it("the consent store writes the shared key and fires the shared event", async () => {
		const { setAnalyticsConsent, getAnalyticsConsent } = await import("@/lib/analytics-consent");
		const seen: string[] = [];
		window.addEventListener(CONSENT_EVENT, () => seen.push("change"));
		expect(getAnalyticsConsent()).toBeNull();
		setAnalyticsConsent("declined");
		expect(getAnalyticsConsent()).toBe("declined");
		setAnalyticsConsent(null);
		expect(getAnalyticsConsent()).toBeNull();
		expect(seen).toEqual(["change", "change"]);
	});
});
