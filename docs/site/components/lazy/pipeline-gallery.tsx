"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const PipelineGalleryInner = dynamic(
  () => import("../pipeline-gallery").then((m) => ({ default: m.PipelineGallery })),
  { loading: () => <div className="h-64 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyPipelineGallery() {
  return (
    <LazyErrorBoundary>
      <PipelineGalleryInner />
    </LazyErrorBoundary>
  );
}
