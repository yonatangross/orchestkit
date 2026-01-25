# Animation Presets

Spring configurations and animation presets for scene intro cards in Remotion.

## Spring Configuration Reference

Remotion's `spring()` function uses two main parameters:
- **damping**: Controls oscillation. Higher = less bounce (range: 1-100+)
- **stiffness**: Controls speed. Higher = faster animation (range: 1-500+)

```
SPRING BEHAVIOR CHART
=====================

               Low Stiffness    High Stiffness
               (slow)           (fast)
            +-----------------+-----------------+
Low Damping |   Bouncy,       |   Snappy,       |
(bouncy)    |   slow          |   bouncy        |
            +-----------------+-----------------+
High Damping|   Smooth,       |   Sharp,        |
(no bounce) |   gradual       |   instant       |
            +-----------------+-----------------+
```

## Preset Configurations

### 1. Minimal Style Presets

For clean, subtle animations that don't distract from content.

```tsx
// Entry: Gentle fade-in
const minimalEntry = {
  config: { damping: 80, stiffness: 200 },
  // Results: Smooth, no overshoot, ~0.4s to settle
};

// Exit: Quick fade
const minimalExit = {
  config: { damping: 100, stiffness: 300 },
  // Results: Fast, clean exit, ~0.3s
};

// Text stagger delay: 5 frames (0.17s at 30fps)
const minimalStagger = 5;
```

#### Usage Example
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Entry animation
const opacity = spring({
  frame,
  fps,
  config: { damping: 80, stiffness: 200 },
});

// Staggered elements
const labelOpacity = spring({
  frame,
  fps,
  config: { damping: 80, stiffness: 300 },
});

const titleOpacity = spring({
  frame: Math.max(0, frame - 5), // 5 frame delay
  fps,
  config: { damping: 80, stiffness: 250 },
});
```

### 2. Bold Style Presets

For high-impact, attention-grabbing animations.

```tsx
// Icon: Bouncy scale-up
const boldIconEntry = {
  config: { damping: 15, stiffness: 100 },
  // Results: Bouncy overshoot to ~110%, settles in ~0.5s
};

// Title: Slide up with ease
const boldTitleSlide = {
  config: { damping: 20, stiffness: 100 },
  from: 20, // Start 20px below
  to: 0,
  // Results: Smooth slide with slight elasticity
};

// Text: Smooth fade
const boldTextFade = {
  config: { damping: 80, stiffness: 200 },
};

// Stagger timing
const boldStagger = {
  icon: 0,      // Immediate
  label: 5,     // +5 frames
  title: 8,     // +8 frames
  subtitle: 12, // +12 frames
};
```

#### Usage Example
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Icon with bounce
const iconScale = spring({
  frame,
  fps,
  config: { damping: 15, stiffness: 100 },
});

// Title slides up
const titleY = spring({
  frame: Math.max(0, frame - 8),
  fps,
  config: { damping: 20, stiffness: 100 },
  from: 20,
  to: 0,
});

// Subtitle fades in
const subtitleOpacity = spring({
  frame: Math.max(0, frame - 12),
  fps,
  config: { damping: 80, stiffness: 200 },
});
```

### 3. Branded Style Presets

For consistent, professional brand animations.

```tsx
// Accent bar: Smooth wipe
const brandedBarWipe = {
  config: { damping: 20, stiffness: 80 },
  from: 0,
  to: 100, // Percentage width
  // Results: Deliberate, premium feel, ~0.6s
};

// Content: Fade with delay
const brandedContentFade = {
  config: { damping: 80, stiffness: 200 },
  delay: 10, // Wait for bar animation
};

// Stagger timing
const brandedStagger = {
  bar: 0,       // Immediate
  progress: 10, // +10 frames
  label: 12,    // +12 frames
  title: 14,    // +14 frames
  subtitle: 16, // +16 frames
};
```

#### Usage Example
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Accent bar wipes in
const barWidth = spring({
  frame,
  fps,
  config: { damping: 20, stiffness: 80 },
  from: 0,
  to: 100,
});

// Content fades in after bar
const contentOpacity = spring({
  frame: Math.max(0, frame - 10),
  fps,
  config: { damping: 80, stiffness: 200 },
});
```

### 4. Progress Style Presets

For step indicators and progress animations.

```tsx
// Dots: Sequential scale-up
const progressDotScale = {
  config: { damping: 15, stiffness: 150 },
  // Results: Bouncy, playful
};

// Dot stagger: 3 frames between each
const progressDotStagger = 3;

// Title: Delayed fade
const progressTitleFade = {
  config: { damping: 80, stiffness: 200 },
  // Delay calculated as: numDots * dotStagger
};
```

#### Usage Example
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const numDots = 5;

// Each dot appears sequentially
const dots = Array.from({ length: numDots }, (_, i) => ({
  scale: spring({
    frame: Math.max(0, frame - i * 3), // 3 frame stagger
    fps,
    config: { damping: 15, stiffness: 150 },
  }),
}));

// Title after all dots
const titleOpacity = spring({
  frame: Math.max(0, frame - numDots * 3),
  fps,
  config: { damping: 80, stiffness: 200 },
});
```

