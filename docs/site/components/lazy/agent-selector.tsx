"use client";
import dynamic from "next/dynamic";

export const LazyAgentSelector = dynamic(
  () =>
    import("../agent-selector").then((m) => ({ default: m.AgentSelector })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);
