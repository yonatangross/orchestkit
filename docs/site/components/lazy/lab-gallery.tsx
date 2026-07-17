"use client";
import dynamic from "next/dynamic";
import { LazyErrorBoundary } from "./error-boundary";

const LabGalleryInner = dynamic(
  () => import("../lab-gallery").then((m) => ({ default: m.LabGallery })),
  { loading: () => <div className="h-64 animate-pulse rounded bg-fd-muted" /> }
);

const LabEmbedInner = dynamic(
  () => import("../lab-embed").then((m) => ({ default: m.LabEmbed })),
  { loading: () => <div className="h-56 animate-pulse rounded bg-fd-muted" /> }
);

const CcAdoptionBoardInner = dynamic(
  () => import("../cc-adoption-board").then((m) => ({ default: m.CcAdoptionBoard })),
  { loading: () => <div className="h-64 animate-pulse rounded bg-fd-muted" /> }
);

export function LazyLabGallery() {
  return (
    <LazyErrorBoundary>
      <LabGalleryInner />
    </LazyErrorBoundary>
  );
}

export function LazyLabEmbed(props: { slug: string; caption: string; height?: number }) {
  return (
    <LazyErrorBoundary>
      <LabEmbedInner {...props} />
    </LazyErrorBoundary>
  );
}

export function LazyCcAdoptionBoard() {
  return (
    <LazyErrorBoundary>
      <CcAdoptionBoardInner />
    </LazyErrorBoundary>
  );
}
