import { createSearchAPI } from "fumadocs-core/search/server";
import { buildSearchIndexes } from "@/lib/search-indexes";
import { problemResponse } from "@/lib/problem";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

// Unified ⌘K search over ALL content types (docs · skills · agents · hooks ·
// compositions) via one Orama index. Replaces the title-only fumadocs default.
//
//  • tolerance: 1  → 1-char Levenshtein typo tolerance ("agnt" finds "agent").
//        Note: tolerance > 0 disables prefix search (Orama #544) — the correct
//        trade for full-query docs search.
//  • boost.content → lift body-content matches; advanced mode already weights
//        title/heading hits, so content boost balances deep-body relevance.
//  • indexes carry a `tag` ("docs"|"skill"|"agent"|"hook"|"composition") so the
//        search dialog can filter by content type (?tag=skill) for the tabs.
const { GET: fumaGET } = createSearchAPI("advanced", {
	language: "english",
	indexes: buildSearchIndexes,
	search: {
		tolerance: 1,
		boost: { content: 1.5 },
	},
});

// Cursor-based pagination: the cursor is an opaque token encoding the next
// position in the (deterministic, per-build) ranked result list. Cursors beat
// offset/page params for agents — no drifting pages, and the next-page link is
// returned ready to follow (response `Link: <...>; rel="next"` + X-Next-Cursor).
function encodeCursor(position: number): string {
	return btoa(`v1:${position}`).replace(/=+$/, "");
}

function decodeCursor(cursor: string): number | null {
	try {
		const decoded = atob(cursor);
		const match = /^v1:(\d+)$/.exec(decoded);
		return match ? Number.parseInt(match[1], 10) : null;
	} catch {
		return null;
	}
}

// Thin wrapper so agents get (a) a structured RFC 9457 JSON error on a malformed
// request instead of an empty 200, (b) cursor-based pagination via `limit` +
// `cursor` with an `X-Total-Count` total header, and (c) RateLimit-* headers.
// The fumadocs handler does the actual search. An empty/missing `query` is
// treated as a bad request (the ⌘K dialog never fires an empty query — it
// debounces on non-empty input).
export async function GET(req: Request) {
	const rate = checkRateLimit(req, "search");
	if (rate.limited) {
		return problemResponse(
			{
				title: "Too many requests",
				status: 429,
				detail: `Rate limit exceeded; retry after ${rate.resetSeconds}s.`,
				instance: "/api/search",
			},
			{ ...rateLimitHeaders(rate), "Retry-After": String(rate.resetSeconds) },
		);
	}

	const url = new URL(req.url);
	const query = (url.searchParams.get("query") ?? "").trim();
	if (!query) {
		return problemResponse(
			{
				type: "https://orchestkit.yonyon.ai/docs/reference",
				title: "Missing query parameter",
				status: 400,
				detail:
					"Provide a non-empty `query`, e.g. /api/search?query=install&limit=10.",
				instance: "/api/search",
			},
			rateLimitHeaders(rate),
		);
	}

	const cursorRaw = url.searchParams.get("cursor");
	const start = cursorRaw ? decodeCursor(cursorRaw) : 0;
	if (start === null) {
		return problemResponse(
			{
				title: "Invalid cursor",
				status: 400,
				detail: "`cursor` is not a token issued by this API; omit it to restart.",
				instance: "/api/search",
			},
			rateLimitHeaders(rate),
		);
	}

	const res = await fumaGET(req);
	if (!res.ok) return res;

	const limitRaw = url.searchParams.get("limit");
	const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 0;

	const results = (await res.json()) as unknown;
	const all = Array.isArray(results) ? results : [];
	const end = Number.isFinite(limit) && limit > 0 ? start + limit : all.length;
	const page = all.slice(start, end);
	const nextCursor = end < all.length ? encodeCursor(end) : null;

	const next = new URL(url);
	if (nextCursor) next.searchParams.set("cursor", nextCursor);

	return Response.json(page, {
		headers: {
			"X-Total-Count": String(all.length),
			...(nextCursor
				? { "X-Next-Cursor": nextCursor, Link: `<${next.toString()}>; rel="next"` }
				: {}),
			...rateLimitHeaders(rate),
			"Cache-Control": "public, max-age=300",
			Vary: "Accept",
		},
	});
}
