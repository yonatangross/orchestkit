# Hero Section Mockups - All Three Concepts

All mockups use exact Tailwind v4 classes that map to the @theme tokens defined in each concept's CSS file.

---

## Concept A: Neon Command Center

```jsx
{/* Hero — Neon Command Center */}
<section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-void">
  {/* Particle canvas (JS-driven, or static dot-grid fallback) */}
  <div className="absolute inset-0 z-0 bg-dot-grid opacity-40" aria-hidden="true" />

  {/* Subtle radial glow behind content */}
  <div
    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-neon-blue/5 blur-[120px]"
    aria-hidden="true"
  />

  <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
    {/* Version badge */}
    <div className="animate-fade-in-up stagger-1">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-xs font-mono text-text-secondary backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-neon-green shadow-[0_0_8px_#10b98180]" />
        v6.0.3 &middot; Claude Code 2.1.34+
      </span>
    </div>

    {/* Headline */}
    <h1 className="animate-fade-in-up stagger-2 mt-8 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
      Stop explaining your stack.
      <br />
      <span className="bg-gradient-to-r from-neon-blue via-[#8b5cf6] to-neon-magenta bg-clip-text text-transparent">
        Start shipping.
      </span>
    </h1>

    {/* Subtitle */}
    <p className="animate-fade-in-up stagger-3 mx-auto mt-6 max-w-lg text-text-secondary sm:text-lg leading-relaxed">
      199 skills, 36 agents, and 119 hooks that turn Claude Code into
      a full development team.
    </p>

    {/* CTAs */}
    <div className="animate-fade-in-up stagger-4 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <a
        href="/docs/getting-started/first-10-minutes"
        className="inline-flex h-11 items-center rounded-lg bg-neon-blue px-8 text-sm font-semibold text-white shadow-[0_0_20px_#3b82f640] transition-all hover:bg-neon-blue-hover hover:shadow-[0_0_30px_#3b82f660]"
      >
        Get Started
      </a>
      <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-mono text-text-secondary transition-all hover:border-[#3b82f640] hover:text-text-primary">
        <span>claude install orchestkit/ork</span>
        <CopyIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
</section>

{/* Stat bar */}
<section className="relative border-y border-border bg-surface/60 backdrop-blur-md scanline-overlay" aria-label="Quick statistics">
  <dl className="relative z-10 mx-auto grid max-w-3xl grid-cols-3 divide-x divide-border text-center">
    {[
      { n: 199, label: "Skills", glow: "text-glow-blue" },
      { n: 36, label: "Agents", glow: "text-glow-green" },
      { n: 119, label: "Hooks", glow: "text-glow-magenta" },
    ].map(({ n, label, glow }) => (
      <div key={label} className="py-8">
        <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </dt>
        <dd className={`mt-1 font-mono text-3xl font-bold tabular-nums text-text-primary sm:text-4xl ${glow}`}>
          {n}
        </dd>
      </div>
    ))}
  </dl>
</section>
```

---

## Concept B: Obsidian Studio

```jsx
{/* Hero — Obsidian Studio */}
<section className="relative overflow-hidden py-24 sm:py-32 lg:py-40 bg-base noise-overlay">
  {/* Gradient mesh blobs */}
  <div className="absolute inset-0 -z-10 opacity-30 blur-[120px] overflow-hidden" aria-hidden="true">
    <div className="mesh-blob-1 absolute -top-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-teal" />
    <div className="mesh-blob-2 absolute -top-1/3 left-1/3 h-[600px] w-[600px] rounded-full bg-violet" />
    <div className="mesh-blob-3 absolute top-1/4 -right-1/4 h-[400px] w-[400px] rounded-full bg-amber" />
  </div>

  <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
    {/* Overline */}
    <div className="animate-fade-up delay-1">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-teal" />
        v6.0.3 &middot; Claude Code 2.1.34+
      </span>
    </div>

    {/* Headline */}
    <h1 className="animate-fade-up delay-2 mt-8 text-4xl font-extrabold tracking-[-0.04em] text-text-primary sm:text-5xl lg:text-7xl leading-[1.05]">
      Stop explaining your stack.
      <br />
      <span className="text-gradient-hero">Start shipping.</span>
    </h1>

    {/* Subtitle */}
    <p className="animate-fade-up delay-3 mx-auto mt-6 max-w-xl text-lg text-text-secondary leading-relaxed">
      199 skills, 36 agents, and 119 hooks that turn Claude Code into
      a full development team.
    </p>

    {/* CTAs */}
    <div className="animate-fade-up delay-4 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <a
        href="/docs/getting-started/first-10-minutes"
        className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-teal to-[#0d9488] px-8 text-sm font-semibold text-white shadow-lg shadow-[#14b8a620] transition-all duration-300 hover:shadow-xl hover:shadow-[#14b8a630] hover:brightness-110"
      >
        Get Started
      </a>
      <button className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-surface px-6 text-sm font-mono text-text-secondary transition-all duration-300 hover:border-border-warm hover:text-text-primary">
        <span>claude install orchestkit/ork</span>
        <CopyIcon className="h-4 w-4" />
      </button>
    </div>

    {/* Stat cards */}
    <div className="animate-fade-up delay-5 mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      {[
        { n: 199, label: "Skills", underline: "gradient-underline-teal" },
        { n: 36, label: "Agents", underline: "gradient-underline-amber" },
        { n: 119, label: "Hooks", underline: "gradient-underline-violet" },
      ].map(({ n, label, underline }) => (
        <div key={label} className="glass-card rounded-xl p-6 text-center">
          <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            {label}
          </dt>
          <dd className="mt-2 text-5xl font-extrabold tracking-tight text-text-primary">
            {n}
          </dd>
          <div className={`mx-auto mt-3 h-0.5 w-12 rounded-full ${underline}`} aria-hidden="true" />
        </div>
      ))}
    </div>
  </div>
</section>
```

