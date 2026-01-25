# Effects Library

## Background Effects

Location: `orchestkit-demos/src/components/shared/BackgroundEffects.tsx`

### ParticleBackground
Floating particles with noise-driven organic movement.

```tsx
import { ParticleBackground } from "./shared/BackgroundEffects";

<ParticleBackground
  particleCount={50}       // Number of particles
  particleColor="#8b5cf6"  // Particle color
  particleSize={4}         // Base size in pixels
  speed={0.5}              // Movement speed multiplier
  opacity={0.6}            // Max opacity
  blur={0}                 // Optional blur (0 = sharp)
/>
```

### MeshGradient
Animated multi-color gradient blobs (like Apple backgrounds).

```tsx
import { MeshGradient } from "./shared/BackgroundEffects";

<MeshGradient
  colors={["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b"]}
  speed={1}                // Animation speed
  opacity={0.3}            // Overall opacity
/>
```

### GlowOrbs
Large blurred color orbs for depth.

```tsx
import { GlowOrbs } from "./shared/BackgroundEffects";

<GlowOrbs
  orbs={[
    { color: "#8b5cf6", x: 20, y: 30, size: 40 },  // x,y,size in %
    { color: "#06b6d4", x: 80, y: 70, size: 35 },
    { color: "#22c55e", x: 50, y: 50, size: 30 },
  ]}
  animated                 // Enable position/size pulse
/>
```

### Vignette
Edge darkening for cinematic look.

```tsx
import { Vignette } from "./shared/BackgroundEffects";

<Vignette
  intensity={0.5}          // 0-1 darkness level
  color="#000000"          // Edge color
/>
```

### GridPattern
Animated grid lines (cyberpunk/tech aesthetic).

```tsx
import { GridPattern } from "./shared/BackgroundEffects";

<GridPattern
  gridSize={50}            // Grid cell size in pixels
  lineColor="rgba(139, 92, 246, 0.15)"
  lineWidth={1}
  animated                 // Moving grid
  perspective              // 3D perspective view
/>
```

### ScanLines
CRT/VHS retro effect.

```tsx
import { ScanLines } from "./shared/BackgroundEffects";

<ScanLines
  lineHeight={2}           // Line thickness
  opacity={0.1}            // Line darkness
  animated                 // Moving lines
/>
```

### NoiseTexture
Film grain effect.

```tsx
import { NoiseTexture } from "./shared/BackgroundEffects";

<NoiseTexture
  opacity={0.05}           // Grain intensity
  animated                 // Changing noise per frame
/>
```

## Transitions

Location: `orchestkit-demos/src/components/shared/TransitionWipe.tsx`

### SceneTransition (8 Types)

```tsx
import { SceneTransition } from "./shared/TransitionWipe";

// Basic fade
<SceneTransition type="fade" startFrame={100} durationFrames={15} />

// Horizontal wipe
<SceneTransition type="wipe" startFrame={100} />

// Scale zoom
<SceneTransition type="zoom" startFrame={100} />

// Directional slide
<SceneTransition type="slide" startFrame={100} />

// 3D card flip
<SceneTransition type="flip" startFrame={100} />

// Circular reveal from center
<SceneTransition type="circle" startFrame={100} />

// Venetian blinds
<SceneTransition type="blinds" startFrame={100} />

// Pixelation/blur
<SceneTransition type="pixelate" startFrame={100} />
```

### TransitionWipe (Directional)

```tsx
import { TransitionWipe } from "./shared/TransitionWipe";

<TransitionWipe
  direction="left"         // left, right, up, down, diagonal
  color="#8b5cf6"
  startFrame={100}
  durationFrames={15}
>
  {children}
</TransitionWipe>
```

### Crossfade (Between Scenes)

```tsx
import { Crossfade } from "./shared/TransitionWipe";

<Crossfade
  startFrame={100}
  durationFrames={20}
  from={<SceneA />}
  to={<SceneB />}
/>
```

### Content Transitions

```tsx
import {
  SlideTransition,
  ScaleTransition,
  RevealTransition,
} from "./shared/TransitionWipe";

// Slide content in/out
<SlideTransition
  direction="up"           // left, right, up, down
  startFrame={0}
  exitFrame={60}           // Optional exit frame
>
  <Content />
</SlideTransition>

// Scale content in/out
<ScaleTransition
  startFrame={0}
  exitFrame={60}
  scaleFrom={0.8}
  scaleTo={1}
>
  <Content />
</ScaleTransition>

// Clip-path reveal
<RevealTransition
  type="horizontal"        // horizontal, vertical, diagonal, circle
  direction="forward"      // forward, reverse
  startFrame={0}
  durationFrames={25}
>
  <Content />
</RevealTransition>
```

## Combining Effects

### Cinematic Background Stack
```tsx
<AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
  {/* Layer 1: Mesh gradient */}
  <MeshGradient colors={["#8b5cf6", "#06b6d4"]} opacity={0.2} />

  {/* Layer 2: Glow orbs */}
  <GlowOrbs animated />

  {/* Layer 3: Particles */}
  <ParticleBackground particleCount={30} opacity={0.4} />

  {/* Layer 4: Content */}
  <AbsoluteFill>
    {children}
  </AbsoluteFill>

  {/* Layer 5: Vignette */}
  <Vignette intensity={0.4} />

  {/* Layer 6: Scan lines (subtle) */}
  <ScanLines opacity={0.05} />
</AbsoluteFill>
```

### Tech/Cyberpunk Style
```tsx
<AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
  <GridPattern animated perspective lineColor="rgba(6, 182, 212, 0.1)" />
  <GlowOrbs orbs={[{ color: "#06b6d4", x: 50, y: 50, size: 50 }]} />
  {children}
  <ScanLines opacity={0.08} animated />
  <NoiseTexture opacity={0.03} />
</AbsoluteFill>
```

### Clean Modern Style
```tsx
<AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
  <MeshGradient colors={["#8b5cf6", "#06b6d4", "#22c55e"]} opacity={0.15} />
  {children}
  <Vignette intensity={0.3} />
</AbsoluteFill>
```
