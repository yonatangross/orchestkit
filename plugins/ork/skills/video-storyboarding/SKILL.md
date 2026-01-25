---
name: video-storyboarding
description: Pre-production planning for tech demo videos using AIDA framework, scene templates, and shot planning for compelling narratives
tags: [video, storyboard, pre-production, planning, narrative, remotion]
user-invocable: false
version: 1.0.0
---

# Video Storyboarding for Tech Demos

Pre-production planning system for creating compelling tech demo videos. Combines the AIDA marketing framework with structured scene planning to produce engaging content that converts viewers into users.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO PRODUCTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ CONCEPT  │──▶│STORYBOARD│──▶│  ASSETS  │──▶│  RENDER  │     │
│  │          │   │          │   │          │   │          │     │
│  │ • AIDA   │   │ • Scenes │   │ • Code   │   │ • Export │     │
│  │ • Hook   │   │ • Timing │   │ • B-roll │   │ • Review │     │
│  │ • CTA    │   │ • Shots  │   │ • Audio  │   │ • Publish│     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  [This Skill]   [This Skill]  [Production]   [Remotion]        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## AIDA Framework for Tech Demos

The AIDA framework structures your video to guide viewers through a psychological journey from awareness to action.

### Framework Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         AIDA TIMELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  0s              15s              45s              75s    90s   │
│  │───────────────│────────────────│────────────────│──────│    │
│  │   ATTENTION   │    INTEREST    │     DESIRE     │ACTION│    │
│  │    (15%)      │     (35%)      │     (35%)      │(15%) │    │
│  │               │                │                │       │    │
│  │  ┌─────────┐  │  ┌──────────┐  │  ┌──────────┐  │ ┌───┐ │    │
│  │  │ HOOK    │  │  │ PROBLEM  │  │  │ SOLUTION │  │ │CTA│ │    │
│  │  │ Visual  │  │  │ Demo     │  │  │ Benefits │  │ └───┘ │    │
│  │  │ Impact  │  │  │ Features │  │  │ Proof    │  │       │    │
│  │  └─────────┘  │  └──────────┘  │  └──────────┘  │       │    │
│                                                                  │
│  Emotion: Curious   Engaged        Convinced        Motivated   │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Breakdown

#### A - Attention (0-15% of video)

Goal: Stop the scroll, create immediate visual impact

```yaml
attention_phase:
  duration: "10-15 seconds for 90s video"
  elements:
    - hook_statement: "Bold claim or question"
    - visual_impact: "Eye-catching animation or demo"
    - pattern_interrupt: "Unexpected element"

  techniques:
    - "Start with the end result"
    - "Show the 'wow' moment first"
    - "Use motion to draw eye"
    - "Bold typography with contrast"

  anti_patterns:
    - "Logo animations (skip these)"
    - "Slow fade-ins"
    - "Generic stock footage"
    - "Reading from slides"
```

OrchestKit Example:
```
Scene: Terminal with rapid-fire commands
Hook: "179 skills. 34 agents. One plugin."
Visual: Animated skill icons flowing into Claude
Duration: 8 seconds
```

#### I - Interest (15-50% of video)

Goal: Demonstrate the problem and introduce your solution

```yaml
interest_phase:
  duration: "30-40 seconds for 90s video"
  structure:
    problem_setup:
      duration: "10-15s"
      content: "Relatable pain point"
      visuals: "Before state / struggle"

    solution_intro:
      duration: "15-20s"
      content: "Your tool in action"
      visuals: "Clean demo footage"

    feature_highlights:
      duration: "10-15s"
      content: "2-3 key capabilities"
      visuals: "Quick feature montage"
```

OrchestKit Example:
```
Problem: "Managing prompts across projects is chaos"
  - Split screen: messy notes vs organized skills

Solution: "OrchestKit organizes everything"
  - Show /ork:implement invocation
  - Parallel agents spawning

Features: "Auto-loaded context, quality gates, task tracking"
  - Quick cuts of each feature
```

#### D - Desire (50-85% of video)

Goal: Build emotional connection through benefits and proof

```yaml
desire_phase:
  duration: "30-40 seconds for 90s video"
  components:
    benefits:
      - "Speed improvements with metrics"
      - "Quality outcomes shown"
      - "Time savings visualized"

    social_proof:
      - "Usage statistics"
      - "Community size"
      - "GitHub stars/downloads"

    differentiation:
      - "What makes you unique"
      - "Competitor comparison (subtle)"
```

