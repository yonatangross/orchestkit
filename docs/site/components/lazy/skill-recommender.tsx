"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const SkillRecommenderInner = dynamic(
  () =>
    import("../skill-recommender").then((m) => ({
      default: m.SkillRecommender,
    })),
  { loading: () => <div className="h-48 animate-pulse rounded-lg bg-fd-muted" /> }
);

export function LazySkillRecommender() {
  return (
    <LazyErrorBoundary>
      <SkillRecommenderInner />
    </LazyErrorBoundary>
  );
}
