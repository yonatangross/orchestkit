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
import { AGENTS } from "@/lib/generated/shared-data";
import { COUNTS } from "@/lib/constants";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import {
  groupedHookEvents,
  HOOK_LIFECYCLE_CHART,
} from "@/lib/hook-phases";
import {
  libraryTabHref,
  type LibraryTab,
} from "@/lib/library-tab";
import type { HostId } from "@/components/host-marks";

const TABS: { id: LibraryTab; label: string; count: number }[] = [
  { id: "skills", label: "Skills", count: COUNTS.skills },
  { id: "agents", label: "Agents", count: COUNTS.agents },
  { id: "hooks", label: "Hooks", count: COUNTS.hooks },
];

export function LibraryCatalog({
  tab,
  host = "claude",
}: {
  tab: LibraryTab;
  host?: HostId;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<LibraryTab>(tab);
  const pendingTabFocus = useRef<LibraryTab | null>(null);

  useEffect(() => {
    setCurrent(tab);
  }, [tab]);

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

        <AnimatedTabs
          ariaLabel="Library primitives"
          layoutId="library-tab-indicator"
          value={current}
          onChange={select}
          onKeyDown={onTabKeyDown}
          tabs={TABS.map((t) => ({
            id: t.id,
            href: libraryTabHref(t.id, host),
            label: (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-fd-muted text-current">
                  <LibraryMark kind={t.id} className="h-3.5 w-3.5" />
                </span>
                {t.label}
                <span className="font-mono text-[11px] tabular-nums opacity-70">
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

function AgentsGrid() {
  const [query, setQuery] = useState("");
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
        Showing{" "}
        <span className="font-semibold tabular-nums text-fd-foreground">
          {filtered.length}
        </span>{" "}
        of {AGENTS.length} agents
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent) => {
          const cat =
            CATEGORY_COLORS[agent.category as keyof typeof CATEGORY_COLORS] ??
            CATEGORY_COLORS.other;
          return (
            <Link
              key={agent.name}
              href={`/docs/reference/agents/${agent.name}`}
              className="group rounded-lg border border-fd-border p-4 transition-colors hover:bg-fd-muted"
            >
              <div className="mb-2 flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cat.bg} ${cat.color}`}
                >
                  <CategoryMark category={agent.category} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-fd-foreground">
                    {agent.name}
                  </h3>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cat.bg} ${cat.color}`}
                  >
                    {agent.category}
                  </span>
                </div>
              </div>
              <p className="text-[13px] leading-[1.5] text-fd-muted-foreground">
                {agent.description}
              </p>
            </Link>
          );
        })}
      </div>
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
        <ChangelogMermaid chart={HOOK_LIFECYCLE_CHART} />
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
