# Calibration Workflow

Step-by-step guide for precisely positioning callouts, arrows, and annotations in Remotion video compositions using a screenshot-based calibration approach.

## Overview

The calibration workflow ensures pixel-perfect positioning of annotations by:
1. Rendering a frame with debug grid
2. Measuring coordinates from the screenshot
3. Applying coordinates to callout components
4. Verifying and iterating

## Prerequisites

- Remotion project set up
- DebugGrid component available (see `debug-grid-component.md`)
- Image editor with coordinate display (GIMP, Photoshop, Figma, Preview)

## Step 1: Enable Debug Grid

Add the debug grid to your composition during development.

```tsx
// YourComposition.tsx
import { AbsoluteFill } from 'remotion';
import { DebugGrid } from './components/DebugGrid';
import { YourContent } from './components/YourContent';

export const YourComposition: React.FC<{ showDebug?: boolean }> = ({
  showDebug = true,
}) => {
  return (
    <AbsoluteFill>
      {/* Your actual content */}
      <YourContent />

      {/* Debug overlay - ALWAYS render on top */}
      <DebugGrid
        enabled={showDebug}
        gridSize={100}
        showCoordinates
        showRulers
        highlightCenter
        showSafeZones
      />
    </AbsoluteFill>
  );
};
```

## Step 2: Render Debug Frame

Render a single frame at the point where you need to add callouts.

### Using Remotion CLI

```bash
# Render frame 30 (1 second at 30fps)
npx remotion still YourComposition --frame=30 --output=calibration/frame-30.png

# Render multiple frames for different scenes
npx remotion still YourComposition --frame=0 --output=calibration/frame-intro.png
npx remotion still YourComposition --frame=90 --output=calibration/frame-main.png
npx remotion still YourComposition --frame=180 --output=calibration/frame-cta.png
```

### Using Remotion Studio

1. Open Remotion Studio: `npx remotion studio`
2. Navigate to the target frame using the timeline
3. Click "Export Frame" or use keyboard shortcut
4. Save as PNG for pixel-accurate measurement

## Step 3: Measure Coordinates

Open the rendered frame in an image editor and identify coordinates.

### Using Preview (macOS)

1. Open the PNG in Preview
2. Go to Tools > Show Inspector (Cmd+I)
3. Hover over target positions to see coordinates

### Using GIMP

1. Open the PNG in GIMP
2. Look at the cursor position in the bottom-left corner
3. Coordinates update as you move the cursor

### Using Figma

1. Import PNG into Figma
2. Draw rectangles over target areas
3. Read X, Y from the properties panel

### Using Browser DevTools

1. Open PNG in browser (drag into Chrome)
2. Open DevTools (F12)
3. Use Element inspector to measure positions

## Step 4: Document Measurements

Create a measurement record for your composition.

```tsx
// calibration/measurements.ts

export const FRAME_30_MEASUREMENTS = {
  // Target: Terminal output area
  terminalOutput: {
    topLeft: { x: 180, y: 220 },
    bottomRight: { x: 1740, y: 860 },
    description: 'Terminal window content area',
  },

  // Target: First command output
  firstCommandOutput: {
    position: { x: 200, y: 312 },
    description: 'Start of "Skills: 168" output line',
  },

  // Target: Success badge
  successBadge: {
    center: { x: 1650, y: 180 },
    description: 'Green checkmark badge',
  },

  // Target: CTA button
  ctaButton: {
    center: { x: 960, y: 950 },
    width: 300,
    height: 60,
    description: 'Install button center',
  },
};
```

## Step 5: Apply Coordinates

Use measured coordinates in your callout components.

