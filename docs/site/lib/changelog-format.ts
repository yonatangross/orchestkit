import type {
  ChangelogEntry,
  ChangelogSection,
  SectionType,
} from "@/lib/generated/changelog-data";

/** The legend's vocabulary. Docs is split out of the generator's "changed". */
export type ChangelogCategory = SectionType | "docs";

type CategoryMeta = { label: string; glyph: string; hint: string };

/**
 * The one table the legend, the section headings under each release and the
 * per-item icons all read. Row order is legend order.
 */
export const CHANGELOG_CATEGORIES: Record<ChangelogCategory, CategoryMeta> = {
  added: { label: "Added", glyph: "🎯", hint: "new capability" },
  fixed: { label: "Fixed", glyph: "✅", hint: "a bug closed" },
  changed: { label: "Changed", glyph: "🔄", hint: "behavior or plumbing" },
  docs: { label: "Docs", glyph: "📜", hint: "no runtime change" },
  removed: { label: "Removed", glyph: "❌", hint: "gone, check your usage" },
  deprecated: { label: "Deprecated", glyph: "⚠️", hint: "still works, going away" },
  security: { label: "Security", glyph: "🚨", hint: "read before you upgrade" },
};

/**
 * Release-please and Keep a Changelog section names, lowercased, mapped to a
 * legend category. Unknown headings fall back to the generator's section type.
 */
export const SECTION_HEADING_CATEGORY: Record<string, ChangelogCategory> = {
  features: "added",
  added: "added",
  "bug fixes": "fixed",
  fixed: "fixed",
  miscellaneous: "changed",
  "code refactoring": "changed",
  performance: "changed",
  "ci/cd": "changed",
  changed: "changed",
  documentation: "docs",
  removed: "removed",
  deprecated: "deprecated",
  security: "security",
};

export function sectionCategory(
  section: Pick<ChangelogSection, "type" | "heading">,
): ChangelogCategory {
  return SECTION_HEADING_CATEGORY[section.heading.trim().toLowerCase()] ?? section.type;
}

export type ReleaseGroup = {
  category: ChangelogCategory;
  label: string;
  glyph: string;
  items: string[];
};

/** One group per category, in first-seen order: Miscellaneous + CI/CD read as one Changed. */
export function groupReleaseSections(entry: ChangelogEntry): ReleaseGroup[] {
  const groups = new Map<ChangelogCategory, ReleaseGroup>();
  for (const s of entry.sections) {
    const category = sectionCategory(s);
    const group = groups.get(category);
    if (group) {
      group.items.push(...s.items);
    } else {
      const { label, glyph } = CHANGELOG_CATEGORIES[category];
      groups.set(category, { category, label, glyph, items: [...s.items] });
    }
  }
  return [...groups.values()];
}

/** Theme-aware tags: fd-* / george text tokens, not raw Tailwind 400s. */
export const TAG_BG: Record<ChangelogCategory, string> = {
  added: "bg-[var(--color-fd-primary-10)] text-fd-primary",
  changed: "bg-fd-muted text-fd-foreground",
  docs: "bg-fd-muted text-fd-muted-foreground",
  fixed: "bg-fd-muted text-[var(--yy-george-cool-text)]",
  deprecated: "bg-fd-muted text-[var(--yy-george-warm-text)]",
  removed: "bg-fd-muted text-fd-error",
  security: "border border-fd-error/40 bg-fd-muted text-fd-error",
};

const PLUMBING_PREFIX =
  /^(build|ci|chore|docs|style|test|refactor|cc)(\(.+\))?:/i;

export function isProductChangelogItem(text: string): boolean {
  return !PLUMBING_PREFIX.test(stripMarkdown(text.split("\n")[0]));
}

export type WhatsNewPreviewItem = { type: SectionType; item: string };

