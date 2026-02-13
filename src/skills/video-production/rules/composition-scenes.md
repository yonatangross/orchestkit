---
title: Scene Intro Cards
impact: HIGH
impactDescription: "Transition cards provide cognitive reset between dense content sections — without them, viewers experience information overload and drop off"
tags: scenes, cards, transitions, animation, timing
---

## Scene Intro Cards

Transitional intro cards between video scenes that build anticipation and provide cognitive reset.

**Core Principle:** Intro Cards = Anticipation Builder + Cognitive Reset

### When to Use

| Use Case | Card Duration | Style |
|----------|---------------|-------|
| Major topic change | 3-4 seconds | Bold, high contrast |
| Section within topic | 2-3 seconds | Minimal, subtle |
| Returning from tangent | 2 seconds | Quick reminder |
| Before key reveal | 3-4 seconds | Building tension |
| Tutorial steps | 2 seconds | Numbered, clear |

### Card Styles

**Minimal:** Clean, fast (1.5-2s), simple fade. Best for short-form.
**Bold:** High impact (2-3s), scale pop with motion blur. For entertainment.
**Branded:** Progress tracking (2-3s), step N of M. For series content.
**Numbered:** Clear step indication (2s), number scales in first. For tutorials.

### Duration Formula

```
Card Duration = Base + Content Complexity Modifier

Base Duration:
- Short-form (<60s): 1.5 seconds
- Medium-form (1-5m): 2.5 seconds
- Long-form (>5m): 3 seconds

Complexity Modifier: +0s (simple) | +0.5s (moderate) | +1s (major)
```

### Transition Breakdown (3-second card)

```
0.0s  Fade/slide in (0.3-0.5s)
0.4s  Hold for reading (2.2-2.5s)
2.6s  Fade/slide out (0.3-0.5s)
3.0s  Complete

Rule: Never hard cut to/from intro cards
```

### Remotion TransitionSeries Integration

```tsx
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={180}>
    <ContentSceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15 })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <IntroCard title="Coming Up" subtitle="Advanced Patterns" icon="rocket" />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15 })}
  />
  <TransitionSeries.Sequence durationInFrames={240}>
    <ContentSceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

### Anti-Patterns

| Anti-Pattern | Solution |
|--------------|----------|
| Too long (>5s) | Keep 2-4s |
| Too frequent | Max 1 per 90-120s |
| Too much text | 4 words maximum |
| Hard cuts | Always fade/transition |

**References:** `references/card-templates.md`, `references/scene-animation-presets.md`, `references/timing-patterns.md`
