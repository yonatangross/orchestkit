---
title: Follow structured pre-production and recording workflow to prevent costly re-shoots
impact: HIGH
impactDescription: "Structured pre-production and recording workflow prevents costly re-shoots and editing rework"
tags: video, storyboard, narration, hooks, pacing, recording, VHS, manim
---

## Video Production Pipeline

**Incorrect — jumping straight to recording:**
```
# WRONG: No planning, no script, no timing
vhs record my-demo.tape
# Results in: rambling, bad pacing, missed key moments
```

**Correct — structured pre-production pipeline:**
```
video-storyboarding     terminal-demo-generator     manim-visualizer
(pre-production)        (recording)                 (animations)
       |                       |                         |
       v                       v                         v
content-type-recipes    remotion-composer <---- scene-intro-cards
(recipes)               (composition)          callout-positioning
       |                       |               thumbnail-first-frame
       v                       v
narration-scripting     music-sfx-selection
hook-formulas           audio-mixing-patterns
video-pacing            elevenlabs-narration
```

### Pre-Production Checklist

| Step | Rule File | Key Pattern |
|------|-----------|-------------|
| Storyboarding | `preproduction-storyboard.md` | AIDA framework, scene templates, shot planning |
| Narration | `preproduction-narration.md` | Scene-by-scene scripts, timing markers, WPM pacing |
| Hook Formulas | `preproduction-hooks.md` | 12 proven hook patterns for scroll-stopping intros |
| Content Recipes | `preproduction-recipes.md` | Content type recipes (skill demo, agent demo, tutorial) |
| Pacing | `preproduction-pacing.md` | Video rhythm, attention curves, platform-specific timing |

### Recording Patterns

| Tool | Best For | Format |
|------|----------|--------|
| VHS | Terminal recordings | `.tape` script files |
| asciinema | CLI sessions | `.cast` recordings |
| Manim | Architecture animations | Python scripts |

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Frame rate | 30fps (standard), 60fps (smooth typing) |
| Resolution | 1920x1080 (YouTube), 1080x1920 (shorts) |
| Hook duration | 3 seconds max |
| AIDA split | 15% attention, 35% interest, 35% desire, 15% action |
| Narration WPM | 130-150 (standard), 120-140 (technical) |
| Intro card duration | 2-4 seconds |
