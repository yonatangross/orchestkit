---
name: callout-positioning
description: Debug grids and coordinate systems for video annotations. Use when positioning callouts, arrows, or debugging coordinate misalignment in Remotion
tags: [video, remotion, callout, annotation, debug, coordinates, arrows]
user-invocable: false
version: 1.0.0
context: fork
author: OrchestKit
---

# Callout Positioning

Debug grids and coordinate systems for accurate arrow/annotation placement in Remotion video compositions. Essential for precise callout placement across different resolutions and aspect ratios.

## Overview

- Positioning callouts, arrows, and annotations in video compositions
- Debugging coordinate misalignment in Remotion renders
- Calibrating element positions using screenshot-based workflow
- Creating responsive annotations for multi-resolution exports
- Building reusable callout components with precise positioning

## Quick Start

```tsx
// 1. Enable debug grid during development
import { DebugGrid } from './components/DebugGrid';

<AbsoluteFill>
  <YourScene />
  <DebugGrid enabled={process.env.NODE_ENV === 'development'} />
</AbsoluteFill>

// 2. Position callouts using grid coordinates
<Callout
  x={960}   // Center horizontal (1920/2)
  y={540}   // Center vertical (1080/2)
  type="pointer"
  label="Click here"
/>
```

## Coordinate Systems

### 1920x1080 (Horizontal/Landscape)

Standard YouTube/Twitter format. Origin at top-left.

| Region | X Range | Y Range | Description |
|--------|---------|---------|-------------|
| Top-Left | 0-640 | 0-360 | Logo/watermark |
| Top-Center | 640-1280 | 0-360 | Titles |
| Top-Right | 1280-1920 | 0-360 | Controls/badges |
| Center | 640-1280 | 360-720 | Main content |
| Bottom | 0-1920 | 720-1080 | CTAs/captions |

### 1080x1920 (Vertical/Portrait)

TikTok/Reels/Shorts format. Origin at top-left.

| Region | X Range | Y Range | Description |
|--------|---------|---------|-------------|
| Safe-Top | 0-1080 | 200-400 | Below platform UI |
| Center | 0-1080 | 640-1280 | Main content |
| Safe-Bottom | 0-1080 | 1520-1720 | Above controls |

### 1080x1080 (Square)

Instagram/LinkedIn format.

| Region | X Range | Y Range | Description |
|--------|---------|---------|-------------|
| Center | 270-810 | 270-810 | Safe content zone |
| Margins | 0-270 | 0-1080 | Decorative only |

## Debug Grid Component

Enable during development to visualize coordinates.

```tsx
import { DebugGrid } from './components/DebugGrid';

// In your composition
<AbsoluteFill>
  <YourSceneContent />

  {/* Toggle with prop or env var */}
  <DebugGrid
    enabled={showDebug}
    gridSize={100}        // Grid cell size in pixels
    showCoordinates       // Show X,Y at cursor position
    showRulers            // Show pixel rulers on edges
    highlightCenter       // Crosshair at center
    opacity={0.5}
  />
</AbsoluteFill>
```

**See: `references/debug-grid-component.md`** for full component implementation.

## Callout Types

### 1. Pointer Callout

Arrow pointing to a specific location with label.

```tsx
<PointerCallout
  targetX={400}
  targetY={300}
  labelX={600}
  labelY={200}
  label="Important feature"
  arrowColor="#8b5cf6"
  animate              // Fade in with arrow draw
/>
```

### 2. Bracket Callout

Brackets around a region to highlight an area.

```tsx
<BracketCallout
  x={300}
  y={200}
  width={400}
  height={150}
  label="This section"
  position="right"      // Label position: top, right, bottom, left
  bracketColor="#22c55e"
/>
```

### 3. Highlight Callout

Colored overlay to emphasize a region.

```tsx
<HighlightCallout
  x={500}
  y={400}
  width={200}
  height={100}
  color="rgba(139, 92, 246, 0.3)"
  pulse                // Pulsing animation
/>
```

### 4. Number Badge

Numbered circle for step-by-step annotations.

```tsx
<NumberBadge
  number={1}
  x={300}
  y={250}
  size={40}
  color="#f59e0b"
/>
```

## Calibration Workflow

### Step 1: Enable Debug Grid

```tsx
// In your composition root
const showDebug = true; // Toggle manually or via env

<DebugGrid enabled={showDebug} showCoordinates showRulers />
```

### Step 2: Take Screenshot

```bash
# Render single frame with debug grid
npx remotion still MyComposition --frame=30 --output=debug-frame.png
```

### Step 3: Measure Coordinates

Open screenshot in image editor. Note pixel coordinates of target elements.

### Step 4: Apply Coordinates

```tsx
// Use measured coordinates
<PointerCallout
  targetX={847}    // Measured from screenshot
  targetY={312}    // Measured from screenshot
  labelX={1000}
  labelY={200}
  label="Feature name"
/>
```

### Step 5: Verify and Iterate

Re-render and compare. Adjust as needed.

**See: `references/calibration-workflow.md`** for detailed step-by-step guide.

## Responsive Positioning

### Scale-Based Positioning

```tsx
function ResponsiveCallout({ baseWidth = 1920, baseHeight = 1080, x, y, ...props }) {
  const { width, height } = useVideoConfig();

  // Scale coordinates proportionally
  const scaledX = (x / baseWidth) * width;
  const scaledY = (y / baseHeight) * height;

  return <Callout x={scaledX} y={scaledY} {...props} />;
}
```

### Anchor-Based Positioning

