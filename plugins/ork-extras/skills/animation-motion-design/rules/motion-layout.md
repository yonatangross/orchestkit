---
title: "Layout Animations with Motion"
impact: "HIGH"
impactDescription: "Without layout prop, list reorders and size changes cause jarring jumps instead of smooth FLIP transitions"
tags: [motion, layout, FLIP, layoutId, shared-layout, animation]
---

## Layout Animations with Motion

The `layout` prop enables automatic FLIP (First, Last, Invert, Play) animations when a component's position or size changes in the DOM. Use `layoutId` for shared element transitions across components.

**Incorrect:**
```tsx
// Animating width/height directly — causes layout thrash, drops frames
<motion.div
  animate={{ width: isExpanded ? 400 : 200, height: isExpanded ? 300 : 150 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

**Correct:**
```tsx
// layout prop — Motion calculates FLIP transform automatically
<motion.div layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
  <div style={{ width: isExpanded ? 400 : 200, height: isExpanded ? 300 : 150 }}>
    {content}
  </div>
</motion.div>
```

### Shared Layout Transitions

Use `layoutId` to animate a single element across different component trees:

```tsx
function TabBar({ activeTab }: { activeTab: string }) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => setActive(tab.id)}>
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="active-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
```

### Layout Groups

Wrap independent layout animation contexts with `LayoutGroup`:

```tsx
import { LayoutGroup } from "motion/react"

<LayoutGroup id="sidebar">
  <SidebarNav />
</LayoutGroup>
<LayoutGroup id="main">
  <MainContent />
</LayoutGroup>
```

**Key rules:**
- Use `layout` for position/size changes, never animate `width`/`height` directly
- Use `layoutId` for shared element transitions — IDs must be unique within a `LayoutGroup`
- Set `layout="position"` to only animate position (skip size), reducing visual distortion
- Wrap siblings in `LayoutGroup` to scope layout animations and prevent cross-contamination
- Add `layoutDependency` when layout changes depend on non-React state

Reference: https://motion.dev/docs/layout-animations
