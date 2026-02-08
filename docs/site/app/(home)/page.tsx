import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CopyInstallButton } from "./copy-button";
import { SITE, COUNTS } from "@/lib/constants";
import { COMPOSITIONS } from "@/lib/playground-data";

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
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="mx-auto max-w-[980px] px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-20">
        <div className="animate-fade-in mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-fd-border px-3.5 py-1 text-xs text-fd-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            v{SITE.version} &middot; Claude Code {SITE.ccVersion}
          </span>
        </div>

        <h1 id="hero-heading" className="animate-fade-in delay-100 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Stop explaining your stack.
          <br />
          <span className="text-fd-primary">Start shipping.</span>
        </h1>

        <p className="animate-fade-in delay-200 mx-auto mt-6 max-w-[540px] text-fd-muted-foreground sm:text-lg">
          {COUNTS.skills} skills, {COUNTS.agents} agents, and {COUNTS.hooks} hooks that turn Claude Code into
          a full development team.
        </p>

        <div className="animate-fade-in delay-300 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/docs/getting-started/first-10-minutes"
            className="inline-flex h-10 items-center rounded-md bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground shadow-sm transition-colors hover:bg-fd-primary/90"
          >
            Get Started
          </Link>
          <CopyInstallButton />
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Quick statistics" className="border-y border-fd-border">
        <dl className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-fd-border text-center">
          {([
            [COUNTS.skills, "Skills"],
            [COUNTS.agents, "Agents"],
            [COUNTS.hooks, "Hooks"],
          ] as const).map(([n, label]) => (
            <div key={label} className="py-6 sm:py-8">
              <dt className="text-xs font-medium text-fd-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Category Distribution */}
      <section aria-label="Skill categories" className="bg-fd-card/30">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries({
              Backend: { count: 38, color: "bg-amber-500" },
              Frontend: { count: 32, color: "bg-blue-500" },
              "AI / LLM": { count: 35, color: "bg-cyan-500" },
              Security: { count: 12, color: "bg-red-500" },
              DevOps: { count: 18, color: "bg-orange-500" },
              Testing: { count: 22, color: "bg-emerald-500" },
              Product: { count: 16, color: "bg-pink-500" },
              Workflows: { count: 27, color: "bg-violet-500" },
            }).map(([label, { count, color }]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span>{label}</span>
                <span className="font-medium tabular-nums text-fd-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Primitives */}
      <section aria-labelledby="primitives-heading" className="mx-auto max-w-[980px] px-6 py-16 sm:py-20">
        <h2 id="primitives-heading" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Three primitives, infinite workflows
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-fd-muted-foreground">
          Everything in OrchestKit composes from these building blocks.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PRIMITIVES.map((item) => (
            <Link
              key={item.letter}
              href={item.href}
              className="group rounded-lg border border-fd-border p-6 transition-colors hover:bg-fd-accent"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-fd-border font-mono text-sm font-bold text-fd-primary" aria-hidden="true">
                {item.letter}
              </div>
              <h3 className="font-semibold">
                {item.count} {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">
                {item.desc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-fd-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden="true">
                Browse all &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Demo Showcase */}
      <section aria-labelledby="demos-heading" className="border-t border-fd-border bg-fd-card/50">
        <div className="mx-auto max-w-[980px] px-6 py-16 sm:py-20">
          <h2 id="demos-heading" className="mb-2 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            See it in action
          </h2>
          <p className="mx-auto mb-8 max-w-md text-center text-fd-muted-foreground">
            Every command skill comes with a demo composition.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {COMPOSITIONS.filter(c => c.format === "landscape").slice(0, 6).map((comp) => (
              <Link
                key={comp.id}
                href="/docs/reference"
                className="group flex-none w-[280px] rounded-lg border border-fd-border overflow-hidden transition-colors hover:bg-fd-accent"
              >
                <div className="aspect-video bg-fd-secondary relative">
                  <img
                    src={comp.thumbnailCdn ?? `/thumbnails/${comp.id}.png`}
                    alt={comp.id}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                    {comp.durationSeconds}s
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium">{comp.id.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <p className="mt-0.5 text-xs text-fd-muted-foreground font-mono">{comp.command}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/docs/reference"
              className="text-sm text-fd-primary hover:underline"
            >
              View all compositions &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Quick paths */}
      <section aria-labelledby="quickpaths-heading" className="border-t border-fd-border bg-fd-card/50">
        <div className="mx-auto max-w-[980px] px-6 py-16 sm:py-20">
          <h2 id="quickpaths-heading" className="mb-8 text-center text-2xl font-bold tracking-tight">
            Jump right in
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_PATHS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-lg border border-fd-border px-4 py-4 transition-colors hover:bg-fd-accent"
              >
                <div>
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <div className="text-sm text-fd-muted-foreground">{item.desc}</div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-fd-primary"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-fd-border">
        <div className="mx-auto flex max-w-[980px] items-center justify-between px-6 py-6 text-sm text-fd-muted-foreground">
          <span>
            Built with{" "}
            <a href="https://fumadocs.dev" target="_blank" rel="noopener noreferrer" className="text-fd-foreground underline decoration-fd-border underline-offset-4 hover:decoration-fd-primary">
              Fumadocs
            </a>
          </span>
          <nav aria-label="Footer" className="flex gap-5">
            <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="hover:text-fd-foreground">GitHub</a>
            <Link href="/docs/foundations/overview" className="hover:text-fd-foreground">Docs</Link>
            <Link href="/docs/cookbook/implement-feature" className="hover:text-fd-foreground">Cookbook</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
