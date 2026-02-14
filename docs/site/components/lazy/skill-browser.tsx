"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const SkillBrowserInner = dynamic(
  () => import("../skill-browser").then((m) => ({ default: m.SkillBrowser })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazySkillBrowser() {
  return (
    <LazyErrorBoundary>
      <SkillBrowserInner />
    </LazyErrorBoundary>
  );
}
