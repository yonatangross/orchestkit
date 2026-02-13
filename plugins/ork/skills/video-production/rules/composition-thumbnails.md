---
title: Thumbnail & First-Frame Optimization
impact: HIGH
impactDescription: "Thumbnails determine click-through rate — poor thumbnails mean great content never gets watched; invisible first frames break autoplay previews"
tags: thumbnail, first-frame, CTR, design, marketing, spring
---

## Thumbnail & First-Frame Optimization

Maximize click-through rates with proven thumbnail formulas, text rules, and platform-specific optimization.

### The 3-Second Test

Thumbnails must communicate value in under 3 seconds at 300+ items/hour scroll speed.

### Thumbnail Composition Formulas

**Formula 1: Face + Text + Context** — Most effective for tutorial/educational
**Formula 2: Before/After Split** — For transformation content
**Formula 3: Number + Benefit** — For listicles and how-to

### Text Rules

- **3-4 words maximum** (never more)
- High contrast: white text with black outline or dark background bar
- Readable at 50% preview size

### Color Performance Ranking

```
HIGHEST CTR: Yellow > Red > Orange > Blue > Green
LOWEST CTR:  Gray, Brown, Muted pastels, Low-contrast combos
```

### CRITICAL: First Frame Animation Gotchas

**Spring animation — never start at zero:**

```typescript
// BAD - First frame is invisible (scale=0)
const scale = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

// GOOD - Always visible (0.9 → 1.0)
const scale = 0.9 + 0.1 * spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

// GOOD - Explicit minimum scale
const scale = Math.max(0.85, spring({ frame, fps }));
```

**Opacity at frame 0:**

```typescript
// BAD - Content invisible at frame 0
const opacity = interpolate(frame, [0, 15], [0, 1]);

// GOOD - First content visible immediately
const opacity = line.frame === 0
  ? 1
  : interpolate(frame - line.frame, [0, 8], [0, 1]);
```

### Frame 0 Visibility Checklist

- No spring animations starting at raw 0
- No opacity starting at 0 for initial content
- Background/container visible immediately
- Key message readable at frame 0
- Test: `npx remotion still CompositionName out.png --frame=0`

### Platform Quick Reference

| Platform | Resolution | Aspect | Safe Zone |
|----------|------------|--------|-----------|
| YouTube | 1920x1080 | 16:9 | Center 70% |
| TikTok/Reels | 1080x1920 | 9:16 | Center 80% |
| LinkedIn | 1200x627 | 1.91:1 | — |
| Twitter | 1280x720 | 16:9 | — |

**References:** `references/thumbnail-formulas.md`, `references/platform-requirements.md`, `references/first-frame-optimization.md`
