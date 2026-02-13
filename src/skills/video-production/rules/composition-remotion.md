---
title: Remotion Composition
impact: HIGH
impactDescription: "Remotion is the core composition engine — incorrect patterns lead to rendering failures, poor animation quality, and bundler caching issues"
tags: remotion, composition, video, animation, render, spring
---

## Remotion Composition

Production-quality video composition with Remotion. Covers package library, animation presets, spring configs, and folder organization.

### Package Library

**Core Animation:**
- `@remotion/shapes` — Geometric primitives (pie, rect, triangle)
- `@remotion/paths` — SVG path animations (evolvePath)
- `@remotion/noise` — Procedural noise (noise2D, noise3D)
- `@remotion/transitions` — Scene transitions (fade, slide, wipe)
- `@remotion/motion-blur` — Motion trails and blur
- `@remotion/layout-utils` — Text fitting and layout

**Advanced:**
- `@remotion/three` — Three.js 3D graphics
- `@remotion/lottie` — After Effects animations
- `@remotion/captions` — Subtitles and captions
- `@remotion/renderer` — Server-side rendering

### Animation Presets

| Preset | Use Case | Feel |
|--------|----------|------|
| `bounce` | Success celebrations | Playful |
| `elastic` | Attention grab | Energetic |
| `back` | Entry animations | Anticipation |
| `snappy` | Quick UI | Overshoot |
| `spring` | Default | Natural |

### Spring Configs

| Name | damping | stiffness | Use |
|------|---------|-----------|-----|
| Bouncy | 10-12 | 100-120 | Playful enters |
| Snappy | 15-20 | 150-200 | Quick UI |
| Smooth | 80 | 200 | Subtle moves |
| Heavy | 15 | 50 | Large elements |

### Text Animations (9 types)

`spring`, `fade`, `slide`, `blur`, `wave`, `gradient`, `split`, `reveal`, `typewriter`

### Scene Transitions (8 types)

`fade`, `wipe`, `zoom`, `slide`, `flip`, `circle`, `blinds`, `pixelate`

### Formats

| Format | Resolution | FPS | Use Case |
|--------|------------|-----|----------|
| Horizontal | 1920x1080 | 30 | YouTube, Twitter |
| Vertical | 1080x1920 | 30 | TikTok, Reels, Shorts |
| Square | 1080x1080 | 30 | Instagram, LinkedIn |
| 4K | 3840x2160 | 60 | High-quality exports |

### Bundler Caching Gotchas

```bash
# Asset changes not reflected: kill and re-render
pkill -f "remotion"
npx remotion render CompositionName output.mp4

# Or clear bundler cache
rm -rf node_modules/.cache
```

### staticFile vs Inline Assets

```typescript
// External assets via staticFile
import { staticFile, Img } from "remotion";
<Img src={staticFile("claude-logo.png")} />

// Audio via staticFile
<Audio src={staticFile("audio/snap-attack.mp3")} volume={0.35} />
```

**References:** `references/composition-patterns.md`, `references/folder-organization.md`, `references/animation-presets.md`
