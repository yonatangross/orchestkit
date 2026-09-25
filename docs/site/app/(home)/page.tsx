import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { StarLink } from "./star-link";
import { COUNTS, PAGE_SUMMARY, SITE, SITE_TITLE } from "@/lib/constants";
import { AgentReadinessSection } from "@/components/agent-readiness-section";
import { HomepageStructuredData } from "@/components/structured-data";
import { GeorgeMark } from "@/components/world/george";
import { LibraryCatalog } from "@/components/library-catalog";
import { WhatsNewStrip } from "@/components/whats-new-strip";
import { HomeSearchTrigger } from "@/components/home-search-trigger";
import { HostInstallPicker } from "@/components/host-install";
import { WhatsAppCommunityLink } from "@/components/whatsapp-community-link";
import { WebMcpSearchForm } from "@/components/webmcp-search-form";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";
import { HomeHeroArt } from "@/components/home-hero-art";

// Homepage-only social fields. Kept off the root layout so marketing pages that
// only set `title` do not inherit this og/twitter title and description.
// og:type and og:image live here too (not in app/layout.tsx): Next merges
// openGraph shallowly, and a child object without those keys dropped them from
// the built homepage even when the file-based opengraph-image route returned 200.
export const metadata: Metadata = {
	title: {
		absolute: SITE_TITLE,
	},
	description: PAGE_SUMMARY.site,
	openGraph: {
		title: SITE_TITLE,
		description: PAGE_SUMMARY.site,
		url: SITE.domain,
		type: "website",
		images: [
			{
				url: "/opengraph-image",
				width: 1200,
				height: 630,
				alt: SITE_TITLE,
			},
		],
	},
	twitter: {
		title: SITE_TITLE,
		description: PAGE_SUMMARY.site,
		images: ["/opengraph-image"],
	},
};

async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/yonatangross/orchestkit", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.stargazers_count ?? null;
  } catch {
    return null;
  }
}

type Recipe = {
  title: string;
  tag: string;
  cmd: string;
  href: string;
  badge?: string;
};

const RECIPES: Recipe[] = [
  { title: "Implement a feature", tag: "From idea to merged PR with parallel AI agents.", cmd: "/ork:implement", href: "/docs/cookbook/implement-feature" },
  { title: "Claude Design → PR", tag: "Handoff URL in, reviewable PR out.", cmd: "/ork:design-ship", href: "/docs/cookbook/claude-design-handoff", badge: "NEW" },
  { title: "Review a PR", tag: "Parallel specialized reviewers, synthesized comment.", cmd: "/ork:review-pr", href: "/docs/cookbook/review-pr" },
  { title: "Fix a GitHub issue", tag: "Root-cause analysis, regression detection, linked PR.", cmd: "/ork:fix-issue", href: "/docs/cookbook/fix-github-issue" },
  { title: "Task management", tag: "Multi-agent TaskCreate / TaskList / dependency chains.", cmd: "TaskCreate", href: "/docs/cookbook/task-management" },
  { title: "Set up memory", tag: "3-tier knowledge graph that persists across sessions.", cmd: "/ork:memory", href: "/docs/cookbook/setup-memory" },
  { title: "Create a demo video", tag: "VHS + Remotion pipeline, auto-generated voiceover.", cmd: "/ork:demo-producer", href: "/docs/cookbook/create-demo-video" },
  { title: "Security audit", tag: "Parallel scan across auth, secrets, OWASP, dependencies.", cmd: "/ork:audit-full", href: "/docs/cookbook/security-audit" },
];

