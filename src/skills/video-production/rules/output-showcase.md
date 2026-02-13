---
title: Showcase & Multi-Format Rendering
impact: MEDIUM
impactDescription: "A single render format misses most platforms — showcase templates with multi-format output maximize reach across YouTube, TikTok, Twitter, and LinkedIn simultaneously"
tags: showcase, rendering, multi-format, remotion, layer-stack, output
---

## Showcase & Multi-Format Rendering

Compose final showcase videos with layered stacks and render to multiple platform formats from a single Remotion composition.

### Layer Stack Composition

```
+-------------------------------------------+
|  Layer 5: Watermark / Logo                |  z-index: 50
+-------------------------------------------+
|  Layer 4: Captions / Subtitles            |  z-index: 40
+-------------------------------------------+
|  Layer 3: Callouts / Annotations          |  z-index: 30
+-------------------------------------------+
|  Layer 2: Terminal Recording / Content    |  z-index: 20
+-------------------------------------------+
|  Layer 1: Background Effects              |  z-index: 10
+-------------------------------------------+
```

### Showcase Composition

```tsx
import {
  AbsoluteFill, Sequence, Audio, OffthreadVideo,
  staticFile, useVideoConfig,
} from "remotion";

const ShowcaseVideo: React.FC<{
  terminalSrc: string;
  narrationSrc: string;
  captions: CaptionEntry[];
}> = ({ terminalSrc, narrationSrc, captions }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      {/* Layer 1: Background */}
      <ParticleBackground count={40} color="#8b5cf6" />

      {/* Layer 2: Terminal recording */}
      <AbsoluteFill style={{ padding: "60px 100px" }}>
        <div style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 80px rgba(139, 92, 246, 0.3)",
        }}>
          <OffthreadVideo src={staticFile(terminalSrc)} />
        </div>
      </AbsoluteFill>

      {/* Layer 3: Callouts (timed) */}
      <Sequence from={90} durationInFrames={120}>
        <Callout x={400} y={200} text="Skills auto-injected" />
      </Sequence>

      {/* Layer 4: Captions */}
      {captions.map((cap, i) => (
        <Sequence key={i} from={cap.startFrame} durationInFrames={cap.duration}>
          <TikTokCaption text={cap.text} startFrame={0}
            durationInFrames={cap.duration} />
        </Sequence>
      ))}

      {/* Layer 5: Watermark */}
      <Watermark position="top-right" opacity={0.6} />

      {/* Audio */}
      <Audio src={staticFile(narrationSrc)} volume={1} />
      <Audio src={staticFile("audio/bg-music.mp3")} volume={0.15} />
    </AbsoluteFill>
  );
};
```

### Multi-Format Rendering

```bash
# Horizontal — YouTube, Twitter, LinkedIn
npx remotion render ShowcaseVideo \
  --width=1920 --height=1080 \
  --codec=h264 --crf=18 \
  output-horizontal.mp4

# Vertical — TikTok, Reels, Shorts
npx remotion render ShowcaseVideo \
  --width=1080 --height=1920 \
  --codec=h264 --crf=18 \
  output-vertical.mp4

# Square — Instagram, LinkedIn carousel
npx remotion render ShowcaseVideo \
  --width=1080 --height=1080 \
  --codec=h264 --crf=18 \
  output-square.mp4

# Thumbnail still (frame 0)
npx remotion still ShowcaseVideo \
  --frame=0 --output=thumbnail.png \
  --width=1920 --height=1080
```

### Format-Aware Layout

```tsx
const ResponsiveLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;
  const isSquare = Math.abs(width - height) < 100;

  const padding = isVertical
    ? { top: 200, bottom: 400, left: 40, right: 40 }
    : isSquare
    ? { top: 80, bottom: 200, left: 60, right: 60 }
    : { top: 60, bottom: 120, left: 100, right: 100 };

  return (
    <AbsoluteFill style={{
      paddingTop: padding.top,
      paddingBottom: padding.bottom,
      paddingLeft: padding.left,
      paddingRight: padding.right,
    }}>
      {children}
    </AbsoluteFill>
  );
};
```

### Platform Output Matrix

| Platform | Resolution | Codec | CRF | FPS | Max Duration |
|----------|------------|-------|-----|-----|-------------|
| YouTube | 1920x1080 | H.264 | 18 | 30 | No limit |
| TikTok | 1080x1920 | H.264 | 18 | 30 | 10 min |
| Instagram Reels | 1080x1920 | H.264 | 18 | 30 | 90 sec |
| Twitter/X | 1280x720 | H.264 | 20 | 30 | 2:20 |
| LinkedIn | 1920x1080 | H.264 | 18 | 30 | 10 min |
| YouTube Shorts | 1080x1920 | H.264 | 18 | 30 | 60 sec |
| Product Hunt | 1920x1080 | H.264 | 18 | 30 | 3 min |

### Render Script

```bash
#!/bin/bash
# render-all-formats.sh — Render showcase in all formats
COMP="ShowcaseVideo"
OUT_DIR="./output"
mkdir -p "$OUT_DIR"

echo "Rendering horizontal (YouTube)..."
npx remotion render "$COMP" "$OUT_DIR/horizontal.mp4" \
  --width=1920 --height=1080 --codec=h264 --crf=18

echo "Rendering vertical (TikTok)..."
npx remotion render "$COMP" "$OUT_DIR/vertical.mp4" \
  --width=1080 --height=1920 --codec=h264 --crf=18

echo "Rendering square (Instagram)..."
npx remotion render "$COMP" "$OUT_DIR/square.mp4" \
  --width=1080 --height=1080 --codec=h264 --crf=18

echo "Rendering thumbnail..."
npx remotion still "$COMP" "$OUT_DIR/thumbnail.png" \
  --frame=0 --width=1920 --height=1080

echo "All formats rendered to $OUT_DIR/"
```

**Key rules:** Always render horizontal + vertical + still at minimum. Use CRF 18 for quality. Layer order: background, content, callouts, captions, watermark. Frame 0 must be a valid thumbnail.

**References:** `references/showcase-templates.md`, `references/multi-format-rendering.md`
