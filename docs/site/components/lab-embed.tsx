"use client";

import { useState } from "react";

/**
 * Sandboxed live embed of a Lab playground with a caption bar.
 * `sandbox="allow-scripts"` (no allow-same-origin) gives the playground an
 * opaque origin: scripts run, but cookies/storage of the docs site are
 * unreachable. Loads on click to keep the page light.
 */
export function LabEmbed({
  slug,
  caption,
  height = 560,
}: {
  slug: string;
  caption: string;
  height?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = `/lab/${slug}.html`;

  return (
    <figure
      className="my-6 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--color-fd-border)" }}
    >
      {loaded ? (
        <iframe
          src={url}
          sandbox="allow-scripts"
          title={caption}
          style={{ width: "100%", height, border: 0, display: "block", background: "#0d1017" }}
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="flex w-full items-center justify-center text-sm font-medium"
          style={{ height: 220, background: "var(--color-fd-muted)", color: "var(--color-fd-foreground)" }}
        >
          ▶ Load interactive playground
        </button>
      )}
      <figcaption
        className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs"
        style={{
          borderColor: "var(--color-fd-border)",
          color: "var(--color-fd-muted-foreground)",
          background: "var(--color-fd-card)",
        }}
      >
        <span>{caption}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium" style={{ color: "var(--color-fd-primary)" }}>
          Full page ↗
        </a>
      </figcaption>
    </figure>
  );
}
