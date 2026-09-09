export type LibraryTab = "skills" | "agents" | "hooks";

export function parseLibraryTab(
  value: string | string[] | undefined,
): LibraryTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "agents" || raw === "hooks") return raw;
  return "skills";
}

export function libraryTabHref(id: LibraryTab): string {
  return id === "skills" ? "/#library" : `/?lib=${id}#library`;
}
