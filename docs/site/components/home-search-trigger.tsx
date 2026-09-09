"use client";

import { Search } from "lucide-react";
import { useSearchContext } from "fumadocs-ui/contexts/search";

export function HomeSearchTrigger() {
  const { setOpenSearch } = useSearchContext();

  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="mx-auto mt-5 flex h-11 w-full max-w-[440px] items-center gap-2.5 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-3.5 text-left text-sm text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-foreground"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">Search skills, agents, hooks, docs…</span>
      <kbd className="hidden rounded border border-fd-border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
