// PostHog loader for the docs site. The ONLY module that loads posthog-js, and
// it does so with a dynamic import(). Which client it starts follows the
// visitor's stored choice (lib/analytics-consent.ts):
//
//   no choice yet  cookieless: memory persistence, no person profiles, replay
//                  off, mirrored events off, no /flags or remote config call,
//                  and every non-pageview SDK feature off (PAGEVIEW_ONLY).
//                  Page views are counted; nothing
//                  is written to cookies, localStorage or sessionStorage, and
//                  no consent flag is set (opt_in and opt_out both write one).
//   "accepted"     the consented client #5098 built: persistent storage,
//                  identified_only person profiles, replay gate, mirrored
//                  events. A cookieless client already running is upgraded in
//                  place: reset({ resetDeviceID: true }) first, so neither the
//                  cookieless distinct_id nor its $device_id reaches persistent
//                  storage and the two phases cannot be matched.
//   "declined"     nothing is imported. A client already running stops
//                  capturing. Decline is how a visitor objects to the
//                  cookieless count (legitimate interest, see /privacy).
//
// Clearing the choice (privacy page reset) after an Allow withdraws consent as
// before; the client stays opted out until the next choice.
//
// Why this is local and not @yonatan-hq/analytics/posthog: that package is
// private, so pull-request CI on this public repo installs a no-op stub in its
// place (.github/workflows/docs.yml). Tests of a stub prove nothing, so the
// gate lives here, where CI and production run the same code. It keeps the
// same contract as the package: key "cookie-consent", values accepted |
// declined, same-tab event "cookie-consent-change".

import type { PostHog } from "posthog-js";
import {
	type AnalyticsConsent,
	CONSENT_EVENT,
	CONSENT_KEY,
	getAnalyticsConsent,
} from "@/lib/analytics-consent";

export type PostHogInitOptions = Record<string, unknown>;

/** Persistence once the visitor allows analytics (the SDK default under the 2026-01-30 defaults). */
export const CONSENTED_PERSISTENCE = "localStorage+cookie";

// "cookieless": capturing page views with nothing stored. "consented":
// capturing with consent. "off": loaded but not capturing (declined or withdrawn).
type Mode = "cookieless" | "consented" | "off";

let client: PostHog | null = null;
let loading = false;
let mode: Mode = "off";
let detach: (() => void) | null = null;

const BASE_OPTIONS: PostHogInitOptions = {
	// Same-origin proxy: next.config.mjs rewrites /ingest, and the CSP allows
	// no PostHog host in script-src.
	api_host: "/ingest",
	// The app UI, so in-app links resolve (ingest is eu.i.posthog.com).
	ui_host: "https://eu.posthog.com",
	defaults: "2026-01-30",
	// Withdrawing consent must also drop the identifying ph_ cookie:
	// opt_out_capturing() disables SDK persistence only when this is set
	// (Codex P2, #5098, reproduced on 1.438.19).
	opt_out_persistence_by_default: true,
};

// Every SDK feature that would send something other than $pageview before
// consent, turned off. The approval is anonymous page view counts only, so
// $pageleave (time on page) is off too. Allow turns each one back on through
// consentedCapture() below.
const PAGEVIEW_ONLY = {
	autocapture: false,
	rageclick: false,
	capture_exceptions: false,
	capture_heatmaps: false,
	capture_dead_clicks: false,
	// Web vitals (and replay network timing).
	capture_performance: false,
	capture_pageleave: false,
	disable_surveys: true,
} as const;

type PageviewOnlyKey = keyof typeof PAGEVIEW_ONLY;

// What each of those keys is on the consented client when the caller passes
// nothing for it: the SDK default under the 2026-01-30 defaults. `undefined`
// means "follow the project's remote config", which is how #5098 ran them.
const CONSENTED_DEFAULTS: Record<PageviewOnlyKey, unknown> = {
	autocapture: true,
	rageclick: true,
	capture_exceptions: undefined,
	capture_heatmaps: undefined,
	capture_dead_clicks: undefined,
	capture_performance: undefined,
	capture_pageleave: "if_capture_pageview",
	disable_surveys: false,
};

// Applied last, over the caller's options, so nothing the caller passes can
// turn on storage, person profiles, replay or non-pageview events before
// consent.
const COOKIELESS_OVERRIDES: PostHogInitOptions = {
	persistence: "memory",
	person_profiles: "never",
	disable_session_recording: true,
	// Capture is on from init. Opting in would write a consent flag to storage.
	opt_out_capturing_by_default: false,
	// No /flags call and no remote config fetch before consent: init() makes
	// both unless this is set, and they carry the in-memory distinct_id and the
	// visitor IP (b136, #5180). The site evaluates no feature flags, and every
	// PAGEVIEW_ONLY feature is set locally above, so nothing here needs them.
	// posthog-js reads this from the init config for the client's whole life
	// (_shouldDisableFlags, 1.438.21): set_config cannot clear it on upgrade.
	advanced_disable_flags: true,
	...PAGEVIEW_ONLY,
};

/**
 * The consented value of every PAGEVIEW_ONLY key: the caller's option when it
 * set one (instrumentation-client.ts sets capture_exceptions), else the SDK
 * default. Split into values to set and keys to unset, because set_config
 * skips undefined values and cannot unset anything by itself.
 */
