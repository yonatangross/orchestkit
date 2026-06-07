import { createSearchAPI } from "fumadocs-core/search/server";
import { buildSearchIndexes } from "@/lib/search-indexes";

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
export const { GET } = createSearchAPI("advanced", {
  language: "english",
  indexes: buildSearchIndexes,
  search: {
    tolerance: 1,
    boost: { content: 1.5 },
  },
});
