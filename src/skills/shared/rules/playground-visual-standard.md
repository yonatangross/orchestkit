---
title: "Playground Visual Standard"
impact: HIGH
impactDescription: "Governs the visual quality of every playground OrchestKit emits. The difference between a considered product demo and a generic AI dashboard is the specific values in this file."
tags: [playground, design, visual, frontend, ui, drag-and-drop, glassmorphism, rtl]
---

# Playground Visual Standard

<!-- Sync rule: edit this standard and its exemplars in assets/playground-exemplars/ in the SAME PR (colocation). -->

> **Load when:** generating a single-file HTML playground that demonstrates a feature, user story,
> flow, or decision — i.e. a *visual* playground.
> **Skip for:** plan/config/data/architecture dashboards (their current card layout is fine).

A playground is not a slide. It is a thing the viewer can *operate*: play a user story, or make a
decision by dragging. This standard makes that quality reproducible. Every rule carries a concrete,
falsifiable value — a rule without a measurable threshold is not shippable.

Reference exemplars (read the one matching your archetype before building):
`${CLAUDE_PLUGIN_ROOT}/skills/shared/assets/playground-exemplars/`
- `homeos-arieh.html` — canonical gold standard (user-story player, RTL Hebrew). Study the bar.
- `user-story-player.template.html` — generalized player scaffold (device mockup + transport + flow).
- `decision-board.template.html` — drag-and-drop prioritization toolkit (the decision archetype).

---

## §0 Routing rule — does this standard apply?

Decision, not vibe. Count the signals:

```
PLAYGROUND (apply this standard) if ≥2 are true:
  □ device mockup (phone/tablet/app frame)     □ playback / step controls (▶ prev next)
  □ cause→effect flow arrows                    □ narrative user-story copy
  □ drag-and-drop decision surface              □ copy-prompt bar ("build / decide" affordance)

Then pick ONE archetype:
  • USER-STORY PLAYER  → the playground plays a flow over ≥2 steps/screens
  • DECISION BOARD     → the core is prioritization/management via drag-and-drop
  • (neither, <2 signals) → DASHBOARD → this standard does NOT apply; keep today's behavior
```

---

## §1 Persona — pick one, up front, and don't mix

Aesthetic primes emotion in <100ms, before content is read. The frame's persona is the first
*functional* decision.

- **warm-glass** ("warm intelligence") — amber/emerald accents, frosted surfaces, rounded. Default
  for consumer/family/approachable products. Matches the HomeOS reference.
- **cool-glass** ("technical precision") — indigo/violet/teal accents, tighter radii. For
  developer/enterprise/data products.

**Don't** mix warm and cool accents in one playground. **Don't** spend your one bold move on more
than one place (§3).

---

## §2 Design tokens

Define as CSS custom properties prefixed `--pg-`. **Use HSL, not hex** — you can derive a lighter
shade from `hsl(248 84% 68%)` by hand; you cannot from `#7c6cf0`. Every color carries a **role**.

| Token | Example (cool) | Role |
|---|---|---|
| `--pg-bg` | `hsl(232 26% 7%)` | Page background (rich + dark, ≤8% L — never `#000`) |
| `--pg-ink` | `hsl(220 18% 93%)` | Primary text (never pure white) |
| `--pg-muted` / `--pg-faint` | `…64%` / `…46%` | Secondary / tertiary text |
| `--pg-glass` / `--pg-glass-2` | `hsl(0 0% 100% / .05)` / `.08` | Glass fill (see §5) |
| `--pg-glass-edge` | `hsl(0 0% 100% / .18)` | Glass border |
| `--pg-accent` (+`-deep`) | `hsl(248 84% 68%)` | Primary action / active state / flow arrow |
| `--pg-warm` | `hsl(38 95% 60%)` | Secondary accent |

- **Spacing:** only `4 · 8 · 12 · 16 · 24 · 48 · 96`. No `13px`, no `22px`.
- **Radius:** `sm 9px · md 16px · lg 24px · device-bezel 40px · device-outer 54px`. Glass cards ≥16px.
- **Shadow (two-part, §5):** ambient `0 20px 60px -22px hsl(… / .7)` + tight `0 4px 12px -6px hsl(… / .5)`.
- **Motion:** exactly four durations — `100 / 200 / 300 / 500ms`, ease `cubic-bezier(.2,.8,.25,1)` (§6).
- **Gradient mesh background:** 2–3 radial-gradients in accent hues over `--pg-bg`, with
  `background-attachment: fixed`. **Hue span ≤30°** across the mesh — wider reads as garish.

---

## §3 Visual hierarchy — emphasize by de-emphasizing

The most-violated rule in generic AI playgrounds: everything competes at full strength.

- **Do** assign every element a tier before styling: Primary (the mockup / the board), Secondary
  (transport / controls), Tertiary (copy-prompt bar / metadata).
- **Values:** competing elements drop to ~60% opacity or `--pg-faint`; remove their borders. Primary
  text weight 600–700; tertiary 400.
- **Don't** give two elements the same visual weight and expect one to read as primary.

---

## §4 Typography

