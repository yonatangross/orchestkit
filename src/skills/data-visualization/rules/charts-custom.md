---
title: "Charts: Custom Tooltips & Performance"
category: charts
impact: HIGH
impactDescription: Custom tooltips and performance optimization are essential for production chart UX
tags: [recharts, tooltip, real-time, performance, memoization]
---

# Custom Tooltips & Performance

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

## Key Principles

- Disable `isAnimationActive` for real-time charts to prevent jank
- Use `dot={false}` when rendering >100 data points
- Limit data with sliding window (`data.slice(-MAX_POINTS)`)
- Memoize data transformations with `useMemo`
- Never define data arrays inline in render (creates new reference each render)
