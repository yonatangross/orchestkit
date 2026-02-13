"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search,
  X,
  SearchX,
  Play,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Square,
  Loader,
} from "lucide-react";
import { OptimizedThumbnail } from "@/components/optimized-thumbnail";
import type { Composition } from "@/lib/generated/types";
import { COMPOSITIONS } from "@/lib/generated/compositions-data";

// ── Category metadata ────────────────────────────────────────
const COMP_CATEGORY_META: Record<
  string,
  { label: string; dot: string; color: string; bg: string }
> = {
  core: {
    label: "Core",
    dot: "bg-violet-500",
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-100 dark:bg-violet-500/20",
  },
  memory: {
    label: "Memory",
    dot: "bg-cyan-500",
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-100 dark:bg-cyan-500/20",
  },
  review: {
    label: "Review",
    dot: "bg-amber-500",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-500/20",
  },
  devops: {
    label: "DevOps",
    dot: "bg-orange-500",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-100 dark:bg-orange-500/20",
  },
  ai: {
    label: "AI",
    dot: "bg-emerald-500",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
  },
  advanced: {
    label: "Advanced",
    dot: "bg-pink-500",
    color: "text-pink-700 dark:text-pink-300",
    bg: "bg-pink-100 dark:bg-pink-500/20",
  },
};

const FORMAT_LABELS: Record<string, string> = {
  landscape: "16:9",
  vertical: "9:16",
  square: "1:1",
};

const FORMAT_ICON_MAP: Record<string, typeof Monitor> = {
  landscape: Monitor,
  vertical: Smartphone,
  square: Square,
};

type FormatFilter = "all" | "landscape" | "vertical" | "square";

// ── Utilities ────────────────────────────────────────────────
function formatTitle(id: string): string {
  return id.replace(/([A-Z])/g, " $1").trim();
}

// Derive unique categories from composition data
const ALL_CATEGORIES = Array.from(
  new Set(COMPOSITIONS.map((c) => c.category)),
);

// ── Focus trap hook (same pattern as AgentSelector) ──────────
function useFocusTrap(
  ref: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;

    const initial = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    initial[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        const focusable = el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [ref, active]);
}

