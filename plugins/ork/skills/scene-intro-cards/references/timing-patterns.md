# Timing Patterns

Guidelines for when to show intro cards and how long they should be displayed.

## Decision Framework

### When to Include Intro Cards

```
DECISION TREE
=============

Is video > 30 seconds?
    |
    +-- NO --> Skip intro cards entirely
    |
    +-- YES --> Does content have 2+ distinct sections?
                    |
                    +-- NO --> Skip intro cards
                    |
                    +-- YES --> Are sections separated by clear topic shifts?
                                    |
                                    +-- NO --> Consider simpler transitions
                                    |
                                    +-- YES --> USE INTRO CARDS
                                                |
                                                v
                                    Select duration based on:
                                    1. Video length
                                    2. Platform
                                    3. Content complexity
```

### Video Length Guidelines

| Video Duration | Include Cards? | Card Duration | Max Cards |
|----------------|----------------|---------------|-----------|
| < 30s | No | - | 0 |
| 30s - 60s | Optional | 1.5-2s | 1 |
| 1-3 min | Yes | 2-2.5s | 2-3 |
| 3-5 min | Yes | 2.5-3s | 3-4 |
| 5-10 min | Yes | 3-3.5s | 4-6 |
| 10-20 min | Yes | 3-4s | 6-10 |
| 20+ min | Yes | 3-4s | 8-15 |

### Platform-Specific Timing

```
PLATFORM TIMING MATRIX
======================

Platform       | Rec Duration | Min | Max | Transition In/Out
---------------|--------------|-----|-----|------------------
TikTok         | 1.5s         | 1s  | 2s  | 0.2-0.3s
Instagram Reels| 1.5-2s       | 1s  | 2.5s| 0.3s
YouTube Shorts | 2s           | 1.5s| 3s  | 0.3-0.4s
YouTube Long   | 3s           | 2s  | 5s  | 0.4-0.5s
LinkedIn       | 2.5s         | 2s  | 4s  | 0.4s
Course/Tutorial| 3-4s         | 2.5s| 5s  | 0.5s
```

## Timing Calculation

### Duration Formula

```
Total Card Duration = Transition In + Hold Time + Transition Out

Where:
- Transition In:  0.3-0.5s (10-15 frames at 30fps)
- Hold Time:      1-3.5s   (30-105 frames at 30fps)
- Transition Out: 0.3-0.5s (10-15 frames at 30fps)
```

### Text-Based Duration

Ensure enough time for reading:

```
Hold Time = (Word Count * 250ms) + 1000ms base

Examples:
- "NEXT" (1 word):           1.25s hold
- "Coming Up" (2 words):     1.5s hold
- "The Solution" (2 words):  1.5s hold
- "Setting Up Auth" (3):     1.75s hold
- "Deploying to Production" (3): 1.75s hold
```

### Complexity Modifier

Add time based on content complexity:

```
COMPLEXITY LEVELS
=================

Simple (no modifier):
- Same topic continuation
- Quick tip preview
- Single concept

Moderate (+0.5s):
- Related topic shift
- Multiple related concepts
- Tutorial step transition

Complex (+1.0s):
- Major topic change
- Unrelated content
- Section with prerequisites
- Key reveal/climax
```

## Frame Calculations

### At 30 FPS

```tsx
const FPS = 30;

// Duration presets in frames
const TIMING = {
  // Transition durations
  transitionQuick: 10,  // 0.33s
  transitionNormal: 15, // 0.5s
  transitionSlow: 20,   // 0.67s

  // Hold durations (excluding transitions)
  holdShort: 30,    // 1s
  holdMedium: 45,   // 1.5s
  holdNormal: 60,   // 2s
  holdLong: 75,     // 2.5s
  holdExtended: 90, // 3s

  // Total card durations (with transitions)
  cardMinimal: 60,    // 2s total
  cardShort: 75,      // 2.5s total
  cardNormal: 90,     // 3s total
  cardLong: 105,      // 3.5s total
  cardExtended: 120,  // 4s total
};
```

### At 60 FPS

```tsx
const FPS = 60;

const TIMING_60FPS = {
  transitionQuick: 20,
  transitionNormal: 30,
  transitionSlow: 40,

  holdShort: 60,
  holdMedium: 90,
  holdNormal: 120,
  holdLong: 150,
  holdExtended: 180,

  cardMinimal: 120,
  cardShort: 150,
  cardNormal: 180,
  cardLong: 210,
  cardExtended: 240,
};
```

## Scene Placement Patterns

### Pattern 1: Section Dividers

Use intro cards to separate major sections.

```
VIDEO STRUCTURE
===============

[Hook]          30s
    |
[Intro Card]    2.5s  "THE PROBLEM"
    |
[Problem]       90s
    |
[Intro Card]    2.5s  "THE SOLUTION"
    |
[Solution]      120s
    |
[Intro Card]    2.5s  "IMPLEMENTATION"
    |
[Implementation] 180s
    |
[CTA/Outro]     30s
```

### Pattern 2: Tutorial Steps

Use numbered cards for step-by-step content.

```
TUTORIAL STRUCTURE
==================

[Intro]         15s
    |
[Card: Step 1]  2s   "SETUP"
    |
[Step 1]        60s
    |
[Card: Step 2]  2s   "CONFIGURE"
    |
[Step 2]        90s
    |
[Card: Step 3]  2s   "TEST"
    |
[Step 3]        45s
    |
[Summary]       30s
```

### Pattern 3: Feature Showcase

Use branded cards for product/feature videos.

