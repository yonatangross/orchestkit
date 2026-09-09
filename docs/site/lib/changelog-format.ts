import type {
  ChangelogEntry,
  SectionType,
} from "@/lib/generated/changelog-data";

export const SECTION_LABEL: Record<SectionType, string> = {
  added: "Added",
  fixed: "Fixed",
  changed: "Changed",
  removed: "Removed",
  deprecated: "Deprecated",
  security: "Security",
};

/** Theme-aware tags: fd-* / george text tokens, not raw Tailwind 400s. */
export const TAG_BG: Record<SectionType, string> = {
  added: "bg-[var(--color-fd-primary-10)] text-fd-primary",
  changed: "bg-fd-muted text-fd-foreground",
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

export const SECTION_GLYPH: Record<SectionType, string> = {
  added: "🎯",
  fixed: "✅",
  changed: "🔄",
  removed: "❌",
  deprecated: "⚠️",
  security: "🚨",
};

const DEFAULT_SCOPE = {
  glyph: "🎯",
  rationale:
    "Shipped in this release. Open the linked PR if you need the full rationale.",
};

const SCOPE_META: Record<string, { glyph: string; rationale: string }> = {
  build: {
    glyph: "🔄",
    rationale: "Release plumbing. Does not change plugin runtime behavior.",
  },
  ci: {
    glyph: "⚡",
    rationale: "CI gates. Protects the next push, not an already-open session.",
  },
  chore: {
    glyph: "🔄",
    rationale: "Housekeeping. No user-facing behavior change.",
  },
  docs: {
    glyph: "📜",
    rationale: "Documentation only. Runtime behavior is unchanged.",
  },
  cc: {
    glyph: "📜",
    rationale:
      "Claude Code version triage. Compatibility notes unless the bullet says otherwise.",
  },
  skills: {
    glyph: "📜",
    rationale:
      "A skill you invoke with /ork: changed. Re-read that skill page if you use it.",
  },
  hooks: {
    glyph: "⚡",
    rationale:
      "A lifecycle hook changed. Affects matching tool calls in every session.",
  },
  agents: {
    glyph: "🤖",
    rationale: "A specialist agent prompt or wiring changed.",
  },
  readme: {
    glyph: "📜",
    rationale: "README or community copy. No runtime change.",
  },
};

export type ChangelogRef = { label: string; href: string };

export type ParsedChange = {
  scope: string | null;
  title: string;
  glyph: string;
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
  const title = scopeMatch ? scopeMatch[2] : titlePlain;
  const meta = (scope && SCOPE_META[scope]) || DEFAULT_SCOPE;
  return { scope, title, glyph: meta.glyph, rationale: meta.rationale, issues, shas };
}

export type ReleaseMixItem = {
  type: SectionType;
  heading: string;
  count: number;
};

export function releaseSectionMix(entry: ChangelogEntry): ReleaseMixItem[] {
  const counts = new Map<string, ReleaseMixItem>();
  for (const s of entry.sections) {
    const heading = s.heading || SECTION_LABEL[s.type];
    const prev = counts.get(heading);
    counts.set(heading, {
      type: s.type,
      heading,
      count: (prev?.count ?? 0) + s.items.length,
    });
  }
  return [...counts.values()];
}

export const HOW_TO_READ = [
  { glyph: "🎯", label: "Added", hint: "new capability" },
  { glyph: "✅", label: "Fixed", hint: "a bug closed" },
  { glyph: "🔄", label: "Changed", hint: "behavior or plumbing" },
  { glyph: "📜", label: "Docs", hint: "no runtime change" },
  { glyph: "🚨", label: "Security", hint: "read before you upgrade" },
] as const;

function mermaidLabel(text: string): string {
  return text
    .replace(/[🎯✅🔄❌⚠️🚨📜🤖⚡]/g, "")
    .replace(/["\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function howToReadMermaid(): string {
  return [
    "flowchart LR",
    '  A["Added - new capability"]',
    '  F["Fixed - a bug closed"]',
    '  C["Changed - behavior or plumbing"]',
    '  D["Docs - no runtime change"]',
    '  S["Security - read before you upgrade"]',
    "  A --- F --- C --- D --- S",
  ].join("\n");
}

export function releaseMixMermaid(entry: ChangelogEntry): string {
  const counts = new Map<string, { n: number; type: SectionType }>();
  for (const s of entry.sections) {
    const label = s.heading || SECTION_LABEL[s.type];
    const prev = counts.get(label);
    counts.set(label, {
      n: (prev?.n ?? 0) + s.items.length,
      type: s.type,
    });
  }
  const nodes = [...counts.entries()].map(([label, { n }], i) => {
    return `  v --> n${i}["${mermaidLabel(label)} · ${n}"]`;
  });
  return [
    "flowchart LR",
    `  v["${mermaidLabel(entry.version)}"]`,
    ...nodes,
  ].join("\n");
}

export function recentTimelineMermaid(entries: ChangelogEntry[], take = 6): string {
  const slice = entries.slice(0, take);
  const nodeLines = slice.map((e, i) => {
    const n = e.sections.reduce((sum, s) => sum + s.items.length, 0);
    return `  v${i}["${mermaidLabel(e.version)} · ${n}"]`;
  });
  const edges = slice.slice(1).map((_, i) => `  v${i} --> v${i + 1}`);
  return ["flowchart LR", ...nodeLines, ...edges].join("\n");
}
