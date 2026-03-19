"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const ContextualSkillSidebarInner = dynamic(
  () =>
    import("../contextual-skill-sidebar").then((m) => ({
      default: m.ContextualSkillSidebar,
    })),
  { loading: () => <div className="h-24 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyContextualSkillSidebar({ slug }: { slug: string }) {
  return (
    <LazyErrorBoundary>
      <ContextualSkillSidebarInner slug={slug} />
    </LazyErrorBoundary>
  );
}