OrchestKit Example:
```
Benefits:
  - "10x faster with parallel agents"
  - "Consistent quality with 144 hooks"
  - "Never forget patterns with skill library"

Proof:
  - "Used in 50+ projects"
  - "163 battle-tested skills"
  - GitHub activity visualization
```

#### A - Action (85-100% of video)

Goal: Clear, simple call-to-action

```yaml
action_phase:
  duration: "10-15 seconds for 90s video"
  elements:
    primary_cta:
      text: "Single clear action"
      visual: "Button or command"
      urgency: "Why now"

    secondary_info:
      - "Where to find more"
      - "Quick start hint"

    closing:
      - "Logo/brand"
      - "Tagline"
```

OrchestKit Example:
```
CTA: "Add to Claude Code in 30 seconds"
Command: claude mcp add orchestkit
Closing: OrchestKit logo + "AI-assisted development, organized"
```

## Scene Planning Template

### Scene Document Structure

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
    - text: "163 Skills"
      position: "center"
      animation: "scale-in"
      timing: "0:02-0:04"

    - text: "34 Agents"
      position: "center"
      animation: "scale-in"
      timing: "0:04-0:06"

    - text: "One Plugin"
      position: "center"
      animation: "scale-in"
      timing: "0:06-0:08"

visuals:
  background: "dark gradient"
  main_element: "animated skill icons"

  shots:
    - type: "animation"
      description: "Skills flowing into Claude icon"
      duration: "8s"

transitions:
  in: "cut"
  out: "fade"

assets_required:
  - "skill-icons-spritesheet.png"
  - "claude-logo.svg"
  - "particle-effect-preset"

notes: |
  High energy opening. Music should peak here.
  Consider sound effect on each number reveal.
```

### Shot List Template

```
┌──────────────────────────────────────────────────────────────────┐
│                          SHOT LIST                                │
├──────┬──────────┬─────────────────────────┬─────────┬────────────┤
│ Shot │ Duration │ Description             │ Type    │ Assets     │
├──────┼──────────┼─────────────────────────┼─────────┼────────────┤
│ 001  │ 0:03     │ Logo reveal             │ Motion  │ logo.svg   │
│ 002  │ 0:05     │ Hook text animation     │ Kinetic │ font.otf   │
│ 003  │ 0:08     │ Terminal demo           │ Screen  │ demo.mp4   │
│ 004  │ 0:12     │ Feature walkthrough     │ Screen  │ capture.mp4│
│ 005  │ 0:06     │ Before/after split      │ Split   │ both.mp4   │
│ 006  │ 0:10     │ Agent parallel demo     │ Screen  │ agents.mp4 │
│ 007  │ 0:08     │ Metrics animation       │ Motion  │ data.json  │
│ 008  │ 0:05     │ CTA with command        │ Static  │ bg.png     │
│ 009  │ 0:03     │ End card                │ Static  │ endcard.psd│
├──────┼──────────┼─────────────────────────┼─────────┼────────────┤
│TOTAL │ 1:00     │                         │         │            │
└──────┴──────────┴─────────────────────────┴─────────┴────────────┘
```

## Timing Calculations

### Video Length Guidelines

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMAL VIDEO LENGTHS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Platform        │ Optimal    │ Max        │ Notes              │
│  ────────────────┼────────────┼────────────┼────────────────    │
│  Twitter/X       │ 30-45s     │ 2:20       │ Hook in 3s         │
│  LinkedIn        │ 30-90s     │ 10:00      │ Value in 15s       │
│  YouTube Shorts  │ 30-60s     │ 60s        │ Vertical only      │
│  YouTube         │ 2-5 min    │ No limit   │ Longer = better    │
│  Product Hunt    │ 1-2 min    │ 3:00       │ Demo focused       │
│  GitHub README   │ 30-60s     │ 2:00       │ Silent-friendly    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pacing Calculator

```typescript
// Timing calculation utilities

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
      end: Math.round(totalDuration * phases.attention / 100)
    },
    interest: {
      start: Math.round(totalDuration * phases.attention / 100),
      duration: Math.round(totalDuration * phases.interest / 100),
      end: Math.round(totalDuration * (phases.attention + phases.interest) / 100)
    },
    desire: {
      start: Math.round(totalDuration * (phases.attention + phases.interest) / 100),
      duration: Math.round(totalDuration * phases.desire / 100),
      end: Math.round(totalDuration * (phases.attention + phases.interest + phases.desire) / 100)
    },
    action: {
      start: Math.round(totalDuration * (phases.attention + phases.interest + phases.desire) / 100),
      duration: Math.round(totalDuration * phases.action / 100),
      end: totalDuration
    }
  };
}

