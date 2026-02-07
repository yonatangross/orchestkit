# Lottie Animations

## @remotion/lottie Integration

```tsx
import { Lottie, LottieAnimationData } from "@remotion/lottie";
import { useCurrentFrame, useVideoConfig } from "remotion";
```

## Basic Usage

```tsx
import animationData from "./animations/success.json";

const LottieAnimation: React.FC = () => {
  return (
    <Lottie
      animationData={animationData as LottieAnimationData}
      style={{ width: 400, height: 400 }}
    />
  );
};
```

## Controlled Playback

```tsx
const ControlledLottie: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate which frame of the Lottie to show
  const lottieFrame = interpolate(
    frame,
    [0, 90], // Remotion frames
    [0, 60], // Lottie frames (match your animation length)
    { extrapolateRight: "clamp" }
  );

  return (
    <Lottie
      animationData={animationData}
      playbackRate={1}
      // Control exact frame
      goTo={lottieFrame}
      direction="forward"
    />
  );
};
```

## Lottie with Spring Timing

```tsx
const SpringLottie: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const lottieFrame = springProgress * 60; // 60 = total Lottie frames

  return (
    <Lottie
      animationData={animationData}
      goTo={lottieFrame}
    />
  );
};
```

## Looping Animations

```tsx
const LoopingLottie: React.FC = () => {
  const frame = useCurrentFrame();
  const animationFrames = 60; // Lottie animation length

  // Loop every 60 Remotion frames
  const loopedFrame = frame % animationFrames;

  return (
    <Lottie
      animationData={animationData}
      goTo={loopedFrame}
      loop
    />
  );
};
```

## Common Lottie Sources

### Free Animations
- **LottieFiles**: https://lottiefiles.com/free-animations
- **IconScout**: https://iconscout.com/lottie-animations
- **Lordicon**: https://lordicon.com (animated icons)

### Categories for Dev Tools
- Success/checkmark animations
- Loading spinners
- Confetti celebrations
- Code/terminal animations
- Rocket/launch sequences
- Data/chart animations
- Error/warning indicators

## Success Animation Pattern

```tsx
const SuccessCheck: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const relativeFrame = Math.max(0, frame - startFrame);

  // Check animation is typically 30-40 frames
  const progress = interpolate(
    relativeFrame,
    [0, 40],
    [0, 40],
    { extrapolateRight: "clamp" }
  );

  const scale = spring({
    frame: relativeFrame,
    fps: 30,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <div style={{ transform: `scale(${scale})` }}>
      <Lottie
        animationData={successAnimation}
        goTo={progress}
        style={{ width: 200, height: 200 }}
      />
    </div>
  );
};
```

## Confetti Celebration

```tsx
const ConfettiCelebration: React.FC<{
  startFrame: number;
  duration?: number;
}> = ({ startFrame, duration = 90 }) => {
  const frame = useCurrentFrame();
  const relativeFrame = Math.max(0, frame - startFrame);

  if (relativeFrame === 0 || relativeFrame > duration) {
    return null;
  }

  const opacity = interpolate(
    relativeFrame,
    [0, 10, duration - 20, duration],
    [0, 1, 1, 0]
  );

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <Lottie
        animationData={confettiAnimation}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
```

## Loading Spinner with Timeout

```tsx
const LoadingSpinner: React.FC<{
  startFrame: number;
  endFrame: number;
}> = ({ startFrame, endFrame }) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) {
    return null;
  }

  // Continuous loop while active
  const loopFrame = (frame - startFrame) % 30;

  return (
    <Lottie
      animationData={spinnerAnimation}
      goTo={loopFrame}
      style={{ width: 60, height: 60 }}
    />
  );
};
```

## Animated Icons

```tsx
const AnimatedIcon: React.FC<{
  icon: "code" | "rocket" | "check" | "star";
  color?: string;
}> = ({ icon, color = "#8b5cf6" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hover = spring({
    frame,
    fps,
    config: { damping: 20 },
  });

  const icons = {
    code: codeAnimation,
    rocket: rocketAnimation,
    check: checkAnimation,
    star: starAnimation,
  };

  return (
    <div
      style={{
        transform: `scale(${0.9 + hover * 0.1})`,
        filter: `drop-shadow(0 4px 12px ${color}40)`,
      }}
    >
      <Lottie
        animationData={icons[icon]}
        style={{ width: 100, height: 100 }}
      />
    </div>
  );
};
```

## Performance Tips

1. **Preload animations**: Load JSON at build time, not runtime
2. **Optimize file size**: Use LottieFiles optimizer
3. **Limit complexity**: <1000 shapes for smooth playback
4. **Use segments**: Only animate visible portion
5. **Cache instances**: Reuse same animation data object
