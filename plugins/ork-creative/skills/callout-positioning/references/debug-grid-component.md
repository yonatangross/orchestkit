# Debug Grid Component

Full React/Remotion implementation of a toggleable debug grid overlay for coordinate visualization during video composition development.

## Complete Implementation

```tsx
// components/DebugGrid.tsx
import React, { useState, useCallback } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';

interface DebugGridProps {
  enabled?: boolean;
  gridSize?: number;
  showCoordinates?: boolean;
  showRulers?: boolean;
  highlightCenter?: boolean;
  opacity?: number;
  gridColor?: string;
  rulerColor?: string;
  centerColor?: string;
  showSafeZones?: boolean;
  safeZoneMargin?: number;
}

export const DebugGrid: React.FC<DebugGridProps> = ({
  enabled = true,
  gridSize = 100,
  showCoordinates = true,
  showRulers = true,
  highlightCenter = true,
  opacity = 0.5,
  gridColor = 'rgba(255, 255, 255, 0.3)',
  rulerColor = 'rgba(255, 255, 255, 0.8)',
  centerColor = 'rgba(255, 0, 0, 0.7)',
  showSafeZones = true,
  safeZoneMargin = 100,
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Handle mouse movement for coordinate display
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    setMousePos({
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    });
  }, [width, height]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  if (!enabled) return null;

  // Calculate grid lines
  const verticalLines = Math.floor(width / gridSize);
  const horizontalLines = Math.floor(height / gridSize);

  return (
    <AbsoluteFill
      style={{ opacity, pointerEvents: 'auto' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Grid Lines */}
      <svg width={width} height={height} style={{ position: 'absolute' }}>
        {/* Vertical grid lines */}
        {Array.from({ length: verticalLines + 1 }, (_, i) => (
          <line
            key={`v-${i}`}
            x1={i * gridSize}
            y1={0}
            x2={i * gridSize}
            y2={height}
            stroke={gridColor}
            strokeWidth={i % 5 === 0 ? 2 : 1}
          />
        ))}

        {/* Horizontal grid lines */}
        {Array.from({ length: horizontalLines + 1 }, (_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={i * gridSize}
            x2={width}
            y2={i * gridSize}
            stroke={gridColor}
            strokeWidth={i % 5 === 0 ? 2 : 1}
          />
        ))}

        {/* Center crosshair */}
        {highlightCenter && (
          <>
            <line
              x1={width / 2}
              y1={0}
              x2={width / 2}
              y2={height}
              stroke={centerColor}
              strokeWidth={2}
              strokeDasharray="10,5"
            />
            <line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke={centerColor}
              strokeWidth={2}
              strokeDasharray="10,5"
            />
            <circle
              cx={width / 2}
              cy={height / 2}
              r={10}
              fill="none"
              stroke={centerColor}
              strokeWidth={2}
            />
          </>
        )}

        {/* Safe zone indicators */}
        {showSafeZones && (
          <rect
            x={safeZoneMargin}
            y={safeZoneMargin}
            width={width - safeZoneMargin * 2}
            height={height - safeZoneMargin * 2}
            fill="none"
            stroke="rgba(0, 255, 0, 0.5)"
            strokeWidth={2}
            strokeDasharray="15,10"
          />
        )}
      </svg>

      {/* Rulers */}
      {showRulers && (
        <>
          {/* Top ruler */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: 30,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            {Array.from({ length: verticalLines + 1 }, (_, i) => (
              <div
                key={`rt-${i}`}
                style={{
                  position: 'absolute',
                  left: i * gridSize,
                  bottom: 2,
                  color: rulerColor,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  transform: 'translateX(-50%)',
                }}
              >
                {i * gridSize}
              </div>
            ))}
          </div>

          {/* Left ruler */}
          <div
            style={{
              position: 'absolute',
              top: 30,
              left: 0,
              width: 40,
              height: height - 30,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          >
            {Array.from({ length: horizontalLines + 1 }, (_, i) => (
              <div
                key={`rl-${i}`}
                style={{
                  position: 'absolute',
                  top: i * gridSize - 30,
                  right: 5,
                  color: rulerColor,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  transform: 'translateY(-50%)',
                }}
              >
                {i * gridSize}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Coordinate display */}
      {showCoordinates && mousePos && (
        <div
          style={{
            position: 'absolute',
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          X: {mousePos.x}, Y: {mousePos.y}
        </div>
      )}

      {/* Frame counter */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        Frame: {frame} | {width}x{height}
      </div>
    </AbsoluteFill>
  );
};
```

