"use client";

import { SITE } from "@/lib/constants";
import { formatStars } from "@/lib/format-stars";
import { track } from "@/lib/search-beacon";

/**
 * The stargazers anchor in the hero proof strip, split out of the server page
 * so the click can carry a first-party star_clicked event (funnel A2). The
 * navigation is untouched: track() is fire-and-forget via sendBeacon.
 */
export function StarLink({ stars }: { stars: number | null }) {
  return (
    <a
      href={`${SITE.github}/stargazers`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("star_clicked")}
      className="inline-flex items-center gap-1.5 px-3.5 transition-colors hover:text-[oklch(0.93_0.012_270)]"
    >
      <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {stars !== null ? (
        <>
          <span className="font-medium tabular-nums text-[oklch(0.95_0.008_270)]">{formatStars(stars)}</span>
          <span>stars</span>
        </>
      ) : (
        <span>Star on GitHub</span>
      )}
    </a>
  );
}
