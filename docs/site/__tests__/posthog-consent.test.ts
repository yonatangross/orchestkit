// PostHog consent gate. Three states, one per stored choice:
//   - no choice yet: PostHog runs cookieless (memory persistence, no person
//     profiles, no replay, nothing in cookies or browser storage) so page views
//     are counted anonymously;
//   - "accepted": the consented client #5098 built (persistent storage, replay
//     gate), upgraded in place from the cookieless one with a fresh id;
//   - "declined": PostHog is not imported at all, and a cookieless client that
//     is already running stops capturing. Decline is the objection.
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
type MockPh = {
	init: ReturnType<typeof vi.fn>;
	opt_in_capturing: ReturnType<typeof vi.fn>;
	opt_out_capturing: ReturnType<typeof vi.fn>;
	set_config: ReturnType<typeof vi.fn>;
	capture: ReturnType<typeof vi.fn>;
	captureException: ReturnType<typeof vi.fn>;
	identify: ReturnType<typeof vi.fn>;
	reset: ReturnType<typeof vi.fn>;
	config: Record<string, unknown>;
	get_distinct_id: () => string;
	get_property: (name: string) => unknown;
	startSessionRecording: ReturnType<typeof vi.fn>;
	stopSessionRecording: ReturnType<typeof vi.fn>;
};
let lastPh: MockPh | null = null;
const phMock = () => lastPh as MockPh;

function bootMock() {
	loads = 0;
	initKeys = [];
	lastInitOpts = null;
	lastPh = null;
	vi.doMock("posthog-js", () => {
		loads += 1;
		// Identity the way posthog-js keeps it: reset() always mints a new
		// distinct_id, and a new $device_id only with reset(true) or
		// reset({ resetDeviceID: true }).
		let generation = 0;
		let distinctId = "anon-0";
		let deviceId = "device-0";
		const ph = {
			// Live config the way posthog-js keeps it: init copies the options,
			// set_config merges and skips undefined values.
			config: {} as Record<string, unknown>,
			get_distinct_id: vi.fn(() => distinctId),
			get_property: vi.fn((name: string) => (name === "$device_id" ? deviceId : undefined)),
			init: vi.fn((key: string, opts: Record<string, unknown>) => {
				initKeys.push(key);
				lastInitOpts = opts;
				ph.config = { ...opts };
				const loaded = opts.loaded as ((p: unknown) => void) | undefined;
				loaded?.(ph);
			}),
			opt_in_capturing: vi.fn(),
			opt_out_capturing: vi.fn(),
			set_config: vi.fn((next: Record<string, unknown>) => {
				for (const [k, v] of Object.entries(next)) if (v !== undefined) ph.config[k] = v;
			}),
			capture: vi.fn(),
			captureException: vi.fn(),
			identify: vi.fn(),
			reset: vi.fn((options?: boolean | { resetDeviceID?: boolean }) => {
				generation += 1;
				distinctId = `anon-${generation}`;
				if (options === true || (typeof options === "object" && options.resetDeviceID)) {
					deviceId = `device-${generation}`;
				}
			}),
			startSessionRecording: vi.fn(),
			stopSessionRecording: vi.fn(),
		};
		lastPh = ph as unknown as MockPh;
		return { default: ph };
	});
}

// Long enough for a dynamic import() of the mocked module to settle.
const settle = () => new Promise((r) => setTimeout(r, 30));

// Expire every cookie this document can see, so each test starts clean.
function clearCookies() {
	for (const c of document.cookie.split(";")) {
		const name = c.split("=")[0]?.trim();
		if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
	}
}

beforeEach(() => {
	vi.resetModules();
	localStorage.clear();
	sessionStorage.clear();
	clearCookies();
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
	sessionStorage.clear();
	clearCookies();
});

