# Stylecard Catalog

Named aesthetic recipes with exact values. Contract per recipe: **Use when** (concrete surfaces),
**Values** (copy-paste code), **Avoid** (falsifiable don'ts). Sources: OrchestKit playground
visual standard; layered-shadow stacks adapted from MengTo/Skills `beautiful-shadows` (MIT).

---

## elevation/sm — layered neutral, quiet

**Use when:** compact cards, form controls, pills, chips — surfaces that need lift without presence.

Tailwind:
```txt
shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]
```

CSS:
```css
box-shadow: 0px 2px 3px -1px rgba(0,0,0,.1), 0px 1px 0px 0px rgba(25,28,33,.02), 0px 0px 0px 1px rgba(25,28,33,.08);
```

**Avoid:** using on hero media (too quiet); combining with a visible border (the 0-0-0-1px ring IS the border).

---

## elevation/md — layered neutral, default

**Use when:** cards, panels, popovers — the default elevated surface.

Tailwind:
```txt
shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]
```

**Avoid:** mixing with default Tailwind `shadow-*` scale on the same component; colored tints — keep neutral; stacking on `elevation/sm` or `/lg`.

---

## elevation/lg — layered neutral, strongest

**Use when:** hero media, feature callouts, modal-like containers — the strongest lift on the page (use once per view).

Tailwind:
```txt
shadow-[0_2.8px_2.2px_rgba(0,0,0,0.034),0_6.7px_5.3px_rgba(0,0,0,0.048),0_12.5px_10px_rgba(0,0,0,0.06),0_22.3px_17.9px_rgba(0,0,0,0.072),0_41.8px_33.4px_rgba(0,0,0,0.086),0_100px_80px_rgba(0,0,0,0.12)]
```

**Avoid:** dense lists or tiny controls; more than one `elevation/lg` element visible at once.

---

## glass/dark — frosted panel on dark backdrop

**Use when:** panels, bars, and cards over a dark (≤8% lightness) contrasted background. Glass is invisible on light backgrounds.

```css
background: hsl(0 0% 100% / .05);           /* .05–.12 range; .08 for raised layer */
border: 1px solid hsl(0 0% 100% / .18);     /* .15–.25 range */
border-radius: 16px;                         /* never below 16px for glass */
backdrop-filter: blur(14px);                 /* 12–20px */
-webkit-backdrop-filter: blur(14px);
box-shadow: inset 0 1px 0 hsl(0 0% 100% / .12),                /* top-left light source */
            0 20px 60px -22px hsl(232 40% 3% / .7),            /* ambient */
            0 4px 12px -6px hsl(232 40% 3% / .5);              /* tight */
```

**Avoid:** glass on light backgrounds; >2 stacked glass layers; radius <16px; a glow halo (`0 0 40px accent`) — the generic-AI tell; using glass strength as a hierarchy signal (use opacity/weight instead).

---

## border/gradient — 1px gradient border, no wrapper

**Use when:** a card or button needs a subtle multi-hue edge (Linear/Vercel style) without nesting an extra div.

```css
border: 1px solid transparent;
background:
  linear-gradient(var(--surface), var(--surface)) padding-box,
  linear-gradient(135deg, hsl(248 84% 68% / .5), hsl(0 0% 100% / .08) 40%, hsl(248 84% 68% / .25)) border-box;
```

**Avoid:** hue span >30° inside the gradient; animating the gradient (paint cost + noise); combining with `glass/dark` (competing edges).

---

## background/mesh — radial mesh page background

**Use when:** full-page backgrounds that need depth without imagery.

```css
background-color: hsl(232 26% 7%);
background-image:
  radial-gradient(1100px 620px at 12% -8%, hsl(248 60% 22% / .55), transparent 60%),
  radial-gradient(900px 560px at 105% 12%, hsl(262 55% 20% / .45), transparent 55%);
background-attachment: fixed;
```

**Avoid:** hue span >30° across the mesh (reads garish); pure `#000` base; more than 3 radial layers.

---

## type/editorial — role split with tracking

**Use when:** any surface with headings + body + data values (dashboards, docs, marketing).

```css
/* display — headings only, used with restraint */
font-weight: 700; letter-spacing: -0.3px;      /* -.2px…-.3px on headings */
/* body */
font-weight: 400; line-height: 1.55;
/* mono utility — values, code, filenames */
font-family: ui-monospace, "SF Mono", Menlo, monospace;
font-variant-numeric: tabular-nums;             /* mandatory on live/aligned numbers */
```

**Avoid:** display face in body copy; proportional digits in tables or counters; more than 3 type roles per view.

---

## motion/budget — the four durations

**Use when:** any animated surface. This is a constraint card, not an effect.

```css
/* exactly four durations, one ease */
--dur-press: 100ms;      /* button press, highlight */
--dur-panel: 200ms;      /* panel/arrow appear */
--dur-step:  300ms;      /* step/screen transition */
--dur-enter: 500ms;      /* one-time entrance on load */
--ease: cubic-bezier(.2, .8, .25, 1);
```

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

**Avoid:** any fifth duration; more than ONE signature moment per view; animating everything (the fastest path to "AI-generated"); shipping without the reduced-motion gate.
