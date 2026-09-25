"use client";

import { useState, useCallback, useEffect, useId, useMemo, useRef } from "react";
import { Search, X, ChevronRight, ExternalLink, SearchX } from "lucide-react";
import { motion } from "motion/react";
import type { SkillMeta } from "@/lib/generated/types";
import { SKILLS } from "@/lib/generated/skills-data";
import {
  CATEGORY_BADGE_CLASS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "@/lib/category-colors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createCollection, useOramaCollection } from "@/lib/orama-browser";
import { Highlight } from "@/components/search-highlight";
import { CategoryMark } from "@/components/category-mark";
import { categorizeSkill } from "@/lib/skill-category";
import { cn } from "@/lib/cn";

// ── Category visual metadata ────────────────────────────────
const SKILL_CATEGORY_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  development: {
    label: CATEGORY_LABELS.development,
    ...CATEGORY_COLORS.development,
    border: "border-l-violet-400 dark:border-l-violet-500",
    dot: "bg-violet-500",
  },
  ai: {
    label: CATEGORY_LABELS.ai,
    ...CATEGORY_COLORS.ai,
    border: "border-l-cyan-400 dark:border-l-cyan-500",
    dot: "bg-cyan-500",
  },
  backend: {
    label: CATEGORY_LABELS.backend,
    ...CATEGORY_COLORS.backend,
    border: "border-l-amber-400 dark:border-l-amber-500",
    dot: "bg-amber-500",
  },
  frontend: {
    label: CATEGORY_LABELS.frontend,
    ...CATEGORY_COLORS.frontend,
    border: "border-l-blue-400 dark:border-l-blue-500",
    dot: "bg-blue-500",
  },
  testing: {
    label: CATEGORY_LABELS.testing,
    ...CATEGORY_COLORS.testing,
    border: "border-l-sky-400 dark:border-l-sky-500",
    dot: "bg-sky-500",
  },
  security: {
    label: CATEGORY_LABELS.security,
    ...CATEGORY_COLORS.security,
    border: "border-l-red-400 dark:border-l-red-500",
    dot: "bg-red-500",
  },
  devops: {
    label: CATEGORY_LABELS.devops,
    ...CATEGORY_COLORS.devops,
    border: "border-l-orange-400 dark:border-l-orange-500",
    dot: "bg-orange-500",
  },
  product: {
    label: CATEGORY_LABELS.product,
    ...CATEGORY_COLORS.product,
    border: "border-l-pink-400 dark:border-l-pink-500",
    dot: "bg-pink-500",
  },
  data: {
    label: CATEGORY_LABELS.data,
    ...CATEGORY_COLORS.data,
    border: "border-l-indigo-400 dark:border-l-indigo-500",
    dot: "bg-indigo-500",
  },
  research: {
    label: CATEGORY_LABELS.research,
    ...CATEGORY_COLORS.research,
    border: "border-l-teal-400 dark:border-l-teal-500",
    dot: "bg-teal-500",
  },
};

// ── Skill entry with computed category ──────────────────────
interface SkillEntry {
  key: string;
  skill: SkillMeta;
  category: string;
}

// ── Build the full skill list with categories ───────────────
const ALL_SKILLS: SkillEntry[] = Object.entries(SKILLS).map(([key, skill]) => ({
  key,
  skill,
  category: categorizeSkill(skill),
}));

const ALL_CATEGORY_KEYS = Object.keys(SKILL_CATEGORY_META);

// ── Orama collection (built once, client-side) ──────────────
const SKILL_COLLECTION = createCollection<SkillEntry>(ALL_SKILLS, {
  id: (e) => e.key,
  schema: {
    name: "string",
    description: "string",
    tags: "string[]",
    category: "enum",
    // Scalar enum (not enum[]): the read-only orama-browser `where` emits
    // `{in:[...]}`, which Orama only supports on scalar enum / number fields —
    // an `enum[]` field would need `containsAny`, which the API can't produce.
    // Skills carry a single plugin (v7 unified "ork"), so scalar is lossless.
    plugins: "enum",
  },
  toDoc: (e) => ({
    name: e.skill.name,
    description: e.skill.description,
    tags: e.skill.tags,
    category: e.category,
    plugins: e.skill.plugins[0] ?? "ork",
  }),
  boost: { name: 3, tags: 1.5, description: 1.5 },
  facetField: "category",
});

/**
 * Cards shown below the lg breakpoint (one or two columns) before "Show all".
 * The full list put What's new and the Cookbook ~15 screens down on a phone
 * (home page 19,244px at 390, QA 2026-09-25). CSS hides the rest, so the
 * server HTML is the same at every width and desktop keeps every card.
 */
export const NARROW_PAGE_SIZE = 8;

