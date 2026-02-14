"use client";
import dynamic from "next/dynamic";

export const LazySkillBrowser = dynamic(
  () => import("../skill-browser").then((m) => ({ default: m.SkillBrowser })),
  { loading: () => <div className="h-96 animate-pulse rounded bg-fd-muted" /> }
);
