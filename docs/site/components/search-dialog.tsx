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
  useSearchList,
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
import {
  suggestCompletions,
  type SuggestEntry,
  type Suggestion,
} from "@/lib/search-autocomplete";
import {
  SUGGEST_PAUSE_MS,
  resolveSuggestions,
  type ServerSuggestOrder,
} from "@/lib/suggest-rerank-client";
import {
  createSuggestStats,
  percentile,
  recordSuggestSample,
} from "@/lib/suggest-metrics";
import { SearchZeroResults } from "@/components/search-zero-results";

const FACETS: { value: string; name: string }[] = [
  { value: "docs", name: "Guides" },
  { value: "skill", name: "Skills" },
  { value: "agent", name: "Agents" },
  { value: "hook", name: "Hooks" },
];

const BEACON_DEBOUNCE_MS = 1500;
const LISTBOX_ID = "ork-search-listbox";

// Typeahead runs fully client-side over the generated title/heading index.
// The optional server re-rank is gated by ORK_SITE_JEV_SUGGEST, the same flag
// the route checks, baked in at build time via the next.config env
// passthrough, so flag-off operation never touches the network beyond the
// existing /api/search call. ORK_SITE_JEV_RERANK is a different switch and
// covers related-pages only.
// It must be a DIRECT process.env read: Next only inlines process.env.NAME
// into the client bundle, so reading through jevSuggestEnabled() would
// evaluate to undefined in the browser and leave the feature dead.
const JEV_SUGGEST_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.ORK_SITE_JEV_SUGGEST ?? "").toLowerCase(),
);

// Dev-only A/B toggle + metrics footer (the Jev launcher demo proof format).
// Never rendered in production builds.
const SUGGEST_DEV_TOOLS =
  JEV_SUGGEST_ENABLED && process.env.NODE_ENV !== "production";
const SUGGEST_MODES = [
  { value: "jev", name: "Jev" },
  { value: "off", name: "Jev off" },
  { value: "llm", name: "LLM" },
] as const;
type SuggestMode = (typeof SUGGEST_MODES)[number]["value"];

/**
 * Sets aria-activedescendant on the combobox input to the active option's DOM
 * id. Must render inside SearchDialogList (it reads fumadocs' ListContext),
 * so it is mounted inside the first Item render.
 */
