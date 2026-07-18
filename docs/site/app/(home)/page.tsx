import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Ban } from "lucide-react";
import { CopyInstallButton } from "./copy-button";
import { SITE, COUNTS } from "@/lib/constants";
import { formatStars } from "@/lib/format-stars";
import { AgentReadinessSection } from "@/components/agent-readiness-section";
import { HomepageStructuredData } from "@/components/structured-data";
import FactoryRide from "@/components/world/factory-ride";
import { GeorgeMark } from "@/components/world/george";
// D2 motion components (#2991). NumberTicker + MagicCard are used by the
// primitives cards below the ride. FlickeringGrid is intentionally NOT
// imported: it was the hero's ambient layer, and the factory ride now owns
// that surface.
import { NumberTicker } from "@/components/lab/number-ticker";
import { MagicCard } from "@/components/lab/magic-card";

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

const PRIMITIVES = [
  {
    letter: "S",
    tag: "/ork",
    title: "Skills",
    count: COUNTS.skills,
    unit: "modules",
    desc: (
      <>
        Reusable knowledge modules — auth patterns, migrations, API design.{" "}
        <span className="font-mono text-fd-foreground">{COUNTS.commands} commands</span> +{" "}
        <span className="font-mono text-fd-foreground">{COUNTS.skills - COUNTS.commands} auto-injected</span>{" "}
        references.
      </>
    ),
    href: "/docs/reference/skills",
  },
  {
    letter: "A",
    tag: "@agent",
    title: "Agents",
    count: COUNTS.agents,
    unit: "personas",
    desc: "Specialized AI personas — security auditors, frontend devs, DB engineers. Curated tools and skills per agent.",
    href: "/docs/reference/agents",
  },
  {
    letter: "H",
    tag: "lifecycle",
    title: "Hooks",
    count: COUNTS.hooks,
    unit: "hooks",
    desc: "TypeScript lifecycle automation — block dangerous commands, inject context, enforce security. Non-blocking.",
    href: "/docs/reference/hooks",
  },
] as const;

const PERSONAS = [
  {
    eyebrow: "01 / New here",
    title: "New to OrchestKit?",
    desc: "Install and ship your first feature in under 5 minutes.",
    cta: "Get started",
    href: "/docs/getting-started/installation",
  },
  {
    eyebrow: "02 / Evaluating",
    title: "Evaluating for your team?",
    desc: `${COUNTS.hooks} hooks enforce security and quality automatically. Zero config.`,
    cta: "See the guardrails",
    href: "/docs/reference/hooks",
  },
  {
    eyebrow: "03 / Existing user",
    title: "Already using Claude Code?",
    desc: `${COUNTS.agents} parallel specialist agents, 3-tier memory, keyword activation.`,
    cta: "What OrchestKit adds",
    href: "/docs/foundations/overview",
  },
] as const;

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

