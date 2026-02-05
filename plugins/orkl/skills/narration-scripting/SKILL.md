---
name: narration-scripting
description: Scene-by-scene narration scripts for videos. Use when writing voiceover scripts, adding timing markers, or creating CTA patterns for demos
tags: [video, narration, script, timing, pacing, copywriting]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
---

# Narration Scripting

Comprehensive guide to writing narration scripts optimized for video production, TTS synthesis, and audience engagement.

## Overview

- Writing scene-by-scene narration for demo videos
- Timing synchronization between visuals and voice
- Pacing narration for optimal comprehension
- CTA scripting that converts viewers
- TTS-optimized script formatting
- Multi-format narration (horizontal, vertical, square)

## Core Principle

**Narration = Visual Support + Comprehension Timing + Emotional Arc**

Narration should enhance visuals, not compete with them. Words must land precisely when viewers need context, and pacing must match cognitive load.

## Timing Fundamentals

### Frame to Milliseconds Conversion

```
Frame Rate    1 Frame    15 Frames    30 Frames    60 Frames
─────────────────────────────────────────────────────────────
24 fps        41.67ms    625ms        1250ms       2500ms
30 fps        33.33ms    500ms        1000ms       2000ms
60 fps        16.67ms    250ms        500ms        1000ms

Common Timing Shortcuts:
├── 30fps: Frame# x 33.33 = milliseconds
├── 24fps: Frame# x 41.67 = milliseconds
└── 60fps: Frame# / 60 x 1000 = milliseconds
```

### Sync Point Types

```
Type            Symbol    Usage                   Precision
──────────────────────────────────────────────────────────────
Hard Sync       [!]       Word lands on action    +/- 2 frames
Soft Sync       [~]       Word near action        +/- 10 frames
Window Sync     [...]     Word during scene       Flexible
Lead Sync       [>]       Word before action      100-300ms early
Lag Sync        [<]       Word after action       100-500ms late
```

## Words Per Minute (WPM) Guidelines

### Comprehension-Based Pacing

```
Content Type          WPM Range    Pause Frequency    Use Case
─────────────────────────────────────────────────────────────────
Technical Demo        120-140      Every 8-10 words   Complex UI, code
Tutorial              130-150      Every 10-12 words  Step-by-step
Product Feature       140-160      Every 12-15 words  Marketing, benefits
Quick Overview        150-170      Every 15-20 words  Intro sequences
High Energy           170-190      Minimal pauses     TikTok, Reels
Documentary           110-130      Natural pauses     Storytelling
```

### Platform-Specific WPM

```
Platform       WPM Range    Why
────────────────────────────────────────────────────
TikTok         160-180      Fast scroll, hook fast
Reels          150-170      Slightly slower aesthetic
YouTube Shorts 140-160      More value-focused
YouTube Long   130-150      Comprehension over speed
LinkedIn       120-140      Professional, clear
Twitter/X      150-170      Quick engagement
```

### Calculating Script Length

```
Formula: (Video Duration in seconds) x (WPM / 60) = Word Count

Examples:
├── 15s video @ 150 WPM = 37 words
├── 30s video @ 140 WPM = 70 words
├── 60s video @ 130 WPM = 130 words
├── 5m video @ 140 WPM = 700 words
└── 10m video @ 135 WPM = 1350 words

Include pause time:
Effective words = Total words - (pause_count x 1.5)
```

## Script Format Standard

### Basic Script Block

```markdown
## Scene: [Scene Name]
**Duration:** [start] - [end] (total seconds)
**Visual:** [What's on screen]

---
**Narration:**
[!0:00.000] "First word lands exactly here."
[~0:02.500] "This phrase starts around this mark."
[...0:05-0:08] "This section plays during this window."
[>0:10.000] "This leads INTO the next action."
[<0:12.500] "This follows the completed action."

**Pauses:**
- [0:04.000] 300ms breath pause
- [0:08.500] 500ms dramatic pause

**Notes:**
- Emphasis on "exactly" and "action"
- Tone: Confident, clear
```

### Extended Format with TTS Markers

