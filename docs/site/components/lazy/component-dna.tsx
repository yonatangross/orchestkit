"use client";
import dynamic from "next/dynamic";
import type { ComponentDNAProps } from "../component-dna";
import { LazyErrorBoundary } from "./error-boundary";

const ComponentDNAInner = dynamic(
  () => import("../component-dna").then((m) => ({ default: m.ComponentDNA })),
  { loading: () => <div className="h-10 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyComponentDNA(props: ComponentDNAProps) {
  return (
    <LazyErrorBoundary>
      <ComponentDNAInner {...props} />
    </LazyErrorBoundary>
  );
}
