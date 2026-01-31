# Coordinate Systems

Comprehensive grid systems and coordinate reference for different video resolutions and aspect ratios used in Remotion compositions.

## Coordinate Fundamentals

### Origin and Direction

```
(0,0) ─────────────────────────────> X (positive right)
  │
  │
  │
  │
  │
  │
  v
  Y (positive down)
```

All Remotion compositions use top-left origin with:
- **X-axis**: Increases left to right
- **Y-axis**: Increases top to bottom
- **Units**: Pixels (integer values)

## 1920x1080 (16:9 Horizontal)

Standard HD format for YouTube, Twitter, and desktop viewing.

### Region Map

```
┌─────────────────────────────────────────────────────────────┐
│ (0,0)                                            (1920,0)   │
│  ┌──────────────┬──────────────────┬──────────────┐        │
│  │  TOP-LEFT    │    TOP-CENTER    │  TOP-RIGHT   │  0-270 │
│  │   0-640      │    640-1280      │  1280-1920   │        │
│  ├──────────────┼──────────────────┼──────────────┤ 270    │
│  │              │                  │              │        │
│  │  LEFT        │     CENTER       │    RIGHT     │ 270-   │
│  │   0-640      │    640-1280      │  1280-1920   │  810   │
│  │              │                  │              │        │
│  ├──────────────┼──────────────────┼──────────────┤ 810    │
│  │ BOTTOM-LEFT  │  BOTTOM-CENTER   │ BOTTOM-RIGHT │ 810-   │
│  │   0-640      │    640-1280      │  1280-1920   │ 1080   │
│  └──────────────┴──────────────────┴──────────────┘        │
│ (0,1080)                                        (1920,1080)│
└─────────────────────────────────────────────────────────────┘
```

### Key Coordinates

| Position | X | Y | Use Case |
|----------|---|---|----------|
| Center | 960 | 540 | Main focal point |
| Top-left corner | 0 | 0 | Logo placement |
| Top-right corner | 1920 | 0 | Badges, controls |
| Bottom-center | 960 | 1080 | CTAs, captions |
| Title area | 960 | 150 | Main titles |
| Content area | 960 | 540 | Primary content |
| CTA area | 960 | 950 | Call to action |

### Safe Zones

```tsx
const SAFE_ZONES_1920x1080 = {
  // Action safe (95% of frame)
  actionSafe: {
    x: 48,      // 2.5% margin
    y: 27,
    width: 1824,
    height: 1026,
  },
  // Title safe (90% of frame)
  titleSafe: {
    x: 96,      // 5% margin
    y: 54,
    width: 1728,
    height: 972,
  },
  // Platform UI safe (YouTube player controls)
  platformSafe: {
    x: 100,
    y: 80,
    width: 1720,
    height: 920,
  },
};
```

### Common Positions

```tsx
const POSITIONS_1920x1080 = {
  // Header area
  logo: { x: 100, y: 50 },
  title: { x: 960, y: 120 },
  topRightBadge: { x: 1820, y: 50 },

  // Content area
  leftContent: { x: 480, y: 540 },
  centerContent: { x: 960, y: 540 },
  rightContent: { x: 1440, y: 540 },

  // Footer area
  bottomLeftLabel: { x: 100, y: 1000 },
  cta: { x: 960, y: 950 },
  bottomRightTimestamp: { x: 1820, y: 1050 },

  // Terminal/content window
  terminalTopLeft: { x: 160, y: 180 },
  terminalCenter: { x: 960, y: 540 },
  terminalBottomRight: { x: 1760, y: 900 },
};
```

## 1080x1920 (9:16 Vertical)

TikTok, Instagram Reels, YouTube Shorts format.

### Region Map

```
┌────────────────────────────┐
│ (0,0)           (1080,0)   │
│  ┌──────────────────────┐  │
│  │     PLATFORM UI      │  │ 0-200
│  │    (avoid content)   │  │
│  ├──────────────────────┤  │ 200
│  │      SAFE TOP        │  │
│  │    Titles/Hooks      │  │ 200-500
│  ├──────────────────────┤  │ 500
│  │                      │  │
│  │                      │  │
│  │      CENTER          │  │
│  │   Main Content       │  │ 500-1400
│  │                      │  │
│  │                      │  │
│  ├──────────────────────┤  │ 1400
│  │     SAFE BOTTOM      │  │
│  │    CTAs/Captions     │  │ 1400-1720
│  ├──────────────────────┤  │ 1720
│  │     PLATFORM UI      │  │
│  │    (avoid content)   │  │ 1720-1920
│  └──────────────────────┘  │
│ (0,1920)        (1080,1920)│
└────────────────────────────┘
```

### Key Coordinates

| Position | X | Y | Use Case |
|----------|---|---|----------|
| Center | 540 | 960 | Main focal point |
| Safe top | 540 | 300 | Hooks, titles |
| Safe center | 540 | 960 | Primary content |
| Safe bottom | 540 | 1600 | CTAs |
| Left edge safe | 100 | - | Left-aligned text |
| Right edge safe | 980 | - | Right-aligned text |

### Safe Zones

```tsx
const SAFE_ZONES_1080x1920 = {
  // Platform UI avoidance
  topUIMargin: 200,      // TikTok/Reels top bar
  bottomUIMargin: 200,   // Comments, controls
  sideMargin: 80,        // Edge padding

  // Content safe area
  contentSafe: {
    x: 80,
    y: 200,
    width: 920,
    height: 1520,
  },

  // Caption safe (above controls)
  captionSafe: {
    x: 80,
    y: 1400,
    width: 920,
    height: 320,
  },
};
```

