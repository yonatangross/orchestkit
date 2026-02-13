---
title: Data Visualization Components
impact: MEDIUM
impactDescription: "Animated data visualizations make metrics compelling and memorable — static numbers fail to create the emotional impact needed for demos and launches"
tags: data-viz, charts, animation, remotion, interpolate, statistics
---

## Data Visualization Components

Animated data visualization components for Remotion — counters, progress rings, bar charts, and line charts with spring-based transitions.

### StatCounter (Animated Number)

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const StatCounter: React.FC<{
  from: number;
  to: number;
  label: string;
  suffix?: string;
  delay?: number;
}> = ({ from, to, label, suffix = "", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });

  const value = Math.round(interpolate(progress, [0, 1], [from, to]));

  return (
    <div style={{ textAlign: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: "#fff" }}>
        {value.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 24, color: "#a1a1aa", marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
};

// Usage: <StatCounter from={0} to={200} label="Skills" delay={15} />
```

### ProgressRing (SVG Circle)

```tsx
const ProgressRing: React.FC<{
  percent: number;
  size?: number;
  color?: string;
  delay?: number;
}> = ({ percent, size = 120, color = "#8b5cf6", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 25, stiffness: 60 },
  });

  const offset = circumference * (1 - (percent / 100) * progress);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius}
        fill="none" stroke="#27272a" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={radius}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
};
```

### BarChart (Spring Transitions)

```tsx
const BarChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  delay?: number;
}> = ({ data, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 300 }}>
      {data.map((item, i) => {
        const barProgress = spring({
          frame: Math.max(0, frame - delay - i * 8),
          fps,
          config: { damping: 15, stiffness: 120 },
        });
        const height = (item.value / maxValue) * 260 * barProgress;
        return (
          <div key={item.label} style={{ textAlign: "center", flex: 1 }}>
            <div style={{
              height, backgroundColor: item.color,
              borderRadius: "6px 6px 0 0", minWidth: 40,
            }} />
            <div style={{ color: "#a1a1aa", fontSize: 14, marginTop: 8 }}>
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

### Animation Timing Patterns

| Component | Entry Style | Duration | Stagger |
|-----------|-------------|----------|---------|
| StatCounter | Count up | 30-45 frames | N/A |
| ProgressRing | Draw clockwise | 30-40 frames | N/A |
| BarChart | Grow from bottom | 20-30 frames | 8 frames per bar |
| LineChart | Draw left to right | 40-60 frames | N/A |

### Color Palette for Data

```
Primary:   #8b5cf6 (purple)  — Main metric
Secondary: #06b6d4 (cyan)    — Supporting data
Success:   #22c55e (green)   — Positive change
Warning:   #f59e0b (amber)   — Caution / comparison
Danger:    #ef4444 (red)     — Negative / before state
Neutral:   #71717a (zinc)    — Baseline / labels
```

### Composition Example

```tsx
<AbsoluteFill style={{ background: "#0a0a0f", padding: 80 }}>
  <div style={{ display: "flex", gap: 60, justifyContent: "center" }}>
    <StatCounter from={0} to={200} label="Skills" suffix="+" delay={0} />
    <StatCounter from={0} to={36} label="Agents" delay={15} />
    <StatCounter from={0} to={93} label="Hooks" delay={30} />
  </div>
</AbsoluteFill>
```

**Key rules:** Always use `spring()` for organic motion. Stagger sequential elements by 8-15 frames. Derive all values from `useCurrentFrame()`.

**References:** `references/data-viz-components.md`, `references/chart-animation-patterns.md`