```tsx
// YourComposition.tsx
import { AbsoluteFill } from 'remotion';
import { PointerCallout } from './components/PointerCallout';
import { BracketCallout } from './components/BracketCallout';
import { FRAME_30_MEASUREMENTS } from './calibration/measurements';

export const YourComposition: React.FC = () => {
  const m = FRAME_30_MEASUREMENTS;

  return (
    <AbsoluteFill>
      <YourContent />

      {/* Pointer to first command output */}
      <PointerCallout
        targetX={m.firstCommandOutput.position.x}
        targetY={m.firstCommandOutput.position.y}
        labelX={m.firstCommandOutput.position.x + 300}
        labelY={m.firstCommandOutput.position.y - 80}
        label="Skills loaded"
        arrowColor="#8b5cf6"
        startFrame={30}
        animate
      />

      {/* Bracket around terminal */}
      <BracketCallout
        x={m.terminalOutput.topLeft.x}
        y={m.terminalOutput.topLeft.y}
        width={m.terminalOutput.bottomRight.x - m.terminalOutput.topLeft.x}
        height={m.terminalOutput.bottomRight.y - m.terminalOutput.topLeft.y}
        label="Terminal output"
        position="right"
        startFrame={45}
      />

      {/* Highlight CTA button */}
      <HighlightCallout
        x={m.ctaButton.center.x - m.ctaButton.width / 2}
        y={m.ctaButton.center.y - m.ctaButton.height / 2}
        width={m.ctaButton.width}
        height={m.ctaButton.height}
        color="rgba(139, 92, 246, 0.3)"
        startFrame={60}
        pulse
      />
    </AbsoluteFill>
  );
};
```

## Step 6: Verify Positioning

Re-render and compare with the original frame.

```bash
# Render verification frame (without debug grid)
npx remotion still YourComposition --frame=30 --output=calibration/verify-30.png --props='{"showDebug":false}'

# Compare side by side
# macOS: Use Preview "Show Both Pages" or any diff tool
# Or open both images in separate windows
```

### Visual Diff Check

1. Open original debug frame
2. Open verification render
3. Check that callouts align with intended targets
4. Note any adjustments needed

## Step 7: Iterate and Refine

If positioning is off, adjust and re-verify.

### Common Adjustments

```tsx
// Offset adjustment pattern
const OFFSET = { x: -5, y: 3 }; // Fine-tune

<PointerCallout
  targetX={measured.x + OFFSET.x}
  targetY={measured.y + OFFSET.y}
  // ...
/>
```

### Tips for Accurate Positioning

1. **Account for element origins**: Some components use center, others use top-left
2. **Check scaling**: If content scales, coords may shift
3. **Frame-specific**: Re-calibrate for different frames/scenes
4. **Batch similar callouts**: Position multiple callouts in one iteration

## Automation Script

Automate the calibration render process.

```bash
#!/bin/bash
# scripts/calibrate.sh

COMPOSITION=${1:-"MyDemo"}
FRAMES=${2:-"0,30,60,90"}
OUTPUT_DIR="calibration"

mkdir -p $OUTPUT_DIR

IFS=',' read -ra FRAME_ARRAY <<< "$FRAMES"
for frame in "${FRAME_ARRAY[@]}"; do
  echo "Rendering frame $frame..."
  npx remotion still "$COMPOSITION" \
    --frame="$frame" \
    --output="$OUTPUT_DIR/frame-$frame.png" \
    --props='{"showDebug":true}'
done

echo "Calibration frames saved to $OUTPUT_DIR/"
echo "Open frames in image editor to measure coordinates."
```

Usage:
```bash
./scripts/calibrate.sh MyDemo "0,30,60,90,120"
```

## Callout Component Templates

### Pointer Callout

```tsx
// components/PointerCallout.tsx
import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface PointerCalloutProps {
  targetX: number;
  targetY: number;
  labelX: number;
  labelY: number;
  label: string;
  arrowColor?: string;
  startFrame?: number;
  animate?: boolean;
}

export const PointerCallout: React.FC<PointerCalloutProps> = ({
  targetX,
  targetY,
  labelX,
  labelY,
  label,
  arrowColor = '#8b5cf6',
  startFrame = 0,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = animate
    ? spring({
        frame: frame - startFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      })
    : 1;

  if (frame < startFrame) return null;

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const arrowLength = interpolate(progress, [0, 1], [0, 1]);

  // Calculate arrow path
  const dx = targetX - labelX;
  const dy = targetY - labelY;
  const endX = labelX + dx * arrowLength;
  const endY = labelY + dy * arrowLength;

  return (
    <div style={{ position: 'absolute', opacity }}>
      {/* Arrow line */}
      <svg
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={arrowColor} />
          </marker>
        </defs>
        <line
          x1={labelX}
          y1={labelY}
          x2={endX}
          y2={endY}
          stroke={arrowColor}
          strokeWidth={3}
          markerEnd="url(#arrowhead)"
        />
      </svg>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: labelX,
          top: labelY - 40,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 18,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          border: `2px solid ${arrowColor}`,
        }}
      >
        {label}
      </div>
    </div>
  );
};
```

