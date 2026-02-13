---
title: "Dashboard: Widgets"
category: dashboard
impact: HIGH
impactDescription: Widget composition and real-time data patterns drive dashboard interactivity
tags: [dashboard, widgets, stat-card, registry, sse, real-time]
---

# Dashboard Widget Patterns

## Stat Card Widget

```tsx
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

function StatCard({ title, value, change, changeType = 'neutral', icon }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold">{value}</p>
        {change && (
          <span className={cn(
            'flex items-center text-sm font-medium',
            changeType === 'positive' && 'text-green-600',
            changeType === 'negative' && 'text-red-600',
          )}>
            {changeType === 'positive' && <TrendingUp className="h-4 w-4" />}
            {changeType === 'negative' && <TrendingDown className="h-4 w-4" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
```

## Widget Registry Pattern

```tsx
type WidgetType = 'stat' | 'chart' | 'table' | 'list';

interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  span?: number;
  props: Record<string, unknown>;
}

const widgetRegistry: Record<WidgetType, React.ComponentType<any>> = {
  stat: StatCard,
  chart: ChartCard,
  table: DataTable,
  list: ListWidget,
};

function DashboardWidget({ config }: { config: WidgetConfig }) {
  const Component = widgetRegistry[config.type];
  if (!Component) return null;

  return (
    <div style={{ gridColumn: config.span ? `span ${config.span}` : undefined }}>
      <Component title={config.title} {...config.props} />
    </div>
  );
}
```

## Real-Time Data with TanStack Query + SSE

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

function useRealtimeMetrics() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: fetchMetrics,
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/metrics/stream');
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      queryClient.setQueryData(['metrics'], (old: Metrics | undefined) => ({
        ...old,
        ...update,
      }));
    };
    eventSource.onerror = () => {
      eventSource.close();
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    };
    return () => eventSource.close();
  }, [queryClient]);

  return { data, isLoading };
}
```
