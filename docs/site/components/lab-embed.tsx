"use client";

import { useState } from "react";

/**
 * Sandboxed live embed of a Lab playground with a caption bar.
 * `sandbox="allow-scripts"` (no allow-same-origin) gives the playground an
 * opaque origin: scripts run, but cookies/storage of the docs site are
 * unreachable. Loads on click to keep the page light.
 *
 * The pre-load state is a designed poster, not a grey stub: it reserves the
 * SAME height as the iframe (so clicking causes no layout shift) and carries
 * the site's own cosmic treatment, so an unloaded embed reads as an
 * invitation rather than as a broken element.
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
          aria-label={`Load interactive playground: ${caption}`}
          className="group relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden"
          style={{
            height,
            background:
              "radial-gradient(120% 90% at 50% 0%, oklch(0.62 0.2 264 / 0.16), transparent 60%), " +
              "radial-gradient(90% 70% at 85% 100%, oklch(0.6 0.2 290 / 0.12), transparent 55%), " +
              "var(--color-fd-card)",
          }}
        >
          {/* Particle grid, echoing the site background. Decorative. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle, oklch(0.62 0.2 264 / 0.16) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(120% 90% at 50% 40%, black 25%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(120% 90% at 50% 40%, black 25%, transparent 75%)",
            }}
          />

          <span
            aria-hidden="true"
            className="relative font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: "var(--yy-george-cool, oklch(0.76 0.06 220))" }}
          >
            Interactive playground
          </span>

          {/* Play affordance */}
          <span
            aria-hidden="true"
            className="relative grid h-14 w-14 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105"
            style={{
              background: "oklch(0.62 0.2 264 / 0.16)",
              border: "1px solid oklch(0.62 0.2 264 / 0.5)",
              boxShadow: "0 0 32px oklch(0.62 0.2 264 / 0.35)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M5 3.5v11l9-5.5-9-5.5Z"
                fill="var(--color-fd-primary)"
                stroke="var(--color-fd-primary)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span
            aria-hidden="true"
            className="relative max-w-[46ch] px-6 text-center text-sm leading-relaxed"
            style={{ color: "var(--color-fd-muted-foreground)" }}
          >
            {caption}
          </span>

          <span
            aria-hidden="true"
            className="relative text-xs font-medium transition-colors"
            style={{ color: "var(--color-fd-primary)" }}
          >
            Click to run it here
          </span>
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
        {/* The poster already shows the caption, so only repeat it once the
            iframe has replaced the poster. */}
        <span>{loaded ? caption : ""}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-medium"
          style={{ color: "var(--color-fd-primary)" }}
        >
          Full page ↗
        </a>
      </figcaption>
    </figure>
  );
}