export default async function HomePage() {
  const stars = await getStarCount();
  const primitiveTotal = COUNTS.skills + COUNTS.agents + COUNTS.hooks;

  return (
    <main>
      <HomepageStructuredData starCount={stars} />
      {/* George — the yonyon husky, gold-ring badge bottom-right */}
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
      {/* ============ HERO — the factory ride ============
          Sticky canvas-scrub ride (components/world/factory-ride.tsx).
          All overlay copy below is server-rendered and passed in as props,
          so every headline, link and CTA is in the raw HTML — which is what
          raw-HTML scrapers and LLM crawlers read.
          Caveat, deliberately stated: once JS runs, the ride layout hides
          stops 2-5 (visibility:hidden) until scroll reveals them, so a
          render-then-index crawler sees only the first stop above the fold.
          The load-bearing copy (h1, counts, install command, primary CTAs)
          lives in stop 1 for exactly that reason. */}
      <section aria-labelledby="hero-heading">
        <FactoryRide
          hero={
            <div className="mx-auto max-w-[880px] text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.62_0.2_264/0.35)] bg-[oklch(0.62_0.2_264/0.14)] px-2.5 py-1.5 font-mono text-[12px] font-medium text-[oklch(0.82_0.08_270)]">
                <GeorgeMark />
                The complete AI development toolkit for Claude Code
              </span>

              <h1
                id="hero-heading"
                data-speakable-headline
                className="mt-5 text-fluid-h1 font-semibold leading-[1.02] tracking-[-0.025em] text-[oklch(0.93_0.012_270)]"
              >
                {/* Brand in the H1 itself (SSR, no JS) so AI crawlers + agent-readiness
                    scanners read the product name in the top heading — accessible name
                    becomes "OrchestKit — Stop explaining your stack. Start shipping."
                    without altering the visual hero. */}
                <span className="sr-only">OrchestKit — </span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, oklch(0.96 0.006 270) 0%, oklch(0.78 0.02 264) 100%)",
                  }}
                >
                  Stop explaining your stack.
                </span>
                <br />
                <span className="headline-trace">Start shipping.</span>
              </h1>

              <p
                data-speakable-summary
                className="mx-auto mt-4 max-w-[620px] text-[clamp(0.95rem,0.3vw+0.9rem,1.125rem)] leading-[1.55] text-[oklch(0.86_0.015_264)] [text-wrap:balance]"
              >
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
                  <span className="text-[var(--yy-george-warm)]">{COUNTS.skills}</span>{" "}
                  <span className="text-[oklch(0.95_0.008_270)]">skills</span>
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
                  <span className="text-[var(--yy-george-cool)]">{COUNTS.agents}</span>{" "}
                  <span className="text-[oklch(0.95_0.008_270)]">agents</span>
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
                  <span className="text-[oklch(0.74_0.14_290)]">{COUNTS.hooks}</span>{" "}
                  <span className="text-[oklch(0.95_0.008_270)]">hooks</span>
                </span>
                <span className="mt-1 block text-[0.9em]">
                  Loaded on demand, zero runtime cost.
                </span>
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  href="/docs/getting-started/first-10-minutes"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[oklch(0.62_0.2_264)] px-[18px] text-sm font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.66_0.19_264)] hover:shadow-[0_0_0_4px_oklch(0.62_0.2_264/0.25)]"
                >
                  Get started{" "}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <CopyInstallButton />
                <Link
                  href="#cookbook"
                  className="inline-flex h-10 items-center rounded-lg border border-[oklch(1_0_0/0.16)] bg-transparent px-[18px] text-sm font-medium text-[oklch(0.93_0.012_270)] transition-colors hover:border-[oklch(1_0_0/0.3)] hover:bg-[oklch(1_0_0/0.06)]"
                >
                  See the cookbook
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center font-mono text-[12px] text-[oklch(0.86_0.015_264)]">
                <a
                  href={`${SITE.github}/stargazers`}
                  target="_blank"
                  rel="noopener noreferrer"
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
                <span aria-hidden="true" className="h-3 w-px bg-[oklch(1_0_0/0.16)]" />
                <span className="inline-flex items-center gap-1.5 px-3.5">MIT license</span>
                <span aria-hidden="true" className="h-3 w-px bg-[oklch(1_0_0/0.16)]" />
                <span className="inline-flex items-center gap-1.5 px-3.5">Claude Code ≥ {SITE.ccVersion}</span>
              </div>
            </div>
          }
          cards={[
            <div className="fr-card" key="hooks">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
                The intake scanners
              </div>
              <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
                {COUNTS.hooks}
                <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">hooks</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
                Every action, inspected
              </h2>
              <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
                TypeScript lifecycle hooks gate each tool call: dangerous commands blocked,
                context injected, security enforced. Non-blocking by design.
              </p>
              <div className="mt-3.5 inline-flex items-center gap-2 rounded-[9px] border border-[oklch(0.63_0.2_25/0.35)] bg-[oklch(0.63_0.2_25/0.12)] px-3 py-2 font-mono text-xs text-[oklch(0.86_0.07_20)]">
                <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>rm -rf /</span>
                <span className="opacity-60">→ diverted before execution</span>
              </div>
              <div className="mt-4">
                <Link
                  href="/docs/reference/hooks"
                  className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
                >
                  /docs/reference/hooks
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>,
            <div className="fr-card" key="agents">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
                The assembly bay
              </div>
              <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
                {COUNTS.agents}
                <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">agents</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
                Specialists, in parallel
              </h2>
              <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
                Security auditors, frontend devs, DB engineers, working simultaneously in
                isolated worktrees, each with curated tools and skills.
              </p>
              <div className="mt-4">
                <Link
                  href="/docs/reference/agents"
                  className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
                >
                  /docs/reference/agents
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>,
            <div className="fr-card" key="skills">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
                The tool wall
              </div>
              <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
                {COUNTS.skills}
                <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">skills</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
                Knowledge, on pegs
              </h2>
              <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
                Auth patterns, migrations, API design, reusable modules that load only when
                the work needs them.
              </p>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {["/ork:implement", "/ork:review-pr", "/ork:brainstorm", `+${COUNTS.skills - 3}`].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-[7px] border border-[oklch(0.76_0.06_220/0.3)] bg-[oklch(1_0_0/0.08)] px-2 py-1 font-mono text-[11.5px] text-[oklch(0.84_0.03_220)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <Link
                  href="/docs/reference/skills"
                  className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
                >
                  /docs/reference/skills
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>,
          ]}
          finale={
            <div className="mx-auto max-w-[760px] text-center">
              <span className="inline-flex items-center gap-2.5 rounded-xl border border-[oklch(0.62_0.2_264/0.4)] bg-[oklch(0.62_0.2_264/0.14)] px-[18px] py-2.5 font-mono text-sm font-semibold tracking-[0.06em] text-[oklch(0.85_0.06_270)] shadow-[0_0_50px_oklch(0.62_0.2_264/0.25)]">
                <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                VERIFIED · MERGED
              </span>
              <h2 className="mt-5 text-[clamp(30px,4.6vw,52px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[oklch(0.95_0.008_270)]">
                Your change ships in a sealed crate.
              </h2>
              <p className="mt-3 text-base text-[oklch(0.86_0.015_264)]">
                Tests, security scans and quality gates, passed before the dock doors open.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  href="/docs/getting-started/first-10-minutes"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[oklch(0.62_0.2_264)] px-[18px] text-sm font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.66_0.19_264)] hover:shadow-[0_0_0_4px_oklch(0.62_0.2_264/0.25)]"
                >
                  Get started{" "}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <CopyInstallButton />
              </div>
            </div>
          }
        />
      </section>

      {/* ============ WHAT IS (definitional, SSR — agent/LLM extractable) ============ */}
      <section aria-labelledby="what-heading" className="border-b border-fd-border">
        <div className="mx-auto max-w-[820px] px-7 py-14">
          <h2 id="what-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
            What is OrchestKit?
          </h2>
          <p className="mt-3 leading-7 text-fd-muted-foreground">
            OrchestKit is a free, open-source (MIT) plugin for{" "}
            <a href="https://www.anthropic.com/claude-code" className="text-fd-primary underline underline-offset-2">Claude Code</a>,
            Anthropic's agentic command-line coding tool. It packages{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.skills} skills</span>,{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.agents} agents</span>, and{" "}
            <span className="font-mono text-fd-foreground">{COUNTS.hooks} lifecycle hooks</span>{" "}
            into a single install — encoding security patterns and quality gates so the agent works to your standards out of the box. It runs locally inside Claude Code; it is not a hosted service and not an editor autocomplete.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            <div>
              <h3 className="font-semibold text-fd-foreground">Skills · {COUNTS.skills}</h3>
              <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">Reusable knowledge modules for auth, migrations, API design, testing, and review — loaded on demand at zero runtime cost.</p>
            </div>
            <div>
              <h3 className="font-semibold text-fd-foreground">Agents · {COUNTS.agents}</h3>
              <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">Specialist personas — security auditors, backend architects, frontend devs — each with curated tools and skills, run in parallel.</p>
            </div>
            <div>
              <h3 className="font-semibold text-fd-foreground">Hooks · {COUNTS.hooks}</h3>
              <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">TypeScript lifecycle automation that blocks dangerous commands, injects context, and enforces security — non-blocking, automatic.</p>
            </div>
          </div>
          <p className="mt-7 leading-7 text-fd-muted-foreground">
            <strong className="text-fd-foreground">How it compares:</strong> unlike editor assistants such as Cursor or GitHub Copilot — which autocomplete inside the IDE — OrchestKit operates at the agent layer, making Claude Code more capable rather than typing alongside you. Install with{" "}
            <span className="font-mono text-fd-foreground">{SITE.installCommand}</span>. See the{" "}
            <Link href="/compare" className="text-fd-primary underline underline-offset-2">full comparison</Link>.
          </p>
        </div>
      </section>

      {/* ============ VALUE-PROP STRIP ============ */}
      <section
        aria-labelledby="personas-heading"
        className="border-b border-fd-border bg-[var(--color-fd-surface-sunken)] py-11"
      >
        <div className="mx-auto max-w-[1200px] px-7">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
              <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
              Paths / 03
            </span>
            <h2 id="personas-heading" className="font-mono text-[13px] font-normal text-fd-muted-foreground">
              Pick your entry point
            </h2>
          </div>
          <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] md:grid-cols-3">
            {PERSONAS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative border-fd-border p-[26px_28px] transition-colors hover:bg-[color-mix(in_oklch,var(--color-fd-primary)_3%,var(--color-fd-surface-raised))] md:border-l md:first:border-l-0 border-t md:border-t-0 first:border-t-0 border-l-[3px] border-l-transparent hover:border-l-fd-primary"
              >
                <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.04em] text-fd-muted-foreground">
                  {p.eyebrow}
                </div>
                <h3 className="mb-1.5 text-base font-semibold tracking-[-0.01em] text-fd-foreground">
                  {p.title}
                </h3>
                <p className="mb-3.5 min-h-10 text-[13.5px] leading-[1.5] text-fd-muted-foreground">{p.desc}</p>
                <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-medium text-fd-primary">
                  {p.cta}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-[3px]"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COOKBOOK (primitives + recipes) ============ */}
      <section aria-labelledby="cookbook-heading" className="border-b border-fd-border" id="cookbook">
        <div className="mx-auto max-w-[1200px] px-7 py-[72px]">
          {/* Primitives */}
          <div className="mb-[18px] flex items-baseline justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
                <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
                Primitives / 03
              </span>
              <h2
                id="cookbook-heading"
                className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground"
              >
                The building blocks
              </h2>
            </div>
            <span className="font-mono text-[13px] text-fd-muted-foreground">
              <span className="tabular-nums">{primitiveTotal}</span> total
            </span>
          </div>

          <div className="mb-11 grid grid-cols-1 gap-[14px] md:grid-cols-3">
            {PRIMITIVES.map((p) => (
              // MagicCard adds the pointer-tracking spotlight overlay only; its
              // own border/bg/rounded chrome is neutralized so the Link keeps
              // the merged D1 card-trace / card-lift treatment intact.
              <MagicCard
                key={p.letter}
                className="rounded-[var(--radius-card)] border-0 bg-transparent"
              >
                <Link
                  href={p.href}
                  className="group card-elevated card-trace card-lift relative block h-full overflow-hidden rounded-[var(--radius-card)] border border-fd-border bg-[var(--color-fd-surface-raised)] p-5"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div
                      aria-hidden="true"
                      className="grid h-[38px] w-[38px] place-items-center rounded-lg border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] font-mono text-[17px] font-semibold text-fd-primary"
                    >
                      {p.letter}
                    </div>
                    <div className="pt-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-fd-muted-foreground">
                      {p.tag}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 font-mono text-[clamp(2rem,2vw+1.2rem,2.75rem)] font-medium leading-none tracking-[-0.03em] text-fd-foreground">
                    <NumberTicker value={p.count} />
                    <span className="text-[0.5em] font-normal tracking-normal text-fd-muted-foreground">
                      {p.unit}
                    </span>
                  </div>
                  <h3 className="mt-2.5 mb-2 text-base font-semibold text-fd-foreground">{p.title}</h3>
                  <p className="text-[13px] leading-[1.55] text-fd-muted-foreground">{p.desc}</p>
                </Link>
              </MagicCard>
            ))}
          </div>

          {/* Recipes */}
          <div className="mb-[18px] flex items-baseline justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
                <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
                Recipes / {String(RECIPES.length).padStart(2, "0")}
              </span>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground">Cookbook</h2>
            </div>
            <Link
              href="/docs/cookbook/implement-feature"
              className="font-mono text-[13px] text-fd-primary transition-colors hover:text-[var(--color-fd-primary-50)]"
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

      {/* ============ WHY ORCHESTKIT ============ */}
      <section aria-labelledby="why-heading" className="border-b border-fd-border">
        <div className="mx-auto max-w-[1200px] px-7 py-16 sm:py-20">
          <h2
            id="why-heading"
            className="text-2xl font-semibold tracking-tight text-fd-foreground"
          >
            Why OrchestKit
          </h2>
          <p className="mt-3 max-w-[680px] leading-7 text-fd-muted-foreground">
            OrchestKit is built for Claude Code developers. Unlike editor
            assistants such as Cursor or GitHub Copilot — which autocomplete
            inside your IDE — OrchestKit operates at the agent layer, making the
            Claude Code agent more capable with {COUNTS.skills} curated skills,{" "}
            {COUNTS.agents} specialist agents, and {COUNTS.hooks} guardrail hooks.
            It is free, open source, and runs locally. See the{" "}
            <Link href="/compare" className="text-fd-primary underline underline-offset-2">
              side-by-side comparison
            </Link>{" "}
            or read{" "}
            <Link href="/about" className="text-fd-primary underline underline-offset-2">
              about the project
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center rounded-lg bg-fd-primary px-[18px] text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-[oklch(0.54_0.15_264)]"
            >
              Get started
            </Link>
            <Link
              href="/compare"
              className="inline-flex h-10 items-center rounded-lg border border-fd-border px-[18px] text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
            >
              Compare
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-lg border border-fd-border px-[18px] text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
            >
              Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOR AI AGENTS (SSR, text-dense) ============ */}
      <AgentReadinessSection />

      {/* ============ WHAT IS ORCHESTKIT (SSR prose — semantic indexability) ============
          Server-rendered plain-text answers; RAG indexers and search engines read raw
          HTML, so this section carries the canonical name-based descriptions. */}
      <section className="border-t border-fd-border">
        <div className="mx-auto max-w-[1200px] px-7 py-12">
          <h2 className="text-lg font-semibold">What is OrchestKit?</h2>
          <div className="mt-4 grid gap-6 text-sm leading-relaxed text-fd-muted-foreground md:grid-cols-2">
            <p>
              OrchestKit is a free, MIT-licensed plugin for Claude Code, Anthropic&apos;s
              agentic coding CLI. It packages {COUNTS.skills} reusable skills,{" "}
              {COUNTS.agents} specialist agents, and {COUNTS.hooks} lifecycle hooks into a
              single install, so the agent applies proven auth, migration, API-design,
              testing, and security patterns to your codebase without being re-taught
              every session. It runs entirely inside Claude Code — there is no hosted
              service, no account, and no telemetry requirement.
            </p>
            <p>
              OrchestKit is built and maintained by Yonyon, the software studio of
              Yonatan Gross. Developer resources live at predictable URLs: the{" "}
              <Link href="/docs/getting-started/installation" className="underline decoration-fd-border underline-offset-4 hover:text-fd-primary">
                documentation
              </Link>
              , the{" "}
              <Link href="/developers" className="underline decoration-fd-border underline-offset-4 hover:text-fd-primary">
                developer resource hub
              </Link>{" "}
              (OpenAPI spec, MCP server, SDK packages, auth and API policy), and the{" "}
              <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="underline decoration-fd-border underline-offset-4 hover:text-fd-primary">
                open-source repository on GitHub
              </a>
              . AI agents can query the docs through the NLWeb /ask endpoint or the
              OrchestKit Docs MCP server, hosted and as a Docker image.
            </p>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-7 py-5 text-[13px] text-fd-muted-foreground">
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
            {" · "}
            Designed with{" "}
            <a
              href="https://claude.ai/design"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-fd-border underline-offset-4 hover:text-fd-primary"
            >
              Claude Design
            </a>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="hover:text-fd-foreground">
              GitHub
            </a>
            <Link href="/docs/getting-started/installation" className="hover:text-fd-foreground">
              Docs
            </Link>
            <Link href="/developers" className="hover:text-fd-foreground">
              Developers
            </Link>
            <Link href="/best-claude-code-plugins" className="hover:text-fd-foreground">
              Best Plugins
            </Link>
            <Link href="/claude-agent-sdk-vs-claude-code-plugins" className="hover:text-fd-foreground">
              vs Agent SDK
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
            <Link href="/contact" className="hover:text-fd-foreground">
              Contact
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
