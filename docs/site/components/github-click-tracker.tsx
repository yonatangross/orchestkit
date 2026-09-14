"use client";

import { useEffect } from "react";
import { SITE } from "@/lib/constants";
import { track } from "@/lib/search-beacon";

export type GitHubLinkLocation = "nav" | "footer" | "sidebar";

/**
 * Where a click on the repository link came from, or null when the anchor is
 * not the shared repo link. Only the bare repo URL counts: /stargazers already
 * fires star_clicked and /edit/... is the per-page "Edit on GitHub" link, not
 * the shared chrome.
 */
export function githubLinkLocation(anchor: Element): GitHubLinkLocation | null {
	const href = anchor.getAttribute("href")?.replace(/\/+$/, "");
	if (href !== SITE.github) return null;
	if (anchor.closest("footer")) return "footer";
	if (anchor.closest("#nd-sidebar, aside")) return "sidebar";
	if (anchor.closest("header, nav, #nd-nav")) return "nav";
	return null;
}

/**
 * Fires github_clicked on the GitHub links in the shared nav, docs sidebar and
 * footer. Those links are rendered by Fumadocs from `githubUrl` (no onClick
 * hook) and by the home footer, so one delegated capture listener covers all of
 * them without forking either. Renders nothing.
 */
export function GitHubClickTracker() {
	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			try {
				const anchor = (e.target as Element | null)?.closest?.("a[href]");
				if (!anchor) return;
				const location = githubLinkLocation(anchor);
				if (location) track("github_clicked", { location });
			} catch {
				// fail-open: analytics must never break navigation
			}
		};
		document.addEventListener("click", onClick, { capture: true });
		return () => document.removeEventListener("click", onClick, { capture: true });
	}, []);
	return null;
}
