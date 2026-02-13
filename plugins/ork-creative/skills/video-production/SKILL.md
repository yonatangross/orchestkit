---
name: video-production
description: Video production pipeline for tech demos covering pre-production, recording, composition, and audio. Use when creating demo videos, terminal recordings, Remotion compositions, narration scripts, or audio mixing.
tags: [video, demo, remotion, vhs, narration, audio, storyboard, manim, thumbnail, pacing]
context: fork
agent: demo-producer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
---

# Video Production

Comprehensive pipeline for creating production-quality tech demo videos. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Pre-Production](#pre-production) | 5 | CRITICAL | Storyboarding, narration scripts, hooks, recipes, pacing |
| [Recording](#recording) | 2 | HIGH | Terminal recording with VHS/asciinema, Manim animations |
| [Composition](#composition) | 4 | HIGH | Remotion compositions, scene cards, callouts, thumbnails |
| [Audio](#audio) | 4 | HIGH | Music selection, mixing, ElevenLabs TTS, SFX placement |
| [Visual Effects](#visual-effects) | 4 | MEDIUM | 3D graphics, data visualization, Lottie, effects library |
| [Captions & Output](#captions--output) | 2 | MEDIUM | Captions/subtitles, showcase templates, final rendering |

**Total: 21 rules across 6 categories**

## Pre-Production

Planning, scripting, and structuring video content before recording.

| Rule | File | Key Pattern |
|------|------|-------------|
| Storyboarding | `rules/preproduction-storyboard.md` | AIDA framework, scene templates, shot planning |
| Narration | `rules/preproduction-narration.md` | Scene-by-scene scripts, timing markers, WPM pacing |
| Hook Formulas | `rules/preproduction-hooks.md` | 12 proven hook patterns for scroll-stopping intros |
| Content Recipes | `rules/preproduction-recipes.md` | Content type recipes (skill demo, agent demo, tutorial) |
| Pacing | `rules/preproduction-pacing.md` | Video rhythm, attention curves, platform-specific timing |

## Recording

Capturing terminal sessions and creating animated visualizations.

| Rule | File | Key Pattern |
|------|------|-------------|
| Terminal Recording | `rules/recording-terminal.md` | VHS tape format, asciinema recording, CC simulation |
| Manim Animations | `rules/recording-manim.md` | Manim animations for workflow and architecture visualization |

## Composition

Assembling video elements into final compositions with Remotion.

| Rule | File | Key Pattern |
|------|------|-------------|
| Remotion Composition | `rules/composition-remotion.md` | Remotion patterns, folder organization, animation presets |
| Scene Intro Cards | `rules/composition-scenes.md` | Transition cards, timing patterns, animation sequences |
| Callout Positioning | `rules/composition-callouts.md` | Debug grids, coordinate systems, responsive positioning |
| Thumbnails | `rules/composition-thumbnails.md` | Thumbnail formulas, first-frame optimization, platform specs |

## Audio

Music selection, sound effects, mixing, and text-to-speech narration.

| Rule | File | Key Pattern |
|------|------|-------------|
| Music Selection | `rules/audio-music.md` | Music matching matrix, BPM guidelines, mood-to-genre mapping |
| Audio Mixing | `rules/audio-mixing.md` | ffmpeg filters, ducking patterns, volume balancing, LUFS |
| ElevenLabs TTS | `rules/audio-elevenlabs.md` | ElevenLabs API integration, voice selection, cost optimization |
| SFX Placement | `rules/audio-sfx.md` | Sound effect timing, UI sounds, transition audio cues |

## Visual Effects

Advanced visual elements for Remotion compositions.

| Rule | File | Key Pattern |
|------|------|-------------|
| 3D Graphics | `rules/visual-3d.md` | Three.js in Remotion, CSS-based 3D, floating logos |
| Data Visualization | `rules/visual-data-viz.md` | StatCounter, ProgressRing, BarChart, LineChart components |
| Lottie Animations | `rules/visual-lottie.md` | After Effects Lottie integration, animated emojis, Rive |
| Effects Library | `rules/visual-effects.md` | ParticleBackground, MeshGradient, GlowOrbs, transitions |

## Captions & Output

Subtitles, captions, and final rendering for distribution.

| Rule | File | Key Pattern |
|------|------|-------------|
| Captions | `rules/output-captions.md` | TikTokCaption, KaraokeCaption, TypingCaption, subtitles |
| Showcase & Render | `rules/output-showcase.md` | Showcase templates, multi-format rendering, layer stack |

## Production Pipeline

```
video-storyboarding     terminal-demo-generator     manim-visualizer
(pre-production)        (recording)                 (animations)
       |                       |                         |
       v                       v                         v
content-type-recipes    remotion-composer ◄──── scene-intro-cards
(recipes)               (composition)          callout-positioning
       |                       |               thumbnail-first-frame
       v                       v
narration-scripting     music-sfx-selection
hook-formulas           audio-mixing-patterns
video-pacing            elevenlabs-narration
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Frame rate | 30fps (standard), 60fps (smooth typing) |
| Resolution | 1920x1080 (YouTube), 1080x1920 (shorts) |
| Music volume | -24 to -20 dB under narration |
| Hook duration | 3 seconds max |
| AIDA split | 15% attention, 35% interest, 35% desire, 15% action |
| TTS model | eleven_multilingual_v2 (production) |
| Narration WPM | 130-150 (standard), 120-140 (technical) |
| Thumbnail text | 3-4 words maximum |
| Intro card duration | 2-4 seconds |
| Debug grid | Enabled during dev, disabled for renders |

## Common Mistakes

1. No hook in first 3 seconds (lose 33% of viewers)
2. Music competing with narration (duck -6 to -8 dB)
3. Spring animations starting at 0 (invisible first frame)
4. Hardcoded callout coordinates (break on format change)
5. Intro cards too long (>5s disrupts flow)
6. Reading from slides instead of demonstrating
7. No CTA at end (missed conversion opportunity)
8. Inconsistent pacing (overwhelm or bore viewers)
9. Missing captions (accessibility and silent browsing)
10. Not testing thumbnails at small preview size

## Evaluations

See `test-cases.json` for 21 test cases across all categories.

## Related Skills

- `demo-producer` - Full demo pipeline orchestration agent
- `ascii-visualizer` - ASCII art terminal visualizations

## Capability Details

### pre-production
**Keywords:** storyboard, plan, AIDA, narrative, scene, shot list
**Solves:**
- Plan video structure with AIDA framework
- Create scene-by-scene storyboards
- Calculate timing and phase allocation

### narration-scripting
**Keywords:** narration, script, voiceover, timing, WPM, CTA
**Solves:**
- Write narration scripts with timing markers
- Calculate words-per-minute for video length
- Create CTA patterns for different platforms

### hook-creation
**Keywords:** hook, attention, scroll-stop, opening, intro
**Solves:**
- Create scroll-stopping video openings
- Apply proven hook formulas
- Match hook intensity to platform

### terminal-recording
**Keywords:** terminal, VHS, asciinema, recording, CLI, demo
**Solves:**
- Record terminal sessions for demo videos
- Generate VHS tape scripts
- Simulate Claude Code output

### remotion-composition
**Keywords:** remotion, composition, video, animation, render
**Solves:**
- Compose final videos with Remotion
- Add branded overlays and animations
- Render multi-format exports

### audio-production
**Keywords:** audio, music, SFX, mixing, ducking, TTS, ElevenLabs
**Solves:**
- Select and mix background music
- Implement audio ducking for narration
- Generate TTS narration with ElevenLabs

### visual-design
**Keywords:** thumbnail, callout, 3D, effects, data-viz, caption
**Solves:**
- Design thumbnails for high CTR
- Position callouts with debug grids
- Add visual effects and captions