## Simplified Version (No Mouse Tracking)

For Remotion rendering (where mouse events don't apply):

```tsx
// components/DebugGridStatic.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';

interface DebugGridStaticProps {
  enabled?: boolean;
  gridSize?: number;
  highlightCenter?: boolean;
  opacity?: number;
  showLabels?: boolean;
}

export const DebugGridStatic: React.FC<DebugGridStaticProps> = ({
  enabled = true,
  gridSize = 100,
  highlightCenter = true,
  opacity = 0.4,
  showLabels = true,
}) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  if (!enabled) return null;

  const cols = Math.floor(width / gridSize);
  const rows = Math.floor(height / gridSize);

  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={width} height={height}>
        {/* Grid */}
        {Array.from({ length: cols + 1 }, (_, i) => (
          <React.Fragment key={`col-${i}`}>
            <line
              x1={i * gridSize}
              y1={0}
              x2={i * gridSize}
              y2={height}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
            />
            {showLabels && i > 0 && (
              <text
                x={i * gridSize}
                y={15}
                fill="white"
                fontSize={10}
                textAnchor="middle"
              >
                {i * gridSize}
              </text>
            )}
          </React.Fragment>
        ))}

        {Array.from({ length: rows + 1 }, (_, i) => (
          <React.Fragment key={`row-${i}`}>
            <line
              x1={0}
              y1={i * gridSize}
              x2={width}
              y2={i * gridSize}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
            />
            {showLabels && i > 0 && (
              <text
                x={5}
                y={i * gridSize + 4}
                fill="white"
                fontSize={10}
              >
                {i * gridSize}
              </text>
            )}
          </React.Fragment>
        ))}

        {/* Center crosshair */}
        {highlightCenter && (
          <>
            <line
              x1={width / 2}
              y1={0}
              x2={width / 2}
              y2={height}
              stroke="red"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            <line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="red"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
          </>
        )}
      </svg>

      {/* Info badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        {width}x{height} | Frame {frame}
      </div>
    </AbsoluteFill>
  );
};
```

## Usage Examples

### Basic Usage

```tsx
import { Composition, AbsoluteFill } from 'remotion';
import { DebugGrid } from './components/DebugGrid';
import { MyScene } from './components/MyScene';

export const MyComposition: React.FC = () => {
  const showDebug = process.env.NODE_ENV === 'development';

  return (
    <AbsoluteFill>
      <MyScene />
      <DebugGrid enabled={showDebug} />
    </AbsoluteFill>
  );
};
```

### With Custom Settings

```tsx
<DebugGrid
  enabled={true}
  gridSize={50}           // 50px grid for fine positioning
  showCoordinates={true}
  showRulers={true}
  highlightCenter={true}
  opacity={0.6}
  gridColor="rgba(0, 255, 255, 0.3)"  // Cyan grid
  showSafeZones={true}
  safeZoneMargin={80}     // 80px safe margin
/>
```

### Toggle with Environment Variable

```tsx
// .env
DEBUG_GRID=true

// Component
const showDebug = process.env.DEBUG_GRID === 'true';
<DebugGrid enabled={showDebug} />
```

### Toggle with Remotion Props

```tsx
// Root.tsx
<Composition
  id="MyDemo"
  component={MyDemo}
  defaultProps={{
    showDebugGrid: false,
  }}
/>

// MyDemo.tsx
export const MyDemo: React.FC<{ showDebugGrid: boolean }> = ({ showDebugGrid }) => (
  <AbsoluteFill>
    <Content />
    <DebugGrid enabled={showDebugGrid} />
  </AbsoluteFill>
);
```

## Grid Size Recommendations

| Use Case | Grid Size | Notes |
|----------|-----------|-------|
| Rough layout | 200px | Quick overview |
| Standard positioning | 100px | Default, good balance |
| Fine positioning | 50px | Precise alignment |
| Pixel-perfect | 25px | Very detailed work |

## Performance Notes

1. **Disable for renders**: Always disable debug grid in production renders
2. **Use static version**: For pure render testing, use DebugGridStatic (no mouse events)
3. **Reduce grid density**: Larger gridSize = better performance
4. **Conditional import**: Consider dynamic import for dev-only loading

```tsx
// Conditional import example
const DebugGrid = process.env.NODE_ENV === 'development'
  ? require('./components/DebugGrid').DebugGrid
  : () => null;
```