// No `searchParams` prop on purpose: reading it renders `/` per request
// (private, no-store). The host picker and the library catalog read `?host=` and
// `?lib=` on the client instead (components/search-params-sync.tsx), so this
// page prerenders and revalidates with the star count fetch.
export default async function HomePage() {
  const stars = await getStarCount();
  const latest = CHANGELOG_ENTRIES[0];

  return (
    <main>
      <HomepageStructuredData starCount={stars} />
      <a
        href={SITE.github}
        aria-label="OrchestKit on GitHub"
        className="fixed bottom-5 right-5 z-40 hidden rounded-full ring-2 ring-[var(--yy-george-warm)]/60 transition-transform hover:scale-105 lg:block"
      >
        <Image
          src="/brand/george-badge.png"
          alt="George, the OrchestKit husky"
          width={52}
          height={52}
          className="rounded-full"
        />
      </a>

      {/* Hero A: left copy + right conductor bleed (approved-design/hero-a-2026-09-22.html).
          Row 1 is the mockup (copy beside the art); the host picker, search and
          links sit in a full-width row 2 so the art never faces an empty column. */}
      <section
        aria-labelledby="hero-heading"
        className="home-hero relative overflow-x-hidden border-b border-fd-border"
      >
        <div className="home-hero-inner relative mx-auto w-full max-w-[var(--hero-max)] px-[var(--hero-pad)] pt-12 pb-10 sm:pt-[72px] sm:pb-12">
          <div className="home-hero-copy relative z-[2] max-w-[520px] text-left max-[900px]:max-w-none">
            <div className="home-hero-copy-top">
              {latest ? (
                <Link
                  href="/changelog"
                  className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-[var(--color-fd-surface-raised)] p-1 pr-3 text-sm text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-foreground"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-fd-primary">
                    <GeorgeMark />
                    What&apos;s new
                  </span>
                  <span className="font-mono text-[12px]">{latest.version}</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-fd-border px-2.5 py-1.5 font-mono text-[12px] font-medium text-fd-muted-foreground">
                  <GeorgeMark />
                  The complete AI development toolkit for Claude Code
                </span>
              )}

              <h1
                id="hero-heading"
                data-speakable-headline
                className="mt-5 text-fluid-h1 font-semibold leading-[1.02] tracking-[-0.025em] text-fd-foreground [text-wrap:balance]"
              >
                <span className="sr-only">OrchestKit. </span>
                Stop explaining your stack.
                <br />
                Start shipping.
              </h1>

              <p
                data-speakable-summary
                className="mt-4 max-w-[520px] text-[clamp(0.95rem,0.3vw+0.9rem,1.125rem)] leading-[1.55] text-fd-muted-foreground [text-wrap:balance]"
              >
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium text-fd-foreground">
                  {COUNTS.skills} skills
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium text-fd-foreground">
                  {COUNTS.agents} agents
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium text-fd-foreground">
                  {COUNTS.hooks} hooks
                </span>
                <span className="mt-1 block text-[0.9em]">
                  A Claude Code plugin library. Search it, install it, ship.
                </span>
              </p>
            </div>

            <div className="home-hero-copy-actions">
              {/* Host first, then that host's one command (operator, 2026-09-25):
                  76% of host picks were not Claude Code, but the hero printed the
                  Claude Code command before the picker. */}
              <HostInstallPicker />
            </div>
          </div>
          <HomeHeroArt />

          <div className="home-hero-more">
            <HomeSearchTrigger />
            <WebMcpSearchForm />
            <div className="mt-4 flex flex-wrap items-center justify-start gap-x-5 gap-y-2 text-[13px] text-fd-muted-foreground min-[901px]:justify-center">
              <WhatsAppCommunityLink />
              <Link
                href="/docs/cookbook/implement-feature"
                className="text-fd-primary underline-offset-2 hover:underline"
              >
                See the cookbook
              </Link>
              <Link
                href="/docs/getting-started/configuration"
                className="text-fd-primary underline-offset-2 hover:underline"
              >
                Configure your project
              </Link>
              <Link
                href="/openapi"
                className="text-fd-primary underline-offset-2 hover:underline"
              >
                OrchestKit OpenAPI specification
              </Link>
              <Link
                href="/docs/mcp"
                className="text-fd-primary underline-offset-2 hover:underline"
              >
                OrchestKit MCP server
              </Link>
              <Link
                href="/docs/sdk"
                className="text-fd-primary underline-offset-2 hover:underline"
              >
                OrchestKit SDK packages
              </Link>
            </div>

            {/* Spacing, not divider glyphs: a divider in a wrapping row ends a line
                on its own ("MIT license |" at 390). */}
            <div className="mt-6 flex flex-wrap items-center justify-start gap-x-6 gap-y-1.5 font-mono text-[12px] text-fd-muted-foreground min-[901px]:justify-center">
              <StarLink stars={stars} />
              <span className="inline-flex items-center gap-1.5">MIT license</span>
              <span className="inline-flex items-center gap-1.5">
                Claude Code ≥ {SITE.ccVersion}
              </span>
            </div>
          </div>
        </div>
      </section>

      <LibraryCatalog />
      <WhatsNewStrip />

      <section aria-labelledby="cookbook-heading" className="border-b border-fd-border" id="cookbook">
        <div className="mx-auto max-w-[1200px] px-7 py-[72px]">
          <div className="mb-[18px] flex items-baseline justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
                <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
                Recipes / {String(RECIPES.length).padStart(2, "0")}
              </span>
              <h2
                id="cookbook-heading"
                className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground"
              >
                Cookbook
              </h2>
            </div>
            <Link
              href="/docs/cookbook/implement-feature"
              className="font-mono text-[13px] text-fd-primary underline-offset-2 hover:underline"
            >
              View all recipes →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {RECIPES.map((r, idx) => (
              <Link
                key={r.href}
                href={r.href}
                className="group relative flex min-h-[148px] flex-col rounded-[10px] border border-fd-border bg-[var(--color-fd-surface-raised)] p-5 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-fd-primary)_40%,var(--color-fd-border))] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
              >
                <div className="mb-3 flex h-5 items-center justify-between font-mono text-[11px] tracking-[0.05em] text-fd-muted-foreground">
                  <span className="tabular-nums">
                    {String(idx + 1).padStart(2, "0")} / {String(RECIPES.length).padStart(2, "0")}
                  </span>
                  {r.badge ? (
                    <span className="rounded border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-fd-primary">
                      {r.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mb-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-fd-foreground">
                  {r.title}
                </h3>
                <div className="flex-1 text-[13px] leading-[1.5] text-fd-muted-foreground">{r.tag}</div>
                <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-fd-border pt-3 font-mono text-[11.5px] text-fd-muted-foreground">
                  <span className="text-fd-foreground">{r.cmd}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3 w-3 text-fd-primary transition-transform duration-150 group-hover:translate-x-[3px]"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="what-heading" className="border-b border-fd-border">
        <div className="mx-auto max-w-[820px] px-7 py-14">
          <h2 id="what-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
            What is OrchestKit?
          </h2>
          <p className="mt-3 leading-7 text-fd-muted-foreground">
            OrchestKit is a free, open-source (MIT) plugin for{" "}
            <a href="https://www.anthropic.com/claude-code" className="text-fd-primary underline underline-offset-2">
              Claude Code
            </a>
            , Anthropic&apos;s agentic command-line coding tool. It packages{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.skills} skills</span>,{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.agents} agents</span>, and{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.hooks} lifecycle hooks</span>{" "}
            into a single install, encoding security patterns and quality gates so the agent
            works to your standards out of the box. It runs locally inside Claude Code; it is
            not a hosted service and not an editor autocomplete. See the{" "}
            <Link href="/compare" className="text-fd-primary underline underline-offset-2">
              full comparison
            </Link>
            .
          </p>
        </div>
      </section>

      <AgentReadinessSection />

    </main>
  );
}