// Example: 90 second video
const timing = calculatePhaseTiming({
  totalDuration: 90,
  phases: {
    attention: 15,  // 13.5s → 14s
    interest: 35,   // 31.5s → 32s
    desire: 35,     // 31.5s → 31s
    action: 15      // 13.5s → 13s
  }
});
```

### Words Per Minute Guide

```
┌─────────────────────────────────────────────────────────────────┐
│                    NARRATION TIMING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Speaking Speed    │ WPM     │ Words/30s  │ Use Case            │
│  ──────────────────┼─────────┼────────────┼───────────────      │
│  Slow (dramatic)   │ 100     │ 50         │ Hooks, reveals      │
│  Normal            │ 130     │ 65         │ Explanations        │
│  Fast (excited)    │ 160     │ 80         │ Features list       │
│  Very Fast         │ 180+    │ 90+        │ Avoid (unclear)     │
│                                                                  │
│  On-Screen Text:                                                 │
│  ──────────────────┼─────────┼────────────┼───────────────      │
│  Headline          │ N/A     │ 3-5 words  │ 2-3 seconds         │
│  Subtext           │ N/A     │ 8-12 words │ 3-4 seconds         │
│  Code snippet      │ N/A     │ Varies     │ 4-8 seconds         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## B-Roll Requirements

### B-Roll Categories

```yaml
b_roll_library:
  screen_captures:
    description: "Recorded demos and UI interactions"
    requirements:
      - "4K resolution minimum"
      - "60fps for smooth scrolling"
      - "Clean desktop (no notifications)"
      - "Consistent terminal theme"

    examples:
      - "Terminal running commands"
      - "Code editor with syntax highlighting"
      - "Browser showing documentation"
      - "Split-screen comparisons"

  motion_graphics:
    description: "Animated illustrations and diagrams"
    requirements:
      - "Vector-based for scaling"
      - "Consistent color palette"
      - "Smooth easing curves"
      - "Loop-friendly when possible"

    examples:
      - "Data flow animations"
      - "Architecture diagrams"
      - "Feature icons"
      - "Progress indicators"

  kinetic_typography:
    description: "Animated text and quotes"
    requirements:
      - "Readable at 1080p"
      - "Minimum 2 second display"
      - "High contrast"
      - "Consistent font family"

    examples:
      - "Key statistics"
      - "Feature names"
      - "User quotes"
      - "CTAs"

  abstract_visuals:
    description: "Background elements and transitions"
    requirements:
      - "Subtle, not distracting"
      - "Brand-aligned colors"
      - "Seamlessly loopable"

    examples:
      - "Gradient backgrounds"
      - "Particle effects"
      - "Grid patterns"
      - "Geometric shapes"
```

### B-Roll Shot List

```
┌──────────────────────────────────────────────────────────────────┐
│                    B-ROLL INVENTORY                               │
├─────────┬────────────────────────────────┬───────────┬───────────┤
│ ID      │ Description                    │ Duration  │ Status    │
├─────────┼────────────────────────────────┼───────────┼───────────┤
│ BR-001  │ Terminal: skill invocation     │ 15s       │ [ ]       │
│ BR-002  │ Terminal: agent spawning       │ 20s       │ [ ]       │
│ BR-003  │ Terminal: hook execution       │ 10s       │ [ ]       │
│ BR-004  │ VSCode: code completion        │ 15s       │ [ ]       │
│ BR-005  │ Split: before/after workflow   │ 10s       │ [ ]       │
│ BR-006  │ Animation: skill flow diagram  │ 8s        │ [ ]       │
│ BR-007  │ Animation: agent architecture  │ 8s        │ [ ]       │
│ BR-008  │ Typography: feature names      │ 12s       │ [ ]       │
│ BR-009  │ Typography: statistics         │ 8s        │ [ ]       │
│ BR-010  │ Background: gradient loop      │ 30s       │ [ ]       │
└─────────┴────────────────────────────────┴───────────┴───────────┘
```

## Storyboard Creation Process

