"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { LazySkillBrowser } from "@/components/lazy";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { CategoryMark, LibraryMark } from "@/components/category-mark";
import { SameRouteFade, sameRouteReplace } from "@/components/page-transition";
import { ChangelogMermaid } from "@/components/changelog-mermaid";
import { SearchParamsSync } from "@/components/search-params-sync";
import { AGENTS } from "@/lib/generated/shared-data";
import { COUNTS } from "@/lib/constants";
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_COLORS,
  categoryBorder,
  categoryLabel,
} from "@/lib/category-colors";
import {
  groupedHookEvents,
  hookLifecycleFlow,
  HOOK_LIFECYCLE_CHART,
} from "@/lib/hook-phases";
import { parseHostId } from "@/lib/host-installs";
import {
  libraryTabHref,
  parseLibraryTab,
  type LibraryTab,
} from "@/lib/library-tab";
import type { HostId } from "@/components/host-marks";

const TABS: { id: LibraryTab; label: string; count: number }[] = [
  { id: "skills", label: "Skills", count: COUNTS.skills },
  { id: "agents", label: "Agents", count: COUNTS.agents },
  { id: "hooks", label: "Hooks", count: COUNTS.hooks },
];

/**
 * The tab and the host both come from the URL (`?lib=`, `?host=`) through
 * SearchParamsSync rather than page props, so `/` stays statically rendered.
 * Prerendered HTML shows Skills; a `?lib=` deep link switches after hydration.
 */
export function LibraryCatalog() {
  const router = useRouter();
  const [current, setCurrent] = useState<LibraryTab>("skills");
  const [host, setHost] = useState<HostId>("claude");
  const pendingTabFocus = useRef<LibraryTab | null>(null);

  const syncFromUrl = (params: URLSearchParams) => {
    setCurrent(parseLibraryTab(params.get("lib") ?? undefined));
    setHost(parseHostId(params.get("host") ?? undefined));
  };

  useEffect(() => {
    const id = pendingTabFocus.current;
    if (!id) return;
    pendingTabFocus.current = null;
    document.getElementById(`library-tab-${id}`)?.focus();
  }, [current]);

  const select = (id: LibraryTab) => {
    startTransition(() => {
      setCurrent(id);
      router.replace(libraryTabHref(id, host), sameRouteReplace);
    });
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === current);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (i + 1) % TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (i - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextId = TABS[next].id;
    pendingTabFocus.current = nextId;
    select(nextId);
  };

  return (
    <section
      id="library"
      aria-labelledby="library-heading"
      className="border-b border-fd-border"
    >
      <SearchParamsSync onChange={syncFromUrl} />
      <div className="mx-auto max-w-[1200px] px-7 py-[72px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
              <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
              Catalog
            </span>
            <h2
              id="library-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground"
            >
              The library
            </h2>
            <p className="mt-2 max-w-[560px] text-sm leading-6 text-fd-muted-foreground">
              Browse every skill, agent, and hook. Search, filter, then open the
              reference page. Skills also have a{" "}
              <Link
                href="/docs/reference/skills"
                className="text-fd-primary underline underline-offset-2"
              >
                clustered atlas
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Phones drop the tab marks and tighten the padding: with them the
            three tabs needed 387px and "Hooks" wrapped alone at 390. */}
        <AnimatedTabs
          ariaLabel="Library primitives"
          layoutId="library-tab-indicator"
          className="max-sm:[&>a]:px-2.5"
          value={current}
          onChange={select}
          onKeyDown={onTabKeyDown}
          tabs={TABS.map((t) => ({
            id: t.id,
            href: libraryTabHref(t.id, host),
            label: (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-fd-muted text-current max-sm:hidden">
                  <LibraryMark kind={t.id} className="h-3.5 w-3.5" />
                </span>
                {t.label}
                <span className="font-mono text-[11px] tabular-nums">
                  {t.count}
                </span>
              </>
            ),
          }))}
        />

        <SameRouteFade childKey={current} name="library-panel">
          <div
            role="tabpanel"
            id={`library-panel-${current}`}
            aria-labelledby={`library-tab-${current}`}
          >
            {current === "skills" ? <LazySkillBrowser /> : null}
            {current === "agents" ? <AgentsGrid /> : null}
            {current === "hooks" ? <HooksFlow /> : null}
          </div>
        </SameRouteFade>
      </div>
    </section>
  );
}

/**
 * Cards shown below lg before "Show all", as in the skill browser
 * (NARROW_PAGE_SIZE there). Not imported: that module carries the skills data.
 */
const AGENTS_NARROW_PAGE = 8;

