# Recharts Chart Types Reference

## Choosing the Right Chart

| Data Type | Recommended Chart | Use Case |
|-----------|-------------------|----------|
| Time series | LineChart, AreaChart | Trends over time |
| Categories | BarChart | Comparing categories |
| Composition | PieChart | Parts of a whole |
| Distribution | ScatterChart | Correlation, clustering |
| Multiple metrics | ComposedChart | Mixed visualizations |
| Flow/connections | Sankey | Process flows |
| Ranking | BarChart (horizontal) | Top N items |

## LineChart

```tsx
<LineChart data={data}>
  <Line type="monotone" dataKey="value" />
  <Line type="linear" dataKey="target" strokeDasharray="5 5" />
</LineChart>

// Line types: monotone, linear, step, stepBefore, stepAfter
```

**Best for:** Continuous data, trends, comparisons over time

## BarChart

```tsx
<BarChart data={data}>
  <Bar dataKey="sales" fill="#8884d8" radius={[4, 4, 0, 0]} />
  <Bar dataKey="costs" fill="#82ca9d" />
</BarChart>

// Stacked bars
<BarChart data={data} layout="vertical">
  <Bar dataKey="a" stackId="stack" />
  <Bar dataKey="b" stackId="stack" />
</BarChart>
```

**Best for:** Categorical comparisons, rankings

## AreaChart

```tsx
<AreaChart data={data}>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
    </linearGradient>
  </defs>
  <Area type="monotone" dataKey="value" fill="url(#gradient)" />
</AreaChart>

// Stacked area
<AreaChart>
  <Area stackId="1" dataKey="a" />
  <Area stackId="1" dataKey="b" />
</AreaChart>
```

**Best for:** Volume over time, cumulative totals

## PieChart

```tsx
<PieChart>
  <Pie
    data={data}
    dataKey="value"
    nameKey="name"
    cx="50%"
    cy="50%"
    innerRadius={60}  // Donut if > 0
    outerRadius={100}
    paddingAngle={2}
    label
  >
    {data.map((entry, i) => (
      <Cell key={i} fill={COLORS[i % COLORS.length]} />
    ))}
  </Pie>
</PieChart>
```

**Best for:** Part-to-whole relationships (≤7 categories)

## ComposedChart

```tsx
<ComposedChart data={data}>
  <Area dataKey="visitors" />
  <Bar dataKey="conversions" />
  <Line dataKey="rate" yAxisId="right" />
  <YAxis yAxisId="left" />
  <YAxis yAxisId="right" orientation="right" />
</ComposedChart>
```

**Best for:** Multiple metric types, dual-axis charts

## RadarChart

```tsx
<RadarChart data={data}>
  <PolarGrid />
  <PolarAngleAxis dataKey="subject" />
  <PolarRadiusAxis />
  <Radar dataKey="A" fill="#8884d8" fillOpacity={0.6} />
  <Radar dataKey="B" fill="#82ca9d" fillOpacity={0.6} />
</RadarChart>
```

**Best for:** Multi-dimensional comparisons, skill assessments

## ScatterChart

```tsx
<ScatterChart>
  <Scatter data={data} fill="#8884d8">
    {data.map((entry, i) => (
      <Cell key={i} fill={entry.z > 100 ? '#ff0000' : '#00ff00'} />
    ))}
  </Scatter>
  <ZAxis dataKey="z" range={[50, 400]} />
</ScatterChart>
```

**Best for:** Correlation analysis, clustering visualization
