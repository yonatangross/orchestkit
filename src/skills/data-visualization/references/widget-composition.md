# Widget Composition Patterns

## Widget Registry Pattern

Create a centralized registry for dynamic widget rendering:

```typescript
// widget-registry.ts
import type { ComponentType, ReactNode } from 'react';

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  span?: { cols: number; rows: number };
  props?: Record<string, unknown>;
}

type WidgetComponent = ComponentType<{ config: WidgetConfig }>;

const widgetRegistry = new Map<string, WidgetComponent>();

export function registerWidget(type: string, component: WidgetComponent) {
  widgetRegistry.set(type, component);
}

export function getWidget(type: string): WidgetComponent | undefined {
  return widgetRegistry.get(type);
}
```

## Dashboard Grid Layout

Use CSS Grid for responsive dashboard layouts:

```typescript
// dashboard-grid.tsx
interface DashboardGridProps {
  widgets: WidgetConfig[];
  columns?: number;
}

export function DashboardGrid({ widgets, columns = 4 }: DashboardGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {widgets.map((widget) => {
        const Widget = getWidget(widget.type);
        if (!Widget) return null;

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${widget.span?.cols ?? 1}`,
              gridRow: `span ${widget.span?.rows ?? 1}`,
            }}
          >
            <Widget config={widget} />
          </div>
        );
      })}
    </div>
  );
}
```

## User-Customizable Layouts

Persist user layout preferences:

```typescript
// use-dashboard-layout.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useDashboardLayout(dashboardId: string) {
  const queryClient = useQueryClient();

  const { data: layout } = useQuery({
    queryKey: ['dashboard-layout', dashboardId],
    queryFn: () => fetchLayout(dashboardId),
  });

  const updateLayout = useMutation({
    mutationFn: (newLayout: WidgetConfig[]) =>
      saveLayout(dashboardId, newLayout),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['dashboard-layout', dashboardId],
      });
    },
  });

  return { layout, updateLayout };
}
```

## Real-Time Widget Updates

Use SSE for live dashboard data:

```typescript
// use-widget-stream.ts
export function useWidgetStream(widgetId: string) {
  const [data, setData] = useState<WidgetData | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/widgets/${widgetId}/stream`);

    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    return () => eventSource.close();
  }, [widgetId]);

  return data;
}
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout system | CSS Grid | Native, no dependencies, responsive |
| State persistence | TanStack Query | Caching, background sync |
| Real-time updates | SSE | Simpler than WebSocket for read-only |
| Widget registry | Map-based | Type-safe, tree-shakeable |