- **Do** set roles: a display face used with restraint, a body face, a mono utility face for
  values/code. Letter-spacing `-.2px…-.3px` on headings; tabular-nums on any live numbers.
- **Don't** treat type as a neutral delivery vehicle — it carries the persona.

---

## §5 Glass system

Glass reads as glass only against a dark, contrasted backdrop with a visible edge.

- **Do:** fill `rgba(255,255,255, .05–.12)`; 1px border `rgba(255,255,255, .15–.25)`;
  `backdrop-filter: blur(12–20px)` (+ `-webkit-` prefix); top-left light source
  (inset `0 1px 0 rgba(255,255,255,.1–.2)`); the §2 two-part shadow.
- **Don't:** glass on a light background (invisible); >2 stacked glass layers; radius <16px; a glow
  halo (`box-shadow: 0 0 40px accent` = the "generic AI glowing card"); glass as a hierarchy signal.

---

## §6 Motion budget

- **Values:** step/screen transition `300ms`; panel/arrow appear `200ms`; button press/highlight
  `100ms`; device slide-in on load `500ms`. **Everything else animates `0`.**
- **Do** allow exactly **one signature moment** (usually the step transition or the drop-settle).
- **Do** ship the reduced-motion gate verbatim:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
  ```
- **Don't** animate every element — animation everywhere is the fastest path to "AI-generated".

---

## §7 Component specs

- **Device frame:** outer radius 54px, bezel 12–16px, inner screen radius 40px (`overflow:hidden`,
  content never escapes the bezel), shadow level 4. Phone notch optional but consistent.
- **Transport bar:** ▶ play / ‹ prev / next ›; primary button = `--pg-accent`; disabled at ends; a
  "step N of M" hint.
- **Flow arrow:** connects cause→effect; uses `--pg-accent`; **RTL-sensitive** — flip with
  `transform: scaleX(-1)` when `dir="rtl"`.
- **Copy-prompt bar:** mono text + one `<button>`; **1 click to clipboard** (no modal/toast to
  dismiss); on copy, icon→✓ for 1500ms then revert. The prompt is a natural-language instruction
  that only mentions non-default choices — not a value dump.
- **Drag-and-drop decision surface** (the decision-board archetype):
  - **Do NOT use native HTML5 DnD** — it is mouse-only and inaccessible.
  - **Do** implement with **Pointer Events** (covers mouse + touch + pen): a floating ghost clone,
    a dimmed source, a drop indicator, hit-test via `elementFromPoint`.
  - **Keyboard is mandatory:** cards `tabindex="0"`; arrow keys move the focused card (reorder /
    nudge axis / change bucket); `:focus-visible` ring; re-focus the card after re-render.
  - **ARIA:** `role="button"`, `aria-roledescription="draggable card"`, and an `aria-live="polite"`
    region that announces every move ("X moved to Should").
  - `touch-action: none` on cards so touch-drag doesn't scroll the page.
  - Supported patterns: Impact×Effort 2×2 · ranked-list reorder · MoSCoW / Now-Next-Later buckets ·
    live score (RICE/WSJF) + copy-prompt. Copy `decision-board.template.html` and swap the data.

---

## §8 RTL / i18n

- **Do** use CSS **logical properties everywhere**: `margin-inline-start`, `padding-inline-end`,
  `inset-inline-start`, `inset-block-end` — never `left`/`right`/`margin-left`.
- **Do** flag flow arrows and any directional position math as RTL-sensitive (flip / invert the
  pointer-X→value mapping when `dir="rtl"`).
- **Do** reserve +50% width for labels (text expands in other languages); never truncate the prompt bar.

---

## §9 Anti-"generic AI aesthetic" checklist (falsifiable DO-NOTs)

1. No pure black `#000` background or text.
2. No gradient with >30° hue span.
3. No two elements at equal visual weight (§3).
4. No glow-halo cards (§5).
5. More than one signature animation → cut to one (§6).
6. Arbitrary spacing (`13px`, `22px`) → snap to the §2 scale.
7. Hex colors in tokens → convert to HSL.
8. Native `draggable="true"` DnD → replace with the §7 pointer+keyboard engine.
9. Physical `left`/`right` CSS in a playground that may be RTL → logical properties.
10. Copy-prompt that dumps values instead of a natural-language instruction.

---

## §10 Self-audit (run before declaring done)

- [ ] Routing (§0): correct archetype chosen; this standard actually applies.
- [ ] One persona, no warm/cool mix (§1).
- [ ] Tokens are HSL with roles; spacing/radius/motion on the scales (§2, §6).
- [ ] Hierarchy: primary element is unmistakably dominant (§3).
- [ ] Glass passes the do/don't (§5); no glow halos.
- [ ] Motion ≤4 durations, one signature moment, reduced-motion gate present (§6).
- [ ] If a decision surface exists: mouse **and** keyboard work, live region announces, touch ok (§7).
- [ ] RTL: toggle `dir="rtl"` — layout + arrows mirror correctly (§8).
- [ ] Single file, zero external deps; copy-prompt is 1-click and natural-language.
- [ ] Ran the §9 checklist; zero hits.
