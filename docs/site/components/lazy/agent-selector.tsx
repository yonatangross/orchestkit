"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const AgentSelectorInner = dynamic(
  () =>
    import("../agent-selector").then((m) => ({ default: m.AgentSelector })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyAgentSelector() {
  return (
    <LazyErrorBoundary>
      <AgentSelectorInner />
    </LazyErrorBoundary>
  );
}
