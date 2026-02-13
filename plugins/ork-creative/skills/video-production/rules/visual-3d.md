---
title: Three.js 3D Scenes
impact: MEDIUM
impactDescription: "3D elements create depth and visual interest that flat 2D compositions cannot match — but incorrect frame sync or camera setup causes jarring rendering artifacts"
tags: three.js, 3D, remotion, camera, animation, WebGL
---

## Three.js 3D Scenes

Integrate Three.js 3D graphics into Remotion compositions using `@remotion/three` with frame-synced animations and camera control.

### Setup

```bash
npm install @remotion/three @react-three/fiber three @types/three
```

### Basic Rotating Cube

```tsx
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useRef } from "react";
import * as THREE from "three";

const RotatingCube: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);

  const rotation = (frame / fps) * Math.PI * 0.5; // 90 deg/sec

  return (
    <ThreeCanvas width={1920} height={1080}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <mesh ref={meshRef} rotation={[rotation * 0.5, rotation, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#8b5cf6" metalness={0.3} roughness={0.4} />
      </mesh>
    </ThreeCanvas>
  );
};
```

### Camera Animation (Orbit)

```tsx
const AnimatedCamera: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = (frame / fps) * Math.PI * 0.3;
  const radius = 6;

  return (
    <ThreeCanvas
      width={1920}
      height={1080}
      camera={{
        position: [
          Math.cos(angle) * radius,
          3,
          Math.sin(angle) * radius,
        ],
        fov: 50,
      }}
    >
      <ambientLight intensity={0.5} />
      <Scene />
    </ThreeCanvas>
  );
};
```

### Architecture Diagram in 3D

```tsx
// Floating boxes representing services with connecting lines
const ArchitectureScene: React.FC<{ services: Service[] }> = ({ services }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {services.map((svc, i) => {
        const delay = i * 10;
        const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        return (
          <mesh key={svc.name} position={svc.position as [number, number, number]}>
            <boxGeometry args={[1.5, 0.8, 0.3]} />
            <meshStandardMaterial color={svc.color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </>
  );
};
```

### Frame Sync Rules

| Pattern | Correct | Incorrect |
|---------|---------|-----------|
| Rotation | `frame / fps * speed` | `Date.now()` (non-deterministic) |
| Position | `interpolate(frame, ...)` | `requestAnimationFrame` |
| Visibility | `frame > delay ? 1 : 0` | `setTimeout` |

**Critical:** All animations must derive from `useCurrentFrame()`. Never use `requestAnimationFrame`, `Date.now()`, or `setTimeout` — these break deterministic rendering.

### Performance Tips

- Keep polygon count under 50K for smooth renders
- Use `meshStandardMaterial` over `meshPhysicalMaterial` unless needed
- Avoid real-time shadows for simple scenes — fake with planes
- Set `dpr={1}` on ThreeCanvas for faster render passes

### CSS-Based 3D Alternative

```tsx
// Lightweight 3D card flip without Three.js
const Card3D: React.FC = () => {
  const frame = useCurrentFrame();
  const rotateY = interpolate(frame, [0, 30], [0, 180], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      perspective: 1000,
      transformStyle: "preserve-3d",
      transform: `rotateY(${rotateY}deg)`,
    }}>
      <CardFront />
    </div>
  );
};
```

**Key rules:** All animation values must derive from `useCurrentFrame()`. Use CSS 3D for simple transforms, Three.js for complex scenes. Keep polygon count under 50K.

**References:** `references/threejs-remotion-setup.md`, `references/camera-animations.md`