```
FEATURE VIDEO
=============

[Hook/Problem]  20s
    |
[Card]          3s   "FEATURE 1: Speed"
    |
[Demo 1]        45s
    |
[Card]          3s   "FEATURE 2: Simplicity"
    |
[Demo 2]        45s
    |
[Card]          3s   "FEATURE 3: Integration"
    |
[Demo 3]        45s
    |
[CTA]           20s
```

### Pattern 4: Short-Form Minimal

For TikTok/Reels, use sparingly.

```
SHORT-FORM
==========

[Hook]          3s
    |
[Card]          1.5s  "WATCH THIS"
    |
[Content]       20s
    |
[Payoff]        5s
```

## Spacing Guidelines

### Minimum Time Between Cards

```
VIDEO LENGTH        MIN SPACING
------------        -----------
< 1 min             No cards or 1 max
1-3 min             45-60 seconds
3-5 min             60-90 seconds
5-10 min            90-120 seconds
10+ min             2-3 minutes
```

### Maximum Card Frequency

```
MAX CARDS = floor(Video Duration / 90 seconds)

Examples:
- 2 min video:  floor(120/90) = 1 card max
- 5 min video:  floor(300/90) = 3 cards max
- 10 min video: floor(600/90) = 6 cards max
```

## Transition Timing Patterns

### Symmetric Transitions

Same duration in and out (most common).

```
[Content A]
    |
  0.4s  <-- Fade out
    |
[Card Visible] 2.2s
    |
  0.4s  <-- Fade out
    |
[Content B]

Total: 3.0s
```

### Asymmetric Transitions

Fast in, slower out (builds anticipation).

```
[Content A]
    |
  0.3s  <-- Quick fade in (anticipation)
    |
[Card Visible] 2.0s
    |
  0.5s  <-- Slower fade out (let it sink in)
    |
[Content B]

Total: 2.8s
```

### Overlap Transitions

Card overlaps with content transitions.

```tsx
// TransitionSeries with overlap
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={180}>
    <ContentA />
  </TransitionSeries.Sequence>

  {/* 15 frame transition = card overlaps both scenes by 15 frames */}
  <TransitionSeries.Transition
    timing={linearTiming({ durationInFrames: 15 })}
    presentation={fade()}
  />

  <TransitionSeries.Sequence durationInFrames={60}>
    <IntroCard />
  </TransitionSeries.Sequence>

  <TransitionSeries.Transition
    timing={linearTiming({ durationInFrames: 15 })}
    presentation={fade()}
  />

  <TransitionSeries.Sequence durationInFrames={240}>
    <ContentB />
  </TransitionSeries.Sequence>
</TransitionSeries>
```

## Dynamic Duration Calculation

```tsx
interface CardTimingConfig {
  fps: number;
  platform: "tiktok" | "reels" | "shorts" | "youtube" | "linkedin" | "course";
  wordCount: number;
  complexity: "simple" | "moderate" | "complex";
}

const calculateCardDuration = (config: CardTimingConfig): number => {
  const { fps, platform, wordCount, complexity } = config;

  // Base hold time from word count
  const baseHoldSeconds = wordCount * 0.25 + 1.0;

  // Platform modifier
  const platformModifiers = {
    tiktok: 0.8,
    reels: 0.85,
    shorts: 0.9,
    youtube: 1.0,
    linkedin: 0.95,
    course: 1.1,
  };

  // Complexity modifier
  const complexityModifiers = {
    simple: 0,
    moderate: 0.5,
    complex: 1.0,
  };

  // Calculate total hold time
  const holdSeconds =
    baseHoldSeconds * platformModifiers[platform] +
    complexityModifiers[complexity];

  // Add transitions (0.4s each)
  const totalSeconds = holdSeconds + 0.8;

  // Clamp to valid range
  const minDuration = 1.5;
  const maxDuration = 5.0;
  const clampedSeconds = Math.max(minDuration, Math.min(maxDuration, totalSeconds));

  // Convert to frames
  return Math.round(clampedSeconds * fps);
};

// Usage
const duration = calculateCardDuration({
  fps: 30,
  platform: "youtube",
  wordCount: 3,
  complexity: "moderate",
});
// Result: ~95 frames (3.17 seconds)
```

## Anti-Pattern Timing

### Too Frequent

```
BAD: Card every 30 seconds
===========================
[Content]   30s
[Card]      3s   <- Interruption
[Content]   30s
[Card]      3s   <- Annoying
[Content]   30s
[Card]      3s   <- Viewer leaves

FIX: Minimum 90s between cards
```

### Too Long

```
BAD: 6-second card
==================
[Content ends]
[Card visible for 6s]  <- Viewer skips ahead
[Content starts]

FIX: Max 4-5s for any card
```

### Too Short

```
BAD: 0.8-second card
====================
[Content ends]
[Card flashes]  <- Viewer: "What was that?"
[Content starts]

FIX: Minimum 1.5s total
```

## Quick Reference

```
TIMING CHEAT SHEET
==================

SHORT-FORM (<60s)
- Card duration: 1.5-2s
- Transition: 0.2-0.3s
- Max cards: 1
- Total frames (30fps): 45-60

MEDIUM-FORM (1-5min)
- Card duration: 2-3s
- Transition: 0.3-0.4s
- Max cards: 2-4
- Total frames (30fps): 60-90

LONG-FORM (5min+)
- Card duration: 3-4s
- Transition: 0.4-0.5s
- Max cards: 1 per 90s
- Total frames (30fps): 90-120

FORMULA SUMMARY
- Hold time: (words * 0.25) + 1.0 seconds
- Total: hold + 0.6-1.0s transitions
- Spacing: 90+ seconds between cards
```
