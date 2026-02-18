"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const AnalyticsDashboardInner = dynamic(
  () => import("../analytics-dashboard").then((m) => ({ default: m.AnalyticsDashboard })),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyAnalyticsDashboard() {
  return (
    <LazyErrorBoundary>
      <AnalyticsDashboardInner />
    </LazyErrorBoundary>
  );
}
