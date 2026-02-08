---
name: scene-intro-cards
description: Transitional intro cards between video scenes. Use when adding "Coming Up Next" cards, scene transitions, or visual breathing room in demos
tags: [video, remotion, transitions, cards, animation, scenes]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
complexity: low
---

# Scene Intro Cards

Transitional intro cards that appear between video scenes to prepare viewers for upcoming content. These "Coming up next" style cards increase engagement by building anticipation and providing visual breathing room.

## Core Principle

**Intro Cards = Anticipation Builder + Cognitive Reset**

Scene intro cards serve two purposes:
1. **Build anticipation** for the next segment
2. **Provide cognitive reset** between dense information sections

```
VIEWER JOURNEY
==============

[Dense Content A]
       |
       v
+------------------+
|  INTRO CARD      |  <-- 2-4 seconds
|  "Coming Up..."  |      Viewer anticipation peaks
+------------------+
       |
       v
[Dense Content B]     <-- Viewer re-engages with fresh attention
```

## When to Use Intro Cards

| Use Case | Card Duration | Style |
|----------|---------------|-------|
| Major topic change | 3-4 seconds | Bold, high contrast |
| Section within topic | 2-3 seconds | Minimal, subtle |
| Returning from tangent | 2 seconds | Quick reminder |
| Before key reveal | 3-4 seconds | Building tension |
| Tutorial steps | 2 seconds | Numbered, clear |

## Card Anatomy

```
+------------------------------------------+
|                                          |
|     [ICON/EMOJI]                         |
|                                          |
|     PRIMARY TEXT                         |
|     "Coming Up Next"                     |
|                                          |
|     Secondary text (optional)            |
|     Brief description                    |
|                                          |
|     ---------=--------- (progress bar)   |
|                                          |
+------------------------------------------+
```

### Required Elements
- **Primary text**: 2-4 words maximum
- **Visual anchor**: Icon, emoji, or simple graphic

### Optional Elements
- Secondary descriptive text
- Progress indicator
- Section number
- Estimated time

## Style Variations

### 1. Minimal

Clean and fast, ideal for short-form content.

```
+------------------------------------------+
|                                          |
|                                          |
|              NEXT UP                     |
|              --------                    |
|                                          |
|                                          |
+------------------------------------------+

Colors: Muted background, high-contrast text
Animation: Simple fade
Use: Professional, educational content, TikTok/Reels
Duration: 1.5-2 seconds
```

### 2. Bold

High impact, attention-grabbing for major transitions.

```
+------------------------------------------+
|  ////////////////////////////////////////|
|  //                                    //|
|  //       COMING UP                    //|
|  //       THE GOOD STUFF               //|
|  //                                    //|
|  ////////////////////////////////////////|
+------------------------------------------+

Colors: Vibrant, brand colors
Animation: Scale pop with motion blur
Use: Entertainment, high-energy content
Duration: 2-3 seconds
```

### 3. Branded

Consistent with brand identity, includes progress tracking.

```
+------------------------------------------+
|  [LOGO]                                  |
|                                          |
|        STEP 3 OF 5                       |
|        Setting Up Auth                   |
|                                          |
|        [Progress: ====>-----]            |
+------------------------------------------+

Colors: Brand palette
Animation: Consistent with brand motion
Use: Series, courses, branded content
Duration: 2-3 seconds
```

### 4. Numbered

Clear step indication for tutorials and listicles.

```
+------------------------------------------+
|                                          |
|            +-----+                       |
|            |  3  |                       |
|            +-----+                       |
|                                          |
|         CONFIGURATION                    |
|                                          |
+------------------------------------------+

Colors: High contrast number, subtle background
Animation: Number scales in first
Use: Step-by-step tutorials, lists
Duration: 2 seconds
```

## Timing Recommendations (2-4 Seconds)

### Duration by Platform

| Platform | Recommended | Minimum | Maximum |
|----------|-------------|---------|---------|
| TikTok/Reels | 1.5-2s | 1s | 2.5s |
| YouTube Shorts | 2-2.5s | 1.5s | 3s |
| YouTube Long | 2.5-4s | 2s | 5s |
| LinkedIn | 2-3s | 2s | 4s |
| Tutorial/Course | 3-4s | 2.5s | 5s |

### Duration Formula

```
Card Duration = Base + Content Complexity Modifier

Base Duration:
- Short-form (<60s): 1.5 seconds
- Medium-form (1-5m): 2.5 seconds
- Long-form (>5m): 3 seconds

Complexity Modifier:
- Simple topic change: +0s
- Moderate shift: +0.5s
- Major section change: +1s
```

### Transition Breakdown

```
TYPICAL 3-SECOND CARD
=====================

0.0s  |====| Fade/slide in (0.3-0.5s)
0.4s  |------------------------------------------|
      |    Hold for reading (2.2-2.5s)           |
2.6s  |------------------------------------------|
      |====| Fade/slide out (0.3-0.5s)
3.0s  Complete

Rule: Never hard cut to/from intro cards
```

## Animation Patterns

