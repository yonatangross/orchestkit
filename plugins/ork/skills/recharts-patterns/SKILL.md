---
name: recharts-patterns
description: Data visualization with Recharts 3.x including responsive charts, custom tooltips, animations, and accessibility for React applications. Use when building charts or dashboards with Recharts.
tags: [recharts, charts, data-visualization, react, svg, accessibility, responsive, d3]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Recharts Patterns

Data visualization patterns using Recharts 3.x - a composable charting library built with React and D3.

## Core Chart Types

### Line Chart

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { date: '2024-01', revenue: 4000, expenses: 2400 },
  { date: '2024-02', revenue: 3000, expenses: 1398 },
];

function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
        <Line type="monotone" dataKey="expenses" stroke="#82ca9d" strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Bar Chart

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function SalesChart({ data }: { data: SalesData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="sales" fill="#8884d8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="target" fill="#82ca9d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Pie/Donut Chart

```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

function DeviceChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### Area Chart with Gradient

```tsx
function TrafficChart({ data }: { data: TrafficData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Area type="monotone" dataKey="visitors" stroke="#8884d8" fill="url(#colorUv)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## Custom Tooltip

```tsx
import { TooltipProps } from 'recharts';

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white p-3 shadow-lg rounded-lg border">
      <p className="font-medium text-gray-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// Usage: <Tooltip content={<CustomTooltip />} />
```

## Accessibility

```tsx
function AccessibleChart({ data }: { data: ChartData[] }) {
  return (
    <figure role="img" aria-label="Monthly revenue trend from January to December">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Monthly Revenue" />
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">Line chart showing monthly revenue</figcaption>
    </figure>
  );
}
```

## Real-Time Updates

```tsx
function RealTimeChart() {
  const { data } = useQuery({
    queryKey: ['metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 5000,
  });

  if (!data) return <ChartSkeleton />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" isAnimationActive={false} dot={false} />
        <XAxis dataKey="timestamp" />
        <YAxis domain={['auto', 'auto']} />
        <Tooltip />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Performance Tips

```tsx
// Limit data points for smooth rendering
const MAX_POINTS = 500;
const chartData = data.slice(-MAX_POINTS);

// Use dot={false} for many data points
<Line dataKey="value" dot={false} />

// Memoize expensive calculations
const processedData = useMemo(() => processChartData(rawData), [rawData]);

// Disable animation for real-time
<Line isAnimationActive={false} />
```

## Anti-Patterns (FORBIDDEN)

```tsx
// NEVER: ResponsiveContainer without parent dimensions
<div> {/* No height! */}
  <ResponsiveContainer width="100%" height="100%"> {/* Won't work */}
  </ResponsiveContainer>
</div>

// NEVER: Fixed dimensions on ResponsiveContainer
// NEVER: Animations on real-time charts (causes jank)
// NEVER: Inline data definition in render (new array every render)
// NEVER: Too many data points without limiting (performance issue)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Container | **ResponsiveContainer** always |
| Animation | **Disabled** for real-time data |
| Tooltip | **Custom** for branded UX |
| Data updates | **Sliding window** for time-series |

## Related Skills

- `dashboard-patterns` - Dashboard layouts with charts
- `tanstack-query-advanced` - Data fetching for charts
- `a11y-testing` - Testing chart accessibility
