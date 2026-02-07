---
name: thumbnail-first-frame
description: Thumbnail and first-frame optimization for CTR. Use when designing thumbnails, fixing frame-0 visibility issues, or optimizing for platform requirements
tags: [video, thumbnail, first-frame, ctr, design, marketing]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
complexity: low
---

# Thumbnail and First-Frame Optimization

Maximize click-through rates with proven thumbnail design formulas, text rules, and platform-specific optimization.

## Core Principle: The 3-Second Test

Thumbnails must communicate value in under 3 seconds. Users scroll at 300+ items/hour.

```
ATTENTION FUNNEL
================

  Scroll Speed: ~300 items/hour
           |
           v
  +------------------+
  |   THUMBNAIL      |  <-- 0.5s: Pattern interrupt (face/color)
  |   VISIBLE        |
  +------------------+
           |
           v
  +------------------+
  |   TEXT READ      |  <-- 1.0s: Value proposition (3-4 words)
  +------------------+
           |
           v
  +------------------+
  |   CLICK          |  <-- 2.0s: Curiosity/benefit decision
  |   DECISION       |
  +------------------+
```

## Thumbnail Composition Formulas

### Formula 1: Face + Text + Context

The most effective formula for tutorial/educational content.

```
+------------------------------------------+
|                                          |
|  +--------+                              |
|  |        |     "3 TRICKS               |
|  |  FACE  |      YOU MISSED"            |
|  | (40%)  |                              |
|  +--------+          +-------+           |
|                      | ICON  |           |
|                      +-------+           |
|                                          |
+------------------------------------------+
     LEFT THIRD          RIGHT TWO-THIRDS
```

### Formula 2: Before/After Split

Effective for transformation content, tutorials, comparisons.

```
+-------------------+-------------------+
|                   |                   |
|     BEFORE        |      AFTER        |
|  - Muted colors   |  - Vibrant colors |
|  - Problem state  |  - Solution state |
|                   |                   |
+-------------------+-------------------+
```

### Formula 3: Number + Benefit

High-performing for listicles and how-to content.

```
+------------------------------------------+
|     +-----+                              |
|     | 7   |   "MISTAKES"                 |
|     +-----+   "KILLING YOUR CODE"        |
|    (large                                |
|     number)    [relevant icon/visual]    |
+------------------------------------------+
```

## Text Rules for Thumbnails

### The 3-4 Word Maximum

```
GOOD                          BAD
====                          ===
"FIX THIS NOW"                "Here's How To Fix This Common
"STOP DOING THIS"              Problem That Many Developers
"10X FASTER"                   Face When Building Apps"
```

### High-Contrast Text Techniques

```
TECHNIQUE 1: Stroke/Outline
+---------------------------+
|  █ WHITE TEXT      █      |
|  █ BLACK OUTLINE   █      |
+---------------------------+

TECHNIQUE 2: Background Bar
+---------------------------+
|  | DARK BAR        |      |
|  | Light text here |      |
+---------------------------+
```

## Color Psychology for CTR

### Color Performance Ranking

```
HIGHEST CTR                  LOWEST CTR
===========                  ==========
1. YELLOW (attention)        1. Gray
2. RED (urgency)             2. Brown
3. ORANGE (energy)           3. Muted pastels
4. BLUE (trust)              4. Low-contrast combos
5. GREEN (positive)
```

### Color Combinations That Convert

| Combination | Background | Text | Accents |
|-------------|------------|------|---------|
| YouTube Red | RED | WHITE | BLACK |
| Warning | YELLOW | BLACK | RED |
| Trust | DARK BLUE | WHITE | ORANGE |
| Modern Tech | BLACK | WHITE | CYAN/GREEN |

## First Frame vs Thumbnail

```
THUMBNAIL (custom image)     FIRST FRAME (video start)
========================     ========================
- Optimized for browse       - Optimized for autoplay
- Can differ from video      - Must relate to content
- Focus on CTR               - Focus on retention
- No motion                  - May have subtle motion
```

### First Frame Checklist

```
[ ] Clear subject visible
[ ] No awkward mid-action freeze
[ ] Text readable if present
[ ] Brand elements visible
[ ] Matches thumbnail promise
[ ] Works at small preview size
```

## CRITICAL: First Frame Animation Gotchas

### Spring Animation - Never Start at Zero

**PROBLEM**: Raw `spring()` starts at 0, making frame 0 invisible.

```typescript
// ❌ BAD - First frame is invisible (scale=0)
const scale = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

// ✅ GOOD - Always visible (0.9 → 1.0)
const scale = 0.9 + 0.1 * spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

// ✅ GOOD - Explicit minimum scale
const scale = Math.max(0.85, spring({ frame, fps }));
```

### Opacity at Frame 0

```typescript
// ❌ BAD - Content invisible at frame 0
const opacity = interpolate(frame, [0, 15], [0, 1]);

// ✅ GOOD - First line visible immediately
const opacity = line.frame === 0
  ? 1
  : interpolate(frame - line.frame, [0, 8], [0, 1]);
```

### Frame 0 Visibility Checklist

```
[ ] No spring animations starting at raw 0
[ ] No opacity starting at 0 for initial content
[ ] Background/container visible immediately
[ ] Key message readable at frame 0
[ ] Test with: npx remotion still CompositionName out.png --frame=0
```

## Platform Quick Reference

### YouTube
- Resolution: 1920 x 1080 pixels
- Aspect ratio: 16:9
- File size: < 2MB
- Safe zone: Center 70%

### TikTok / Reels
- Aspect ratio: 9:16
- Resolution: 1080 x 1920 pixels
- Safe zone: Center 80%

### LinkedIn / Twitter
- LinkedIn: 1200 x 627 (1.91:1)
- Twitter: 1280 x 720 (16:9)

## Programmatic Generation (Remotion)

```typescript
import { AbsoluteFill, Img } from 'remotion';

export const ThumbnailTemplate: React.FC<{
  title: string;
  subtitle?: string;
  backgroundImage: string;
  accentColor: string;
}> = ({ title, subtitle, backgroundImage, accentColor }) => {
  return (
    <AbsoluteFill>
      <Img src={backgroundImage} style={backgroundStyle} />
      <div style={gradientOverlay} />
      <div style={textContainer}>
        <h1 style={{ ...titleStyle, color: accentColor }}>
          {title}
        </h1>
        {subtitle && <h2 style={subtitleStyle}>{subtitle}</h2>}
      </div>
    </AbsoluteFill>
  );
};
```

## Quick Reference Checklist

```
PRE-PUBLISH THUMBNAIL CHECKLIST
===============================

COMPOSITION
[ ] Subject clearly visible
[ ] Text readable at 50% size
[ ] Safe zones respected
[ ] Visual hierarchy clear

TEXT
[ ] 3-4 words maximum
[ ] High contrast achieved
[ ] Stroke/shadow applied

COLOR
[ ] High contrast palette
[ ] Attention color present
[ ] Mobile visibility tested

PLATFORM
[ ] Correct dimensions
[ ] File size under limit
[ ] First frame coordinated
```

## Related Skills

- `remotion-composer`: Video rendering with Remotion
- `core-web-vitals`: Image optimization for web
- `image-optimization`: Compression and format selection

## References

- [Thumbnail Formulas](./references/thumbnail-formulas.md) - Complete composition formulas
- [Platform Requirements](./references/platform-requirements.md) - Detailed platform specs
- [First Frame Optimization](./references/first-frame-optimization.md) - Animation timing details