```markdown
## Scene: Product Feature Demo
**Duration:** 0:15.000 - 0:30.000 (15s)
**Visual:** Screen recording of feature in action

---
**Narration (TTS-Optimized):**
[!0:15.000] "Watch how *simple* this is." {rate:0.9}
[~0:17.500] "Just click... {pause:200ms} and drag." {rate:1.0}
[!0:20.000] "The AI handles the rest." {emphasis:high}
[...0:22-0:26] "No configuration needed. No learning curve."
[>0:27.500] "Ready to try it yourself?" {tone:inviting}

**TTS Parameters:**
- Voice: Professional, warm (e.g., OpenAI "nova", Gemini "Kore")
- Base rate: 1.0x
- Pitch: Neutral

**Sync Points:**
- 0:15.000 [HARD] Word "Watch" on button hover
- 0:17.500 [SOFT] "click" during click animation
- 0:20.000 [HARD] "AI" on result appearing
```

## Scene-by-Scene Templates

### Demo Video Template (30s)

```markdown
## Scene 1: Hook
**Duration:** 0:00 - 0:03 (3s)
**Visual:** Problem statement or pain point visual

---
**Narration:**
[!0:00.000] "Tired of {problem}?"
[~0:01.500] "There's a better way."

**WPM:** 160 (8 words / 3s)
**Tone:** Empathetic, intriguing

---

## Scene 2: Solution Intro
**Duration:** 0:03 - 0:08 (5s)
**Visual:** Product/tool name reveal, interface preview

---
**Narration:**
[!0:03.000] "Meet {ProductName}."
[~0:04.500] "The {category} that actually works."
[...0:06-0:08] "Let me show you."

**WPM:** 140 (12 words / 5s)
**Tone:** Confident, friendly

---

## Scene 3: Demo Action
**Duration:** 0:08 - 0:20 (12s)
**Visual:** Screen recording of key feature

---
**Narration:**
[!0:08.000] "Here's how it works."
[~0:09.500] "Step one: {action}."
[!0:12.000] "Step two: {action}."
[~0:15.000] "And just like that..."
[!0:17.000] "{Result in one sentence}."
[...0:18-0:20] Pause for visual impact

**WPM:** 130 (26 words / 12s)
**Tone:** Clear, instructional

---

## Scene 4: CTA
**Duration:** 0:20 - 0:30 (10s)
**Visual:** CTA screen with link/QR code

---
**Narration:**
[!0:20.000] "Ready to {benefit}?"
[~0:22.000] "Try {ProductName} free today."
[!0:25.000] "Link in bio." OR "Click below."
[...0:27-0:30] {Music swell, no narration}

**WPM:** 120 (15 words / 7.5s active narration)
**Tone:** Inviting, urgent but not pushy
```

### Tutorial Template (60s)

See: `references/script-templates.md`

### Promo Template (15s)

See: `references/script-templates.md`

## CTA Scripting Patterns

### CTA Formula Framework

```
Pattern              Script Template                          Use Case
─────────────────────────────────────────────────────────────────────────
Direct Ask           "Try {product} free today."             Conversion-focused
Benefit-First        "Start {benefit}ing now."               Value-focused
Scarcity             "Join {number} others before {time}."   Urgency
Social Proof         "{Number} developers already use this." Trust-building
Next Step            "Here's what to do next..."             Educational
Question CTA         "Ready to {transformation}?"            Engagement
```

### CTA Timing Rules

```
Video Length    CTA Start       CTA Duration    Approach
────────────────────────────────────────────────────────────
<15s            Last 3s         2-3s            Direct, single CTA
15-30s          Last 5s         3-5s            Benefit + action
30-60s          Last 8-10s      6-8s            Setup + CTA + reinforce
60-120s         Last 12-15s     8-12s           Recap + CTA + social proof
>2min           Last 20-30s     15-20s          Summary + CTA + next content
```

### Platform-Specific CTAs

```
Platform        CTA Script Pattern                    Notes
────────────────────────────────────────────────────────────────────
TikTok          "Follow for more {topic}."            Simple, immediate
                "Link in bio."
Reels           "Save this for later."                Encourages saves
                "Share with someone who needs this."
YouTube Shorts  "Subscribe for more {topic}."         Channel growth
                "Full tutorial linked above."
YouTube Long    "Like and subscribe."                 Engagement boost
                "Watch this next: [card]"             Session time
LinkedIn        "What's your experience with this?"   Comment engagement
                "DM me for the template."             Lead generation
```

## TTS Optimization

### Script Formatting for TTS

```markdown
**DO:**
- Use contractions: "It's" not "It is" (more natural)
- Write phonetically for tricky words: "GIF" → "gif" or "jif"
- Include punctuation for pauses: commas, periods, ellipses
- Mark emphasis with *asterisks* or {emphasis:word}
- Specify pronunciation: "Read" {rhymes with "red"}

**DON'T:**
- Use ALL CAPS (TTS reads as acronym)
- Include URLs verbatim (spell out or skip)
- Use special characters: &, @, # (except as words)
- Write numbers as digits for large numbers: "1,234,567"
```

