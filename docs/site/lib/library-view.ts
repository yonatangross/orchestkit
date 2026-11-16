import type {
  LibraryItem,
  LibraryStationKey,
} from "@/lib/generated/library-data";

/** The kind filter as the section shows it (a segment of four). */
export type LibraryKind = "all" | "skill" | "agent" | "hook";

export const LIBRARY_KINDS: readonly LibraryKind[] = [
  "all",
  "skill",
  "agent",
  "hook",
];

export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  all: "All",
  skill: "Skills",
  agent: "Agents",
  hook: "Hooks",
};

/** The rail order of the approved mockup: the run goes Ask to Remember. */
export const LIBRARY_STATION_ORDER: readonly LibraryStationKey[] = [
  "ask",
  "plan",
  "build",
  "guard",
  "check",
  "ship",
  "remember",
];

export function parseStationParam(
  value: string | null | undefined,
): LibraryStationKey | null {
  const hit = LIBRARY_STATION_ORDER.find((key) => key === value);
  return hit ?? null;
}

export function parseKindParam(value: string | null | undefined): LibraryKind {
  const hit = LIBRARY_KINDS.find((kind) => kind === value);
  return hit ?? "all";
}

/** `PreToolUse` becomes `pre-tool-use`, the file name of the event page. */
export function hookEventSlug(event: string): string {
  return event
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The anchor id of one hook row on its event page. Matcher and script keep it
 * unique inside the page (webhook-forwarder is registered under many matchers).
 * Phase 3 writes the same id into the generated tables.
 */
export function hookAnchorId(
  item: Extract<LibraryItem, { kind: "hook" }>,
): string {
  // The generator's two edge cases: an empty matcher is shown as `*`, and a
  // command that is not a run-hook id (it holds a space, e.g. `node ${...}/x.mjs`)
  // is named by its last path segment (hook_name_from_command).
  const matcher = item.matcher === "" ? "*" : item.matcher;
  const script = /\s/.test(item.script)
    ? (item.script.split("/").pop() ?? item.script)
    : item.script;
  return `hook-${slugPart(matcher)}-${slugPart(script)}`;
}

/** Every item has a page to open; hooks land on their row of the event page. */
export function libraryItemHref(item: LibraryItem): string {
  switch (item.kind) {
    case "skill":
      return `/docs/reference/skills/${item.name}`;
    case "agent":
      return `/docs/reference/agents/${item.name}`;
    case "hook":
      return `/docs/reference/hooks/${hookEventSlug(item.event)}#${hookAnchorId(item)}`;
  }
}

/** One line a row shows under its name: skills and agents their description. */
export function libraryItemNote(item: LibraryItem): string {
  if (item.kind === "hook") {
    return `${item.event}${item.matcher && item.matcher !== "*" ? ` · ${item.matcher}` : ""}`;
  }
  return item.description;
}

/** Lower-cased text a search matches, built once on the server. */
export function libraryItemSearchText(item: LibraryItem): string {
  return `${item.name} ${libraryItemNote(item)}`.toLowerCase();
}

/**
 * The line that explains the hooks count next to it. The site's own total
 * (163) also counts the handlers declared inside skills; the library lists the
 * hooks.json ones and says how many more run inside skills. Never typed: the
 * numbers come from LIBRARY_COUNTS.
 */
export function hooksNote(counts: {
  hooks: number;
  skillScopedHooks: number;
  skillsWithHooks: number;
}): string {
  return `${counts.hooks} hooks, plus ${counts.skillScopedHooks} that run inside ${counts.skillsWithHooks} skills.`;
}

export type LibraryFilter = {
  kind: LibraryKind;
  station: LibraryStationKey | null;
  query: string;
};

export function rowMatches(
  row: { kind: string; station: string; text: string },
  filter: LibraryFilter,
): boolean {
  if (filter.kind !== "all" && row.kind !== filter.kind) return false;
  if (filter.station && row.station !== filter.station) return false;
  const q = filter.query.trim().toLowerCase();
  return q === "" || row.text.includes(q);
}
