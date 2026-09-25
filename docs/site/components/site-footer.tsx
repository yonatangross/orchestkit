import Link from "next/link";
import { SITE } from "@/lib/constants";

/**
 * Site footer for every home-layout route (home, changelog, community, compare,
 * pricing, ...) and the 404. It used to live inside the home page only, so
 * changelog, community and the 404 ended with no footer (visual audit
 * 2026-09-25).
 */
export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-7 py-5 text-[13px] text-fd-muted-foreground">
        <span>
          OrchestKit is built by Yonyon{" · "}
          Built with{" "}
          <a
            href="https://fumadocs.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-fd-border underline-offset-4 hover:text-fd-primary"
          >
            Fumadocs
          </a>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="hover:text-fd-foreground">
            GitHub
          </a>
          <Link href="/docs/getting-started/installation" className="hover:text-fd-foreground">
            Docs
          </Link>
          <Link href="/changelog" className="hover:text-fd-foreground">
            Changelog
          </Link>
          <Link href="/community" className="hover:text-fd-foreground">
            Community
          </Link>
          <Link href="/factory-ride" className="hover:text-fd-foreground">
            Factory ride
          </Link>
          <Link href="/developers" className="hover:text-fd-foreground">
            Developers
          </Link>
          <Link href="/compare" className="hover:text-fd-foreground">
            Compare
          </Link>
          <Link href="/pricing" className="hover:text-fd-foreground">
            Pricing
          </Link>
          <Link href="/about" className="hover:text-fd-foreground">
            About
          </Link>
          <Link href="/privacy" className="hover:text-fd-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fd-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
