/**
 * Format a GitHub stargazer count for compact display.
 *
 * Behavior:
 *   <    1,000  → exact integer ("0", "42", "999")
 *    ≥   1,000  → one-decimal "k" ("1.0k", "1.5k", "9.9k")
 *    ≥  10,000  → integer "k" ("10k", "12k", "999k")
 *    ≥1,000,000 → still "Nk" notation (e.g., "1000k") — no special "M" tier
 *                  yet; revisit when the repo crosses that threshold.
 *
 * Used by docs/site/app/(home)/page.tsx hero proof strip.
 */
export const formatStars = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;
