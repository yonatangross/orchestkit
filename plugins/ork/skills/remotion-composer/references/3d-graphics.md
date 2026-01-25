# 3D Graphics with @remotion/three

## Setup

```tsx
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { OrbitControls, Text3D, RoundedBox, MeshWobbleMaterial } from "@react-three/drei";
```

## Basic 3D Scene

```tsx
const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotation = interpolate(frame, [0, 90], [0, Math.PI * 2]);
  const scale = spring({ frame, fps, config: { damping: 15 } });

  return (
    <ThreeCanvas width={1920} height={1080}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <mesh rotation={[0, rotation, 0]} scale={scale}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#8b5cf6" />
      </mesh>
    </ThreeCanvas>
  );
};
```

## 3D Text Animation

```tsx
const AnimatedText3D: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <ThreeCanvas width={1920} height={1080}>
      <ambientLight intensity={0.8} />
      <spotLight position={[5, 5, 5]} angle={0.3} />

      <Text3D
        font="/fonts/inter-bold.json"
        size={1.5}
        height={0.3}
        curveSegments={12}
        position={[-3, 0, 0]}
      >
        {text}
        <meshStandardMaterial
          color={interpolateColors(
            frame,
            [0, 60],
            ["#8b5cf6", "#22c55e"]
          )}
          metalness={0.8}
          roughness={0.2}
        />
      </Text3D>
    </ThreeCanvas>
  );
};
```

## Camera Animations

```tsx
const CameraFlythrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const cameraZ = interpolate(
    frame,
    [0, durationInFrames],
    [10, 2],
    { easing: Easing.out(Easing.cubic) }
  );

  const cameraY = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [5, 2, 5]
  );

  return (
    <ThreeCanvas
      width={1920}
      height={1080}
      camera={{ position: [0, cameraY, cameraZ], fov: 75 }}
    >
      {/* Scene contents */}
    </ThreeCanvas>
  );
};
```

## Particle Systems

```tsx
const ParticleField: React.FC<{ count: number }> = ({ count }) => {
  const frame = useCurrentFrame();
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, [count]);

  return (
    <points rotation={[0, frame * 0.01, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#8b5cf6" transparent opacity={0.8} />
    </points>
  );
};
```

## Glass/Frosted Effects

```tsx
import { MeshTransmissionMaterial } from "@react-three/drei";

const GlassLogo: React.FC = () => {
  return (
    <mesh>
      <torusKnotGeometry args={[1, 0.3, 128, 32]} />
      <MeshTransmissionMaterial
        thickness={0.5}
        roughness={0}
        transmission={1}
        ior={1.5}
        chromaticAberration={0.06}
        backside
      />
    </mesh>
  );
};
```

## Scene Presets

### Tech Product Showcase
```tsx
<ThreeCanvas>
  <Environment preset="studio" />
  <PresentationControls polar={[-0.4, 0.2]} azimuth={[-1, 0.75]}>
    <Stage environment="city" intensity={0.6}>
      <Model />
    </Stage>
  </PresentationControls>
</ThreeCanvas>
```

### Data Visualization 3D
```tsx
<ThreeCanvas>
  <ambientLight intensity={0.3} />
  <pointLight position={[10, 10, 10]} />
  {data.map((d, i) => (
    <RoundedBox
      key={i}
      position={[i * 2, d.value / 2, 0]}
      args={[1.5, d.value, 1.5]}
    >
      <meshStandardMaterial color={d.color} />
    </RoundedBox>
  ))}
</ThreeCanvas>
```

## Performance Tips

1. **Use `useMemo`** for geometry and material definitions
2. **Limit polygon count** - aim for < 100k for smooth playback
3. **Use instancing** for repeated objects: `<Instances><Instance /></Instances>`
4. **Bake lighting** where possible instead of realtime
5. **Use lower resolution** during preview: `width/2, height/2`
