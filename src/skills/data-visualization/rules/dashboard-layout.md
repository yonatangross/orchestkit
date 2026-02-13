---
title: "Dashboard: Layout"
category: dashboard
impact: HIGH
impactDescription: Responsive grid layouts form the structural foundation of every dashboard
tags: [dashboard, layout, css-grid, responsive, sidebar]
---

# Dashboard Layout Patterns

## Responsive Dashboard Grid

```tsx
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 w-64 border-r bg-background">
        <Sidebar />
      </aside>
      <main className="pl-64">
        <header className="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <DashboardHeader />
        </header>
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{children}</div>
        </div>
      </main>
    </div>
  );
}

function DashboardGrid() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Revenue" value="$45,231" change="+12%" />
      <StatCard title="Users" value="2,350" change="+5.2%" />
      <StatCard title="Orders" value="1,245" change="+18%" />
      <StatCard title="Conversion" value="3.2%" change="-0.4%" />
      <div className="col-span-1 sm:col-span-2"><RevenueChart /></div>
      <div className="col-span-1 sm:col-span-2"><TrafficChart /></div>
      <div className="col-span-full"><RecentOrdersTable /></div>
    </div>
  );
}
```

## Key Principles

- Use **CSS Grid** for 2D dashboard layouts (not Flexbox)
- Always include responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Use `col-span-full` for full-width sections like tables
- Fixed sidebar with scrollable main content area
- Sticky header for persistent navigation