function ActiveDescendantSync({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { active } = useSearchList();
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (active) {
      input.setAttribute("aria-activedescendant", `ork-search-item-${active}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
    return () => input.removeAttribute("aria-activedescendant");
  }, [active, inputRef]);
  return null;
}

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

  // ── Typeahead ─────────────────────────────────────────────────────────
  // Deterministic suggestions from the generated title/heading index. The
  // index is lazy-loaded on the first real keystroke so it stays out of the
  // layout bundle (same pattern as the zero-result rescue list).
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [suggestEntries, setSuggestEntries] = useState<
    readonly SuggestEntry[] | null
  >(null);
  const [serverSuggestions, setServerSuggestions] =
    useState<ServerSuggestOrder | null>(null);
  const [suggestMode, setSuggestMode] = useState<SuggestMode>("jev");
  const [suggestStats, setSuggestStats] = useState(createSuggestStats);

  useEffect(() => {
    if (suggestEntries || search.trim().length < 2) return;
    let alive = true;
    import("@/lib/generated/search-suggest-index")
      .then(({ SEARCH_SUGGEST_INDEX }) => {
        if (alive) setSuggestEntries(SEARCH_SUGGEST_INDEX);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [search, suggestEntries]);

  const localSuggestions = useMemo(
    () => (suggestEntries ? suggestCompletions(search, suggestEntries, 10) : []),
    [search, suggestEntries],
  );

  // Background re-rank of the deterministic top 10 via /api/search/suggest.
  // NOTHING on screen waits for this: localSuggestions is already rendered
  // when the request goes out, and the answer is applied only if the query
  // has not moved on (resolveSuggestions). Skipped entirely when the flag was
  // off at build time or the dev toggle is on "Jev off"; any failure keeps the
  // local deterministic order.
  //
  // Fired on a typing PAUSE, not on every keystroke. Prod 2026-09-21 issued
  // one call per 200 ms debounce and discarded all 72 of them; raw Jev p50 is
  // 760.5 ms, so a mid-word call is answering a prefix the user has already
  // left. SUGGEST_PAUSE_MS collapses a typed word into one call.
  //
  // Latency is measured client-side (full round trip) for the dev footer.
  useEffect(() => {
    if (!JEV_SUGGEST_ENABLED || suggestMode === "off") {
      setServerSuggestions(null);
      return;
    }
    const q = search.trim();
    if (q.length < 2 || localSuggestions.length === 0) {
      setServerSuggestions(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      const startedAt = performance.now();
      try {
        const res = await fetch(
          `/api/search/suggest?query=${encodeURIComponent(q)}&mode=${suggestMode}`,
          // The route answers `private, max-age=300`, so the browser would
          // replay a stored body whose `attempted: true, estCostUsd` describes
          // a call that did not happen, and the footer would bill it twice.
          // Repeat prefixes are served by the route's own order cache instead.
          { cache: "no-store" },
        );
        const json = res.ok
          ? ((await res.json()) as {
              items?: Suggestion[];
              estCostUsd?: number;
              fellBack?: boolean;
              cached?: boolean;
            })
          : null;
        // Recorded BEFORE the staleness check: the request was sent and, per
        // the route's accounting, billed. With a 450 ms pause against Jev's
        // 760 ms p50 the stale answer is the common case, so skipping it here
        // would re-hide exactly the spend the route now reports.
        setSuggestStats((s) =>
          recordSuggestSample(s, Math.round(performance.now() - startedAt), {
            costUsd: json?.estCostUsd ?? 0,
            fellBack: json ? json.fellBack === true : true,
            cached: json?.cached === true,
          }),
        );
        // The query moved on while this was in flight: drop the answer rather
        // than reorder the list under someone who has kept typing.
        if (!alive) return;
        if (Array.isArray(json?.items)) {
          setServerSuggestions({ query: q, mode: suggestMode, items: json.items });
        }
      } catch {
        // A network failure is still an attempt; the server-side cost is
        // unknowable from here, so count the request and leave cost at 0.
        setSuggestStats((s) =>
          recordSuggestSample(s, Math.round(performance.now() - startedAt), {
            costUsd: 0,
            fellBack: true,
            cached: false,
          }),
        );
        // deterministic order stands
      }
    }, SUGGEST_PAUSE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, localSuggestions.length, suggestMode]);

  // Second half of the stale-query guard: `alive` covers an answer that lands
  // after the effect re-runs, this covers one already in state when the user
  // types again, before the new request has returned.
  const suggestions = resolveSuggestions(
    localSuggestions,
    serverSuggestions,
    search,
    suggestMode,
  );

  // Suggestions become ordinary list items at the top of the flat array, so
  // fumadocs' arrow-key + Enter navigation covers them for free. Suggestions
  // whose page already leads the results are dropped (no visual dupes).
  const listItems = useMemo(() => {
    const resultItems = display?.items ?? [];
    const resultPageUrls = new Set(
      resultItems.filter((i) => i.type === "page").map((i) => i.url),
    );
    // No breadcrumbs on heading suggestions: fumadocs draws the heading "#"
    // glyph absolutely at the row's top line, which is where the breadcrumb
    // row sits, so the two overlapped ("Sec#rity Patterns"). The label is
    // already "Page > Heading", so the breadcrumb only repeated the page.
    const suggestItems = suggestions
      .filter((s) => !resultPageUrls.has(s.url.split("#")[0]))
      .map(
        (s): SortedResult => ({
          id: `suggest:${s.url}`,
          type: s.via === "heading" ? "heading" : "page",
          url: s.url,
          content: s.label,
        }),
      );
    return [...suggestItems, ...resultItems];
  }, [suggestions, display]);

  const headerById = useMemo(() => {
    const headers = { ...(display?.headerById ?? {}) };
    const first = listItems[0];
    if (first && first.id.startsWith("suggest:")) {
      headers[first.id] = "Suggestions";
    }
    return headers;
  }, [display, listItems]);

  const itemsForList = listItems.length > 0 ? listItems : (display?.items ?? null);

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
        // carry no url. Typeahead picks are skipped too: they are not ranked
        // results, so counting them would corrupt the position data the click
        // beacon exists to feed.
        if (item.type === "action" || item.id.startsWith("suggest:")) return;
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
      <SearchDialogContent
        // ph-no-capture: PostHog session replay (on /docs/reference/*) replaces
        // this whole subtree with a placeholder, so the typed query, the result
        // list, and the zero-results echo of the query are never recorded. It
        // also opts the dialog out of autocapture; result clicks still reach
        // PostHog through reportSearchResultClicked's first-party mirror.
        className="ph-no-capture"
      >
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput
            ref={inputRef}
            placeholder="Search docs, skills, agents…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listItems.length > 0}
            aria-controls={LISTBOX_ID}
          />
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
          id={LISTBOX_ID}
          role="listbox"
          items={itemsForList}
          Item={({ item, onClick }) => (
            <>
              {item.id === listItems[0]?.id && (
                <ActiveDescendantSync inputRef={inputRef} />
              )}
              {headerById[item.id] !== undefined && (
                <div className="px-2.5 pt-3 pb-1 text-xs font-medium text-fd-muted-foreground first:pt-1.5">
                  {headerById[item.id]}
                </div>
              )}
              <SearchDialogListItem
                item={item}
                onClick={onClick}
                id={`ork-search-item-${item.id}`}
                role="option"
              />
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
        {SUGGEST_DEV_TOOLS && (
          <div className="flex flex-wrap items-center gap-1 border-t px-2.5 py-1.5 text-xs text-fd-muted-foreground">
            <span className="font-medium">suggest rerank:</span>
            {SUGGEST_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                data-active={suggestMode === m.value}
                aria-pressed={suggestMode === m.value}
                onClick={() => setSuggestMode(m.value)}
                className="rounded-md border px-1.5 py-0.5 font-medium transition-colors hover:text-fd-accent-foreground data-[active=true]:bg-fd-accent data-[active=true]:text-fd-accent-foreground"
              >
                {m.name}
              </button>
            ))}
            <span className="ml-auto tabular-nums">
              p50 {Math.round(percentile(suggestStats.latencies, 50))}ms · p95{" "}
              {Math.round(percentile(suggestStats.latencies, 95))}ms ·{" "}
              {suggestStats.requests} req · {suggestStats.fallbacks} fallback ·{" "}
              {suggestStats.cacheHits} cached · ~$
              {suggestStats.costUsd.toFixed(4)}
            </span>
          </div>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