describe("PostHog consent gate", () => {
	it("with no choice stored, starts capture cookieless: memory persistence, no person profiles", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(loads).toBe(1);
		expect(lastInitOpts?.persistence).toBe("memory");
		expect(lastInitOpts?.person_profiles).toBe("never");
		expect(lastInitOpts?.disable_session_recording).toBe(true);
		// Capture is on from init: opted out by default would count nothing.
		expect(lastInitOpts?.opt_out_capturing_by_default).not.toBe(true);
		// opt_in and opt_out both write a consent flag to a cookie or storage.
		expect(phMock().opt_in_capturing).not.toHaveBeenCalled();
		expect(phMock().opt_out_capturing).not.toHaveBeenCalled();
	});

	it("writes nothing to cookies, localStorage or sessionStorage before consent", async () => {
		const mod = await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		mod.onRouterTransitionStart("/docs/reference/skills/verify");
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		const { mirrorToPostHog } = await import("@/lib/posthog-mirror");
		mirrorToPostHog("search_zero_results", { length: 3 });
		await settle();
		expect(document.cookie).toBe("");
		expect(localStorage.length).toBe(0);
		expect(sessionStorage.length).toBe(0);
	});

	it("replay does not start without consent, on load or on navigation into a reference page", async () => {
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		const mod = await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		mod.onRouterTransitionStart("/docs/reference/hooks/pretool");
		window.history.pushState({}, "", "/docs/reference/hooks/pretool");
		await settle();
		await settle();
		expect(phMock().startSessionRecording).not.toHaveBeenCalled();
	});

	it("Allow upgrades the cookieless client in place: fresh id, persistent storage, then opt in", async () => {
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("accepted");
		await vi.waitFor(() => expect(phMock().opt_in_capturing).toHaveBeenCalledTimes(1));
		// One client for the page: the upgrade is not a second init.
		expect(initKeys).toEqual([KEY]);
		expect(phMock().set_config).toHaveBeenCalledWith(
			expect.objectContaining({ persistence: "localStorage+cookie", person_profiles: "identified_only" }),
		);
		// reset() first, while still in memory: the cookieless id never reaches
		// persistent storage, so consented data cannot be matched to it.
		const order = (fn: ReturnType<typeof vi.fn>) => fn.mock.invocationCallOrder[0] ?? 0;
		expect(phMock().reset).toHaveBeenCalledTimes(1);
		expect(order(phMock().reset)).toBeLessThan(order(phMock().set_config));
		expect(order(phMock().set_config)).toBeLessThan(order(phMock().opt_in_capturing));
		// The replay gate follows consent as before: on a reference page it starts now.
		expect(phMock().startSessionRecording).toHaveBeenCalledTimes(1);
	});

	it("before consent only $pageview is captured: no clicks, errors, heatmaps, vitals, pageleave or surveys", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		// Every SDK feature that sends something other than $pageview is off.
		expect(lastInitOpts).toMatchObject({
			autocapture: false,
			rageclick: false,
			capture_exceptions: false,
			capture_heatmaps: false,
			capture_dead_clicks: false,
			capture_performance: false,
			capture_pageleave: false,
			disable_surveys: true,
		});
		// Page views stay on (history_change under the 2026-01-30 defaults).
		expect(lastInitOpts?.capture_pageview).not.toBe(false);
		// A click reaches no capture call of ours either. (A thrown error is
		// covered by capture_exceptions: false above; dispatching a window error
		// here would be reported by vitest's jsdom environment as unhandled.)
		const link = document.createElement("a");
		link.href = "#docs";
		link.textContent = "Docs";
		document.body.append(link);
		link.click();
		link.remove();
		expect(phMock().capture).not.toHaveBeenCalled();
		expect(phMock().captureException).not.toHaveBeenCalled();
	});

	it("Allow restores the consented capture set: autocapture, exceptions, remote driven features", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("accepted");
		await vi.waitFor(() => expect(phMock().opt_in_capturing).toHaveBeenCalledTimes(1));
		const config = phMock().config;
		expect(config.autocapture).toBe(true);
		expect(config.rageclick).toBe(true);
		// instrumentation-client.ts asks for exceptions on the consented client.
		expect(config.capture_exceptions).toBe(true);
		expect(config.capture_pageleave).toBe("if_capture_pageview");
		expect(config.disable_surveys).toBe(false);
		// Unset on the consented client, so the project's remote config decides
		// again, as it did under #5098. Not forced on, not left off.
		expect(config.capture_heatmaps).toBeUndefined();
		expect(config.capture_dead_clicks).toBeUndefined();
		expect(config.capture_performance).toBeUndefined();
	});

	it("Allow gives a fresh identity: distinct_id and $device_id both differ from the cookieless ones", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const cookielessDistinct = phMock().get_distinct_id();
		const cookielessDevice = phMock().get_property("$device_id");
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("accepted");
		await vi.waitFor(() => expect(phMock().opt_in_capturing).toHaveBeenCalledTimes(1));
		expect(phMock().get_distinct_id()).not.toBe(cookielessDistinct);
		expect(phMock().get_property("$device_id")).not.toBe(cookielessDevice);
	});

	it("Decline stops the cookieless client and never identifies or upgrades", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("declined");
		expect(phMock().opt_out_capturing).toHaveBeenCalledTimes(1);
		expect(phMock().identify).not.toHaveBeenCalled();
		expect(phMock().set_config).not.toHaveBeenCalled();
		expect(phMock().opt_in_capturing).not.toHaveBeenCalled();
		expect(phMock().startSessionRecording).not.toHaveBeenCalled();
		const { mirrorToPostHog } = await import("@/lib/posthog-mirror");
		mirrorToPostHog("search_zero_results", { length: 3 });
		expect(phMock().capture).not.toHaveBeenCalled();
	});

	it("does not import posthog-js when the visitor declined", async () => {
		localStorage.setItem(CONSENT_KEY, "declined");
		await import("@/instrumentation-client");
		await settle();
		expect(loads).toBe(0);
	});

	it("mirrored events wait for consent: the cookieless client counts page views only", async () => {
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const { mirrorToPostHog } = await import("@/lib/posthog-mirror");
		mirrorToPostHog("search_zero_results", { length: 3, truncated: false });
		expect(phMock().capture).not.toHaveBeenCalled();
	});

	it("loads and inits once when consent was given on an earlier visit", async () => {
		localStorage.setItem(CONSENT_KEY, "accepted");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(loads).toBe(1);
	});

	it("a returning visitor who allowed analytics gets the consented client straight away", async () => {
		localStorage.setItem(CONSENT_KEY, "accepted");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		expect(lastInitOpts?.persistence).not.toBe("memory");
		expect(lastInitOpts?.person_profiles).toBe("identified_only");
		expect(phMock().opt_in_capturing).toHaveBeenCalledTimes(1);
		expect(phMock().set_config).not.toHaveBeenCalled();
	});

	it("does not init when consent is withdrawn while the SDK downloads (Codex P2, #5098)", async () => {
		// The boot load (cookieless, no choice yet) starts the download at once,
		// so hold the SDK back until both choices have landed.
		vi.doUnmock("posthog-js");
		let release: () => void = () => {};
		const gate = new Promise<void>((r) => {
			release = r;
		});
		vi.doMock("posthog-js", async () => {
			await gate;
			loads += 1;
			return {
				default: {
					init: vi.fn((key: string) => initKeys.push(key)),
					opt_in_capturing: vi.fn(),
					opt_out_capturing: vi.fn(),
					set_config: vi.fn(),
					capture: vi.fn(),
					identify: vi.fn(),
					reset: vi.fn(),
					startSessionRecording: vi.fn(),
					stopSessionRecording: vi.fn(),
				},
			};
		});
		await import("@/instrumentation-client");
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		// Allow, then Decline, both before the SDK arrives.
		setAnalyticsConsent("accepted");
		setAnalyticsConsent("declined");
		release();
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

	it("allow, decline, enter a reference page, allow again: replay starts on the re-allow (b118 should, #5106)", async () => {
		localStorage.setItem(CONSENT_KEY, "accepted");
		const mod = await import("@/instrumentation-client");
		await vi.waitFor(() => expect(initKeys).toEqual([KEY]));
		const ph = lastPh as unknown as {
			startSessionRecording: ReturnType<typeof vi.fn>;
			stopSessionRecording: ReturnType<typeof vi.fn>;
		};
		const { setAnalyticsConsent } = await import("@/lib/analytics-consent");
		setAnalyticsConsent("declined");
		// The gate is asked to start while consent is withdrawn: suppressed.
		mod.onRouterTransitionStart("/docs/reference/skills/verify");
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		await settle();
		await settle();
		expect(ph.startSessionRecording).not.toHaveBeenCalled();
		// Re-allow on the same reference page: the suppressed request must not
		// keep the gate thinking a recording is already running.
		setAnalyticsConsent("accepted");
		expect(ph.startSessionRecording).toHaveBeenCalledTimes(1);
		// And a second Decline stops it again: count the delta, since the
		// re-allow's own stop() already called stopSessionRecording.
		const stopsBefore = ph.stopSessionRecording.mock.calls.length;
		setAnalyticsConsent("declined");
		expect(ph.stopSessionRecording.mock.calls.length).toBeGreaterThan(stopsBefore);
	});

	it("replay still starts when posthog-js runs loaded after init returns (b119, #5106)", async () => {
		vi.doUnmock("posthog-js");
		let deferredLoaded: (() => void) | null = null;
		const ph = {
			init: vi.fn((key: string, opts: Record<string, unknown>) => {
				initKeys.push(key);
				const loaded = opts.loaded as ((p: unknown) => void) | undefined;
				// Deferred: the loader's opt-in and consent callback run first.
				deferredLoaded = () => loaded?.(ph);
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
		vi.doMock("posthog-js", () => ({ default: ph }));
		window.history.pushState({}, "", "/docs/reference/skills/verify");
		localStorage.setItem(CONSENT_KEY, "accepted");
		await import("@/instrumentation-client");
		await vi.waitFor(() => expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1));
		// The consent callback found no gate yet: nothing started.
		expect(ph.startSessionRecording).not.toHaveBeenCalled();
		(deferredLoaded as (() => void) | null)?.();
		expect(ph.startSessionRecording).toHaveBeenCalledTimes(1);
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
