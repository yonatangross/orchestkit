import { createSearchAPI } from "fumadocs-core/search/server";
import { buildSearchIndexes } from "@/lib/search-indexes";
import { problemResponse } from "@/lib/problem";

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

// Thin wrapper so agents get (a) a structured RFC 9457 JSON error on a malformed
// request instead of an empty 200, and (b) a `limit` pagination control with an
// `X-Total-Count` total header. The fumadocs handler does the actual search.
// An empty/missing `query` is treated as a bad request (the ⌘K dialog never
// fires an empty query — it debounces on non-empty input).
export async function GET(req: Request) {
	const url = new URL(req.url);
	const query = (url.searchParams.get("query") ?? "").trim();
	if (!query) {
		return problemResponse({
			type: "https://orchestkit.yonyon.ai/docs/reference",
			title: "Missing query parameter",
			status: 400,
			detail:
				"Provide a non-empty `query`, e.g. /api/search?query=install&limit=10.",
			instance: "/api/search",
		});
	}

	const res = await fumaGET(req);
	if (!res.ok) return res;

	const limitRaw = url.searchParams.get("limit");
	const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 0;

	const results = (await res.json()) as unknown;
	const all = Array.isArray(results) ? results : [];
	const page = Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;

	return Response.json(page, {
		headers: {
			"X-Total-Count": String(all.length),
			"Cache-Control": "public, max-age=300",
			Vary: "Accept",
		},
	});
}