function consentedCapture(options: PostHogInitOptions): {
	set: PostHogInitOptions;
	unset: PageviewOnlyKey[];
} {
	const set: PostHogInitOptions = {};
	const unset: PageviewOnlyKey[] = [];
	for (const key of Object.keys(PAGEVIEW_ONLY) as PageviewOnlyKey[]) {
		const value = key in options ? options[key] : CONSENTED_DEFAULTS[key];
		if (value === undefined) unset.push(key);
		else set[key] = value;
	}
	return { set, unset };
}

async function load(
	key: string,
	options: PostHogInitOptions,
	onConsentChange?: (capturing: boolean) => void,
): Promise<void> {
	if (loading || client) return;
	loading = true;
	try {
		const { default: posthog } = await import("posthog-js");
		// Read the choice after the download: the visitor may have answered
		// while the chunk was in flight. init() fetches remote config, so a
		// Decline must stop it here; `loading` resets in finally so a later
		// Allow loads again.
		const choice: AnalyticsConsent | null = getAnalyticsConsent();
		if (choice === "declined") return;
		if (choice === "accepted") {
			posthog.init(key, {
				...BASE_OPTIONS,
				// Safety net: capture starts only through the opt-in below.
				opt_out_capturing_by_default: true,
				...options,
			});
			client = posthog;
			// Consent was re-checked just above, with nothing async in between.
			posthog.opt_in_capturing();
			mode = "consented";
			// After the opt-in, never inside init(): posthog-js runs the `loaded`
			// option from inside init(), before this point, so anything that must
			// start only with capture on (the replay gate) starts here.
			onConsentChange?.(true);
			return;
		}
		posthog.init(key, { ...BASE_OPTIONS, ...options, ...COOKIELESS_OVERRIDES });
		client = posthog;
		mode = "cookieless";
	} catch {
		// The SDK chunk failed to download (network drop, or a deploy removed an
		// old chunk). Analytics is optional: stay unloaded and quiet, never an
		// unhandled rejection the error reporter would pick up. A later consent
		// event retries, since `loading` resets below (Codex P2, #5098).
	} finally {
		loading = false;
	}
}

/**
 * Start PostHog for this page in the mode the stored choice allows, and keep
 * following the choice: Allow upgrades or loads the consented client, Decline
 * stops capture, clearing the choice after an Allow withdraws it. Call once,
 * from instrumentation-client.ts.
 *
 * `onConsentChange` runs every time consented capture turns on or off: true
 * right after the opt-in (first load or upgrade) and on a re-allow, false on a
 * withdraw. Callers holding their own state, like the replay gate, resync
 * from it. It never fires for the cookieless client.
 */
export function startPostHog(
	key: string | undefined,
	options: PostHogInitOptions,
	onConsentChange?: (capturing: boolean) => void,
): void {
	if (!key || typeof window === "undefined") return;
	const apply = () => {
		const choice = getAnalyticsConsent();
		if (!client) {
			if (choice !== "declined") void load(key, options, onConsentChange);
			return;
		}
		if (choice === "accepted") {
			if (mode === "consented") return;
			// Upgrade in place. reset() runs while persistence is still memory, so
			// the ids minted for the cookieless count are dropped, never saved.
			// resetDeviceID is required: a bare reset() mints a new distinct_id
			// but keeps $device_id, which would link the two phases.
			client.reset({ resetDeviceID: true });
			// Restore the consented capture set. Keys whose consented value is
			// "follow remote config" are deleted from the live config first; the
			// set_config call below then re-runs each feature's startIfEnabled
			// (posthog-js 1.438.19 set_config). This client was started with
			// advanced_disable_flags, which posthog-js keeps for its lifetime, so
			// it never fetches remote config: those features (and replay, which
			// waits on remote config) start on the next full page load, when the
			// stored "accepted" choice inits the consented client directly. That
			// delay is the price of sending nothing but $pageview before consent.
			const capture = consentedCapture(options);
			const live = client.config as unknown as Record<string, unknown>;
			for (const key of capture.unset) delete live[key];
			client.set_config({
				...capture.set,
				persistence: CONSENTED_PERSISTENCE,
				// What instrumentation-client.ts passes for the consented client.
				person_profiles: "identified_only",
			});
			client.opt_in_capturing();
			mode = "consented";
			onConsentChange?.(true);
			return;
		}
		if (mode === "consented") {
			// Withdrawn (Decline or a cleared choice): stop any replay in
			// progress as well as capture.
			client.stopSessionRecording();
			client.opt_out_capturing();
			mode = "off";
			onConsentChange?.(false);
			return;
		}
		if (mode === "cookieless" && choice === "declined") {
			// The objection: stop the anonymous count too.
			client.opt_out_capturing();
			mode = "off";
		}
	};
	const onStorage = (e: StorageEvent) => {
		if (e.key === null || e.key === CONSENT_KEY) apply();
	};
	detach?.();
	window.addEventListener(CONSENT_EVENT, apply);
	window.addEventListener("storage", onStorage);
	detach = () => {
		window.removeEventListener(CONSENT_EVENT, apply);
		window.removeEventListener("storage", onStorage);
	};
	apply();
}

/**
 * Stop following the consent choice (removes the window listeners). A page
 * never needs this; tests do, because a test window outlives each module copy.
 */
export function stopPostHog(): void {
	detach?.();
	detach = null;
}

/**
 * Send one event. A no-op until the visitor has allowed analytics: the
 * cookieless client counts page views only.
 */
export function capturePostHog(name: string, properties?: Record<string, string | number>): void {
	if (mode === "consented") client?.capture(name, properties);
}

/** True once PostHog has loaded with consent and capture is on (the replay gate asks this). */
export function isPostHogLoaded(): boolean {
	return client !== null && mode === "consented";
}
