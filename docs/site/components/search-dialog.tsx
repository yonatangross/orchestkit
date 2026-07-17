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
import { buildDisplayList } from "@/lib/search-display";
import { reportZeroResultQuery } from "@/lib/search-beacon";
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
    api: "/api/search",
    tag,
  });

  // Page-level results only — grouped display reads like a sitemap slice;
  // heading/text sub-rows add noise once sections exist.
  const pages = useMemo(() => {
    if (!Array.isArray(query.data)) return null;
    return (query.data as SortedResult[]).filter((r) => r.type === "page");
  }, [query.data]);

  const display = useMemo(
    () => (pages ? buildDisplayList(pages) : null),
    [pages],
  );

  // Zero-result beacon: debounced so mid-typing states don't fire, deduped
  // per query string, truncated to 80 chars inside the reporter.
  const lastReported = useRef<string>("");
  const isZeroResult =
    search.trim().length > 0 && !query.isLoading && pages?.length === 0;
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

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
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