export function pickWhatsNewPreview(
  entries: ChangelogEntry[],
  count = 3,
): { entry: ChangelogEntry; items: WhatsNewPreviewItem[] } | null {
  for (const entry of entries) {
    const items = entry.sections.flatMap((s) =>
      s.items
        .filter(isProductChangelogItem)
        .map((item) => ({ type: s.type, item })),
    );
    if (items.length > 0) {
      return { entry, items: items.slice(0, count) };
    }
  }
  const latest = entries[0];
  if (!latest) return null;
  return {
    entry: latest,
    items: latest.sections
      .flatMap((s) => s.items.map((item) => ({ type: s.type, item })))
      .slice(0, count),
  };
}

export function formatChangelogDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

export function markdownInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-fd-primary hover:underline">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-fd-foreground/90">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="text-[11px] bg-fd-muted/50 px-1 py-px rounded text-fd-foreground/80">$1</code>',
    );
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function entryHeadline(items: string[]): string {
  const first = items[0];
  if (!first) return "Release notes";
  const line = stripMarkdown(first.split("\n")[0]);
  return line.length > 96 ? `${line.slice(0, 93)}…` : line;
}

const DEFAULT_RATIONALE =
  "Shipped in this release. Open the linked PR if you need the full rationale.";

/** Rationale copy per commit scope. Icons come from the section category, never the scope. */
const SCOPE_RATIONALE: Record<string, string> = {
  build: "Release plumbing. Does not change plugin runtime behavior.",
  ci: "CI gates. Protects the next push, not an already-open session.",
  chore: "Housekeeping. No user-facing behavior change.",
  docs: "Documentation only. Runtime behavior is unchanged.",
  cc: "Claude Code version triage. Compatibility notes unless the bullet says otherwise.",
  skills:
    "A skill you invoke with /ork: changed. Re-read that skill page if you use it.",
  hooks: "A lifecycle hook changed. Affects matching tool calls in every session.",
  agents: "A specialist agent prompt or wiring changed.",
  readme: "README or community copy. No runtime change.",
};

/** A commit's own leading emoji would compete with the legend glyph, so it is dropped. */
const LEADING_EMOJI = /^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{200D}]*)+\s*/u;

export type ChangelogRef = { label: string; href: string };

export type ParsedChange = {
  scope: string | null;
  title: string;
  rationale: string;
  issues: ChangelogRef[];
  shas: ChangelogRef[];
};

export function parseChangelogItem(raw: string): ParsedChange {
  const line = raw.split("\n")[0];
  const refs: ChangelogRef[] = [];
  const withoutLinks = line.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, href: string) => {
      refs.push({ label, href });
      return "";
    },
  );
  const issues = refs.filter(
    (r) => /\/issues\/|\/pull\//.test(r.href) || r.label.startsWith("#"),
  );
  const shas = refs.filter((r) => /\/commit\//.test(r.href));
  const titlePlain = stripMarkdown(withoutLinks)
    .replace(/\(\s*,\s*\)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/,?\s*close\s*$/i, "")
    .replace(/[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const scopeMatch = titlePlain.match(/^([a-z][a-z0-9-]*)(?:\([^)]+\))?:\s*(.+)$/i);
  const scope = scopeMatch ? scopeMatch[1].toLowerCase() : null;
  const title = (scopeMatch ? scopeMatch[2] : titlePlain).replace(LEADING_EMOJI, "");
  const rationale = (scope && SCOPE_RATIONALE[scope]) || DEFAULT_RATIONALE;
  return { scope, title, rationale, issues, shas };
}

export type ReleaseMixItem = {
  category: ChangelogCategory;
  label: string;
  count: number;
};

export function releaseSectionMix(entry: ChangelogEntry): ReleaseMixItem[] {
  return groupReleaseSections(entry).map(({ category, label, items }) => ({
    category,
    label,
    count: items.length,
  }));
}

export function releaseItemCount(entry: ChangelogEntry): number {
  return entry.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export const HOW_TO_READ = (
  Object.entries(CHANGELOG_CATEGORIES) as [ChangelogCategory, CategoryMeta][]
).map(([category, meta]) => ({ category, ...meta }));
