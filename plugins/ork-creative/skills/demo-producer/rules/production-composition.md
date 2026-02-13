---
title: Video Composition and Audio
impact: HIGH
impactDescription: "Professional composition with proper audio mixing determines viewer retention and engagement"
tags: remotion, composition, audio, mixing, thumbnails, captions, effects
---

## Video Composition and Audio

**Incorrect — poor composition and audio:**
```typescript
// WRONG: Spring animation starting at frame 0 (invisible first frame)
const scale = spring({ frame, fps, from: 0, to: 1 });
// WRONG: Hardcoded callout coordinates (break on format change)
<div style={{ position: 'absolute', left: 450, top: 320 }}>
// WRONG: Music competing with narration (no ducking)
// Both tracks at -12 dB = unintelligible narration
```

**Correct — Remotion composition with proper patterns:**
```typescript
// Remotion folder organization
Production/
├── Landscape-16x9/      // YouTube, Website (1920x1080)
│   ├── Core-Skills/
│   ├── Memory-Skills/
│   └── Styles/          // ProgressiveZoom, SplitMerge, etc.
├── Vertical-9x16/       // TikTok, Reels, Shorts (1080x1920)
├── Square-1x1/          // Instagram, LinkedIn (1080x1080)
└── Marketing/           // Brand & intro videos
```

### Audio Mixing

| Element | Volume | Rule |
|---------|--------|------|
| Narration | -14 to -12 dB | Primary, always clear |
| Background music | -24 to -20 dB | Duck -6 to -8 dB under narration |
| SFX | -18 to -14 dB | Punctuate key moments |
| Target LUFS | -14 LUFS | Platform standard |

### Thumbnail Rules

| Rule | Value |
|------|-------|
| Text | 3-4 words maximum |
| Test | Must be readable at small preview size |
| First frame | Optimize — many platforms use it as preview |

### Visual Effects Categories

| Category | Components |
|----------|------------|
| 3D Graphics | Three.js in Remotion, CSS-based 3D, floating logos |
| Data Viz | StatCounter, ProgressRing, BarChart, LineChart |
| Lottie | After Effects integration, animated emojis |
| Effects | ParticleBackground, MeshGradient, GlowOrbs |
| Captions | TikTokCaption, KaraokeCaption, TypingCaption |

### Common Mistakes

1. No hook in first 3 seconds (lose 33% of viewers)
2. Music competing with narration (duck -6 to -8 dB)
3. Spring animations starting at 0 (invisible first frame)
4. Hardcoded callout coordinates (break on format change)
5. Intro cards too long (>5s disrupts flow)
6. Missing captions (accessibility and silent browsing)
7. Not testing thumbnails at small preview size

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Music volume | -24 to -20 dB under narration |
| TTS model | eleven_multilingual_v2 (production) |
| Thumbnail text | 3-4 words maximum |
| Debug grid | Enabled during dev, disabled for renders |
| Caption style | TikTokCaption for shorts, subtitle for long-form |
