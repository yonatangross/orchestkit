"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X, ChevronRight, ExternalLink, SearchX } from "lucide-react";
import type { SkillMeta } from "@/lib/generated/types";
import { SKILLS } from "@/lib/generated/skills-data";
import { CATEGORY_COLORS } from "@/lib/category-colors";

// ── Category visual metadata ────────────────────────────────
const SKILL_CATEGORY_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  development: {
    label: "Development",
    ...CATEGORY_COLORS.development,
    border: "border-l-violet-400 dark:border-l-violet-500",
    dot: "bg-violet-500",
  },
  ai: {
    label: "AI",
    ...CATEGORY_COLORS.ai,
    border: "border-l-cyan-400 dark:border-l-cyan-500",
    dot: "bg-cyan-500",
  },
  backend: {
    label: "Backend",
    ...CATEGORY_COLORS.backend,
    border: "border-l-amber-400 dark:border-l-amber-500",
    dot: "bg-amber-500",
  },
  frontend: {
    label: "Frontend",
    ...CATEGORY_COLORS.frontend,
    border: "border-l-blue-400 dark:border-l-blue-500",
    dot: "bg-blue-500",
  },
  testing: {
    label: "Testing",
    ...CATEGORY_COLORS.testing,
    border: "border-l-emerald-400 dark:border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  security: {
    label: "Security",
    ...CATEGORY_COLORS.security,
    border: "border-l-red-400 dark:border-l-red-500",
    dot: "bg-red-500",
  },
  devops: {
    label: "DevOps",
    ...CATEGORY_COLORS.devops,
    border: "border-l-orange-400 dark:border-l-orange-500",
    dot: "bg-orange-500",
  },
  product: {
    label: "Product",
    ...CATEGORY_COLORS.product,
    border: "border-l-pink-400 dark:border-l-pink-500",
    dot: "bg-pink-500",
  },
  data: {
    label: "Data",
    ...CATEGORY_COLORS.data,
    border: "border-l-indigo-400 dark:border-l-indigo-500",
    dot: "bg-indigo-500",
  },
  research: {
    label: "Research",
    ...CATEGORY_COLORS.research,
    border: "border-l-teal-400 dark:border-l-teal-500",
    dot: "bg-teal-500",
  },
};

// ── Tag-to-category mapping ─────────────────────────────────
const TAG_CATEGORY_MAP: Record<string, string[]> = {
  backend: [
    "api",
    "backend",
    "database",
    "fastapi",
    "sqlalchemy",
    "grpc",
    "rest",
    "graphql",
    "sql",
    "postgres",
    "redis",
  ],
  frontend: [
    "react",
    "frontend",
    "css",
    "tailwind",
    "component",
    "ui",
    "next.js",
    "nextjs",
    "vite",
  ],
  ai: [
    "llm",
    "ai",
    "openai",
    "anthropic",
    "rag",
    "embeddings",
    "langgraph",
    "langchain",
    "prompt",
    "ml",
  ],
  security: [
    "security",
    "owasp",
    "auth",
    "vulnerability",
    "authentication",
    "authorization",
    "encryption",
  ],
  testing: [
    "test",
    "e2e",
    "unit-test",
    "coverage",
    "playwright",
    "jest",
    "vitest",
    "testing",
  ],
  devops: [
    "ci-cd",
    "deployment",
    "kubernetes",
    "terraform",
    "monitoring",
    "docker",
    "ci",
    "cd",
    "infrastructure",
  ],
  product: [
    "product",
    "strategy",
    "requirements",
    "okr",
    "prioritization",
    "business",
    "market",
  ],
  research: ["research", "web-research", "browser", "scraping"],
  data: ["data", "pipeline", "vector", "embeddings", "analytics", "etl"],
};

function categorizeSkill(skill: SkillMeta): string {
  const tagSet = skill.tags.map((t) => t.toLowerCase());

  // Check each category's keywords against the skill's tags
  for (const [category, keywords] of Object.entries(TAG_CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (tagSet.some((tag) => tag.includes(keyword))) {
        return category;
      }
    }
  }

  return "development"; // Default fallback
}

// ── Plugin filter type ──────────────────────────────────────
type PluginFilter = "all" | "orkl" | "ork";

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

// ── Main component ──────────────────────────────────────────
export function SkillBrowser() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pluginFilter, setPluginFilter] = useState<PluginFilter>("all");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Filter skills
  const filtered = useMemo(() => {
    return ALL_SKILLS.filter((entry) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const haystack =
          `${entry.skill.name} ${entry.skill.description} ${entry.skill.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // Category filter
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(entry.category)
      ) {
        return false;
      }

      // Plugin filter
      if (pluginFilter !== "all") {
        if (!entry.skill.plugins.includes(pluginFilter)) return false;
      }

      return true;
    });
  }, [search, selectedCategories, pluginFilter]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setSelectedCategories([]);
    setPluginFilter("all");
  }, []);

  const hasFilters =
    search !== "" ||
    selectedCategories.length > 0 ||
    pluginFilter !== "all";

  return (
    <div className="not-prose">
      {/* Header row: count + plugin toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="text-sm text-fd-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Showing{" "}
          <span className="font-semibold tabular-nums text-fd-foreground">
            {filtered.length}
          </span>{" "}
          of {ALL_SKILLS.length} skills
        </p>
        <div
          className="inline-flex rounded-lg border border-fd-border p-0.5"
          role="group"
          aria-label="Filter by plugin"
        >
          {(["all", "orkl", "ork"] as const).map((p) => {
            const active = pluginFilter === p;
            const label = p === "all" ? "All" : p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPluginFilter(p)}
                aria-pressed={active}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-fd-primary/10 text-fd-primary shadow-sm"
                    : "text-fd-muted-foreground hover:bg-fd-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
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
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? `${meta.bg} ${meta.color} border-current shadow-sm`
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    active ? "opacity-100" : "opacity-60"
                  } ${meta.dot}`}
                />
                {meta.label}
              </button>
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
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center">
          <SearchX className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
          <p className="text-sm font-medium text-fd-foreground">
            No skills match your filters
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Try broadening your search or removing some filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 rounded-md border border-fd-border px-3 py-1.5 text-xs font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <SkillCard
              key={entry.key}
              entry={entry}
              expanded={expandedSkill === entry.key}
              onToggle={() =>
                setExpandedSkill(
                  expandedSkill === entry.key ? null : entry.key,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skill Card ──────────────────────────────────────────────
function SkillCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: SkillEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { skill, category } = entry;
  const catMeta = SKILL_CATEGORY_META[category] ?? SKILL_CATEGORY_META.development;

  return (
    <div
      className={`rounded-lg border border-fd-border border-l-[3px] ${catMeta.border} transition-all duration-200 ${
        expanded
          ? `${catMeta.bg} shadow-sm`
          : "hover:bg-fd-muted"
      }`}
    >
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
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-fd-foreground">
              {skill.name}
            </span>
            <span
              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${catMeta.bg} ${catMeta.color}`}
            >
              {catMeta.label}
            </span>
            {skill.userInvocable && (
              <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                Command
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground">
            {skill.description}
          </p>
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
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${
                    plugin === "orkl"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                  }`}
                >
                  {plugin}
                </span>
              ))}
              <a
                href={`https://github.com/orchestkit/orchestkit/tree/main/src/skills/${skill.name}/SKILL.md`}
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
