---
name: video-storyboarding
description: Pre-production planning for tech demo videos. Use when planning scenes, structuring narrative flow, or applying AIDA framework to video content
tags: [video, storyboard, pre-production, planning, narrative, remotion]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
complexity: medium
---

# Video Storyboarding for Tech Demos

Pre-production planning system for creating compelling tech demo videos. Combines the AIDA marketing framework with structured scene planning.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO PRODUCTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ CONCEPT  │──▶│STORYBOARD│──▶│  ASSETS  │──▶│  RENDER  │     │
│  │          │   │          │   │          │   │          │     │
│  │ • AIDA   │   │ • Scenes │   │ • Code   │   │ • Export │     │
│  │ • Hook   │   │ • Timing │   │ • B-roll │   │ • Review │     │
│  │ • CTA    │   │ • Shots  │   │ • Audio  │   │ • Publish│     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## AIDA Framework for Tech Demos

The AIDA framework structures your video to guide viewers from awareness to action.

### Framework Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                         AIDA TIMELINE                            │
├─────────────────────────────────────────────────────────────────┤
│  0s              15s              45s              75s    90s   │
│  │───────────────│────────────────│────────────────│──────│    │
│  │   ATTENTION   │    INTEREST    │     DESIRE     │ACTION│    │
│  │    (15%)      │     (35%)      │     (35%)      │(15%) │    │
│                                                                  │
│  Emotion: Curious   Engaged        Convinced        Motivated   │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Summary

| Phase | Duration | Goal | Content |
|-------|----------|------|---------|
| **A - Attention** | 10-15s | Stop the scroll | Bold claim, visual impact, pattern interrupt |
| **I - Interest** | 30-40s | Demonstrate value | Problem setup, solution intro, feature highlights |
| **D - Desire** | 30-40s | Build connection | Benefits, social proof, differentiation |
| **A - Action** | 10-15s | Drive conversion | Clear CTA, next steps, closing |

### Anti-Patterns to Avoid

```
❌ Logo animations (skip these)
❌ Slow fade-ins
❌ Generic stock footage
❌ Reading from slides
```

## Scene Planning Template

```yaml
# scene-001-hook.yaml
scene:
  id: "001"
  name: "Hook"
  phase: "attention"

timing:
  start: "00:00"
  duration: "00:08"
  end: "00:08"

content:
  narration: |
    What if you could give Claude Code
    the memory of a senior developer?

  on_screen_text:
    - text: "179 Skills"
      animation: "scale-in"
      timing: "0:02-0:04"

visuals:
  background: "dark gradient"
  main_element: "animated skill icons"

transitions:
  in: "cut"
  out: "fade"

assets_required:
  - "skill-icons-spritesheet.png"
  - "claude-logo.svg"
```

## Timing Calculations

### Video Length Guidelines

| Platform | Optimal | Max | Notes |
|----------|---------|-----|-------|
| Twitter/X | 30-45s | 2:20 | Hook in 3s |
| LinkedIn | 30-90s | 10:00 | Value in 15s |
| YouTube Shorts | 30-60s | 60s | Vertical only |
| YouTube | 2-5 min | No limit | Longer = better |
| Product Hunt | 1-2 min | 3:00 | Demo focused |
| GitHub README | 30-60s | 2:00 | Silent-friendly |

### Pacing Calculator

```typescript
interface VideoTimingConfig {
  totalDuration: number; // seconds
  phases: {
    attention: number;  // percentage
    interest: number;
    desire: number;
    action: number;
  };
}

function calculatePhaseTiming(config: VideoTimingConfig) {
  const { totalDuration, phases } = config;

  return {
    attention: {
      start: 0,
      duration: Math.round(totalDuration * phases.attention / 100),
    },
    interest: {
      start: Math.round(totalDuration * phases.attention / 100),
      duration: Math.round(totalDuration * phases.interest / 100),
    },
    // ... desire and action phases
  };
}

// Example: 90 second video
const timing = calculatePhaseTiming({
  totalDuration: 90,
  phases: { attention: 15, interest: 35, desire: 35, action: 15 }
});
```

### Words Per Minute Guide

| Speaking Speed | WPM | Words/30s | Use Case |
|----------------|-----|-----------|----------|
| Slow (dramatic) | 100 | 50 | Hooks, reveals |
| Normal | 130 | 65 | Explanations |
| Fast (excited) | 160 | 80 | Features list |
| Very Fast | 180+ | 90+ | Avoid (unclear) |

## Shot List Template

```
┌──────┬──────────┬─────────────────────────┬─────────┬────────────┐
│ Shot │ Duration │ Description             │ Type    │ Assets     │
├──────┼──────────┼─────────────────────────┼─────────┼────────────┤
│ 001  │ 0:03     │ Logo reveal             │ Motion  │ logo.svg   │
│ 002  │ 0:05     │ Hook text animation     │ Kinetic │ font.otf   │
│ 003  │ 0:08     │ Terminal demo           │ Screen  │ demo.mp4   │
│ 004  │ 0:12     │ Feature walkthrough     │ Screen  │ capture.mp4│
│ 005  │ 0:05     │ CTA with command        │ Static  │ bg.png     │
│TOTAL │ 0:33     │                         │         │            │
└──────┴──────────┴─────────────────────────┴─────────┴────────────┘
```

## Storyboarding Workflow

```
1. DEFINE GOAL
   └─▶ What action should viewers take?
       └─▶ Example: "Install OrchestKit"

2. IDENTIFY AUDIENCE
   └─▶ Who is watching?
       └─▶ Example: "Developers using Claude Code"

3. CRAFT HOOK
   └─▶ What stops the scroll?
       └─▶ Example: "200 skills, one command"

4. MAP AIDA PHASES
   └─▶ Allocate time to each phase
       └─▶ Calculate scene durations

5. WRITE SCENES
   └─▶ Detail each scene with template
       └─▶ Include narration, visuals, timing

6. CREATE SHOT LIST
   └─▶ Break scenes into individual shots
       └─▶ Identify all required assets

7. PLAN B-ROLL
   └─▶ List all supplementary footage
       └─▶ Schedule capture sessions

8. REVIEW & ITERATE
   └─▶ Check timing, flow, message clarity
```

## Remotion Integration

```typescript
interface StoryboardScene {
  id: number;
  phase: 'attention' | 'interest' | 'desire' | 'action';
  timing: string;
  narration: string;
  text: string | null;
}

function sceneToReaction(
  scene: StoryboardScene,
  fps: number = 30
): { component: string; durationInFrames: number } {
  const [start, end] = scene.timing.split('-').map(parseTime);
  const durationSeconds = end - start;

  return {
    component: `Scene${scene.id}`,
    durationInFrames: Math.round(durationSeconds * fps),
  };
}

function parseTime(time: string): number {
  const [mins, secs] = time.split(':').map(Number);
  return mins * 60 + secs;
}
```

## Related Skills

- `video-pacing`: Rhythm and timing rules
- `elevenlabs-narration`: TTS integration
- `content-type-recipes`: Production recipes by content type
- `remotion-composer`: Programmatic video generation

## References

- [AIDA Framework](./references/aida-framework.md) - Deep dive into AIDA psychology
- [Scene Templates](./references/scene-templates.md) - Copy-paste scene templates
- [Pre-Production Checklist](./references/pre-production-checklist.md) - Complete checklist
