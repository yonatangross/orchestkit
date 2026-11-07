// Analytics consent store for the docs site (PostHog only).
//
// The key, the values and the event name match the @yonatan-hq/analytics/posthog
// contract (consentKey "cookie-consent", "accepted" | "declined", consentEvent
// "cookie-consent-change"), and lib/posthog-loader.ts follows them, so a choice
// made here takes effect without any extra wiring. A same-tab localStorage write
// emits no "storage" event, which is why every write also dispatches the event.
//
// First-party /api/analytics is not gated by this choice: it sets no cookie and
// is the site's own system of record. Only PostHog is.

export const CONSENT_KEY = "cookie-consent";
export const CONSENT_EVENT = "cookie-consent-change";

export type AnalyticsConsent = "accepted" | "declined";

// When browser storage is blocked (policy, some private modes) or a write fails,
// the choice is kept in memory for this document so the banner still closes and
// the choice still applies on this page (Codex P2, #5098). The default stays "no
// choice", so nothing loads before an explicit Allow. Once storage fails, memory
// is the source of truth for the rest of the document.
let memoryChoice: AnalyticsConsent | null = null;
let storageFailed = false;

const asChoice = (value: string | null): AnalyticsConsent | null =>
	value === "accepted" || value === "declined" ? value : null;

export function getAnalyticsConsent(): AnalyticsConsent | null {
	if (typeof window === "undefined") return null;
	if (storageFailed) return memoryChoice;
	try {
		return asChoice(localStorage.getItem(CONSENT_KEY));
	} catch {
		storageFailed = true;
		return memoryChoice;
	}
}

/** Store a choice, or clear it with null so the banner asks again. */
export function setAnalyticsConsent(value: AnalyticsConsent | null): void {
	if (typeof window === "undefined") return;
	memoryChoice = value;
	try {
		if (value === null) localStorage.removeItem(CONSENT_KEY);
		else localStorage.setItem(CONSENT_KEY, value);
	} catch {
		// Storage blocked or full: keep the choice in memory, never throw.
		storageFailed = true;
	}
	window.dispatchEvent(new Event(CONSENT_EVENT));
}
