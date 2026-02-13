---
title: Dashboard Layout & Widgets
impact: HIGH
impactDescription: "Dashboards that fetch data per-widget or re-render entirely on single metric changes cause redundant requests and poor performance — shared query keys and grid layouts solve both"
tags: dashboard, widgets, grid-layout, stat-cards, tanstack-query, sse
---

## Dashboard Layout & Widgets

Build responsive dashboard grids with stat cards, widget composition, and real-time data patterns.

**Incorrect — each widget fetches independently:**
```tsx
// WRONG: 5 widgets = 5 duplicate API calls
function Dashboard() {
  return (
    <div>
      <RevenueWidget /> {/* fetches /api/metrics */}
      <UsersWidget />   {/* fetches /api/metrics AGAIN */}
      <OrdersWidget />  {/* fetches /api/metrics AGAIN */}
    </div>
  );
}
```

**Correct — shared query with responsive grid layout:**
```tsx
// Dashboard grid with responsive breakpoints
function DashboardGrid() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Revenue" value="$45,231" change="+12%" trend="up" />
      <StatCard title="Users" value="2,350" change="+5.2%" trend="up" />
      <StatCard title="Orders" value="1,234" change="-2.1%" trend="down" />
      <StatCard title="Conversion" value="3.2%" change="+0.4%" trend="up" />

      {/* Full-width chart spanning all columns */}
      <div className="col-span-full">
        <RevenueChart />
      </div>

      {/* Two-column layout for secondary charts */}
      <div className="col-span-1 lg:col-span-2">
        <TrafficChart />
      </div>
      <div className="col-span-1 lg:col-span-2">
        <TopProductsTable />
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  title, value, change, trend,
}: {
  title: string; value: string; change: string; trend: 'up' | 'down';
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
        {change}
      </p>
    </div>
  );
}
```

**Widget registry pattern for dynamic dashboards:**
```tsx
const widgetRegistry: Record<string, React.ComponentType<WidgetProps>> = {
  'stat-card': StatCard,
  'line-chart': LineChartWidget,
  'bar-chart': BarChartWidget,
  'data-table': DataTableWidget,
};

function DynamicDashboard({ config }: { config: DashboardConfig }) {
  return (
    <div className="grid gap-4 grid-cols-12">
      {config.widgets.map((widget) => {
        const Widget = widgetRegistry[widget.type];
        return (
          <div key={widget.id} className={`col-span-${widget.colSpan}`}>
            <Suspense fallback={<WidgetSkeleton />}>
              <Widget {...widget.props} />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
```

**Real-time updates with SSE + TanStack Query:**
```tsx
function useRealtimeMetrics() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource('/api/metrics/stream');
    source.onmessage = (event) => {
      const metric = JSON.parse(event.data);
      // Update specific query, not entire dashboard
      queryClient.setQueryData(['metrics', metric.key], metric.value);
    };
    return () => source.close();
  }, [queryClient]);
}
```

**Key rules:**
- Use CSS Grid with responsive breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- Share data via TanStack Query with granular query keys (not per-widget fetch)
- Use `col-span-full` for full-width charts, `col-span-2` for half-width
- Skeleton loading for content areas during initial load
- SSE for server-to-client real-time, WebSocket for bidirectional
- Update specific query keys on real-time events, not entire cache
