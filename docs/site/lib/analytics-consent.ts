// Analytics consent store for the docs site (PostHog only).
//
// The key, the values and the event name are the @yonatan-hq/analytics/posthog
// defaults (consentKey "cookie-consent", "accepted" | "declined", consentEvent
// "cookie-consent-change"), so initPostHog in instrumentation-client.ts reacts
// to a choice made here without any extra wiring. A same-tab localStorage write
// emits no "storage" event, which is why every write also dispatches the event.
//
// First-party /api/analytics is not gated by this choice: it sets no cookie and
// is the site's own system of record. Only PostHog is.

export const CONSENT_KEY = "cookie-consent";
export const CONSENT_EVENT = "cookie-consent-change";

export type AnalyticsConsent = "accepted" | "declined";

export function getAnalyticsConsent(): AnalyticsConsent | null {
	if (typeof window === "undefined") return null;
	try {
		const value = localStorage.getItem(CONSENT_KEY);
		return value === "accepted" || value === "declined" ? value : null;
	} catch {
		return null;
	}
}

/** Store a choice, or clear it with null so the banner asks again. */
export function setAnalyticsConsent(value: AnalyticsConsent | null): void {
	if (typeof window === "undefined") return;
	try {
		if (value === null) localStorage.removeItem(CONSENT_KEY);
		else localStorage.setItem(CONSENT_KEY, value);
	} catch {
		// Storage blocked (private mode, policy): treat as no choice, never throw.
	}
	window.dispatchEvent(new Event(CONSENT_EVENT));
}