### Bracket Callout

```tsx
// components/BracketCallout.tsx
import React from 'react';
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';

interface BracketCalloutProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  bracketColor?: string;
  startFrame?: number;
}

export const BracketCallout: React.FC<BracketCalloutProps> = ({
  x,
  y,
  width,
  height,
  label,
  position = 'right',
  bracketColor = '#22c55e',
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  if (frame < startFrame) return null;

  const bracketSize = 20;
  const labelOffset = 30;

  // Calculate label position based on bracket position
  const labelPositions = {
    top: { lx: x + width / 2, ly: y - labelOffset, anchor: 'bottom' },
    right: { lx: x + width + labelOffset, ly: y + height / 2, anchor: 'left' },
    bottom: { lx: x + width / 2, ly: y + height + labelOffset, anchor: 'top' },
    left: { lx: x - labelOffset, ly: y + height / 2, anchor: 'right' },
  };

  const { lx, ly } = labelPositions[position];

  return (
    <div style={{ position: 'absolute', opacity: progress }}>
      <svg
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
      >
        {/* Bracket corners */}
        {/* Top-left */}
        <path
          d={`M ${x} ${y + bracketSize} L ${x} ${y} L ${x + bracketSize} ${y}`}
          stroke={bracketColor}
          strokeWidth={3}
          fill="none"
        />
        {/* Top-right */}
        <path
          d={`M ${x + width - bracketSize} ${y} L ${x + width} ${y} L ${x + width} ${y + bracketSize}`}
          stroke={bracketColor}
          strokeWidth={3}
          fill="none"
        />
        {/* Bottom-left */}
        <path
          d={`M ${x} ${y + height - bracketSize} L ${x} ${y + height} L ${x + bracketSize} ${y + height}`}
          stroke={bracketColor}
          strokeWidth={3}
          fill="none"
        />
        {/* Bottom-right */}
        <path
          d={`M ${x + width - bracketSize} ${y + height} L ${x + width} ${y + height} L ${x + width} ${y + height - bracketSize}`}
          stroke={bracketColor}
          strokeWidth={3}
          fill="none"
        />
      </svg>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: ly,
          transform: position === 'right' || position === 'left'
            ? 'translateY(-50%)'
            : 'translateX(-50%)',
          backgroundColor: bracketColor,
          color: 'white',
          padding: '6px 12px',
          borderRadius: 4,
          fontSize: 16,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
};
```

## Troubleshooting

### Coordinates Don't Match

**Symptom**: Callout appears in wrong position.

**Causes**:
1. Measured at wrong resolution
2. Content scales differently than expected
3. Transform origin mismatch

**Solution**:
```tsx
// Verify video config matches measurement resolution
const { width, height } = useVideoConfig();
console.log(`Composition: ${width}x${height}`);

// Ensure measuring the correct output resolution
// If composition is 1920x1080, measure from 1920x1080 PNG
```

### Callouts Not Visible

**Symptom**: Callouts don't appear in render.

**Causes**:
1. startFrame is too late
2. z-index/layer order issue
3. Opacity is 0

**Solution**:
```tsx
// Check frame timing
console.log(`Current frame: ${frame}, startFrame: ${startFrame}`);

// Ensure callouts layer is above content
<AbsoluteFill style={{ zIndex: 100 }}>
  <Callouts />
</AbsoluteFill>
```

### Animation Timing Off

**Symptom**: Callout animates at wrong time.

**Solution**:
```tsx
// Log frame for debugging
const frame = useCurrentFrame();
useEffect(() => {
  console.log(`Callout visible: ${frame >= startFrame}`);
}, [frame, startFrame]);
```
