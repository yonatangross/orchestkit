"use client";

// Custom ⌘K dialog on top of the unified Orama index (app/api/search).
//   • Facet chips ABOVE the results (All / Guides / Skills / Agents / Hooks)
//     — selecting one sets ?tag=… so the server filters by content type.
//   • "Top results" row (top 3 overall), then grouped sections with headers
//     (Guides / Concepts / Skills / Agents / Hooks / Other), capped per group.
//     Items stay in one flat array, so the built-in arrow-key navigation
//     keeps working across group boundaries.
//   • Zero-result rescue: "did you mean" + browse links instead of a dead end,
//     plus a fire-and-forget beacon through the existing /api/analytics proxy.

import { useEffect, useMemo, useRef, useState } from "react";
import { useDocsSearch } from "fumadocs-core/search/client";
import type { SortedResult } from "fumadocs-core/search";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import {
  MAX_SNIPPETS_PER_PAGE,
  buildDisplayList,
  toBlocks,
} from "@/lib/search-display";
import {
  reportSearchPerformed,
  reportSearchResultClicked,
  reportZeroResultQuery,
} from "@/lib/search-beacon";
import { stripOrigin } from "@/lib/search-relevance";
import { SearchZeroResults } from "@/components/search-zero-results";

const FACETS: { value: string; name: string }[] = [
  { value: "docs", name: "Guides" },
  { value: "skill", name: "Skills" },
  { value: "agent", name: "Agents" },
  { value: "hook", name: "Hooks" },
];

const BEACON_DEBOUNCE_MS = 1500;

