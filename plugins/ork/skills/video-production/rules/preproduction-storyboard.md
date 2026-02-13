---
title: Video Storyboarding
impact: CRITICAL
impactDescription: "Without structured pre-production planning, videos lack narrative coherence and fail to guide viewers through a conversion funnel"
tags: video, storyboard, AIDA, scene, planning, pre-production
---

## Video Storyboarding

Pre-production planning system for creating compelling tech demo videos using the AIDA marketing framework with structured scene planning.

### AIDA Framework Timeline

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

### Scene Planning Template

```yaml
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
    - text: "200 Skills"
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
```

### Pacing Calculator

```typescript
function calculatePhaseTiming(totalDuration: number) {
  return {
    attention: { start: 0, duration: Math.round(totalDuration * 0.15) },
    interest: { start: Math.round(totalDuration * 0.15), duration: Math.round(totalDuration * 0.35) },
    desire: { start: Math.round(totalDuration * 0.50), duration: Math.round(totalDuration * 0.35) },
    action: { start: Math.round(totalDuration * 0.85), duration: Math.round(totalDuration * 0.15) },
  };
}
```

### Storyboarding Workflow

```
1. DEFINE GOAL → What action should viewers take?
2. IDENTIFY AUDIENCE → Who is watching?
3. CRAFT HOOK → What stops the scroll?
4. MAP AIDA PHASES → Allocate time to each phase
5. WRITE SCENES → Detail each scene with template
6. CREATE SHOT LIST → Break scenes into individual shots
7. PLAN B-ROLL → List supplementary footage
8. REVIEW & ITERATE → Check timing, flow, message clarity
```

### Platform Timing Guidelines

| Platform | Optimal | Max | Notes |
|----------|---------|-----|-------|
| Twitter/X | 30-45s | 2:20 | Hook in 3s |
| LinkedIn | 30-90s | 10:00 | Value in 15s |
| YouTube Shorts | 30-60s | 60s | Vertical only |
| YouTube | 2-5 min | No limit | Longer = better |
| Product Hunt | 1-2 min | 3:00 | Demo focused |
| GitHub README | 30-60s | 2:00 | Silent-friendly |

### Anti-Patterns

- Logo animations (skip these)
- Slow fade-ins at the start
- Generic stock footage
- Reading from slides

**References:** `references/aida-framework.md`, `references/scene-templates.md`, `references/pre-production-checklist.md`
