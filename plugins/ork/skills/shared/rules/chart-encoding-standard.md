---
title: "Chart Encoding Standard"
impact: HIGH
impactDescription: "Governs the DATA-MARK layer of every chart OrchestKit emits (playground, dashboard, infographic, MCP visual, multi-surface). ork does not own chart color science — it rents it from CC's /dataviz. The difference between an accessible, validated chart and an eyeballed rainbow is deferring to that skill and running its validator."
tags: [chart, dataviz, color, accessibility, palette, cvd, visualization, playground]
---

# Chart Encoding Standard

<!-- Sync rule: this rule defers to CC's bundled /dataviz skill. If dataviz's interface
     changes, update the step names / validator invocation here in the same PR. -->

> **Load when:** generating any output that renders **quantitative data marks** — a bar,
> line, area, heatmap, KPI tile, meter, or sparkline — in HTML (playground, dashboard),
> an infographic, an MCP visual, or a multi-surface target.
> **Skip for:** the ASCII floor (monochrome + emoji — `/dataviz` is HTML-only, no overlap).

**OrchestKit does not own chart form or color.** For the data-mark layer, defer to Claude
Code's bundled **`/dataviz`** skill exactly the way `visualize-plan` defers ASCII to
`ascii-visualizer` — it is an upstream dependency, not something ork reimplements. ork owns
the **domain** (what the chart is about) and the **chrome** (frame/persona); `/dataviz` owns
the **marks** (which form, which colors, is it accessible).

## The three steps — all via `/dataviz`

1. **Form** (`choosing-a-form`): first ask *is it even a chart?* — a single value is a **stat
   tile**, a ratio-to-limit is a **meter**, >7 meaningful classes is a **table**. Only then
   pick bar / line / heatmap by the data's job. Never a one-bar bar chart.
2. **Color** (the six-check formula): every mark color does exactly one job — **categorical**
   (8 fixed hues, fixed order), **sequential** (one hue, light→dark), **diverging** (two hues
   + neutral midpoint), or **status** (fixed scale, always icon+label). No hand-picked hex.
3. **Validate** (`validate_palette.js`): run it; **exit 0 is required**. A CVD WARN (ΔE 8–12)
   is legal only with secondary encoding; a contrast WARN **obligates** a relief channel —
   ship visible direct labels or the table-view twin.

## The chrome ↔ marks boundary (the one real seam)

Chrome and marks are **different pixels** — do not let one palette govern both:

- **Chrome** tokens (frame, glass, accent, background) → HSL / persona, per
  `playground-visual-standard.md` §2.
- **Data-mark** tokens → the `/dataviz` validated palette (hex/OKLCH from its `palette.md`).

```
❌ WRONG:  <rect fill="var(--pg-accent)">      <!-- persona-HSL accent as a bar color;
                                                    silently fails CVD, never validated -->
✅ RIGHT:  <rect fill="var(--series-1)">        <!-- --series-1: #2a78d6 from the validated
                                                    palette; chrome accent stays for the frame -->
```

Define both palettes side by side in the chart's `<style>`; a data mark never wears a persona accent.

## Capability gate — never hard-require

`/dataviz` is CC-bundled at **2.1.198** (above ork's 2.1.183 floor) and is disableable via
`disableBundledSkills`. **Probe before use** (the `visualize-plan` STEP 0.5 pattern). If it is
absent, or the validator returns a hard FAIL, **fall back to the ASCII-card layout** — the same
output ork produced before this standard existed. `/dataviz` upgrades charts; it never blocks them.

```
❌ WRONG:  assume /dataviz is present → chart breaks on a floor-CC or disabled install
✅ RIGHT:  probe → present: validated chart · absent/FAIL: ASCII-card fallback (no regression)
```

## Consumers

`visualize-plan` (STEP 4b marks in Risk[3]/Impact[5]/Blast[6]), `playground-visual-standard`
(§0 dashboard archetype, §10 self-audit gate), `mcp-visual-output`, `multi-surface-render`.
