import Link from "next/link";
import { GeorgeBuried } from "@/components/world/george";
import { RECOVERY_LINKS } from "@/lib/not-found-body";

// The two buttons below are the human path out. RECOVERY_LINKS is the same list
// the Markdown and JSON 404 bodies use (lib/not-found-body.ts), rendered here
// so the HTML representation points at the same places, and so a crawler that
// only ever parses HTML still finds the sitemap and llms.txt from a dead link.

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <GeorgeBuried className="text-fd-muted-foreground" />
      <h1 className="mt-6 text-6xl font-bold tabular-nums">404</h1>
      <p className="mt-4 text-lg text-fd-muted-foreground">
        This page got buried.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="hover-glow inline-flex h-10 items-center rounded-md bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-fd-primary-50)]"
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
      <nav aria-label="Where to look next" className="mt-10 max-w-xl">
        <p className="text-sm text-fd-muted-foreground">Where to look next</p>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          {RECOVERY_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                title={l.desc}
                className="text-fd-muted-foreground underline underline-offset-4 transition-colors hover:text-fd-foreground"
              >
                {l.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
