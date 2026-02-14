"use client";
import dynamic from "next/dynamic";

export const LazyDemoGallery = dynamic(
  () => import("../demo-gallery").then((m) => ({ default: m.DemoGallery })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);
