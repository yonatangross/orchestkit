// Consent-gated PostHog loader for the docs site. The ONLY module that loads
// posthog-js, and it does so with a dynamic import() after the visitor allows
// analytics (lib/analytics-consent.ts). Before that nothing PostHog is fetched:
// not "init it opted out", which would still pull remote config and install
// exception handlers, but no import at all.
//
// Why this is local and not @yonatan-hq/analytics/posthog: that package is
// private, so pull-request CI on this public repo installs a no-op stub in its
// place (.github/workflows/docs.yml). Tests of a stub prove nothing, so the
// gate lives here, where CI and production run the same code. It keeps the
// same contract as the package: key "cookie-consent", values accepted |
// declined, same-tab event "cookie-consent-change".

import type { PostHog } from "posthog-js";
import { CONSENT_EVENT, CONSENT_KEY, getAnalyticsConsent } from "@/lib/analytics-consent";

export type PostHogInitOptions = Record<string, unknown>;

let client: PostHog | null = null;
let loading = false;
let enabled = false;
let detach: (() => void) | null = null;

const granted = () => getAnalyticsConsent() === "accepted";

async function load(key: string, options: PostHogInitOptions): Promise<void> {
	if (loading || client) return;
	loading = true;
	try {
		const { default: posthog } = await import("posthog-js");
		// The visitor may have declined or cleared their choice while the chunk
		// was downloading. init() alone fetches remote config, so it must not run
		// without consent; `loading` resets in finally so a later Allow loads again.
		if (!granted()) return;
		posthog.init(key, {
			// Same-origin proxy: next.config.mjs rewrites /ingest, and the CSP
			// allows no PostHog host in script-src.
			api_host: "/ingest",
			// The app UI, so in-app links resolve (ingest is eu.i.posthog.com).
			ui_host: "https://eu.posthog.com",
			defaults: "2026-01-30",
			// Safety net: capture starts only through the opt-in below.
			opt_out_capturing_by_default: true,
			// Withdrawing consent must also drop the identifying ph_ cookie:
			// opt_out_capturing() disables SDK persistence only when this is set
			// (Codex P2, #5098, reproduced on 1.438.19).
			opt_out_persistence_by_default: true,
			...options,
		});
		client = posthog;
		// Consent was re-checked just above, with nothing async in between.
		posthog.opt_in_capturing();
		enabled = true;
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
 * Start PostHog for this page if the visitor has allowed analytics, and keep
 * following their choice: a later "accepted" loads it, a later "declined" or a
 * cleared choice stops capture. Call once, from instrumentation-client.ts.
 */
export function startPostHog(key: string | undefined, options: PostHogInitOptions): void {
	if (!key || typeof window === "undefined") return;
	const apply = () => {
		if (granted()) {
			if (!client) void load(key, options);
			else if (!enabled) {
				client.opt_in_capturing();
				enabled = true;
			}
		} else if (client && enabled) {
			// Withdrawn: stop any replay in progress as well as capture.
			client.stopSessionRecording();
			client.opt_out_capturing();
			enabled = false;
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

/** Send one event. A no-op until PostHog has loaded with consent. */
export function capturePostHog(name: string, properties?: Record<string, string | number>): void {
	if (enabled) client?.capture(name, properties);
}

/** True once PostHog has loaded and capture is on. */
export function isPostHogLoaded(): boolean {
	return client !== null && enabled;
}