export default function CustomSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string | undefined>(undefined);
  const { search, setSearch, query } = useDocsSearch({
    type: "fetch",
    // Ask for only what this dialog can render. Without these bounds the API
    // returns EVERY matched row: a one-character query like "m" is 2180 rows /
    // 433 KB, re-fetched on each keystroke, then parsed and grouped client-side.
    // maxSnippets matches MAX_SNIPPETS_PER_PAGE; limit covers the display cap
    // (3 top + 6 groups x 4 = 27 pages, at most 3 rows each).
    //
    // client=dialog marks this as OUR OWN XHR, not agent traffic. fumadocs'
    // fetchClient sends a bare fetch() with no headers, so the request arrives
    // with `Accept: */*` and is otherwise indistinguishable from an agent
    // calling the documented /api/search endpoint. Its debounce is 100ms, so
    // without this marker middleware emitted one agent:api-request per settled
    // keystroke. The API itself ignores the param.
    api: `/api/search?maxSnippets=${MAX_SNIPPETS_PER_PAGE}&limit=90&client=dialog`,
    tag,
  });

  // Keep heading/text sub-rows: they carry the <mark>-highlighted excerpt that
  // shows WHY a page matched, and deep-link to the matching #anchor. Filtering
  // to type === "page" here reduced every result to a bare title (for "tavily",
  // 66 of 86 rows were evidence and all 66 were dropped). buildDisplayList caps
  // them per page so the list stays scannable.
  const rows = useMemo(() => {
    if (!Array.isArray(query.data)) return null;
    return query.data as SortedResult[];
  }, [query.data]);

  const display = useMemo(() => (rows ? buildDisplayList(rows) : null), [rows]);

  // Client-side fallback timing for search:performed's duration_ms. The
  // server measures its own Server-Timing header around the actual Orama
  // search (app/api/search/route.ts), but fumadocs' `useDocsSearch({ type:
  // "fetch" })` only ever surfaces the parsed result array, never the
  // `Response` object, so that header is unreachable from here (see the
  // comment on reportSearchPerformed). This instead times from
  // debounce-settle (query.isLoading -> true) to results-arrived, which also
  // captures network + JSON-parse time on top of the server's own number.
  const searchStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (query.isLoading) searchStartRef.current = performance.now();
  }, [query.isLoading]);

  // Zero-result beacon: debounced so mid-typing states don't fire, deduped
  // per query string, truncated to 80 chars inside the reporter.
  const lastReported = useRef<string>("");
  const isZeroResult =
    search.trim().length > 0 && !query.isLoading && rows?.length === 0;
  useEffect(() => {
    if (!isZeroResult) return;
    const q = search.trim();
    if (lastReported.current === q) return;
    const timer = setTimeout(() => {
      lastReported.current = q;
      reportZeroResultQuery(q);
    }, BEACON_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isZeroResult, search]);

  // search:performed is the denominator for click-through, and the only record
  // of what people actually type. Debounced on the SAME 1500ms as the
  // zero-result beacon because fumadocs' own delay is 100ms, i.e. roughly one
  // settled result set per typed word: instrumenting the raw data change would
  // emit several events per search.
  //
  // The dedupe key carries the facet as well as the text. Keyed on text alone,
  // switching Skills -> Agents on the same query would emit nothing and the
  // facet's effect on results would go unmeasured; a facet change re-runs the
  // query with no debounce of its own, so it is a genuinely new result set.
  const lastPerformed = useRef<string>("");
  useEffect(() => {
    const q = search.trim();
    // rows is null until a search has actually run (fumadocs reports "empty"
    // rather than an array for an empty query), so this is the real guard.
    if (!q || query.isLoading || !rows) return;
    const key = `${tag ?? "all"}::${q}`;
    if (lastPerformed.current === key) return;
    // Page blocks, not rendered rows: the flat array interleaves heading/text
    // sub-rows. Still a post-cap count (limit=90), never the corpus total.
    const resultCount = toBlocks(rows).length;
    const durationMs =
      searchStartRef.current !== null
        ? Math.round(performance.now() - searchStartRef.current)
        : undefined;
    const timer = setTimeout(() => {
      lastPerformed.current = key;
      reportSearchPerformed({ query: q, resultCount, tag: tag ?? "all", durationMs });
    }, BEACON_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, tag, rows, query.isLoading]);

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      // One funnel for BOTH mouse clicks and keyboard Enter, so no per-item
      // wiring. fumadocs calls this AFTER router.push and after closing the
      // dialog, which is why the beacon must be sendBeacon/keepalive.
      onSelect={(item) => {
        // "action" items are fumadocs' own commands, not search results, and
        // carry no url.
        if (item.type === "action") return;
        const items = display?.items ?? [];
        const position = items.findIndex((i) => i.id === item.id);
        // Unreachable by construction (the list is built from `display`), but a
        // -1 would poison the rank math this event exists to feed, so drop it.
        if (position < 0) return;
        reportSearchResultClicked({
          query: search,
          url: stripOrigin(item.url),
          position,
          resultType: item.type,
          tag: tag ?? "all",
        });
      }}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput placeholder="Search docs, skills, agents…" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <div
          role="group"
          aria-label="Filter results by content type"
          className="flex flex-wrap items-center gap-1 border-b px-2.5 py-2"
        >
          {[{ value: undefined, name: "All" }, ...FACETS].map((t) => {
            const selected = tag === t.value;
            return (
              <button
                key={t.name}
                type="button"
                data-active={selected}
                aria-pressed={selected}
                onClick={() => setTag(t.value)}
                className="rounded-md border px-2 py-0.5 text-xs font-medium text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:bg-fd-accent data-[active=true]:text-fd-accent-foreground"
              >
                {t.name}
              </button>
            );
          })}
        </div>
        <SearchDialogList
          items={display?.items ?? null}
          Item={({ item, onClick }) => (
            <>
              {display?.headerById[item.id] !== undefined && (
                <div className="px-2.5 pt-3 pb-1 text-xs font-medium text-fd-muted-foreground first:pt-1.5">
                  {display.headerById[item.id]}
                </div>
              )}
              <SearchDialogListItem item={item} onClick={onClick} />
            </>
          )}
          Empty={() =>
            search.trim().length > 0 ? (
              <SearchZeroResults
                query={search}
                onNavigate={() => props.onOpenChange?.(false)}
              />
            ) : (
              <div className="py-12 text-center text-sm text-fd-muted-foreground">
                Type to search the docs
              </div>
            )
          }
        />
      </SearchDialogContent>
    </SearchDialog>
  );
}
