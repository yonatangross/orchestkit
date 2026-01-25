# Animation Presets

## Easing Functions

Import from Remotion:
```tsx
import { Easing, interpolate, spring } from "remotion";
```

### Predefined Easings
```tsx
// Standard mathematical easings
Easing.linear       // t => t
Easing.ease         // Basic inertial
Easing.quad         // t²
Easing.cubic        // t³
Easing.sin          // Sinusoidal
Easing.exp          // Exponential
Easing.circle       // Circular

// Playful easings
Easing.bounce       // Bouncing ball effect
Easing.elastic(1)   // Spring-like oscillation
Easing.back(1.5)    // Overshoot with anticipation

// Custom bezier
Easing.bezier(0.68, -0.6, 0.32, 1.6) // Snappy overshoot
```

### Directional Modifiers
```tsx
Easing.in(Easing.ease)     // Accelerates
Easing.out(Easing.ease)    // Decelerates (most natural)
Easing.inOut(Easing.ease)  // Symmetrical
```

## Spring Physics

### Config Presets
```tsx
// Bouncy - playful enters
const BOUNCY = { damping: 10, stiffness: 100 };

// Snappy - quick UI responses
const SNAPPY = { damping: 20, stiffness: 200 };

// Smooth - subtle movements
const SMOOTH = { damping: 80, stiffness: 200 };

// Heavy - large elements
const HEAVY = { damping: 15, stiffness: 50 };

// Elastic - attention grabbing
const ELASTIC = { damping: 8, stiffness: 120 };
```

### Usage Pattern
```tsx
const scale = spring({
  frame: adjustedFrame,
  fps,
  config: BOUNCY,
  from: 0,
  to: 1,
});
```

## Common Animation Patterns

### Staggered Entry
```tsx
{items.map((item, i) => {
  const itemDelay = i * 5; // 5 frames between each
  const progress = spring({
    frame: Math.max(0, frame - itemDelay),
    fps,
    config: { damping: 15, stiffness: 100 },
  });
  return <Item key={i} style={{ opacity: progress }} />;
})}
```

### Number Counting with Easing
```tsx
const displayValue = interpolate(
  adjustedFrame,
  [0, 45],
  [0, targetValue],
  {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  }
);
```

### Pulse Loop
```tsx
const pulse = 1 + Math.sin(frame * 0.15) * 0.03;
// Results in 0.97 to 1.03 oscillation
```

### Delayed Fade
```tsx
const opacity = interpolate(
  adjustedFrame,
  [0, 15],
  [0, 1],
  { extrapolateRight: "clamp" }
);
```

## Text Animation Recipes

### Wave Effect (char-by-char)
```tsx
{text.split("").map((char, i) => {
  const y = spring({
    frame: Math.max(0, frame - i * 2),
    fps,
    config: { damping: 10, stiffness: 120 },
    from: -25,
    to: 0,
  });
  return <span style={{ transform: `translateY(${y}px)` }}>{char}</span>;
})}
```

### Blur Reveal
```tsx
const blur = interpolate(adjustedFrame, [0, 20], [12, 0], {
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.ease),
});
// style={{ filter: `blur(${blur}px)` }}
```

### Gradient Sweep
```tsx
const position = interpolate(adjustedFrame, [0, 35], [-50, 150]);
// background: linear-gradient(90deg, transparent ${position-30}%, color ${position}%, transparent ${position+30}%)
```
