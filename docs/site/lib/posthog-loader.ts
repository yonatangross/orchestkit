// PostHog loader for the docs site. The ONLY module that loads posthog-js, and
// it does so with a dynamic import(). Which client it starts follows the
// visitor's stored choice (lib/analytics-consent.ts):
//
//   no choice yet  cookieless: memory persistence, no person profiles, replay
//                  off, mirrored events off. Page views are counted; nothing
//                  is written to cookies, localStorage or sessionStorage, and
//                  no consent flag is set (opt_in and opt_out both write one).
//   "accepted"     the consented client #5098 built: persistent storage,
//                  identified_only person profiles, replay gate, mirrored
//                  events. A cookieless client already running is upgraded in
//                  place: reset() first, so the cookieless id never reaches
//                  persistent storage and the two cannot be matched.
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

// Applied last, over the caller's options, so nothing the caller passes can
// turn on storage, person profiles or replay before consent.
const COOKIELESS_OVERRIDES: PostHogInitOptions = {
	persistence: "memory",
	person_profiles: "never",
	disable_session_recording: true,
	// Capture is on from init. Opting in would write a consent flag to storage.
	opt_out_capturing_by_default: false,
};

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
			// the id minted for the cookieless count is dropped, never saved.
			client.reset();
			client.set_config({
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
