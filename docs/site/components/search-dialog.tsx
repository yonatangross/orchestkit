"use client";

// Custom ⌘K dialog — adds Docs / Skills / Agents / Hooks / Compositions tabs on
// top of the unified Orama index (app/api/search). Selecting a tab sets ?tag=…
// so the server filters by content type. Built on fumadocs' canonical fetch
// dialog pattern; "All" is the cleared state (allowClear).

import { useState } from "react";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";

const TABS: { value: string; name: string }[] = [
  { value: "docs", name: "Docs" },
  { value: "skill", name: "Skills" },
  { value: "agent", name: "Agents" },
  { value: "hook", name: "Hooks" },
  { value: "composition", name: "Compositions" },
];

export default function CustomSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string | undefined>(undefined);
  const { search, setSearch, query } = useDocsSearch({
    type: "fetch",
    api: "/api/search",
    tag,
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput placeholder="Search docs, skills, agents…" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data !== "empty" ? query.data : null}
        />
        <SearchDialogFooter>
          <TagsList tag={tag} onTagChange={setTag} allowClear>
            {TABS.map((t) => (
              <TagsListItem key={t.value} value={t.value}>
                {t.name}
              </TagsListItem>
            ))}
          </TagsList>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
