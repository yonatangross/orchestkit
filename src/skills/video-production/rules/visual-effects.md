---
title: Background Visual Effects
impact: MEDIUM
impactDescription: "Ambient background effects create depth and atmosphere that elevate production quality — static backgrounds feel flat and amateurish in motion content"
tags: particles, gradient, glow, effects, background, animation, remotion
---

## Background Visual Effects

Ambient background components for Remotion compositions — particle systems, mesh gradients, glow orbs, and scene transition effects.

### ParticleBackground (Canvas2D)

```tsx
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { useRef, useEffect } from "react";

const ParticleBackground: React.FC<{
  count?: number;
  color?: string;
  speed?: number;
}> = ({ count = 60, color = "#8b5cf6", speed = 0.5 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Seed particles deterministically
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: ((i * 7919) % 1000) / 1000 * width,
      y: ((i * 6271) % 1000) / 1000 * height,
      size: 1 + ((i * 3571) % 3),
      speedX: (((i * 4219) % 100) / 100 - 0.5) * speed,
      speedY: (((i * 8461) % 100) / 100 - 0.5) * speed,
      opacity: 0.2 + ((i * 2693) % 60) / 100,
    }))
  ).current;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      const x = (p.x + p.speedX * frame) % width;
      const y = (p.y + p.speedY * frame) % height;
      ctx.beginPath();
      ctx.arc(x < 0 ? x + width : x, y < 0 ? y + height : y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
    });
  }, [frame, width, height, color, particles]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={width} height={height} />
    </AbsoluteFill>
  );
};
```

### MeshGradient (CSS Animation)

```tsx
const MeshGradient: React.FC<{
  colors?: string[];
}> = ({ colors = ["#8b5cf6", "#06b6d4", "#0a0a0f", "#1e1b4b"] }) => {
  const frame = useCurrentFrame();
  const angle = (frame * 0.5) % 360;
  const shift = Math.sin(frame * 0.02) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `
          conic-gradient(from ${angle}deg at ${50 + shift}% ${50 - shift}%,
            ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[3]}, ${colors[0]})
        `,
        filter: "blur(80px)",
        opacity: 0.6,
        transform: "scale(1.2)",
      }}
    />
  );
};
```

### GlowOrbs

```tsx
const GlowOrbs: React.FC<{
  orbs?: { x: number; y: number; color: string; size: number }[];
}> = ({ orbs = [
  { x: 20, y: 30, color: "#8b5cf6", size: 300 },
  { x: 70, y: 60, color: "#06b6d4", size: 250 },
  { x: 50, y: 80, color: "#7c3aed", size: 200 },
] }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {orbs.map((orb, i) => {
        const drift = Math.sin((frame + i * 50) * 0.015) * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${orb.x + drift}%`,
              top: `${orb.y + drift * 0.7}%`,
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background: orb.color,
              filter: `blur(${orb.size * 0.4}px)`,
              opacity: 0.3,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
```

### Effect Presets

| Effect | Performance | Best For | Complexity |
|--------|-------------|----------|------------|
| ParticleBackground | Light | Tech demos, ambient | Low |
| MeshGradient | Light | Intro/outro backgrounds | Low |
| GlowOrbs | Light | Section transitions | Low |
| Noise texture | Medium | Organic feel, film grain | Medium |
| Grid pattern | Light | Tech/matrix aesthetic | Low |

### Layer Composition Order

```tsx
<AbsoluteFill style={{ background: "#0a0a0f" }}>
  {/* Layer 1: Ambient effect (lowest) */}
  <ParticleBackground count={40} color="#8b5cf6" speed={0.3} />

  {/* Layer 2: Gradient overlay */}
  <MeshGradient />

  {/* Layer 3: Main content */}
  <MainContent />

  {/* Layer 4: Foreground effects (highest) */}
  <GlowOrbs />
</AbsoluteFill>
```

### Performance Rules

- Particle count: max 80 for 1080p, max 40 for 4K
- Blur radius: keep under 100px (GPU intensive)
- All positions derived from `useCurrentFrame()` (deterministic)
- Use `transform: scale(1.2)` on gradients to hide hard edges
- Test with `npx remotion render` before adding more layers

**Key rules:** All motion must derive from `useCurrentFrame()`. Keep particle count under 80. Layer order: background, gradient, content, foreground.

**References:** `references/particle-systems.md`, `references/gradient-effects.md`
