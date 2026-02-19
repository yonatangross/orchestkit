import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CopyInstallButton } from "./copy-button";
import { SITE, COUNTS } from "@/lib/constants";
import { COMPOSITIONS } from "@/lib/generated/compositions-data";
import { OptimizedThumbnail } from "@/components/optimized-thumbnail";

const PRIMITIVES = [
  {
    letter: "S",
    title: "Skills",
    count: COUNTS.skills,
    desc: "Reusable knowledge modules — auth patterns, migrations, API design. 24 commands + 175 auto-injected references.",
    href: "/docs/reference/skills",
  },
  {
    letter: "A",
    title: "Agents",
    count: COUNTS.agents,
    desc: "Specialized AI personas — security auditors, frontend devs, DB engineers. Curated tools and skills per agent.",
    href: "/docs/reference/agents",
  },
  {
    letter: "H",
    title: "Hooks",
    count: COUNTS.hooks,
    desc: "TypeScript lifecycle automation — block dangerous commands, inject context, enforce security. Non-blocking.",
    href: "/docs/reference/hooks",
  },
] as const;

const QUICK_PATHS = [
  { title: "3 Building Blocks", desc: "How Skills, Agents, and Hooks compose", href: "/docs/foundations/skills-agents-hooks" },
  { title: "First 10 Minutes", desc: "Install to first AI-assisted commit", href: "/docs/getting-started/first-10-minutes" },
  { title: "Find Your Path", desc: "Backend, Frontend, AI, or DevOps", href: "/docs/getting-started/navigating" },
  { title: "Cookbook", desc: "Real workflow walkthroughs", href: "/docs/cookbook/implement-feature" },
] as const;

