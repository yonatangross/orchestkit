"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/category-colors";

// ── Data contracts (populated server-side in skill-atlas.tsx) ──
export interface AtlasEntry {
  /** Skill key / slug (equals SKILL.md name) */
  name: string;
  /** First sentence of the skill description */
  blurb: string;
  tags: string[];
  complexity: string;
  userInvocable: boolean;
  cluster: string;
}

export interface AtlasCluster {
  id: string;
  label: string;
  entries: AtlasEntry[];
}

// ── Visual metadata ─────────────────────────────────────────
const COMPLEXITY_ORDER = ["simple", "low", "medium", "high", "complex", "max"];

const COMPLEXITY_STYLE: Record<string, string> = {
  simple: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  low: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  complex: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  max: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

function clusterStyle(id: string) {
  return (
    CATEGORY_COLORS[id as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.other
  );
}

// ── Copy-to-clipboard command chip ──────────────────────────
function CopyCommand({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `/ork:${name}`;

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(cmd)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      aria-label={`Copy command ${cmd}`}
      title={`Copy ${cmd}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-fd-border bg-fd-muted px-2 py-1 font-mono text-[11px] text-fd-muted-foreground transition-colors hover:border-fd-ring hover:text-fd-foreground"
    >
      <span className="truncate">{cmd}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-fd-success" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0" aria-hidden />
      )}
    </button>
  );
}

// ── Facet chip ──────────────────────────────────────────────
function FacetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
        active
          ? "border-fd-primary bg-[var(--color-fd-primary-10,rgba(99,102,241,0.1))] text-fd-primary shadow-sm"
          : "border-fd-border text-fd-muted-foreground hover:bg-fd-muted"
      }`}
    >
      {children}
    </button>
  );
}

// ── Atlas grid with progressive-enhancement filters ─────────
// The full list is SSR-rendered by this component; without JS every
// skill card is visible and the filter bar is simply inert.
export function SkillAtlasGrid({ clusters }: { clusters: AtlasCluster[] }) {
  const [activeClusters, setActiveClusters] = useState<string[]>([]);
  const [activeComplexity, setActiveComplexity] = useState<string[]>([]);
  const [invocableOnly, setInvocableOnly] = useState(false);

  const allEntries = clusters.flatMap((c) => c.entries);
  const complexityValues = COMPLEXITY_ORDER.filter((c) =>
    allEntries.some((e) => e.complexity === c),
  );

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const matches = (e: AtlasEntry) =>
    (activeClusters.length === 0 || activeClusters.includes(e.cluster)) &&
    (activeComplexity.length === 0 || activeComplexity.includes(e.complexity)) &&
    (!invocableOnly || e.userInvocable);

  const visible = clusters
    .map((c) => ({ ...c, entries: c.entries.filter(matches) }))
    .filter((c) => c.entries.length > 0);

  const shown = visible.reduce((n, c) => n + c.entries.length, 0);
  const hasFilters =
    activeClusters.length > 0 || activeComplexity.length > 0 || invocableOnly;

  return (
    <div className="not-prose mb-10">
      {/* Filter bar */}
      <div className="mb-6 rounded-xl border border-fd-border bg-fd-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-fd-muted-foreground" role="status" aria-live="polite">
            <span className="font-semibold tabular-nums text-fd-foreground">{shown}</span>{" "}
            of {allEntries.length} skills
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setActiveClusters([]);
                setActiveComplexity([]);
                setInvocableOnly(false);
              }}
              className="text-xs text-fd-muted-foreground underline underline-offset-2 hover:text-fd-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        <fieldset className="mb-3">
          <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
            Tag cluster
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {clusters.map((c) => {
              const style = clusterStyle(c.id);
              const active = activeClusters.includes(c.id);
              return (
                <FacetChip
                  key={c.id}
                  active={active}
                  onClick={() => toggle(activeClusters, setActiveClusters, c.id)}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${style.bg}`} />
                  {c.label}
                  <span className="tabular-nums opacity-70">{c.entries.length}</span>
                </FacetChip>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
              Complexity
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {complexityValues.map((cplx) => (
                <FacetChip
                  key={cplx}
                  active={activeComplexity.includes(cplx)}
                  onClick={() => toggle(activeComplexity, setActiveComplexity, cplx)}
                >
                  {cplx}
                </FacetChip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
              Invocation
            </legend>
            <FacetChip
              active={invocableOnly}
              onClick={() => setInvocableOnly((v) => !v)}
            >
              /ork: command only
            </FacetChip>
          </fieldset>
        </div>
      </div>

      {/* Grouped grid */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center text-sm text-fd-muted-foreground">
          No skills match the selected filters.
        </div>
      ) : (
        visible.map((cluster) => {
          const style = clusterStyle(cluster.id);
          return (
            <section key={cluster.id} className="mb-8" aria-label={cluster.label}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fd-foreground">
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.color}`}>
                  {cluster.label}
                </span>
                <span className="text-xs font-normal tabular-nums text-fd-muted-foreground">
                  {cluster.entries.length} skills
                </span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cluster.entries.map((entry) => (
                  <article
                    key={entry.name}
                    className="flex flex-col gap-2 rounded-lg border border-fd-border p-4 transition-colors hover:bg-fd-muted"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/docs/reference/skills/${entry.name}`}
                        className="text-sm font-semibold text-fd-foreground hover:text-fd-primary hover:underline"
                      >
                        {entry.name}
                      </a>
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${
                          COMPLEXITY_STYLE[entry.complexity] ?? COMPLEXITY_STYLE.medium
                        }`}
                      >
                        {entry.complexity}
                      </span>
                      {entry.userInvocable && (
                        <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                          Command
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-fd-muted-foreground">
                      {entry.blurb}
                    </p>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-fd-muted px-2 py-0.5 text-[10px] text-fd-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {entry.tags.length > 4 && (
                          <span className="rounded-full px-1 py-0.5 text-[10px] text-fd-muted-foreground/70">
                            +{entry.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-auto pt-1">
                      <CopyCommand name={entry.name} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
