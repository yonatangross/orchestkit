# Design Concept Decision Matrix

## Scoring Criteria (1-5 scale)

| Criteria | Weight | A: Neon Command Center | B: Obsidian Studio | C: Circuit Forge |
|----------|--------|----------------------|-------------------|-----------------|
| Fidelity to reference site | 20% | 5 | 3 | 2 |
| Professional credibility | 20% | 3 | 5 | 4 |
| Uniqueness / memorability | 15% | 4 | 3 | 5 |
| Implementation complexity | 15% | 2 (complex) | 3 (moderate) | 5 (simple) |
| Accessibility compliance | 10% | 4 | 5 | 5 |
| Fumadocs integration ease | 10% | 3 | 4 | 5 |
| Content readability | 10% | 3 | 5 | 4 |
| **Weighted Total** | | **3.45** | **3.85** | **3.95** |

## Trade-off Analysis

### Concept A: Neon Command Center
**Best for:** Maximum visual impact, demo-heavy landing page, developer conference vibes
**Risk:** Particle effects hurt mobile performance. Neon glow can feel gimmicky if overdone. Three accent colors increase design maintenance burden. Scanline overlays can reduce text readability.
**Implementation effort:** HIGH — requires canvas/Three.js for particles, custom text-shadow utilities, multiple glow keyframe animations.

### Concept B: Obsidian Studio
**Best for:** Balanced approach that looks expensive without being flashy. Appeals to both individual developers and enterprise buyers. Gradient mesh is trendy (Vercel, Linear, Raycast all use variants).
**Risk:** Could feel "generic SaaS" without enough personality. Three accent colors (teal/amber/violet) are harder to maintain than one. Noise texture SVG adds page weight.
**Implementation effort:** MEDIUM — gradient mesh is pure CSS, glassmorphism is standard backdrop-blur, noise is an inline SVG.

### Concept C: Circuit Forge
**Best for:** Standing out from every other developer docs site. The circuit-trace metaphor directly maps to OrchestKit's architecture (skills CONNECT to agents CONNECT to hooks). Monochrome simplicity is timeless.
**Risk:** Single accent color may feel too austere for some users. Left-aligned hero breaks convention. 11px mono text needs careful testing at all screen sizes. 1px card gaps require precise border management.
**Implementation effort:** LOW — dot grid is one CSS line, circuit traces are simple HTML, no blur effects or canvas.

## Recommendation

**Concept C (Circuit Forge)** scores highest on the weighted matrix and has the lowest implementation risk. Its key strengths:

1. **The metaphor works.** OrchestKit literally orchestrates connections between components. Circuit traces make that visible.
2. **Single accent color** (emerald) means every touch of green has maximum impact. Less color = more meaning.
3. **Monospace-forward typography** reinforces that this is a developer tool, not a marketing site.
4. **Easiest to implement** with Fumadocs — minimal custom CSS, no JS effects, standard Tailwind utilities.
5. **Left-aligned hero** is distinctive but natural for developers who read left-to-right in their editors.

**However**, if the goal is to maximize resemblance to the reference site (claude-code-presentation-black.vercel.app), **Concept A** is the direct translation.

**If a balance is desired**, **Concept B** provides the premium dark SaaS feel with more visual warmth than C but less complexity than A.

## Hybrid Possibility

A strong hybrid would take:
- **C's layout and typography** (left-aligned hero, monospace overlines, tight spacing)
- **B's gradient mesh** (just for the hero section, not everywhere)
- **A's colored accent per category** (blue=skills, green=agents, magenta=hooks) — but only in interactive visualizations, not UI chrome

This hybrid keeps C's disciplined simplicity while adding the one "wow" moment in the hero.