```tsx
// Position relative to anchors
type Anchor = 'top-left' | 'top-center' | 'top-right'
            | 'center-left' | 'center' | 'center-right'
            | 'bottom-left' | 'bottom-center' | 'bottom-right';

function AnchoredCallout({ anchor, offsetX = 0, offsetY = 0, ...props }) {
  const { width, height } = useVideoConfig();

  const anchors = {
    'top-left': { x: 0, y: 0 },
    'center': { x: width / 2, y: height / 2 },
    'bottom-right': { x: width, y: height },
    // ... other anchors
  };

  const base = anchors[anchor];
  return <Callout x={base.x + offsetX} y={base.y + offsetY} {...props} />;
}
```

### Format-Specific Presets

```tsx
// Presets for common positions per format
const CALLOUT_PRESETS = {
  '1920x1080': {
    title: { x: 960, y: 100 },
    centerContent: { x: 960, y: 540 },
    bottomCTA: { x: 960, y: 950 },
    topRightBadge: { x: 1800, y: 100 },
  },
  '1080x1920': {
    title: { x: 540, y: 300 },
    centerContent: { x: 540, y: 960 },
    bottomCTA: { x: 540, y: 1700 },
  },
  '1080x1080': {
    title: { x: 540, y: 150 },
    centerContent: { x: 540, y: 540 },
    bottomCTA: { x: 540, y: 930 },
  },
};

function useCalloutPreset(position: string) {
  const { width, height } = useVideoConfig();
  const format = `${width}x${height}`;
  return CALLOUT_PRESETS[format]?.[position] ?? { x: width/2, y: height/2 };
}
```

## Arrow Styling

### Arrow Variants

```tsx
// Solid arrow
<Arrow
  fromX={100} fromY={100}
  toX={300} toY={200}
  strokeColor="#8b5cf6"
  strokeWidth={3}
  headSize={12}
/>

// Curved arrow
<CurvedArrow
  fromX={100} fromY={100}
  toX={300} toY={200}
  curve={0.3}          // Curve amount (0 = straight, 1 = max curve)
  strokeColor="#22c55e"
/>

// Dashed arrow
<Arrow
  fromX={100} fromY={100}
  toX={300} toY={200}
  strokeDasharray="5,5"
  strokeColor="#f59e0b"
/>
```

### Animated Arrows

```tsx
<AnimatedArrow
  fromX={100} fromY={100}
  toX={300} toY={200}
  startFrame={30}
  drawDuration={15}     // Frames to draw arrow
  strokeColor="#8b5cf6"
/>
```

## Best Practices

### 1. Use Debug Grid During Development

Always enable debug grid when positioning callouts. Disable for final renders.

```tsx
const DEBUG = process.env.DEBUG_GRID === 'true';
<DebugGrid enabled={DEBUG} />
```

### 2. Document Coordinates

Comment coordinates with context.

```tsx
<Callout
  x={847}   // Terminal window top-left corner
  y={312}   // First line of output
  label="Result"
/>
```

### 3. Test All Formats

Verify callout positions in all target formats before finalizing.

```bash
# Render test frames for each format
npx remotion still MyComposition-Horizontal --frame=60 --output=test-h.png
npx remotion still MyComposition-Vertical --frame=60 --output=test-v.png
npx remotion still MyComposition-Square --frame=60 --output=test-s.png
```

### 4. Use Relative Positioning When Possible

Prefer anchor-based or percentage positioning over hardcoded pixels for reusability.

### 5. Layer Callouts Properly

Ensure callouts appear above content but below UI overlays.

```
Layer order (top to bottom):
1. UI Overlays (watermark, progress)
2. Callouts/Annotations
3. Main Content
4. Background
```

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Hardcoded coordinates | Breaks on format change | Use responsive positioning |
| No debug grid | Guessing coordinates | Enable DebugGrid during dev |
| Wrong layer order | Callouts hidden | Check z-index/layer stack |
| Missing safe zones | Content cut off on mobile | Use safe zone margins |
| No calibration | Misaligned annotations | Follow calibration workflow |

## References

- `references/debug-grid-component.md` - Full React/Remotion debug grid component
- `references/coordinate-systems.md` - Grid systems for different resolutions
- `references/calibration-workflow.md` - Step-by-step positioning workflow

## Related Skills

- `remotion-composer` - Core Remotion composition patterns
- `video-storyboarding` - Scene planning and structure
- `video-pacing` - Timing and rhythm for animations

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coordinate origin | Top-left (0,0) | Standard screen coordinate convention |
| Debug grid default | Disabled | Performance in production |
| Position units | Pixels | Direct mapping to render resolution |
| Responsive method | Scale-based | Works across all formats consistently |

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-25

## Capability Details

### debug-grid
**Keywords:** debug, grid, overlay, coordinates, ruler, measurement
**Solves:**
- How do I see coordinates in my Remotion composition?
- Debug grid for video positioning
- Visualize pixel coordinates during development

### callout-placement
**Keywords:** callout, annotation, arrow, pointer, label, highlight
**Solves:**
- How do I add callouts to my video?
- Position arrows and labels in Remotion
- Annotate video content with pointers

### coordinate-calibration
**Keywords:** calibrate, measure, screenshot, position, align
**Solves:**
- How do I find exact coordinates for elements?
- Screenshot-based coordinate calibration
- Measure pixel positions in video frames

### responsive-positioning
**Keywords:** responsive, scale, anchor, format, resolution
**Solves:**
- How do I make callouts work across formats?
- Responsive positioning for 1080p and 4K
- Anchor-based positioning in Remotion
