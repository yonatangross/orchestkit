---
title: "Charts: Responsive & Accessible"
category: charts
impact: HIGH
impactDescription: Responsive containers and accessibility ensure charts work across devices and for all users
tags: [recharts, responsive, accessibility, aria, responsive-container]
---

# Responsive & Accessible Charts

## ResponsiveContainer Rules

Always wrap charts in `ResponsiveContainer`. The parent element **must** have explicit height.

```tsx
// CORRECT: Parent has height
<div style={{ height: 400 }}>
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>...</LineChart>
  </ResponsiveContainer>
</div>

// ALSO CORRECT: Fixed height on container
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data}>...</LineChart>
</ResponsiveContainer>
```

```tsx
// WRONG: No parent height - chart won't render
<div>
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>...</LineChart>
  </ResponsiveContainer>
</div>
```

## Accessible Charts

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

## Key Principles

- Always use `ResponsiveContainer` - never fixed pixel dimensions on charts
- Ensure parent element has explicit height (CSS or inline)
- Use `figure` element with `role="img"` and `aria-label` for accessibility
- Include `sr-only` figcaption describing the chart data
- Provide meaningful `name` props on data series for screen readers