export default function HomePage() {
  return (
    <main>
      {/* Hero — left-aligned, dot-grid background */}
      <section aria-labelledby="hero-heading" className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-[1024px] px-6 py-20">
          <div className="animate-fade-in stagger-1">
            <span className="overline">OrchestKit v{SITE.version}</span>
          </div>

          <h1 id="hero-heading" className="animate-fade-in stagger-2 mt-4 max-w-3xl text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl lg:text-6xl">
            Stop explaining your stack.
            <br />
            <span className="text-fd-primary">Start shipping.</span>
          </h1>

          <p className="animate-fade-in stagger-3 mt-6 max-w-lg text-[15px] text-fd-muted-foreground leading-relaxed">
            {COUNTS.skills} skills, {COUNTS.agents} agents, and {COUNTS.hooks} hooks that turn Claude Code into
            a full development team.
          </p>

          <div className="animate-fade-in stagger-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center rounded-lg bg-fd-primary px-6 text-sm font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/80"
            >
              Get Started
            </Link>
            <CopyInstallButton />
          </div>

          {/* Circuit-trace stat bar */}
          <div className="mt-16 hidden items-center justify-between border-t border-fd-border pt-8 max-w-2xl sm:flex" aria-label="Quick statistics">
            <div className="text-center">
              <dd className="font-mono text-[40px] font-bold tabular-nums text-fd-foreground leading-none">{COUNTS.skills}</dd>
              <dt className="mt-1 overline-muted">Skills</dt>
            </div>

            <div className="flex-1 mx-6 relative">
              <div className="circuit-line" />
              <div className="circuit-dot absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2" />
              <div className="circuit-dot absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="text-center">
              <dd className="font-mono text-[40px] font-bold tabular-nums text-fd-foreground leading-none">{COUNTS.agents}</dd>
              <dt className="mt-1 overline-muted">Agents</dt>
            </div>

            <div className="flex-1 mx-6 relative">
              <div className="circuit-line" />
              <div className="circuit-dot absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2" />
              <div className="circuit-dot absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="text-center">
              <dd className="font-mono text-[40px] font-bold tabular-nums text-fd-foreground leading-none">{COUNTS.hooks}</dd>
              <dt className="mt-1 overline-muted">Hooks</dt>
            </div>
          </div>

          {/* Mobile stats — stacked, no connectors */}
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-fd-border pt-6 sm:hidden" aria-label="Quick statistics">
            {([
              [COUNTS.skills, "Skills"],
              [COUNTS.agents, "Agents"],
              [COUNTS.hooks, "Hooks"],
            ] as const).map(([n, label]) => (
              <div key={label} className="text-center">
                <dd className="font-mono text-2xl font-bold tabular-nums text-fd-foreground">{n}</dd>
                <dt className="mt-0.5 overline-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Category Distribution */}
      <section aria-label="Skill categories" className="border-t border-fd-border bg-fd-card/50">
        <div className="mx-auto max-w-[1024px] px-6 py-5">
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries({
              Backend: 38,
              Frontend: 32,
              "AI / LLM": 35,
              Security: 12,
              DevOps: 18,
              Testing: 22,
              Product: 16,
              Workflows: 27,
            }).map(([label, count]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-fd-primary" />
                <span>{label}</span>
                <span className="font-mono font-medium tabular-nums text-fd-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Primitives — accent-border cards */}
      <section aria-labelledby="primitives-heading" className="border-t border-fd-border">
        <div className="mx-auto max-w-[1024px] px-6 py-12 sm:py-16">
          <span className="overline">Building Blocks</span>
          <h2 id="primitives-heading" className="mt-2 text-2xl font-semibold tracking-tight text-fd-foreground">
            Three primitives, infinite workflows
          </h2>
          <p className="mt-2 max-w-lg text-[15px] text-fd-muted-foreground">
            Everything in OrchestKit composes from these building blocks.
          </p>

          <div className="mt-8 grid gap-px sm:grid-cols-3">
            {PRIMITIVES.map((item) => (
              <Link
                key={item.letter}
                href={item.href}
                className="group border border-fd-border border-l-2 border-l-fd-primary bg-fd-card p-5 transition-colors duration-200 hover:bg-fd-secondary hover:border-l-fd-primary/80 sm:rounded-r-lg"
              >
                <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded border border-fd-border font-mono text-xs font-bold text-fd-primary" aria-hidden="true">
                  {item.letter}
                </div>
                <h3 className="font-semibold text-fd-foreground">
                  {item.count} {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fd-muted-foreground">
                  {item.desc}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-medium text-fd-primary opacity-0 transition-all duration-200 group-hover:opacity-100" aria-hidden="true">
                  Browse all
                  <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Showcase */}
      <section aria-labelledby="demos-heading" className="border-t border-fd-border">
        <div className="mx-auto max-w-[1024px] px-6 py-12 sm:py-16">
          <span className="overline">Demos</span>
          <h2 id="demos-heading" className="mt-2 text-2xl font-semibold tracking-tight text-fd-foreground">
            See it in action
          </h2>
          <p className="mt-2 max-w-md text-[15px] text-fd-muted-foreground">
            Every command skill comes with a demo composition.
          </p>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
            {COMPOSITIONS.filter(c => c.format === "landscape" && c.videoCdn).slice(0, 6).map((comp) => (
              <Link
                key={comp.id}
                href="/docs/reference"
                className="group flex-none w-[260px] border border-fd-border bg-fd-card overflow-hidden rounded-lg transition-colors hover:bg-fd-secondary"
              >
                <div className="aspect-video bg-fd-background relative">
                  <OptimizedThumbnail
                    src={comp.thumbnailCdn ?? `/thumbnails/${comp.id}.png`}
                    alt={comp.id}
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                    {comp.durationSeconds}s
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-fd-foreground">{comp.id.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <p className="mt-0.5 font-mono text-[11px] text-fd-muted-foreground">{comp.command}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link
              href="/docs/reference"
              className="font-mono text-[13px] text-fd-primary hover:text-fd-primary/80 transition-colors"
            >
              View all compositions &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Quick paths */}
      <section aria-labelledby="quickpaths-heading" className="border-t border-fd-border">
        <div className="mx-auto max-w-[1024px] px-6 py-12 sm:py-16">
          <span className="overline">Quick Start</span>
          <h2 id="quickpaths-heading" className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-fd-foreground">
            Jump right in
          </h2>
          <div className="grid gap-px sm:grid-cols-2">
            {QUICK_PATHS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between border border-fd-border bg-fd-card px-4 py-3.5 transition-colors duration-200 hover:bg-fd-secondary"
              >
                <div>
                  <h3 className="text-sm font-medium text-fd-foreground">{item.title}</h3>
                  <div className="text-[13px] text-fd-muted-foreground">{item.desc}</div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-fd-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-fd-primary"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-fd-border">
        <div className="mx-auto flex max-w-[1024px] items-center justify-between px-6 py-5 text-[13px] text-fd-muted-foreground">
          <span>
            Built with{" "}
            <a href="https://fumadocs.dev" target="_blank" rel="noopener noreferrer" className="text-fd-muted-foreground underline decoration-fd-border underline-offset-4 hover:text-fd-primary">
              Fumadocs
            </a>
          </span>
          <nav aria-label="Footer" className="flex gap-5">
            <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="hover:text-fd-muted-foreground">GitHub</a>
            <Link href="/docs/foundations/overview" className="hover:text-fd-muted-foreground">Docs</Link>
            <Link href="/docs/cookbook/implement-feature" className="hover:text-fd-muted-foreground">Cookbook</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
