"use client";

// Analytics consent banner (approved design: approved-design/posthog-consent-mockup.txt).
//
// Shown at the bottom of every page until the visitor answers. Before an answer
// PostHog only counts page views cookieless, with nothing stored; "Allow
// analytics" upgrades it and "Decline" stops it (lib/posthog-loader.ts,
// lib/analytics-consent.ts). Decline and Allow carry the same visual
// weight on purpose, so declining is as easy as allowing.
//
// It renders nothing on the server and on the first client pass, then reads the
// stored choice. That avoids a hydration mismatch and a flash of the banner for
// visitors who already answered.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	CONSENT_EVENT,
	CONSENT_KEY,
	getAnalyticsConsent,
	setAnalyticsConsent,
} from "@/lib/analytics-consent";

const BUTTON =
	"rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm font-medium text-fd-foreground hover:bg-fd-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary";

export function AnalyticsConsentBanner() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const sync = () => setOpen(getAnalyticsConsent() === null);
		const onStorage = (e: StorageEvent) => {
			if (e.key === null || e.key === CONSENT_KEY) sync();
		};
		sync();
		window.addEventListener(CONSENT_EVENT, sync);
		window.addEventListener("storage", onStorage);
		return () => {
			window.removeEventListener(CONSENT_EVENT, sync);
			window.removeEventListener("storage", onStorage);
		};
	}, []);

	if (!open) return null;

	return (
		<section
			aria-label="Analytics consent"
			className="fixed inset-x-0 bottom-0 z-50 border-t border-fd-border bg-fd-background/95 px-4 py-3 shadow-lg backdrop-blur"
		>
			<div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-fd-muted-foreground">
					We count page views with PostHog without cookies and without storing
					anything on your device. Allow analytics adds a cookie, usage events and
					session replay on reference docs; Decline stops the count too.{" "}
					<Link href="/privacy" className="text-fd-foreground underline underline-offset-2">
						Privacy policy
					</Link>
				</p>
				<div className="flex shrink-0 gap-2">
					<button type="button" className={BUTTON} onClick={() => setAnalyticsConsent("declined")}>
						Decline
					</button>
					<button type="button" className={BUTTON} onClick={() => setAnalyticsConsent("accepted")}>
						Allow analytics
					</button>
				</div>
			</div>
		</section>
	);
}

/** Clears the stored choice so the banner asks again (privacy page). */
export function AnalyticsConsentReset() {
	return (
		<button type="button" className={BUTTON} onClick={() => setAnalyticsConsent(null)}>
			Change analytics choice
		</button>
	);
}