// ── Main component ──────────────────────────────────────────
export function SkillBrowser() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Orama-backed search + faceted filtering (BM25 ranking, 1-char typo
  // tolerance, native facet counts — all in one query).
  const debouncedSearch = useDebouncedValue(search, 150);
  const { result, ready } = useOramaCollection<SkillEntry>(SKILL_COLLECTION, {
    term: debouncedSearch,
    where: {
      category: selectedCategories,
    },
  });
  const filtered = result.items;
  const suggestions = result.suggestions;

  // Per-category facet counts. Stable under an active category filter: the
  // orama-browser sources these from a query that excludes the category field
  // from `where`, so selecting one pill doesn't collapse the others' counts.
  const fallbackCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of ALL_SKILLS) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  const countOf = useCallback(
    (cat: string) => {
      const fromOrama = result.facets.find((f) => f.value === cat);
      if (fromOrama) return fromOrama.count;
      if (result.facets.length === 0) return fallbackCount.get(cat) ?? 0;
      return 0;
    },
    [result.facets, fallbackCount],
  );

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setSelectedCategories([]);
  }, []);

  const hasFilters = search !== "" || selectedCategories.length > 0;
  // A search or a category filter always shows every match.
  const capped =
    ready && !hasFilters && !showAll && filtered.length > NARROW_PAGE_SIZE;

  // "Show fewer" unmounts itself too: return focus to "Show all" and bring it
  // into view, so the reader is not left 100 cards below the list.
  const showAllRef = useRef<HTMLButtonElement>(null);
  const collapsingRef = useRef(false);
  useEffect(() => {
    if (showAll || !collapsingRef.current) return;
    collapsingRef.current = false;
    showAllRef.current?.focus({ preventScroll: true });
    showAllRef.current?.scrollIntoView({ block: "center" });
  }, [showAll]);

  // "Show all" unmounts itself, so hand focus to the first card it revealed.
  useEffect(() => {
    if (!showAll) return;
    gridRef.current
      ?.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")
      [NARROW_PAGE_SIZE]?.focus();
  }, [showAll]);

  const shownCount = (n: number) => (
    <>
      Showing{" "}
      <span className="font-semibold tabular-nums text-fd-foreground">{n}</span>{" "}
      of {ALL_SKILLS.length} skills
    </>
  );

  return (
    <div className="not-prose">
      <div className="mb-6">
        <p
          className="text-sm text-fd-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {!ready ? (
            "Loading skills…"
          ) : capped ? (
            <>
              <span className="lg:hidden">{shownCount(NARROW_PAGE_SIZE)}</span>
              <span className="max-lg:hidden">{shownCount(filtered.length)}</span>
            </>
          ) : (
            shownCount(filtered.length)
          )}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fd-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills by name, description, or tag..."
          aria-label="Search skills by name, description, or tag"
          className="h-10 w-full rounded-lg border border-fd-border bg-fd-background pl-10 pr-8 text-sm outline-none transition-all placeholder:text-fd-muted-foreground focus:border-fd-ring focus:ring-2 focus:ring-fd-ring/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fd-muted-foreground hover:text-fd-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <fieldset className="mb-5">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Category
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORY_KEYS.map((cat) => {
            const meta = SKILL_CATEGORY_META[cat];
            const active = selectedCategories.includes(cat);
            return (
              <motion.button
                key={cat}
                type="button"
                layout
                transition={{ duration: 0.18 }}
                onClick={() => toggleCategory(cat)}
                aria-pressed={active}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium [&_svg]:block",
                  active
                    ? `${meta.bg} ${meta.color} border-current shadow-sm`
                    : "border-fd-border text-fd-muted-foreground hover:bg-fd-muted",
                )}
              >
                <CategoryMark category={cat} className="h-3.5 w-3.5" />
                {meta.label}
                <span className="tabular-nums text-fd-muted-foreground">
                  {countOf(cat)}
                </span>
              </motion.button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-2.5 py-1 text-xs text-fd-muted-foreground underline decoration-fd-border underline-offset-2 hover:text-fd-foreground"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}
        </div>
      </fieldset>

      {/* Skill grid or empty state */}
      {!ready ? (
        <div
          className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center text-sm text-fd-muted-foreground"
          aria-busy="true"
        >
          Loading skills…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center">
          <SearchX className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
          <p className="text-sm font-medium text-fd-foreground">
            {debouncedSearch
              ? <>No skills match &ldquo;{debouncedSearch}&rdquo;</>
              : "No skills match your filters"}
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Try broadening your search or removing some filters.
          </p>
          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-fd-muted-foreground">
                Did you mean?
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setSearch(entry.skill.name)}
                    className="rounded-full border border-fd-border bg-fd-background px-3 py-1 text-xs font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
                  >
                    {entry.skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 rounded-md border border-fd-border px-3 py-1.5 text-xs font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          {/* grid-cols-1 caps the phone column at the page. With no template the
              one auto column grew to the widest card's min-content, the full
              width of a truncated name, so "Show all" (which renders
              react-server-components-framework) pushed every card 25px past
              the gutter (dogfood ISSUE-001). */}
          <div ref={gridRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry, index) => (
              <SkillCard
                key={entry.key}
                entry={entry}
                query={debouncedSearch}
                className={
                  capped && index >= NARROW_PAGE_SIZE ? "max-lg:hidden" : undefined
                }
                expanded={expandedSkill === entry.key}
                onToggle={() =>
                  setExpandedSkill(
                    expandedSkill === entry.key ? null : entry.key,
                  )
                }
              />
            ))}
          </div>
          {capped ? (
            <button
              ref={showAllRef}
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-4 py-2.5 text-sm font-semibold text-fd-primary transition-colors hover:border-fd-primary/40 hover:bg-fd-muted lg:hidden"
            >
              Show all {filtered.length} skills
            </button>
          ) : null}
          {/* The way back: expanded, the phone page ran 18,593px (gate NEW-5). */}
          {ready && showAll && !hasFilters && filtered.length > NARROW_PAGE_SIZE ? (
            <button
              type="button"
              onClick={() => {
                setShowAll(false);
                collapsingRef.current = true;
              }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-4 py-2.5 text-sm font-semibold text-fd-primary transition-colors hover:border-fd-primary/40 hover:bg-fd-muted lg:hidden"
            >
              Show fewer skills
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── Skill Card ──────────────────────────────────────────────
function SkillCard({
  entry,
  query,
  className,
  expanded,
  onToggle,
}: {
  entry: SkillEntry;
  query: string;
  className?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { skill, category } = entry;
  const catMeta = SKILL_CATEGORY_META[category] ?? SKILL_CATEGORY_META.development;
  const descId = useId();

  return (
    <div
      className={cn(
        "rounded-lg border border-fd-border border-l-[3px] transition-all duration-200",
        catMeta.border,
        expanded ? `${catMeta.bg} shadow-sm` : "hover:bg-fd-muted",
        className,
      )}
    >
      {/* Named by the skill alone; badges and description are the description.
          Unnamed, the button read its whole text run together
          ("architecture-patternsTestingArchitecture validation...", QA #20). */}
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-label={skill.name}
        aria-describedby={descId}
      >
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catMeta.bg} ${catMeta.color}`}
        >
          <CategoryMark category={category} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Highlight
            text={skill.name}
            query={query}
            className="block truncate text-sm font-semibold text-fd-foreground"
          />
          {/* Badges lead the two clamped description lines instead of sharing
              the name's line, where they wrapped for long names (35 of 108
              cards at 1024) and gave rows uneven heights. Every card is now
              one name line plus two lines, the old height. */}
          <div
            id={descId}
            className="mt-1 line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground"
          >
            <span
              className={`${CATEGORY_BADGE_CLASS} ${catMeta.bg} ${catMeta.color}`}
            >
              {catMeta.label}
            </span>{" "}
            {skill.userInvocable ? (
              <>
                <span className="mr-1.5 inline-block rounded bg-teal-100 px-1.5 py-px align-[1px] text-[11px] font-medium leading-tight text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                  Command
                </span>{" "}
              </>
            ) : null}
            <Highlight text={skill.description} query={query} />
          </div>
        </div>
        <ChevronRight
          className={`mt-1 h-4 w-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Expandable detail panel */}
      <div
        aria-hidden={!expanded}
        className={`grid transition-all duration-200 ease-out ${
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-fd-border px-4 pb-4 pt-3">
            {/* Full description */}
            <p className="mb-3 text-xs leading-relaxed text-fd-muted-foreground">
              {skill.description}
            </p>

            {/* Tags */}
            {skill.tags.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-fd-muted px-2 py-0.5 text-[11px] text-fd-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related agents */}
            {skill.relatedAgents.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                  Related agents
                </p>
                <div className="flex flex-wrap gap-1">
                  {skill.relatedAgents.map((agent) => (
                    <a
                      key={agent}
                      href={`/docs/reference/agents#${agent}`}
                      className="inline-flex items-center gap-1 rounded-full bg-fd-muted px-2 py-0.5 text-[11px] text-fd-foreground hover:bg-fd-muted"
                      tabIndex={expanded ? 0 : -1}
                    >
                      {agent}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Plugin badges + source link */}
            <div className="flex items-center gap-2">
              {skill.plugins.map((plugin) => (
                <span
                  key={plugin}
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                >
                  {plugin}
                </span>
              ))}
              <a
                href={`https://github.com/yonatangross/orchestkit/tree/main/src/skills/${skill.name}/SKILL.md`}
                className="inline-flex items-center gap-1 text-[11px] text-fd-primary hover:underline"
                tabIndex={expanded ? 0 : -1}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
