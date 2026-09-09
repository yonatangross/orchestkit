import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { StarLink } from "./star-link";
import { SITE, COUNTS } from "@/lib/constants";
import { AgentReadinessSection } from "@/components/agent-readiness-section";
import { HomepageStructuredData } from "@/components/structured-data";
import { GeorgeMark } from "@/components/world/george";
import { LibraryCatalog } from "@/components/library-catalog";
import { parseLibraryTab } from "@/lib/library-tab";
import { parseHostId } from "@/lib/host-installs";
import { WhatsNewStrip } from "@/components/whats-new-strip";
import { HomeSearchTrigger } from "@/components/home-search-trigger";
import { HostInstallPicker } from "@/components/host-install";
import { WhatsAppCommunityLink } from "@/components/whatsapp-community-link";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lib?: string | string[]; host?: string | string[] }>;
}) {
  const stars = await getStarCount();
  const latest = CHANGELOG_ENTRIES[0];
  const sp = await searchParams;
  const libraryTab = parseLibraryTab(sp.lib);
  const host = parseHostId(sp.host);

  return (
    <main>
      <HomepageStructuredData starCount={stars} />
      <a
        href={SITE.github}
        aria-label="OrchestKit on GitHub"
        className="fixed bottom-5 right-5 z-40 hidden rounded-full ring-2 ring-[var(--yy-george-warm)]/60 transition-transform hover:scale-105 md:block"
      >
        <Image
          src="/brand/george-badge.png"
          alt="George, the OrchestKit husky"
          width={52}
          height={52}
          className="rounded-full"
        />
      </a>

      <section aria-labelledby="hero-heading" className="border-b border-fd-border">
        <div className="mx-auto max-w-[880px] px-7 py-16 text-center sm:py-20">
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
            className="mt-5 text-fluid-h1 font-semibold leading-[1.02] tracking-[-0.025em] text-fd-foreground"
          >
            <span className="sr-only">OrchestKit. </span>
            Stop explaining your stack.
            <br />
            Start shipping.
          </h1>

          <p
            data-speakable-summary
            className="mx-auto mt-4 max-w-[620px] text-[clamp(0.95rem,0.3vw+0.9rem,1.125rem)] leading-[1.55] text-fd-muted-foreground [text-wrap:balance]"
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

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[oklch(0.45_0.20_264)] px-[18px] text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.40_0.18_264)] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
            >
              Get started{" "}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <HostInstallPicker active={host} libraryTab={libraryTab} />
          <HomeSearchTrigger />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] text-fd-muted-foreground">
            <WhatsAppCommunityLink />
            <Link
              href="/docs/cookbook/implement-feature"
              className="text-fd-primary underline-offset-2 hover:underline"
            >
              See the cookbook
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/docs/getting-started/configuration"
              className="text-fd-primary underline-offset-2 hover:underline"
            >
              Configure your project
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center font-mono text-[12px] text-fd-muted-foreground">
            <StarLink stars={stars} />
            <span aria-hidden="true" className="h-3 w-px bg-fd-border" />
            <span className="inline-flex items-center gap-1.5 px-3.5">MIT license</span>
            <span aria-hidden="true" className="h-3 w-px bg-fd-border" />
            <span className="inline-flex items-center gap-1.5 px-3.5">
              Claude Code ≥ {SITE.ccVersion}
            </span>
          </div>
        </div>
      </section>

      <LibraryCatalog tab={libraryTab} />
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

          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {RECIPES.map((r, idx) => (
              <Link
                key={r.href}
                href={r.href}
                className="group relative flex min-h-[148px] flex-col rounded-[10px] border border-fd-border bg-[var(--color-fd-surface-raised)] p-5 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-fd-primary)_40%,var(--color-fd-border))] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
              >
                <div className="mb-3 flex items-center justify-between font-mono text-[11px] tracking-[0.05em] text-fd-muted-foreground">
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
    </main>
  );
}
