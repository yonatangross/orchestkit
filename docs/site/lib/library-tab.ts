export type LibraryTab = "skills" | "agents" | "hooks";

export function parseLibraryTab(
  value: string | string[] | undefined,
): LibraryTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "agents" || raw === "hooks") return raw;
  return "skills";
}

/** Claude is the default host, so it stays off the query string. */
export function libraryTabHref(id: LibraryTab, host = "claude"): string {
  const params = new URLSearchParams();
  if (host !== "claude") params.set("host", host);
  if (id !== "skills") params.set("lib", id);
  const query = params.toString();
  return query ? `/?${query}#library` : "/#library";
}
