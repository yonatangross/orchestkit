"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const SetupWizardInner = dynamic(
  () => import("../setup-wizard").then((m) => ({ default: m.SetupWizard })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazySetupWizard() {
  return (
    <LazyErrorBoundary>
      <SetupWizardInner />
    </LazyErrorBoundary>
  );
}
