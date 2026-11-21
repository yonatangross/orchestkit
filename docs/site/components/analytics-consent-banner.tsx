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
// different sizes or weights. 44 px tap target on a phone, 40 px from 640 px up.
const BUTTON =
	"min-h-11 rounded-md border border-fd-border bg-fd-background px-4 py-2 text-sm font-semibold text-fd-foreground hover:bg-fd-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary sm:min-h-10";

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
			{/* Slim on a first visit (Yonatan, 16.11.2026): one row from 640 px up, a
			    tight card on a phone, so the first screen stays readable. The look,
			    the wording and the consent logic are unchanged. */}
			<div
				data-testid="analytics-consent-card"
				className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-2 rounded-lg border-2 border-fd-primary bg-fd-card p-3 shadow-xl sm:flex-row sm:items-center sm:gap-4"
			>
				<p className="text-xs leading-4 text-fd-card-foreground sm:flex-1 sm:text-[13px] sm:leading-5">
					We count page views with PostHog without cookies and without storing
					anything on your device. Allow analytics adds a cookie, usage events and
					session replay on reference docs; Decline stops the count too.{" "}
					<Link
						href="/privacy"
						className="inline-flex min-h-11 items-center whitespace-nowrap font-medium text-fd-card-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary"
					>
						Privacy notice
					</Link>
				</p>
				{/* Right-aligned under the sentence on a phone, beside it from 640 px up. */}
				<div className="flex shrink-0 gap-2 self-end sm:self-auto">
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