## Exit Animation Presets

### Fade Exit
```tsx
const { durationInFrames } = useVideoConfig();
const exitDuration = 15; // frames

const exitFrame = Math.max(0, frame - (durationInFrames - exitDuration));
const exitOpacity = interpolate(exitFrame, [0, exitDuration], [1, 0], {
  extrapolateRight: "clamp",
});
```

### Scale + Fade Exit
```tsx
const exitScale = interpolate(exitFrame, [0, exitDuration], [1, 0.95], {
  extrapolateRight: "clamp",
});
const exitOpacity = interpolate(exitFrame, [0, exitDuration], [1, 0], {
  extrapolateRight: "clamp",
});

// Apply to container
style={{
  transform: `scale(${exitScale})`,
  opacity: exitOpacity,
}}
```

### Slide + Fade Exit
```tsx
const exitX = interpolate(exitFrame, [0, exitDuration], [0, -50], {
  extrapolateRight: "clamp",
});
const exitOpacity = interpolate(exitFrame, [0, exitDuration], [1, 0], {
  extrapolateRight: "clamp",
});

style={{
  transform: `translateX(${exitX}px)`,
  opacity: exitOpacity,
}}
```

## Combined Entry + Exit Pattern

```tsx
const IntroCardAnimated: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entry animation (first 15 frames)
  const entryProgress = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Exit animation (last 15 frames)
  const exitStart = durationInFrames - 15;
  const exitFrame = Math.max(0, frame - exitStart);
  const exitOpacity = interpolate(exitFrame, [0, 15], [1, 0], {
    extrapolateRight: "clamp",
  });

  // Combined opacity
  const opacity = Math.min(entryProgress, exitOpacity);

  // Entry scale (0.95 -> 1)
  const entryScale = interpolate(entryProgress, [0, 1], [0.95, 1]);

  // Exit scale (1 -> 0.95)
  const exitScale = interpolate(exitFrame, [0, 15], [1, 0.95], {
    extrapolateRight: "clamp",
  });

  // Use entry scale during entry, exit scale during exit
  const scale = frame < exitStart ? entryScale : exitScale;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

## Easing Curves Reference

For `interpolate()` operations, use easing curves:

```tsx
import { Easing } from "remotion";

// Smooth ease out (decelerating)
interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.out(Easing.ease),
});

// Smooth ease in (accelerating)
interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.in(Easing.ease),
});

// Ease in-out (both)
interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.inOut(Easing.ease),
});

// Bouncy (overshoot)
interpolate(frame, [0, 30], [0, 1], {
  easing: Easing.out(Easing.back(1.7)), // 1.7 = overshoot amount
});
```

## Quick Reference Chart

| Style | Element | Damping | Stiffness | Delay (frames) | Duration |
|-------|---------|---------|-----------|----------------|----------|
| Minimal | Label | 80 | 300 | 0 | ~0.3s |
| Minimal | Title | 80 | 250 | 5 | ~0.35s |
| Bold | Icon | 15 | 100 | 0 | ~0.5s |
| Bold | Label | 80 | 250 | 5 | ~0.35s |
| Bold | Title | 20 | 100 | 8 | ~0.45s |
| Bold | Subtitle | 80 | 200 | 12 | ~0.4s |
| Branded | Bar | 20 | 80 | 0 | ~0.6s |
| Branded | Content | 80 | 200 | 10 | ~0.4s |
| Progress | Dots | 15 | 150 | 3 per dot | ~0.4s |
| Progress | Title | 80 | 200 | dots * 3 | ~0.4s |

## Reduced Motion Fallback

```tsx
const useReducedMotion = () => {
  // In Remotion, check a prop or config
  // For web, use media query
  return false; // Default to full motion
};

const getAnimationConfig = (prefersReduced: boolean) => {
  if (prefersReduced) {
    return {
      // Instant, no animation
      damping: 100,
      stiffness: 1000,
    };
  }
  return {
    // Normal animation
    damping: 80,
    stiffness: 200,
  };
};

// Usage
const prefersReduced = useReducedMotion();
const config = getAnimationConfig(prefersReduced);

const opacity = spring({
  frame,
  fps,
  config,
});
```

## Performance Tips

1. **Avoid animating layout properties** - Use `transform` and `opacity` only
2. **Use `will-change`** for complex animations:
   ```tsx
   style={{ willChange: "transform, opacity" }}
   ```
3. **Limit simultaneous springs** - Max 5-6 spring calculations per frame
4. **Pre-calculate constants** - Move static calculations outside render
5. **Use `useMemo`** for complex calculations:
   ```tsx
   const staggerDelays = useMemo(
     () => Array.from({ length: 5 }, (_, i) => i * 3),
     []
   );
   ```
