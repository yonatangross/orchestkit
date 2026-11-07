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
let lastInitOpts: Record<string, unknown> | null = null;
let lastPh: { opt_out_capturing: ReturnType<typeof vi.fn> } | null = null;

function bootMock() {
	loads = 0;
	initKeys = [];
	lastInitOpts = null;
	lastPh = null;
	vi.doMock("posthog-js", () => {
		loads += 1;
		const ph = {
			init: vi.fn((key: string, opts: Record<string, unknown>) => {
				initKeys.push(key);
				lastInitOpts = opts;
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
		lastPh = ph;
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

afterEach(async () => {
	// The test window outlives each fresh module copy, so a loader left
	// listening would also react to the next test's consent event (CI saw five
	// init calls for one Allow). Detach this test's loader before the next boot.
	const loader = await import("@/lib/posthog-loader");
	loader.stopPostHog();
	vi.doUnmock("posthog-js");
	vi.unstubAllEnvs();
	window.history.pushState({}, "", "/");
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

	it("does not init when consent is withdrawn while the SDK downloads (Codex P2, #5098)", async () => {
		await import("@/instrumentation-client");
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		// Allow starts the dynamic import; Decline lands before it resolves.
		setAnalyticsConsent("accepted");
		setAnalyticsConsent("declined");
		await settle();
		expect(initKeys).toEqual([]);
		// A later Allow still loads: the aborted download must not leave the gate stuck.
		setAnalyticsConsent("accepted");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
	});

	it("reconciles replay when a navigation starts while the SDK downloads (Codex P2, #5098)", async () => {
		// A gated mock: the SDK "arrives" only when release() is called.
		vi.doUnmock("posthog-js");
		let release: () => void = () => {};
		const gate = new Promise<void>((r) => {
			release = r;
		});
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
		vi.doMock("posthog-js", async () => {
			await gate;
			loads += 1;
			return { default: ph };
		});

		window.history.pushState({}, "", "/docs/reference/skills/verify");
		localStorage.setItem(CONSENT_KEY, "accepted");
		const mod = await import("@/instrumentation-client");
		// Leave the reference tree while the SDK is still downloading.
		mod.onRouterTransitionStart("/");
		// The SDK arrives before the URL commits: loaded() syncs the old page.
		release();
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(ph.startSessionRecording).toHaveBeenCalledTimes(1);
		// The navigation commits: replay must stop, it may not stay on outside /docs/reference.
		window.history.pushState({}, "", "/");
		await vi.waitFor(() => expect(ph.stopSessionRecording).toHaveBeenCalledTimes(1));
	});

	it("a failed SDK download stays quiet: no init, no unhandled rejection (Codex P2, #5098)", async () => {
		// vitest fails the file on an unhandled rejection, so the old discarded
		// load() promise turns this test red by itself.
		vi.doUnmock("posthog-js");
		vi.doMock("posthog-js", () => {
			throw new Error("chunk load failed");
		});
		await import("@/instrumentation-client");
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("accepted");
		await settle();
		expect(initKeys).toEqual([]);
	});

	it("withdrawing consent also drops PostHog persistence (Codex P2, #5098)", async () => {
		// opt_out_capturing() alone stops events but keeps the identifying ph_
		// cookie unless opt_out_persistence_by_default is set at init (posthog-js
		// documents this on opt_out_capturing; Codex reproduced it on 1.438.19).
		localStorage.setItem(CONSENT_KEY, "accepted");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(lastInitOpts?.opt_out_persistence_by_default).toBe(true);
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("declined");
		expect(lastPh?.opt_out_capturing).toHaveBeenCalledTimes(1);
	});

	it("after a Decline, entering a reference page starts no recording (b116 follow-up)", async () => {
		localStorage.setItem(CONSENT_KEY, "accepted");
		const mod = await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const ph = lastPh as unknown as { startSessionRecording: ReturnType<typeof vi.fn> };
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("declined");
		mod.onRouterTransitionStart("/docs/reference/skills/verify");
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		await settle();
		await settle();
		expect(ph.startSessionRecording).not.toHaveBeenCalled();
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
