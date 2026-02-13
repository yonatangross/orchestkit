---
title: Callout Positioning
impact: HIGH
impactDescription: "Misaligned annotations distract viewers and undermine professional quality — debug grids and calibration workflows prevent coordinate errors"
tags: callout, annotation, debug, coordinates, arrows, positioning
---

## Callout Positioning

Debug grids and coordinate systems for accurate arrow/annotation placement in Remotion video compositions.

### Coordinate Systems

**1920x1080 (Horizontal):**

| Region | X Range | Y Range | Description |
|--------|---------|---------|-------------|
| Top-Left | 0-640 | 0-360 | Logo/watermark |
| Top-Center | 640-1280 | 0-360 | Titles |
| Center | 640-1280 | 360-720 | Main content |
| Bottom | 0-1920 | 720-1080 | CTAs/captions |

**1080x1920 (Vertical):** Safe-Top: 200-400, Center: 640-1280, Safe-Bottom: 1520-1720

### Debug Grid Component

```tsx
<DebugGrid
  enabled={process.env.NODE_ENV === 'development'}
  gridSize={100}
  showCoordinates
  showRulers
  highlightCenter
  opacity={0.5}
/>
```

### Callout Types

**Pointer:** Arrow pointing to specific location with label
**Bracket:** Brackets around a region to highlight an area
**Highlight:** Colored overlay to emphasize a region
**Number Badge:** Numbered circle for step-by-step annotations

### Calibration Workflow

1. Enable debug grid in composition
2. Render single frame: `npx remotion still MyComposition --frame=30 --output=debug-frame.png`
3. Measure coordinates in image editor
4. Apply coordinates to callout components
5. Verify and iterate

### Responsive Positioning

```tsx
// Scale coordinates proportionally
function ResponsiveCallout({ baseWidth = 1920, baseHeight = 1080, x, y, ...props }) {
  const { width, height } = useVideoConfig();
  const scaledX = (x / baseWidth) * width;
  const scaledY = (y / baseHeight) * height;
  return <Callout x={scaledX} y={scaledY} {...props} />;
}
```

### Layer Order

```
1. UI Overlays (watermark, progress)  ← top
2. Callouts/Annotations
3. Main Content
4. Background                          ← bottom
```

### Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Hardcoded coordinates | Use responsive positioning |
| No debug grid | Enable DebugGrid during dev |
| Wrong layer order | Check z-index/layer stack |
| Missing safe zones | Use safe zone margins |

**References:** `references/debug-grid-component.md`, `references/coordinate-systems.md`, `references/calibration-workflow.md`
