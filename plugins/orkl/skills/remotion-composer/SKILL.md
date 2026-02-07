---
name: remotion-composer
description: Compose final demo videos using Remotion. Use when combining terminal recordings with animations, adding branded overlays, or rendering multi-format video exports
context: fork
version: 2.0.0
author: OrchestKit
tags: [remotion, video, composition, marketing, demo, animation, data-viz, charts]
user-invocable: false
complexity: medium
---

# Remotion Composer

Production-quality video composition with AnimStats-level animations. Supports data visualization, spring physics, easing presets, and cinematic transitions.

## Quick Start

```bash
# Install enhanced packages
cd orchestkit-demos && npm install

# Add composition for a skill
./scripts/add-composition.sh explore

# Render
npx remotion render ExploreDemo out/ExploreDemo.mp4
```

## Package Library (v2.1)

### Core Animation
```json
{
  "@remotion/shapes": "^4.0.0",      // Geometric primitives (pie, rect, triangle)
  "@remotion/paths": "^4.0.0",       // SVG path animations (evolvePath)
  "@remotion/noise": "^4.0.0",       // Procedural noise (noise2D, noise3D)
  "@remotion/transitions": "^4.0.0", // Scene transitions (fade, slide, wipe)
  "@remotion/motion-blur": "^4.0.0", // Motion trails and blur
  "@remotion/gif": "^4.0.0",         // GIF synchronization
  "@remotion/animated-emoji": "^4.0.0", // Lottie emojis
  "@remotion/layout-utils": "^4.0.0"   // Text fitting and layout
}
```

### Advanced Capabilities
```json
{
  "@remotion/three": "^4.0.0",       // Three.js 3D graphics
  "@remotion/lottie": "^4.0.0",      // After Effects animations
  "@remotion/rive": "^4.0.0",        // Rive interactive animations
  "@remotion/captions": "^4.0.0",    // Subtitles and captions
  "@remotion/player": "^4.0.0",      // Embeddable player
  "@remotion/renderer": "^4.0.0",    // Server-side rendering
  "@remotion/media-utils": "^4.0.0"  // Audio/video metadata
}
```

### 3D & Animation Runtimes
```json
{
  "three": "^0.175.0",                    // Three.js core
  "@react-three/fiber": "^9.1.0",         // React Three Fiber
  "@react-three/drei": "^10.3.0",         // Three.js helpers
  "@lottiefiles/react-lottie-player": "^3.5.4", // Lottie player
  "@rive-app/react-canvas": "^4.21.0"     // Rive runtime
}
```

## Animation Presets

### Easing Reference
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

## Data Visualization Components

### StatCounter (Enhanced)
```tsx
<StatCounter
  value={168}
  label="Skills"
  color="#8b5cf6"
  easing="bounce"           // bounce, elastic, back, snappy, spring
  digitMorph                // Individual digit animation
  gradientColors={["#8b5cf6", "#22c55e"]}  // Animated gradient
  celebrateOnComplete       // Particle burst
  size="lg"                 // sm, md, lg
/>
```

### ProgressRing
```tsx
<ProgressRing
  progress={85}
  color="#22c55e"
  size={120}
  delay={15}
  showLabel
  easing="spring"
/>
```

### BarChart
```tsx
<BarChart
  data={[
    { label: "Skills", value: 168, color: "#8b5cf6" },
    { label: "Agents", value: 35, color: "#22c55e" },
  ]}
  staggerDelay={5}
  showValues
/>
```

### LineChart
```tsx
<LineChart
  points={[10, 25, 18, 42, 35, 60]}
  color="#8b5cf6"
  showDots
  showArea
/>
```

## Text Animations

### AnimatedText Types
```tsx
// 9 animation types available:
<AnimatedText text="Hello" animation="spring" />   // Scale bounce
<AnimatedText text="Hello" animation="fade" />     // Simple fade
<AnimatedText text="Hello" animation="slide" />    // Directional slide
<AnimatedText text="Hello" animation="blur" />     // Blur reveal (NEW)
<AnimatedText text="Hello" animation="wave" />     // Char-by-char bounce (NEW)
<AnimatedText text="Hello" animation="gradient" /> // Gradient sweep (NEW)
<AnimatedText text="Hello" animation="split" />    // Chars from random (NEW)
<AnimatedText text="Hello" animation="reveal" />   // Clip reveal (NEW)
<AnimatedText text="Hello" animation="typewriter" /> // Typing effect
```

### GradientText
```tsx
<GradientText
  text="OrchestKit"
  colors={["#8b5cf6", "#22c55e"]}
  animateGradient // Moving gradient
/>
```

## Transitions

### SceneTransition Types
```tsx
// 8 transition types:
<SceneTransition type="fade" />     // Simple opacity
<SceneTransition type="wipe" />     // Horizontal wipe
<SceneTransition type="zoom" />     // Scale in/out
<SceneTransition type="slide" />    // Directional slide (NEW)
<SceneTransition type="flip" />     // 3D card flip (NEW)
<SceneTransition type="circle" />   // Circular reveal (NEW)
<SceneTransition type="blinds" />   // Venetian blinds (NEW)
<SceneTransition type="pixelate" /> // Pixelation (NEW)
```

