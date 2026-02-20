---
title: Configure Recharts with ResponsiveContainer and animation control for stable rendering
impact: HIGH
impactDescription: "Charts without ResponsiveContainer or with animations on real-time data cause layout overflow and rendering jank — proper container setup and animation control prevents both"
tags: recharts, charts, line-chart, bar-chart, pie-chart, responsive-container
---

## Recharts Chart Components

Build Recharts 3.x chart components with responsive containers, custom tooltips, and accessibility.

**Incorrect — chart without responsive container:**
```tsx
// WRONG: Fixed width, no container, animations on real-time data
function BrokenChart({ data }: { data: ChartData[] }) {
  return (
    <LineChart width={800} height={400} data={data}>
      {/* Fixed width overflows on mobile */}
      {/* Animation on every data update = jank */}
      <Line type="monotone" dataKey="value" />
    </LineChart>
  );
}
```

**Correct — responsive chart with proper setup:**
```tsx
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

// Line chart (trends over time)
function RevenueChart({ data }: { data: ChartData[] }) {
  return (
    <div className="h-[400px]"> {/* Parent MUST have height */}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Custom tooltip for branded UX
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// Real-time chart: disable animations
function LiveMetricChart({ data }: { data: MetricData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="value"
          isAnimationActive={false}  // No animation on real-time data
          dot={false}                // No dots for performance
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Accessible chart with figure role
function AccessibleChart({ data, title }: { data: ChartData[]; title: string }) {
  return (
    <figure role="figure" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
```

**Chart type selection guide:**

| Chart | Component | Best For |
|-------|-----------|----------|
| Line | `LineChart` | Trends over time |
| Bar | `BarChart` | Comparisons between categories |
| Pie/Donut | `PieChart` with `innerRadius` | Proportions/percentages |
| Area | `AreaChart` with gradient | Volume over time |

**Key rules:**
- Always wrap charts in `ResponsiveContainer` with a parent that has explicit height
- Disable animations on real-time/frequently-updating charts (`isAnimationActive={false}`)
- Use custom tooltips for branded UX instead of default
- Add `figure` role and `aria-label` for accessibility
- Limit data points to prevent rendering performance issues
- Memoize data calculations outside the render function
