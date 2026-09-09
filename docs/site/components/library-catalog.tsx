"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { LazySkillBrowser } from "@/components/lazy";
import { AGENTS } from "@/lib/generated/shared-data";
import { COUNTS } from "@/lib/constants";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { HOOK_EVENT_PAGES } from "@/lib/hook-events";
import {
  libraryTabHref,
  type LibraryTab,
} from "@/lib/library-tab";

const TABS: { id: LibraryTab; label: string; count: number }[] = [
  { id: "skills", label: "Skills", count: COUNTS.skills },
  { id: "agents", label: "Agents", count: COUNTS.agents },
  { id: "hooks", label: "Hooks", count: COUNTS.hooks },
];

export function LibraryCatalog({ tab }: { tab: LibraryTab }) {
  const router = useRouter();

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
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
    router.push(libraryTabHref(TABS[next].id));
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

        <div
          role="tablist"
          aria-label="Library primitives"
          onKeyDown={onTabKeyDown}
          className="mb-6 flex flex-wrap gap-1 rounded-lg border border-fd-border p-1"
        >
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <a
                key={t.id}
                href={libraryTabHref(t.id)}
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                id={`library-tab-${t.id}`}
                aria-controls={`library-panel-${t.id}`}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-[var(--color-fd-primary-10)] text-fd-primary"
                    : "text-fd-muted-foreground hover:text-fd-foreground"
                }`}
              >
                {t.label}
                <span className="font-mono text-[11px] tabular-nums opacity-70">
                  {t.count}
                </span>
              </a>
            );
          })}
        </div>

        {tab === "skills" ? (
          <div
            role="tabpanel"
            id="library-panel-skills"
            aria-labelledby="library-tab-skills"
          >
            <LazySkillBrowser />
          </div>
        ) : null}
        {tab === "agents" ? (
          <div
            role="tabpanel"
            id="library-panel-agents"
            aria-labelledby="library-tab-agents"
          >
            <AgentsGrid />
          </div>
        ) : null}
        {tab === "hooks" ? (
          <div
            role="tabpanel"
            id="library-panel-hooks"
            aria-labelledby="library-tab-hooks"
          >
            <HooksGrid />
          </div>
        ) : null}
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
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-fd-foreground">
                  {agent.name}
                </h3>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cat.bg} ${cat.color}`}
                >
                  {agent.category}
                </span>
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

function HooksGrid() {
  return (
    <div>
      <p className="mb-4 text-sm text-fd-muted-foreground">
        {HOOK_EVENT_PAGES.length} lifecycle events. Open a category for the
        hooks that fire there.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HOOK_EVENT_PAGES.map((event) => (
          <Link
            key={event.slug}
            href={event.href}
            className="group flex items-center justify-between rounded-lg border border-fd-border px-4 py-3 transition-colors hover:bg-fd-muted"
          >
            <span className="font-mono text-sm font-medium text-fd-foreground">
              {event.label}
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 text-fd-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