### Step-by-Step Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                 STORYBOARDING WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEFINE GOAL                                                  │
│     └─▶ What action should viewers take?                        │
│         └─▶ Example: "Install OrchestKit"                       │
│                                                                  │
│  2. IDENTIFY AUDIENCE                                            │
│     └─▶ Who is watching?                                        │
│         └─▶ Example: "Developers using Claude Code"             │
│                                                                  │
│  3. CRAFT HOOK                                                   │
│     └─▶ What stops the scroll?                                  │
│         └─▶ Example: "179 skills, one command"                  │
│                                                                  │
│  4. MAP AIDA PHASES                                              │
│     └─▶ Allocate time to each phase                             │
│         └─▶ Calculate scene durations                           │
│                                                                  │
│  5. WRITE SCENES                                                 │
│     └─▶ Detail each scene with template                         │
│         └─▶ Include narration, visuals, timing                  │
│                                                                  │
│  6. CREATE SHOT LIST                                             │
│     └─▶ Break scenes into individual shots                      │
│         └─▶ Identify all required assets                        │
│                                                                  │
│  7. PLAN B-ROLL                                                  │
│     └─▶ List all supplementary footage                          │
│         └─▶ Schedule capture sessions                           │
│                                                                  │
│  8. REVIEW & ITERATE                                             │
│     └─▶ Check timing, flow, message clarity                     │
│         └─▶ Get feedback before production                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Example: OrchestKit Demo Storyboard

### 60-Second Product Demo

```yaml
video:
  title: "OrchestKit: AI Development, Organized"
  duration: 60
  target_audience: "Claude Code users"
  goal: "Drive plugin installation"

scenes:
  - id: 1
    phase: attention
    timing: "0:00-0:08"
    narration: "What if Claude Code remembered everything a senior developer knows?"
    visuals: "Skill icons flowing into Claude logo"
    text: "163 Skills • 34 Agents • 144 Hooks"

  - id: 2
    phase: interest
    timing: "0:08-0:18"
    narration: "Most AI coding sessions start from scratch. Context lost. Patterns forgotten."
    visuals: "Split screen - messy chat vs organized workflow"
    text: null

  - id: 3
    phase: interest
    timing: "0:18-0:28"
    narration: "OrchestKit gives Claude instant access to battle-tested patterns."
    visuals: "Terminal showing /ork:implement with parallel agents"
    text: "Parallel Agents"

  - id: 4
    phase: desire
    timing: "0:28-0:42"
    narration: "Built-in quality gates catch issues before they ship. Hooks validate every step."
    visuals: "Hook execution with green checkmarks"
    text: "144 Quality Hooks"

  - id: 5
    phase: desire
    timing: "0:42-0:50"
    narration: "From testing to deployment, every pattern you need is one command away."
    visuals: "Quick cuts of different skill categories"
    text: "Testing • Security • Performance • DevOps"

  - id: 6
    phase: action
    timing: "0:50-0:60"
    narration: "Add OrchestKit to Claude Code in 30 seconds."
    visuals: "Terminal with install command, success message"
    text: "claude mcp add orchestkit"
    cta: "Install Now"

assets_needed:
  - "claude-logo.svg"
  - "skill-icons-sprite.png"
  - "terminal-recording-implement.mp4"
  - "terminal-recording-hooks.mp4"
  - "background-gradient.mp4"
```

## Integration with Remotion

### Scene to Component Mapping

```typescript
// Map storyboard scenes to Remotion components

interface StoryboardScene {
  id: number;
  phase: 'attention' | 'interest' | 'desire' | 'action';
  timing: string;
  narration: string;
  visuals: string;
  text: string | null;
}

interface RemotionScene {
  component: string;
  durationInFrames: number;
  props: Record<string, unknown>;
}

function sceneToReaction(
  scene: StoryboardScene,
  fps: number = 30
): RemotionScene {
  const [start, end] = scene.timing.split('-').map(parseTime);
  const durationSeconds = end - start;

  return {
    component: `Scene${scene.id}`,
    durationInFrames: Math.round(durationSeconds * fps),
    props: {
      narration: scene.narration,
      text: scene.text,
      phase: scene.phase
    }
  };
}

function parseTime(time: string): number {
  const [mins, secs] = time.split(':').map(Number);
  return mins * 60 + secs;
}
```

## References

- `references/aida-framework.md` - Deep dive into AIDA psychology
- `references/scene-templates.md` - Copy-paste scene templates
- `references/pre-production-checklist.md` - Complete checklist before filming