### Pattern 1: Fade Through

Simple, professional transition.
```
Frame 0:    Content A visible
Frame 15:   Content A fades out (0.5s at 30fps)
Frame 16:   Card fades in
Frame 75:   Card visible (2s hold)
Frame 90:   Card fades out (0.5s)
Frame 91:   Content B fades in
```

### Pattern 2: Scale Pop

Energetic, attention-grabbing.
```
Frame 0:    Card at 0% scale, 0% opacity
Frame 10:   Card at 110% scale, 100% opacity (overshoot)
Frame 15:   Card at 100% scale (settle)
Frame 75:   Card visible (2s hold)
Frame 85:   Card scales to 95%, fades out
Frame 90:   Content B begins
```

### Pattern 3: Slide + Reveal

Directional momentum.
```
Frame 0:    Card offscreen left, Content A visible
Frame 15:   Card slides in from left, Content A exits right
Frame 75:   Card centered (2s hold)
Frame 90:   Card slides out left, Content B enters right
```

### Pattern 4: Icon First

Two-stage reveal for emphasis.
```
Frame 0:    Icon appears (scale from 0)
Frame 20:   Icon settles, text fades in below
Frame 30:   Full card visible
Frame 90:   Simultaneous fade out
Frame 105:  Content B begins
```

## Integration with TransitionSeries

Intro cards integrate seamlessly with Remotion's `<TransitionSeries>`:

```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={180}>
    <ContentSceneA />
  </TransitionSeries.Sequence>

  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15 })}
  />

  <TransitionSeries.Sequence durationInFrames={60}>
    <IntroCard
      title="Coming Up"
      subtitle="Advanced Patterns"
      icon="rocket"
    />
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

## Accessibility Considerations

### Readable Timing

```
MINIMUM DISPLAY TIME FOR READABILITY
=====================================

Text Length        Minimum Duration
-----------------------------------------
2-3 words          1.5 seconds
4-5 words          2.0 seconds
6-7 words          2.5 seconds
8+ words           3.0+ seconds (avoid this many)

Formula: 250ms per word + 1 second base
         duration = (wordCount * 0.25) + 1.0
```

### Color Contrast (WCAG AA)

```
CONTRAST REQUIREMENTS (minimum 4.5:1)
=====================================

Background    Text Color    Ratio    Status
-------------------------------------------------
#000000       #FFFFFF       21:1     Excellent
#1a1a2e       #FFFFFF       15.3:1   Excellent
#2d3748       #F7FAFC       12.2:1   Good
#4a5568       #FFFFFF       7.0:1    Acceptable
#718096       #FFFFFF       4.5:1    Minimum
```

### Reduced Motion Support

```tsx
// Respect user preferences for reduced motion
const { prefersReducedMotion } = useMediaQuery();

const animationConfig = prefersReducedMotion
  ? { durationInFrames: 1 } // Instant, minimal motion
  : { durationInFrames: 15 }; // Full animation
```

### Screen Reader Considerations

```tsx
// Ensure card content is announced
<div
  role="status"
  aria-live="polite"
  aria-label={`Coming up next: ${title}`}
>
  <IntroCard title={title} />
</div>
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Too long (>5s) | Viewers skip ahead | Keep 2-4s |
| Too short (<1.5s) | Unreadable | Minimum 1.5s |
| Too frequent | Disrupts flow | Max 1 per 90-120s |
| Too much text | Cognitive overload | 4 words maximum |
| No visual anchor | Forgettable | Always include icon |
| Jarring colors | Breaks immersion | Match video palette |
| Inconsistent style | Unprofessional | Use same template |
| Hard cuts | Jarring transition | Always fade/transition |

## Quick Reference Checklist

```
INTRO CARD PRE-RENDER CHECKLIST
===============================

DESIGN
[ ] 2-4 words primary text
[ ] Visual anchor (icon/emoji)
[ ] Brand-consistent colors
[ ] High contrast (4.5:1+ ratio)
[ ] Clean, uncluttered layout

TIMING
[ ] 2-4 second total duration
[ ] Smooth transition in (0.3-0.5s)
[ ] Adequate hold time for reading
[ ] Smooth transition out (0.3-0.5s)
[ ] Appropriate for target platform

ANIMATION
[ ] Entry animation defined
[ ] Exit animation defined
[ ] Reduced motion fallback provided
[ ] Frame timing verified at target FPS

ACCESSIBILITY
[ ] Text readable at display time
[ ] Sufficient color contrast
[ ] Motion sensitivity handled
[ ] Screen reader friendly (if web)
```

## Related Skills

- `video-pacing`: Timing and rhythm patterns for overall video flow
- `remotion-composer`: Programmatic video generation with Remotion
- `motion-animation-patterns`: Spring configs and easing functions
- `thumbnail-first-frame`: Visual design principles

## References

- [Card Templates](./references/card-templates.md) - React/Remotion component templates
- [Animation Presets](./references/animation-presets.md) - Spring configs for different styles
- [Timing Patterns](./references/timing-patterns.md) - When and how long to show cards
