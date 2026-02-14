"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const DemoGalleryInner = dynamic(
  () => import("../demo-gallery").then((m) => ({ default: m.DemoGallery })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyDemoGallery() {
  return (
    <LazyErrorBoundary>
      <DemoGalleryInner />
    </LazyErrorBoundary>
  );
}
