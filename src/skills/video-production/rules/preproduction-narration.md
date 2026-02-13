---
title: Narration Scripting
impact: CRITICAL
impactDescription: "Poorly timed narration desynchronizes with visuals and degrades viewer comprehension and engagement"
tags: narration, script, voiceover, timing, WPM, TTS, CTA
---

## Narration Scripting

Scene-by-scene narration scripts optimized for video production, TTS synthesis, and audience engagement.

**Core Principle:** Narration = Visual Support + Comprehension Timing + Emotional Arc

### WPM Guidelines by Content Type

```
Content Type          WPM Range    Pause Frequency    Use Case
─────────────────────────────────────────────────────────────────
Technical Demo        120-140      Every 8-10 words   Complex UI, code
Tutorial              130-150      Every 10-12 words  Step-by-step
Product Feature       140-160      Every 12-15 words  Marketing, benefits
Quick Overview        150-170      Every 15-20 words  Intro sequences
High Energy           170-190      Minimal pauses     TikTok, Reels
```

### Script Length Formula

```
(Video Duration in seconds) x (WPM / 60) = Word Count

Examples:
├── 15s video @ 150 WPM = 37 words
├── 30s video @ 140 WPM = 70 words
├── 60s video @ 130 WPM = 130 words
└── 5m video @ 140 WPM = 700 words
```

### Sync Point Types

```
Type            Symbol    Precision
──────────────────────────────────────
Hard Sync       [!]       +/- 2 frames
Soft Sync       [~]       +/- 10 frames
Window Sync     [...]     Flexible
Lead Sync       [>]       100-300ms early
Lag Sync        [<]       100-500ms late
```

### Script Format Standard

```markdown
## Scene: [Scene Name]
**Duration:** [start] - [end] (total seconds)
**Visual:** [What's on screen]

**Narration:**
[!0:00.000] "First word lands exactly here."
[~0:02.500] "This phrase starts around this mark."
[...0:05-0:08] "This section plays during this window."

**Pauses:**
- [0:04.000] 300ms breath pause
- [0:08.500] 500ms dramatic pause
```

### CTA Timing Rules

```
Video Length    CTA Start       CTA Duration
────────────────────────────────────────────
<15s            Last 3s         2-3s
15-30s          Last 5s         3-5s
30-60s          Last 8-10s      6-8s
60-120s         Last 12-15s     8-12s
>2min           Last 20-30s     15-20s
```

### TTS Optimization

- Use contractions ("It's" not "It is") for natural speech
- Include punctuation for pauses: commas, periods, ellipses
- Mark emphasis with `*asterisks*` or `{emphasis:word}`
- Avoid ALL CAPS (TTS reads as acronym)
- Do not include URLs verbatim

**References:** `references/script-templates.md`, `references/timing-markers.md`, `references/pacing-guidelines.md`