### TTS Markup Examples

```markdown
**Plain text:**
"Click the button and wait for results."

**TTS-optimized:**
"Click the button... {pause:300ms} and wait for results."

**With emphasis:**
"Click the *button*... {pause:300ms} and wait for *results*."

**With rate control:**
"{rate:0.9}Watch carefully.{rate:1.1} This happens fast."

**SSML format (advanced):**
<speak>
  Click the <emphasis level="moderate">button</emphasis>
  <break time="300ms"/>
  and wait for <prosody rate="slow">results</prosody>.
</speak>
```

### Voice Selection Guidelines

```
Content Type        Recommended Voices              Characteristics
────────────────────────────────────────────────────────────────────────
Technical Demo      OpenAI: "onyx", Gemini: "Charon"  Clear, authoritative
Tutorial            OpenAI: "nova", Gemini: "Kore"    Warm, patient
Marketing           OpenAI: "alloy", Gemini: "Puck"   Energetic, engaging
Corporate           OpenAI: "echo", Gemini: "Fenrir"  Professional, calm
Storytelling        OpenAI: "fable", Gemini: "Aoede"  Expressive, melodic
```

## Sync Point Workflow

### Pre-Production Sync Planning

```
1. Create rough edit with temporary VO or no audio
2. Mark key visual moments (timestamps)
3. Write narration to hit those marks
4. Calculate total word count vs. duration
5. Adjust pacing or cut visuals to match

Visual Moments to Mark:
├── Actions (clicks, transitions, animations)
├── Reveals (new screens, results, data)
├── Emphasis (key features, benefits)
├── Transitions (scene changes)
└── CTA appearance
```

### Post-Production Sync Adjustment

```
Problem                     Solution
───────────────────────────────────────────────────────────────
Narration too long          Cut words, not speed up TTS
Narration too short         Add pauses, elaboration
Hard sync misaligned        Adjust video timing or rewrite phrase
Multiple sync misses        Re-evaluate structure
TTS sounds rushed           Lower WPM, add breath pauses
TTS sounds slow             Trim pauses, tighten phrases
```

## Quick Reference: Narration Checklist

```
Pre-Write:
[ ] Video duration confirmed
[ ] Target WPM selected
[ ] Key sync points identified
[ ] CTA placement decided
[ ] Voice/tone defined

During Write:
[ ] Each scene has timing markers
[ ] Pauses marked for breath/emphasis
[ ] Technical terms phonetically noted
[ ] Contractions used naturally
[ ] Emphasis words identified

Post-Write:
[ ] Word count within target
[ ] All sync points achievable
[ ] TTS test recorded
[ ] Timing validated against video
[ ] CTA clear and actionable
```

## Related Skills

- `video-pacing`: Rhythm and timing patterns for video editing
- `audio-language-models`: TTS providers and voice synthesis
- `demo-producer`: Full demo video production workflow
- `hook-formulas`: Attention-grabbing opening patterns
- `copywriting-patterns`: Persuasive writing techniques

## References

- [Script Templates](./references/script-templates.md) - Full templates for demo, tutorial, promo videos
- [Timing Markers](./references/timing-markers.md) - Detailed sync point specification
- [Pacing Guidelines](./references/pacing-guidelines.md) - WPM targets and comprehension research

## Capability Details

### script-writing
**Keywords:** narration, script, voiceover, VO, dialogue, copy
**Solves:**
- How do I write narration for a demo video?
- Script templates for video production
- Writing voice-over copy

### timing-sync
**Keywords:** timing, sync, synchronization, markers, cue points
**Solves:**
- How do I sync narration to video?
- Timing markers for TTS
- Frame-accurate voice alignment

### pacing
**Keywords:** WPM, words per minute, pacing, speed, comprehension
**Solves:**
- How fast should narration be?
- Calculating script length for video duration
- Platform-specific pacing

### cta-scripting
**Keywords:** CTA, call to action, conversion, engagement
**Solves:**
- How do I write a video CTA?
- CTA patterns for different platforms
- Closing scripts that convert

### tts-optimization
**Keywords:** TTS, text-to-speech, voice synthesis, SSML
**Solves:**
- How do I format scripts for TTS?
- Making AI voices sound natural
- TTS markup and emphasis