---

## Concept C: Circuit Forge

```jsx
{/* Hero — Circuit Forge */}
<section className="relative min-h-[70vh] flex items-center overflow-hidden">
  {/* Dot grid background */}
  <div className="absolute inset-0 bg-dot-grid" aria-hidden="true" />

  <div className="relative z-10 mx-auto w-full max-w-[1024px] px-6 py-20">
    {/* Overline */}
    <div className="animate-fade-in stagger-1">
      <span className="overline">OrchestKit v6.0.3</span>
    </div>

    {/* Headline — LEFT aligned */}
    <h1 className="animate-fade-in stagger-2 mt-4 max-w-3xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
      Stop explaining your stack.
      <br />
      <span className="text-emerald">Start shipping.</span>
    </h1>

    {/* Subtitle */}
    <p className="animate-fade-in stagger-3 mt-6 max-w-lg text-[15px] text-text-secondary leading-relaxed">
      199 skills, 36 agents, and 119 hooks that turn Claude Code into
      a full development team.
    </p>

    {/* CTAs */}
    <div className="animate-fade-in stagger-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href="/docs/getting-started/first-10-minutes"
        className="inline-flex h-10 items-center rounded-lg bg-emerald px-6 text-sm font-semibold text-[#0c0f14] transition-colors hover:bg-emerald-hover"
      >
        Get Started
      </a>
      <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 font-mono text-sm text-text-secondary">
        <span>claude install orchestkit/ork</span>
        <button className="ml-2 text-text-muted hover:text-text-primary transition-colors" aria-label="Copy install command">
          <CopyIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    {/* Circuit-trace stat bar */}
    <div className="mt-16 flex items-center justify-between border-t border-border pt-8 max-w-2xl">
      {/* Skill node */}
      <div className="text-center">
        <dd className="font-mono text-[40px] font-bold tabular-nums text-text-primary leading-none">199</dd>
        <dt className="mt-1 overline-muted">Skills</dt>
      </div>

      {/* Connector */}
      <div className="flex-1 mx-6 relative">
        <div className="circuit-line" />
        <div className="circuit-dot absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2" />
        <div className="circuit-dot absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Agent node */}
      <div className="text-center">
        <dd className="font-mono text-[40px] font-bold tabular-nums text-text-primary leading-none">36</dd>
        <dt className="mt-1 overline-muted">Agents</dt>
      </div>

      {/* Connector */}
      <div className="flex-1 mx-6 relative">
        <div className="circuit-line" />
        <div className="circuit-dot absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2" />
        <div className="circuit-dot absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Hook node */}
      <div className="text-center">
        <dd className="font-mono text-[40px] font-bold tabular-nums text-text-primary leading-none">119</dd>
        <dt className="mt-1 overline-muted">Hooks</dt>
      </div>
    </div>
  </div>
</section>
```

---

## Comparison Summary

| Aspect | A: Neon Command Center | B: Obsidian Studio | C: Circuit Forge |
|--------|----------------------|-------------------|-----------------|
| Hero alignment | Center | Center | Left |
| Hero height | 80vh | py-40 (auto) | 70vh |
| Background effect | Particle/dot grid | Gradient mesh blobs | Dot grid |
| Headline accent | Gradient (blue-violet-magenta) | Gradient (teal-violet-amber) | Solid emerald |
| CTA style | Neon glow shadow | Gradient fill + shadow | Flat solid fill |
| Stat display | Divider bar + glow text | Glassmorphism cards | Circuit-trace diagram |
| Max title size | text-6xl (60px) | text-7xl (72px) | text-6xl (60px) |
| Animation intensity | High (5 stagger layers + glow) | Medium (5 delays + mesh drift) | Low (4 fades only) |
| Overall vibe | Sci-fi mission control | Premium developer SaaS | Engineering blueprint |
