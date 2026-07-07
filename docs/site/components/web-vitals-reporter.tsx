"use client";

import { useCallback, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";

// CWV beacon. Collects Core Web Vitals + FCP/TTFB, samples at 10% per session,
// and flushes to the existing first-party proxy at /api/analytics (which enriches
// + HMAC-signs + forwards to the API's /api/analytics/ingest). Imports ONLY
// next/web-vitals + React and POSTs same-origin — no HMAC is hand-rolled here.
// Mirrors the platform WebVitalsReporter: dev skip, buffer, sendBeacon on
// visibilitychange-hidden / pagehide. Fail-open everywhere — never throws.

const PROJECT_ID = "orchestkit";
const ENDPOINT = "/api/analytics";
const SAMPLE_RATE = 0.1;
const SAMPLE_KEY = "hq-cwv-sampled";
const TRACKED = new Set(["LCP", "CLS", "INP", "TTFB", "FCP"]);

type Vital = {
	name: string;
	value: number;
	rating?: string;
	id?: string;
	navigationType?: string;
};

type BeaconEvent = {
	name: string;
	path: string;
	referrer: string;
	properties: {
		value: number;
		rating: string | null;
		id: string | null;
		navigationType: string | null;
	};
};

/**
 * Decide once per session whether this session is in the 10% sample, and reuse
 * the decision deterministically via sessionStorage. Returns false (don't
 * sample) and never throws if sessionStorage is unavailable.
 */
function isSampled(): boolean {
	try {
		const cached = window.sessionStorage.getItem(SAMPLE_KEY);
		if (cached !== null) return cached === "1";
		const decision = Math.random() < SAMPLE_RATE;
		window.sessionStorage.setItem(SAMPLE_KEY, decision ? "1" : "0");
		return decision;
	} catch {
		return false;
	}
}

export function WebVitalsReporter() {
	const bufferRef = useRef<BeaconEvent[]>([]);
	const flushedRef = useRef(false);
	// Resolve the sampling gate once per mount; bail entirely if not sampled.
	const sampledRef = useRef<boolean | null>(null);
	if (sampledRef.current === null) {
		const isDev = process.env.NODE_ENV === "development";
		sampledRef.current = !isDev && isSampled();
	}

	const flush = useCallback(() => {
		if (flushedRef.current) return;
		const events = bufferRef.current;
		if (events.length === 0) return;
		flushedRef.current = true;
		bufferRef.current = [];

		const body = JSON.stringify({ project_id: PROJECT_ID, events });
		try {
			if (
				typeof navigator !== "undefined" &&
				typeof navigator.sendBeacon === "function"
			) {
				navigator.sendBeacon(
					ENDPOINT,
					new Blob([body], { type: "application/json" }),
				);
			} else {
				void fetch(ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
					keepalive: true,
				}).catch(() => {});
			}
		} catch {
			// fail-open — a beacon must never surface an error
		}
	}, []);

	const registerFlushListeners = useCallback(() => {
		const onHidden = () => {
			if (document.visibilityState === "hidden") flush();
		};
		document.addEventListener("visibilitychange", onHidden);
		window.addEventListener("pagehide", flush);
	}, [flush]);

	const listenersBoundRef = useRef(false);

	const handler = useCallback(
		(metric: Vital) => {
			try {
				if (sampledRef.current !== true) return;
				if (!TRACKED.has(metric.name)) return;

				bufferRef.current.push({
					name: `web-vital:${metric.name}`,
					path: window.location.pathname,
					referrer: "",
					properties: {
						value: Math.round(metric.value * 100) / 100,
						rating: metric.rating ?? null,
						id: metric.id ?? null,
						navigationType: metric.navigationType ?? null,
					},
				});

				if (!listenersBoundRef.current) {
					listenersBoundRef.current = true;
					registerFlushListeners();
				}
			} catch {
				// fail-open
			}
		},
		[registerFlushListeners],
	);

	useReportWebVitals(handler);

	return null;
}
