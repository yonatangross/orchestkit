import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { CopyInstallButton } from "./copy-button";
import { SITE, COUNTS } from "@/lib/constants";
import { COMPOSITIONS } from "@/lib/generated/compositions-data";
import { OptimizedThumbnail } from "@/components/optimized-thumbnail";
import { AnimateOnView } from "@/components/animate-on-view";

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

const formatStars = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

export default async function HomePage() {
  const stars = await getStarCount();
  const primitiveTotal = COUNTS.skills + COUNTS.agents + COUNTS.hooks;

  return (
    <main>
      {/* ============ HERO ============ */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-fd-border"
      >
        {/* Radial emerald gradient top-center */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, var(--color-fd-primary-10) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 50% 10%, var(--color-fd-primary-5) 0%, transparent 70%)",
          }}
        />
        {/* Dot grid motif */}
        <div aria-hidden="true" className="absolute inset-0 bg-dot-grid opacity-60" />

        <div className="relative mx-auto max-w-[1200px] px-7 py-24 sm:py-28 text-center">
          <AnimateOnView>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] px-2.5 py-1.5 font-mono text-[12px] font-medium text-fd-primary">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-fd-primary"
                style={{ boxShadow: "0 0 0 3px var(--color-fd-primary-20)" }}
              />
              The complete AI development toolkit for Claude Code
            </span>
          </AnimateOnView>

          <AnimateOnView delay={100} className="mt-5">
            <h1
              id="hero-heading"
              className="text-fluid-h1 font-semibold leading-[1.02] tracking-[-0.025em] text-fd-foreground"
            >
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, var(--color-fd-foreground) 0%, color-mix(in oklch, var(--color-fd-foreground) 70%, var(--color-fd-muted-foreground)) 100%)",
                }}
              >
                Stop explaining your stack.
              </span>
              <br />
              Start shipping.
            </h1>
          </AnimateOnView>

          <AnimateOnView delay={200} className="mt-5">
            <p className="mx-auto max-w-[620px] text-[clamp(0.95rem,0.3vw+0.9rem,1.125rem)] leading-[1.55] text-fd-muted-foreground">
              <span className="font-mono text-[0.92em] font-medium text-fd-foreground">
                {COUNTS.skills} skills
              </span>
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-mono text-[0.92em] font-medium text-fd-foreground">
                {COUNTS.agents} agents
              </span>
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-mono text-[0.92em] font-medium text-fd-foreground">
                {COUNTS.hooks} hooks
              </span>
              {" "}— loaded on demand, zero runtime cost.
            </p>
          </AnimateOnView>

          <AnimateOnView delay={300} className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-fd-primary px-[18px] text-sm font-medium text-fd-primary-foreground transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.54_0.15_163)] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
            >
              Get started{" "}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <CopyInstallButton />
            <Link
              href="#cookbook"
              className="inline-flex h-10 items-center rounded-lg border border-fd-border bg-transparent px-[18px] text-sm font-medium text-fd-foreground transition-colors hover:border-[var(--color-fd-primary-30)] hover:bg-fd-muted"
            >
              See the cookbook
            </Link>
          </AnimateOnView>

          <AnimateOnView delay={400} className="mt-7 flex flex-wrap items-center justify-center font-mono text-[12px] text-fd-muted-foreground">
            <a
              href={`${SITE.github}/stargazers`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 transition-colors hover:text-fd-foreground"
            >
              <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {stars !== null ? (
                <>
                  <span className="font-medium text-fd-foreground tabular-nums">{formatStars(stars)}</span>
                  <span>stars</span>
                </>
              ) : (
                <span>Star on GitHub</span>
              )}
            </a>
            <span aria-hidden="true" className="h-3 w-px bg-fd-border" />
            <span className="inline-flex items-center gap-1.5 px-3.5">MIT license</span>
            <span aria-hidden="true" className="h-3 w-px bg-fd-border" />
            <span className="inline-flex items-center gap-1.5 px-3.5">Claude Code ≥ {SITE.ccVersion}</span>
          </AnimateOnView>
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
            <span id="personas-heading" className="font-mono text-[13px] text-fd-muted-foreground">
              Pick your entry point
            </span>
          </div>
          <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] md:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative border-fd-border p-[26px_28px] transition-colors hover:bg-[color-mix(in_oklch,var(--color-fd-primary)_3%,var(--color-fd-surface-raised))] md:border-l md:first:border-l-0 border-t md:border-t-0 first:border-t-0 border-l-[3px] border-l-transparent hover:border-l-fd-primary"
              >
                <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.04em] text-fd-muted-foreground">
                  {p.eyebrow}
                </div>
                <div className="mb-1.5 text-base font-semibold tracking-[-0.01em] text-fd-foreground">
                  {p.title}
                </div>
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
              <Link
                key={p.letter}
                href={p.href}
                className="group relative overflow-hidden rounded-[10px] border border-fd-border bg-[var(--color-fd-surface-raised)] p-5 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-fd-primary)_40%,var(--color-fd-border))] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
              >
                {/* Top-accent shimmer on hover */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--color-fd-primary) 40%, transparent) 50%, transparent 100%)",
                  }}
                />
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
                  <span className="tabular-nums">{p.count}</span>
                  <span className="text-[0.5em] font-normal tracking-normal text-fd-muted-foreground">
                    {p.unit}
                  </span>
                </div>
                <h3 className="mt-2.5 mb-2 text-base font-semibold text-fd-foreground">{p.title}</h3>
                <p className="text-[13px] leading-[1.55] text-fd-muted-foreground">{p.desc}</p>
              </Link>
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
            {RECIPES.map((r, i) => (
              <Link
                key={r.href}
                href={r.href}
                className="group relative flex min-h-[148px] flex-col rounded-[10px] border border-fd-border bg-[var(--color-fd-surface-raised)] p-5 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-fd-primary)_40%,var(--color-fd-border))] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
              >
                <div className="mb-3 flex items-center justify-between font-mono text-[11px] tracking-[0.05em] text-fd-muted-foreground">
                  <span className="tabular-nums">
                    {String(i + 1).padStart(2, "0")} / {String(RECIPES.length).padStart(2, "0")}
                  </span>
                  {r.badge ? (
                    <span className="rounded border border-[var(--color-fd-primary-20)] bg-[var(--color-fd-primary-10)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-fd-primary">
                      {r.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mb-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-fd-foreground">
                  {r.title}
                </div>
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

      {/* ============ DEMO SHOWCASE (kept from prior landing) ============ */}
      <section aria-labelledby="demos-heading" className="border-b border-fd-border">
        <div className="mx-auto max-w-[1200px] px-7 py-16">
          <div className="mb-[18px] flex items-baseline justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
                <span aria-hidden="true" className="h-px w-2.5 bg-fd-muted-foreground opacity-50" />
                Demos
              </span>
              <h2
                id="demos-heading"
                className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fd-foreground"
              >
                See it in action
              </h2>
            </div>
            <Link
              href="/docs/reference"
              className="font-mono text-[13px] text-fd-primary transition-colors hover:text-[var(--color-fd-primary-50)]"
            >
              View all →
            </Link>
          </div>
          <div className="flex gap-[14px] overflow-x-auto pb-4">
            {COMPOSITIONS.filter((c) => c.format === "landscape" && c.videoCdn)
              .slice(0, 6)
              .map((comp) => (
                <Link
                  key={comp.id}
                  href="/docs/reference"
                  className="group w-[260px] flex-none overflow-hidden rounded-[10px] border border-fd-border bg-[var(--color-fd-surface-raised)] transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-fd-primary)_40%,var(--color-fd-border))] hover:shadow-[0_0_0_4px_var(--color-fd-glow)]"
                >
                  <div className="relative aspect-video bg-fd-background">
                    <OptimizedThumbnail
                      src={comp.thumbnailCdn ?? `/thumbnails/${comp.id}.png`}
                      alt={`${comp.id.replace(/([A-Z])/g, " $1").trim()} — ${comp.durationSeconds}s demo`}
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                      {comp.durationSeconds}s
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-fd-foreground">
                      {comp.id.replace(/([A-Z])/g, " $1").trim()}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-fd-muted-foreground">{comp.command}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-7 py-5 text-[13px] text-fd-muted-foreground">
          <span>
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
          <nav aria-label="Footer" className="flex gap-5">
            <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="hover:text-fd-foreground">
              GitHub
            </a>
            <Link href="/docs/getting-started/installation" className="hover:text-fd-foreground">
              Docs
            </Link>
            <Link href="#cookbook" className="hover:text-fd-foreground">
              Cookbook
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