// ── Main component ───────────────────────────────────────────
export function DemoGallery() {
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalComposition, setModalComposition] =
    useState<Composition | null>(null);

  const filtered = useMemo(() => {
    return COMPOSITIONS.filter((comp) => {
      if (formatFilter !== "all" && comp.format !== formatFilter) return false;
      if (categoryFilter !== "all" && comp.category !== categoryFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack =
          `${comp.id} ${formatTitle(comp.id)} ${comp.command} ${comp.hook} ${comp.tags.join(" ")} ${comp.skill} ${comp.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [formatFilter, categoryFilter, search]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFormatFilter("all");
    setCategoryFilter("all");
  }, []);

  const hasFilters =
    search !== "" || formatFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="not-prose">
      {/* Format filter pills */}
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Format
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: "all", label: "All" },
              { value: "landscape", label: "Landscape (16:9)" },
              { value: "vertical", label: "Vertical (9:16)" },
              { value: "square", label: "Square (1:1)" },
            ] as const
          ).map((f) => {
            const active = formatFilter === f.value;
            const Icon =
              f.value === "all"
                ? null
                : FORMAT_ICON_MAP[f.value] ?? null;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormatFilter(f.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary shadow-sm"
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
              >
                {Icon && <Icon className="h-3 w-3 opacity-70" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Category filter pills */}
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Category
        </legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            aria-pressed={categoryFilter === "all"}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
              categoryFilter === "all"
                ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary shadow-sm"
                : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = COMP_CATEGORY_META[cat];
            if (!meta) return null;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(active ? "all" : cat)}
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
        </div>
      </fieldset>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fd-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search compositions by title, command, or tags..."
          aria-label="Search compositions by title, command, or tags"
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

      {/* Count + clear */}
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-sm text-fd-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Showing{" "}
          <span className="font-semibold tabular-nums text-fd-foreground">
            {filtered.length}
          </span>{" "}
          of {COMPOSITIONS.length} compositions
        </p>
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center">
          <SearchX className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
          <p className="text-sm font-medium text-fd-foreground">
            No compositions match your filters
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
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {filtered.map((comp) => (
            <GalleryCard
              key={comp.id}
              composition={comp}
              onClick={() => setModalComposition(comp)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalComposition && (
        <CompositionModal
          composition={modalComposition}
          onClose={() => setModalComposition(null)}
        />
      )}
    </div>
  );
}

// ── Gallery Card ─────────────────────────────────────────────
function GalleryCard({
  composition,
  onClick,
}: {
  composition: Composition;
  onClick: () => void;
}) {
  const catMeta = COMP_CATEGORY_META[composition.category];
  const formatLabel = FORMAT_LABELS[composition.format] ?? composition.format;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-fd-border text-left overflow-hidden transition-all hover:border-fd-border hover:shadow-sm"
      aria-label={`View details for ${formatTitle(composition.id)}`}
    >
      {/* Thumbnail container */}
      <div className="relative aspect-video bg-fd-muted">
        <OptimizedThumbnail
          src={composition.thumbnailCdn ?? `/thumbnails/${composition.id}.png`}
          alt={`Thumbnail for ${formatTitle(composition.id)}`}
        />
        {/* Format badge — top-right */}
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {formatLabel}
        </span>
        {/* Duration badge — bottom-left */}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {composition.durationSeconds}s
        </span>
        {/* Status overlay */}
        {composition.videoCdn ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
            <Play className="h-8 w-8 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-90" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/10">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/80 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Loader className="h-3 w-3 animate-spin" />
              In production
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-fd-foreground">
          {formatTitle(composition.id)}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-fd-primary">
          {composition.command}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-fd-muted-foreground">
          {composition.hook}
        </p>
        {catMeta && (
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${catMeta.dot}`}
            />
            <span className={`text-[11px] font-medium ${catMeta.color}`}>
              {catMeta.label}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Composition Modal ────────────────────────────────────────
function CompositionModal({
  composition,
  onClose,
}: {
  composition: Composition;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useFocusTrap(modalRef, true);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(composition.command);
    setCopied(true);
    setTimeout(setCopied, 2000, false);
  }, [composition.command]);

  const catMeta = COMP_CATEGORY_META[composition.category];
  const formatLabel = FORMAT_LABELS[composition.format] ?? composition.format;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fd-overlay p-4 backdrop-blur-sm animate-[fade-in_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comp-modal-heading"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-fd-border bg-fd-background shadow-2xl animate-[slide-up_200ms_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-fd-border px-6 py-4">
          <h3
            id="comp-modal-heading"
            className="text-lg font-semibold text-fd-foreground"
          >
            {formatTitle(composition.id)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-fd-muted hover:text-fd-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video or thumbnail — large */}
          <div className="mb-6 overflow-hidden rounded-lg bg-fd-muted">
            <div className="relative aspect-video">
              {composition.videoCdn ? (
                <video
                  src={composition.videoCdn}
                  poster={composition.thumbnailCdn ?? `/thumbnails/${composition.id}.png`}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <OptimizedThumbnail
                    src={composition.thumbnailCdn ?? `/thumbnails/${composition.id}.png`}
                    alt={`Preview for ${formatTitle(composition.id)}`}
                    opacity="opacity-60"
                    placeholderSize={48}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <Loader className="h-6 w-6 animate-spin text-amber-500" />
                    <span className="rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                      Video in production
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3">
            <MetadataRow label="Format" value={formatLabel} />
            <MetadataRow
              label="Resolution"
              value={`${composition.width}x${composition.height}`}
            />
            <MetadataRow
              label="Duration"
              value={`${composition.durationSeconds}s`}
            />
            <MetadataRow label="FPS" value={String(composition.fps)} />
            <MetadataRow label="Style" value={composition.style} />
            <MetadataRow label="Plugin" value={composition.relatedPlugin} />
            {catMeta && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-fd-muted-foreground">
                  Category
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${catMeta.dot}`}
                  />
                  <span className={`text-xs font-medium ${catMeta.color}`}>
                    {catMeta.label}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Command with copy */}
          <div className="mb-6">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
              Command
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-fd-border bg-fd-muted px-3 py-2">
              <code className="flex-1 font-mono text-sm text-fd-primary">
                {composition.command}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
                aria-label={copied ? "Copied" : "Copy command"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Tags */}
          {composition.tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {composition.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-fd-border bg-fd-muted px-2.5 py-0.5 text-[11px] font-medium text-fd-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Metadata row helper ──────────────────────────────────────
function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-fd-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-fd-foreground">
        {value}
      </span>
    </div>
  );
}