### Common Positions

```tsx
const POSITIONS_1080x1920 = {
  // Top area (below platform UI)
  hookText: { x: 540, y: 300 },
  topBadge: { x: 540, y: 250 },

  // Center content
  mainContent: { x: 540, y: 960 },
  leftAligned: { x: 100, y: 960 },
  rightAligned: { x: 980, y: 960 },

  // Bottom area (above platform UI)
  cta: { x: 540, y: 1600 },
  caption: { x: 540, y: 1550 },
  bottomBadge: { x: 540, y: 1650 },

  // Floating elements
  likeButton: { x: 1000, y: 1100 },
  shareButton: { x: 1000, y: 1200 },
};
```

## 1080x1080 (1:1 Square)

Instagram feed, LinkedIn, Facebook format.

### Region Map

```
┌─────────────────────────────────────────┐
│ (0,0)                        (1080,0)   │
│  ┌─────────┬─────────┬─────────┐       │
│  │ TOP-L   │  TOP-C  │  TOP-R  │ 0-360 │
│  ├─────────┼─────────┼─────────┤  360  │
│  │         │         │         │       │
│  │  MID-L  │ CENTER  │  MID-R  │ 360-  │
│  │         │         │         │  720  │
│  ├─────────┼─────────┼─────────┤  720  │
│  │ BOT-L   │  BOT-C  │  BOT-R  │ 720-  │
│  │         │         │         │ 1080  │
│  └─────────┴─────────┴─────────┘       │
│ (0,1080)                    (1080,1080)│
└─────────────────────────────────────────┘
```

### Key Coordinates

| Position | X | Y | Use Case |
|----------|---|---|----------|
| Center | 540 | 540 | Focal point |
| Top-center | 540 | 150 | Titles |
| Bottom-center | 540 | 930 | CTAs |
| Content safe center | 540 | 540 | Main content |

### Safe Zones

```tsx
const SAFE_ZONES_1080x1080 = {
  // Visual safe margin (10%)
  margin: 108,

  // Content safe area
  contentSafe: {
    x: 108,
    y: 108,
    width: 864,
    height: 864,
  },

  // Central focus area (rule of thirds)
  focusArea: {
    x: 270,
    y: 270,
    width: 540,
    height: 540,
  },
};
```

### Common Positions

```tsx
const POSITIONS_1080x1080 = {
  // Center
  center: { x: 540, y: 540 },

  // Thirds
  topThird: { x: 540, y: 360 },
  bottomThird: { x: 540, y: 720 },
  leftThird: { x: 360, y: 540 },
  rightThird: { x: 720, y: 540 },

  // Corners (safe)
  topLeft: { x: 150, y: 150 },
  topRight: { x: 930, y: 150 },
  bottomLeft: { x: 150, y: 930 },
  bottomRight: { x: 930, y: 930 },
};
```

## 3840x2160 (4K UHD)

High-resolution format. Use 2x multiplier from 1920x1080.

```tsx
const scale4K = (pos: { x: number; y: number }) => ({
  x: pos.x * 2,
  y: pos.y * 2,
});

// Example: 1080p center (960, 540) -> 4K (1920, 1080)
const center4K = scale4K({ x: 960, y: 540 }); // { x: 1920, y: 1080 }
```

## Utility Functions

### Format Detection

```tsx
function getFormat(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 16/9) < 0.01) return 'horizontal';
  if (Math.abs(ratio - 9/16) < 0.01) return 'vertical';
  if (Math.abs(ratio - 1) < 0.01) return 'square';
  return 'custom';
}
```

### Coordinate Scaling

```tsx
function scaleCoordinates(
  pos: { x: number; y: number },
  fromSize: { width: number; height: number },
  toSize: { width: number; height: number }
) {
  return {
    x: (pos.x / fromSize.width) * toSize.width,
    y: (pos.y / fromSize.height) * toSize.height,
  };
}

// Scale 1080p coords to 4K
const pos4K = scaleCoordinates(
  { x: 960, y: 540 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 }
);
```

### Safe Zone Checker

```tsx
function isInSafeZone(
  x: number,
  y: number,
  safeZone: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    x >= safeZone.x &&
    x <= safeZone.x + safeZone.width &&
    y >= safeZone.y &&
    y <= safeZone.y + safeZone.height
  );
}
```

### Center Point Calculator

```tsx
function getCenter(width: number, height: number) {
  return {
    x: Math.floor(width / 2),
    y: Math.floor(height / 2),
  };
}
```

## Quick Reference Card

### 1920x1080

| Anchor | Coordinates |
|--------|-------------|
| TL | 0, 0 |
| TC | 960, 0 |
| TR | 1920, 0 |
| CL | 0, 540 |
| CC | 960, 540 |
| CR | 1920, 540 |
| BL | 0, 1080 |
| BC | 960, 1080 |
| BR | 1920, 1080 |

### 1080x1920

| Anchor | Coordinates |
|--------|-------------|
| TL | 0, 0 |
| TC | 540, 0 |
| TR | 1080, 0 |
| CL | 0, 960 |
| CC | 540, 960 |
| CR | 1080, 960 |
| BL | 0, 1920 |
| BC | 540, 1920 |
| BR | 1080, 1920 |

### 1080x1080

| Anchor | Coordinates |
|--------|-------------|
| TL | 0, 0 |
| TC | 540, 0 |
| TR | 1080, 0 |
| CL | 0, 540 |
| CC | 540, 540 |
| CR | 1080, 540 |
| BL | 0, 1080 |
| BC | 540, 1080 |
| BR | 1080, 1080 |
