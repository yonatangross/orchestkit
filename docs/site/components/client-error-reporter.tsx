"use client";

import { useEffect } from "react";

// Sovereign client-error beacon. Captures uncaught errors + unhandled promise
// rejections and flushes them through the SAME first-party proxy as
// WebVitalsReporter: POST /api/analytics -> HMAC-sign + enrich -> API
// /api/analytics/ingest. No SaaS, no backend change (AnalyticsIngestEvent.name is
// a free-form str, so name:"error" flows through). Imports ONLY React and POSTs
// same-origin — no HMAC hand-rolled here. Fail-open everywhere; production-only;
// deduped by signature + session-capped so an error loop can never flood ingest.

const PROJECT_ID = "orchestkit";
const ENDPOINT = "/api/analytics";
const MAX_PER_SESSION = 25;
const MESSAGE_MAX = 500;
const STACK_MAX = 2000;

// Module-scoped per-session counters (reset on full page load, persist across
// client-side navigation) — the idiomatic shape for a beacon volume guard.
let sent = 0;
const seen = new Set<string>();

type ErrorKind = "onerror" | "unhandledrejection" | "boundary" | "fetch";

function beacon(properties: Record<string, unknown>): void {
	try {
		if (typeof window === "undefined") return;
		if (process.env.NODE_ENV === "development") return;
		if (sent >= MAX_PER_SESSION) return;
		sent += 1;
		const body = JSON.stringify({
			project_id: PROJECT_ID,
			events: [
				{
					name: "error",
					path: window.location.pathname,
					referrer: document.referrer || "",
					properties,
				},
			],
		});
		if (
			typeof navigator !== "undefined" &&
			typeof navigator.sendBeacon === "function"
		) {
			navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
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
}

function signature(message: string, stack: string): string {
	return `${message}|${stack.split("\n")[0] ?? ""}`.slice(0, 200);
}

/**
 * Report a client-side error through the sovereign analytics beacon.
 * Safe to call from catch blocks, error boundaries, or fetch handlers —
 * never throws, deduplicates repeated signatures, and is a no-op in dev.
 */
export function reportClientError(
	error: unknown,
	context?: { kind?: ErrorKind; component?: string },
): void {
	try {
		const err = error instanceof Error ? error : new Error(String(error));
		const sig = signature(err.message, err.stack ?? "");
		if (seen.has(sig)) return; // suppress loops / duplicate signatures
		seen.add(sig);
		beacon({
			message: err.message.slice(0, MESSAGE_MAX),
			stack: (err.stack ?? "").slice(0, STACK_MAX),
			name: err.name,
			kind: context?.kind ?? "boundary",
			component: context?.component ?? null,
		});
	} catch {
		// fail-open
	}
}

/**
 * Mounts global listeners for uncaught errors + unhandled promise rejections
 * and beacons them through the sovereign analytics pipeline. Renders nothing.
 * Mirrors WebVitalsReporter — mount once at the root layout.
 */
export function ClientErrorReporter(): null {
	useEffect(() => {
		const onError = (e: ErrorEvent) =>
			reportClientError(e.error ?? new Error(e.message), { kind: "onerror" });
		const onRejection = (e: PromiseRejectionEvent) =>
			reportClientError(e.reason, { kind: "unhandledrejection" });
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onRejection);
		return () => {
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onRejection);
		};
	}, []);
	return null;
}
