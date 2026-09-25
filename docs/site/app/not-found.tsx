import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/app/layout.config";
import { SiteFooter } from "@/components/site-footer";
import { GeorgeBuried } from "@/components/world/george";
import { HomeContainer } from "./(home)/home-container";
import { RECOVERY_LINKS } from "@/lib/not-found-body";

// Human destinations first (visual audit 2026-09-25: the only "where to look
// next" row pointed at llms.txt, OpenAPI and RFC 9727, and the page had no nav).
const POPULAR = [
  { href: "/docs/getting-started/first-10-minutes", title: "Get started" },
  { href: "/docs/cookbook", title: "Cookbook" },
  { href: "/docs/reference", title: "Reference" },
  { href: "/changelog", title: "Changelog" },
  { href: "/community", title: "Community" },
] as const;

// The two buttons below are the human path out. RECOVERY_LINKS is the same list
// the Markdown and JSON 404 bodies use (lib/not-found-body.ts), rendered here
// so the HTML representation points at the same places, and so a crawler that
// only ever parses HTML still finds the sitemap and llms.txt from a dead link.

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions} slots={{ container: HomeContainer }}>
      <main className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center px-6 py-16 text-center">
        <GeorgeBuried className="text-fd-muted-foreground" />
        <h1 className="mt-6 text-6xl font-bold tabular-nums">404</h1>
        <p className="mt-4 text-lg text-fd-muted-foreground">
          This page got buried.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="hover-glow inline-flex h-10 items-center rounded-md bg-fd-primary px-6 dark:bg-[oklch(0.5_0.19_264)] text-sm font-medium text-fd-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-fd-primary-50)]"
          >
            Home
          </Link>
          <Link
            href="/docs/foundations/overview"
            className="inline-flex h-10 items-center rounded-md border border-fd-border px-6 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Documentation
          </Link>
        </div>
        <nav aria-label="Popular pages" className="mt-10 max-w-xl">
          <p className="text-sm text-fd-muted-foreground">Popular pages</p>
          <ul className="mt-2 grid grid-cols-3 justify-items-center gap-x-5 gap-y-1.5 text-sm font-medium sm:flex sm:flex-wrap sm:justify-center">
            {POPULAR.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-fd-primary underline-offset-4 hover:underline">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="For agents and crawlers" className="mt-8 max-w-xl">
          <p className="text-xs text-fd-muted-foreground">For agents and crawlers</p>
          <ul className="mt-1 flex flex-wrap justify-center gap-x-4 text-sm">
            {RECOVERY_LINKS.map((l) => (
              <li key={l.href}>
                {/* No prefetch: these are API and file endpoints (prefetching
                    /api/search?query= logged a 400 on every 404 view), and py-1
                    keeps a 24px tap target (axe target-size). */}
                <Link
                  href={l.href}
                  title={l.desc}
                  prefetch={false}
                  className="inline-block py-1 text-fd-muted-foreground underline underline-offset-4 transition-colors hover:text-fd-foreground"
                >
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <SiteFooter />
    </HomeLayout>
  );
}