### Content Transitions
```tsx
<SlideTransition direction="up" startFrame={0} exitFrame={60}>
  <Content />
</SlideTransition>

<ScaleTransition startFrame={0} scaleFrom={0.8}>
  <Content />
</ScaleTransition>

<RevealTransition type="circle" startFrame={0}>
  <Content />
</RevealTransition>
```

## 3D Components (CSS-based)

### FloatingLogo
```tsx
<FloatingLogo
  text="OrchestKit"
  color="#8b5cf6"
  secondaryColor="#22c55e"
  rotationSpeed={0.02}
/>
```

### ParticleSphere
```tsx
<ParticleSphere
  particleCount={200}
  radius={200}
  color="#8b5cf6"
  rotationSpeed={0.01}
/>
```

### WireframeBox
```tsx
<WireframeBox
  size={200}
  color="#8b5cf6"
  lineWidth={2}
/>
```

### OrbitingRings
```tsx
<OrbitingRings
  ringCount={3}
  baseRadius={100}
  color="#8b5cf6"
/>
```

## Captions & Subtitles

### TikTokCaption (word bounce)
```tsx
<TikTokCaption
  words={["Build", "faster", "with", "AI"]}
  startFrame={0}
  wordsPerSecond={3}
  activeColor="#8b5cf6"
/>
```

### KaraokeCaption (fill reveal)
```tsx
<KaraokeCaption
  text="OrchestKit makes development faster"
  startFrame={0}
  durationFrames={90}
/>
```

### TypingCaption (typewriter)
```tsx
<TypingCaption
  text="/plugin install ork"
  startFrame={0}
  charsPerSecond={20}
  cursorColor="#8b5cf6"
/>
```

### HighlightCaption
```tsx
<HighlightCaption
  text="24 commands and 176 skills"
  startFrame={0}
  endFrame={90}
  highlightColor="#8b5cf6"
/>
```

## Background Effects

### ParticleBackground
```tsx
<ParticleBackground
  particleCount={50}
  particleColor="#8b5cf6"
  speed={0.5}
  opacity={0.6}
/>
```

### MeshGradient
```tsx
<MeshGradient
  colors={["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b"]}
  speed={1}
  opacity={0.3}
/>
```

### GlowOrbs
```tsx
<GlowOrbs
  orbs={[
    { color: "#8b5cf6", x: 20, y: 30, size: 40 },
    { color: "#06b6d4", x: 80, y: 70, size: 35 },
  ]}
  animated
/>
```

## Layer Stack

```
┌─────────────────────────────────────────┐
│  Layer 6: Vignette + ScanLines          │
├─────────────────────────────────────────┤
│  Layer 5: CTA Overlay (bottom)          │
├─────────────────────────────────────────┤
│  Layer 4: Watermark (top-right)         │
├─────────────────────────────────────────┤
│  Layer 3: Progress Bar (bottom)         │
├─────────────────────────────────────────┤
│  Layer 2: Content (Terminal/Manim)      │
├─────────────────────────────────────────┤
│  Layer 1: Background Effects            │
│    - ParticleBackground                 │
│    - MeshGradient                       │
│    - GlowOrbs                           │
├─────────────────────────────────────────┤
│  Layer 0: Base Color (#0a0a0f)          │
└─────────────────────────────────────────┘
```

## Formats

| Format | Resolution | FPS | Use Case |
|--------|------------|-----|----------|
| Horizontal | 1920x1080 | 30 | YouTube, Twitter |
| Vertical | 1080x1920 | 30 | TikTok, Reels, Shorts |
| Square | 1080x1080 | 30 | Instagram, LinkedIn |
| 4K | 3840x2160 | 60 | High-quality exports |

## Color Mapping

Skills have associated colors:
- explore: #8b5cf6 (purple)
- verify: #22c55e (green)
- commit: #06b6d4 (cyan)
- brainstorming: #f59e0b (amber)
- review-pr: #f97316 (orange)
- remember: #ec4899 (pink)

## References

### Core
- `references/audio-layer.md` - Audio setup and volume curves
- `references/composition-patterns.md` - Composition templates
- `references/cinematic-scenes.md` - 6-scene narrative structure
- `references/folder-organization.md` - Root.tsx folder structure and naming conventions

### Animation
- `references/animation-presets.md` - Easing and spring configs
- `references/data-viz-patterns.md` - Chart and counter patterns
- `references/effects-library.md` - Background and transition effects

### Advanced
- `references/3d-graphics.md` - Three.js 3D scenes and camera animations
- `references/lottie-animations.md` - After Effects Lottie integration
- `references/captions-subtitles.md` - Subtitle generation and styling
- `references/showcase-templates.md` - Production patterns from Remotion showcase

## Related Skills

- `terminal-demo-generator`: VHS/asciinema recordings that feed into compositions
- `manim-visualizer`: Animated diagrams as overlay assets
- `demo-producer`: Full pipeline orchestration
- `video-pacing`: Timing and rhythm patterns for compositions
- `music-sfx-selection`: Audio selection for the audio layer
