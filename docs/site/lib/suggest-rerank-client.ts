// Client-side policy for the non-blocking typeahead re-rank.
//
// The dialog renders its locally computed deterministic suggestions
// immediately and never awaits the network. The Jev order arrives later, out
// of band, and is applied only when it still describes what the user is
// looking at. Prod measurement 2026-09-21: raw Jev p50 760.5 ms, min 708.7 ms,
// so "later" is roughly a second after the pause, by which time a fast typist
// has moved on.
//
// Kept out of the component so the staleness rule is unit-testable without a
// DOM or a React renderer.

import type { Suggestion } from "@/lib/search-autocomplete";

/**
 * Idle time before the background request fires. Not the keystroke debounce:
 * the prod run issued one call per 200 ms debounce and threw all 72 away.
 * Waiting for a typing pause collapses a typed word into a single call.
 */
export const SUGGEST_PAUSE_MS = 450;

export type ServerSuggestOrder = {
	/** The trimmed query this order was requested for. */
	query: string;
	/** The re-rank mode in force when it was requested (dev A/B toggle). */
	mode: string;
	items: readonly Suggestion[];
};

/**
 * True when a server order still describes the current input. A late answer
 * for an abandoned prefix must be discarded rather than applied: reordering
 * the list under someone who has typed on is worse than never reordering.
 */
export function isCurrentSuggestOrder(
	server: ServerSuggestOrder | null,
	currentQuery: string,
	currentMode: string,
): boolean {
	if (!server) return false;
	return server.query === currentQuery.trim() && server.mode === currentMode;
}

/**
 * What the dialog renders: the Jev order when it is current, the local
 * deterministic order otherwise. Never an empty list while local has content.
 */
export function resolveSuggestions(
	local: readonly Suggestion[],
	server: ServerSuggestOrder | null,
	currentQuery: string,
	currentMode: string,
): readonly Suggestion[] {
	if (!isCurrentSuggestOrder(server, currentQuery, currentMode)) return local;
	const items = server?.items ?? [];
	return items.length > 0 ? items : local;
}