function AgentsGrid() {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const showAllRef = useRef<HTMLButtonElement>(null);
  const collapsingRef = useRef(false);
  useEffect(() => {
    if (!showAll) {
      // Back from "Show fewer": focus "Show all" and bring it into view.
      if (!collapsingRef.current) return;
      collapsingRef.current = false;
      showAllRef.current?.focus({ preventScroll: true });
      showAllRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    gridRef.current
      ?.querySelectorAll<HTMLAnchorElement>("a")
      [AGENTS_NARROW_PAGE]?.focus();
  }, [showAll]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AGENTS;
    return AGENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [query]);
  // A search always shows every match.
  const capped =
    query.trim() === "" && !showAll && filtered.length > AGENTS_NARROW_PAGE;
  const shownCount = (n: number) => (
    <>
      Showing{" "}
      <span className="font-semibold tabular-nums text-fd-foreground">{n}</span>{" "}
      of {AGENTS.length} agents
    </>
  );

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fd-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents by name or role..."
          aria-label="Search agents by name or role"
          className="h-10 w-full rounded-lg border border-fd-border bg-fd-background pl-10 pr-8 text-sm outline-none transition-all placeholder:text-fd-muted-foreground focus:border-fd-ring focus:ring-2 focus:ring-fd-ring/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fd-muted-foreground hover:text-fd-foreground"
            aria-label="Clear agent search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-fd-muted-foreground" role="status">
        {capped ? (
          <>
            <span className="lg:hidden">{shownCount(AGENTS_NARROW_PAGE)}</span>
            <span className="max-lg:hidden">{shownCount(filtered.length)}</span>
          </>
        ) : (
          shownCount(filtered.length)
        )}
      </p>
      {/* grid-cols-1 caps the phone column at the page, as in the skill grid.
          With no template the auto column grew to the widest card's
          min-content: emulate-engineer's description holds one slash-joined
          list of 13 providers, so "Show all" made every card 588px on a 390px
          phone. The description may break that list (wrap-anywhere). */}
      <div ref={gridRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent, index) => {
          const cat =
            CATEGORY_COLORS[agent.category as keyof typeof CATEGORY_COLORS] ??
            CATEGORY_COLORS.other;
          return (
            <Link
              key={agent.name}
              href={`/docs/reference/agents/${agent.name}`}
              aria-label={agent.name}
              aria-describedby={`agent-card-${agent.name}-desc`}
              className={`group rounded-lg border border-fd-border border-l-[3px] ${categoryBorder(agent.category)} p-4 transition-colors hover:bg-fd-muted${
                capped && index >= AGENTS_NARROW_PAGE ? " max-lg:hidden" : ""
              }`}
            >
              {/* Same anatomy as the skill card: mark, name, then the badge
                  leading two clamped description lines. */}
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cat.bg} ${cat.color}`}
                >
                  <CategoryMark category={agent.category} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-fd-foreground">
                    {agent.name}
                  </h3>
                  <p
                    id={`agent-card-${agent.name}-desc`}
                    className="mt-1 line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground wrap-anywhere"
                  >
                    <span className={`${CATEGORY_BADGE_CLASS} ${cat.bg} ${cat.color}`}>
                      {categoryLabel(agent.category)}
                    </span>{" "}
                    {agent.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {capped ? (
        <button
          ref={showAllRef}
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-4 py-2.5 text-sm font-semibold text-fd-primary transition-colors hover:border-fd-primary/40 hover:bg-fd-muted lg:hidden"
        >
          Show all {filtered.length} agents
        </button>
      ) : null}
      {showAll && query.trim() === "" && filtered.length > AGENTS_NARROW_PAGE ? (
        <button
          type="button"
          onClick={() => {
            collapsingRef.current = true;
            setShowAll(false);
          }}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-4 py-2.5 text-sm font-semibold text-fd-primary transition-colors hover:border-fd-primary/40 hover:bg-fd-muted lg:hidden"
        >
          Show fewer agents
        </button>
      ) : null}
    </div>
  );
}

const HOOK_NODE_CLASS =
  "rounded-md border border-fd-border bg-fd-background px-2 py-1 font-mono text-xs text-fd-foreground";

/** Phone rendition of HOOK_LIFECYCLE_CHART: the spine, then its fan-out. */
function HookFlowCompact() {
  const { spine, branches } = hookLifecycleFlow();
  const last = spine[spine.length - 1];
  return (
    <div
      data-testid="hook-flow-compact"
      className="space-y-2 rounded-lg border border-fd-border p-3 md:hidden"
    >
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Lifecycle order">
        {spine.map((node, i) => (
          <li key={node} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span aria-hidden="true" className="text-xs text-fd-muted-foreground">
                →
              </span>
            ) : null}
            <span className={HOOK_NODE_CLASS}>{node}</span>
          </li>
        ))}
      </ol>
      {branches.length > 0 ? (
        <div className="flex items-start gap-1.5">
          <span aria-hidden="true" className="py-1 text-xs text-fd-muted-foreground">
            ↳
          </span>
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={`${last} branches to`}
          >
            {branches.map((node) => (
              <li key={node} className={HOOK_NODE_CLASS}>
                {node}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HooksFlow() {
  const groups = groupedHookEvents();
  const total = groups.reduce((n, group) => n + group.events.length, 0);

  return (
    <div>
      <p className="mb-4 text-sm text-fd-muted-foreground">
        {total} lifecycle events, grouped by when they fire. Open a category
        for the hooks that run there.
      </p>
      <div className="mb-8 overflow-x-auto rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-4">
        {/* The SVG scales to this box, so below md its labels drew at about
            8px. Phones get the same flow as 12px text instead. */}
        <div className="max-md:hidden">
          <ChangelogMermaid chart={HOOK_LIFECYCLE_CHART} />
        </div>
        <HookFlowCompact />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`hook-phase-${group.id}`}
            className="rounded-xl border border-fd-border p-4"
          >
            <h3
              id={`hook-phase-${group.id}`}
              className="text-sm font-semibold text-fd-foreground"
            >
              {group.label}
              <span className="ml-2 font-mono text-[11px] font-medium tabular-nums text-fd-muted-foreground">
                {group.events.length}
              </span>
            </h3>
            <p className="mt-1 text-[12.5px] leading-5 text-fd-muted-foreground">
              {group.blurb}
            </p>
            <ul className="mt-3 space-y-1">
              {group.events.map((event) => (
                <li key={event.slug}>
                  <Link
                    href={event.href}
                    className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-fd-muted"
                  >
                    <span className="font-mono text-[13px] font-medium text-fd-foreground">
                      {event.label}
                    </span>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-fd-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
