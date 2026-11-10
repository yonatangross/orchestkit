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

// One class string for both answers, so Decline and Allow can never drift to
// different sizes or weights. Larger tap target than before (min-h-10).
const BUTTON =
	"min-h-10 rounded-md border border-fd-border bg-fd-background px-4 py-2 text-sm font-semibold text-fd-foreground hover:bg-fd-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary";

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
			className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
		>
			<div
				data-testid="analytics-consent-card"
				className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-3 rounded-lg border-2 border-fd-primary bg-fd-card p-4 shadow-xl"
			>
				<p className="text-sm text-fd-card-foreground">
					We count page views with PostHog without cookies and without storing
					anything on your device. Allow analytics adds a cookie, usage events and
					session replay on reference docs; Decline stops the count too.
					{/* Its own line under the sentence, as the approved mockup draws it; w-fit keeps the tap target to the text. */}
					<Link
						href="/privacy"
						className="mt-1 block w-fit font-medium text-fd-card-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary"
					>
						Privacy notice
					</Link>
				</p>
				{/* Below the sentence and right-aligned at every width, as the approved mockup draws it. */}
				<div className="flex shrink-0 gap-2 self-end">
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
