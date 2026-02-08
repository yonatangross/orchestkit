# Data Visualization Patterns

## StatCounter (Enhanced)

Location: `orchestkit-demos/src/components/shared/StatCounter.tsx`

### Basic Usage
```tsx
import { StatCounter, StatRow, InlineStat } from "./shared/StatCounter";

<StatCounter
  value={168}
  label="Skills"
  color="#8b5cf6"
/>
```

### Advanced Features
```tsx
<StatCounter
  value={168}
  label="Skills"
  color="#8b5cf6"
  prefix="+"           // Shown before value
  suffix="%"           // Shown after value
  delay={15}           // Start delay in frames
  easing="bounce"      // bounce, elastic, back, snappy, spring
  digitMorph           // Animate each digit separately
  gradientColors={["#8b5cf6", "#22c55e"]}  // Value color gradient
  celebrateOnComplete  // Particle burst when done
  size="lg"            // sm (28px), md (42px), lg (64px)
/>
```

### StatRow (Multiple Stats)
```tsx
<StatRow
  stats={[
    { value: 168, label: "Skills", suffix: "+" },
    { value: 35, label: "Agents" },
    { value: 148, label: "Hooks" },
  ]}
  color="#8b5cf6"
  staggerDelay={8}    // Frames between each stat
  easing="bounce"
  digitMorph
  size="md"
/>
```

## Charts

Location: `orchestkit-demos/src/components/shared/AnimatedChart.tsx`

### ProgressRing (Donut Chart)
```tsx
import { ProgressRing } from "./shared/AnimatedChart";

<ProgressRing
  progress={85}           // 0-100
  color="#22c55e"
  size={120}              // Diameter in pixels
  strokeWidth={12}
  delay={0}
  showLabel               // Show percentage in center
  labelSuffix="%"
  easing="spring"         // spring, ease, bounce
  gradientColors={["#8b5cf6", "#22c55e"]}  // Optional gradient
/>
```

### BarChart (Racing Bars)
```tsx
import { BarChart } from "./shared/AnimatedChart";

<BarChart
  data={[
    { label: "Skills", value: 168, color: "#8b5cf6" },
    { label: "Agents", value: 35, color: "#22c55e" },
    { label: "Hooks", value: 148, color: "#f59e0b" },
  ]}
  maxValue={200}          // Optional, auto-calculated if omitted
  delay={0}
  barHeight={28}
  gap={12}
  showValues              // Show numbers at end of bars
  staggerDelay={5}        // Frames between each bar
  labelWidth={80}         // Width for label column
/>
```

### LineChart (Path Drawing)
```tsx
import { LineChart } from "./shared/AnimatedChart";

<LineChart
  points={[10, 25, 18, 42, 35, 60, 55, 80]}
  color="#8b5cf6"
  width={300}
  height={150}
  delay={0}
  strokeWidth={3}
  showDots                // Animated dots at data points
  showArea                // Fill area under line
  gradientColors={["#8b5cf6", "#22c55e"]}  // Optional line gradient
/>
```

### ComparisonStat (Before/After)
```tsx
import { ComparisonStat } from "./shared/AnimatedChart";

<ComparisonStat
  before={180}
  after={2}
  label="Review Time"
  suffix=" min"
  beforeColor="#ef4444"
  afterColor="#22c55e"
  delay={0}
  showArrow               // Arrow between values
/>
```

### MetricCard (Stat with Trend)
```tsx
import { MetricCard } from "./shared/AnimatedChart";

<MetricCard
  value={94}
  label="Coverage"
  icon="📊"
  trend="up"              // up, down, neutral
  trendValue="+12%"
  color="#22c55e"
  delay={0}
/>
```

## Usage in Compositions

### Results Scene with Charts
```tsx
<AbsoluteFill style={{ padding: 60 }}>
  <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
    <ProgressRing progress={94} color="#22c55e" showLabel />
    <ProgressRing progress={85} color="#8b5cf6" showLabel />
    <ProgressRing progress={100} color="#06b6d4" showLabel />
  </div>

  <ComparisonStat
    before="3 hours"
    after="2 minutes"
    label="Review Time"
  />

  <StatRow
    stats={[
      { value: 6, label: "Agents" },
      { value: 12, label: "Issues" },
      { value: 94, label: "Score", suffix: "%" },
    ]}
    easing="bounce"
  />
</AbsoluteFill>
```

## AnimStats-Style Patterns

### Digit Morphing Counter
For AnimStats-quality number animations, use:
```tsx
<StatCounter
  value={10000}
  digitMorph              // Each digit springs in separately
  easing="bounce"
  celebrateOnComplete     // Particle burst on completion
/>
```

### Racing Bar Chart
```tsx
<BarChart
  data={sortedData}       // Sort by value for racing effect
  staggerDelay={3}        // Quick stagger for racing feel
  showValues
/>
```

### Progress Dashboard
```tsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
  {metrics.map((m, i) => (
    <MetricCard
      key={i}
      value={m.value}
      label={m.label}
      trend={m.trend}
      delay={i * 8}
    />
  ))}
</div>
```
