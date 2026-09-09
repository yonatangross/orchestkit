"use client";

import { useEffect, useId, useState } from "react";

type MermaidApi = typeof import("mermaid").default;

let mermaidPromise: Promise<MermaidApi> | null = null;
let queue: Promise<void> = Promise.resolve();

function getMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then((mod) => {
    const mermaid = mod.default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      fontFamily: "inherit",
    });
    return mermaid;
  });
  return mermaidPromise;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function dropMermaidScratch(id: string) {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
  document.getElementById(`${id}-d`)?.remove();
}

export function ChangelogMermaid({ chart }: { chart: string }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const renderId = `clmd${reactId}${Math.random().toString(36).slice(2, 8)}`;

    void enqueue(async () => {
      try {
        const mermaid = await getMermaid();
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: dark ? "dark" : "neutral",
          fontFamily: "inherit",
        });
        const { svg: rendered } = await mermaid.render(renderId, chart);
        dropMermaidScratch(renderId);
        if (!cancelled) setSvg(rendered);
      } catch {
        dropMermaidScratch(renderId);
        if (!cancelled) setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-fd-border bg-fd-muted p-3 font-mono text-[11px] text-fd-muted-foreground">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div
        className="min-h-[140px] rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] p-3"
        aria-busy="true"
        aria-label="Rendering diagram"
      />
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
