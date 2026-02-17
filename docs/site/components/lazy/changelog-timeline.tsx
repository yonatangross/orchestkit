"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const ChangelogTimelineInner = dynamic(
  () => import("../changelog-timeline").then((m) => ({ default: m.ChangelogTimeline })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyChangelogTimeline() {
  return (
    <LazyErrorBoundary>
      <ChangelogTimelineInner />
    </LazyErrorBoundary>
  );
}
