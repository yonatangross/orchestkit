"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const SkillDependencyGraphInner = dynamic(
  () =>
    import("../skill-dependency-graph").then((m) => ({
      default: m.SkillDependencyGraph,
    })),
  {
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-lg bg-fd-muted" />
    ),
    ssr: false,
  }
);

export function LazySkillDependencyGraph() {
  return (
    <LazyErrorBoundary>
      <SkillDependencyGraphInner />
    </LazyErrorBoundary>
  );
}
