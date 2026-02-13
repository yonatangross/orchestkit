---
title: Caption Components
impact: MEDIUM
impactDescription: "80% of social media videos are watched without sound — captions are not optional; missing or poorly styled captions eliminate most of your potential audience"
tags: captions, subtitles, TikTok, karaoke, typing, accessibility
---

## Caption Components

Styled caption components for Remotion — TikTok-style bold captions, word-by-word karaoke highlighting, and typewriter effects.

### TikTokCaption (Bold White + Black Stroke)

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const TikTokCaption: React.FC<{
  text: string;
  startFrame: number;
  durationInFrames: number;
  highlight?: string;
}> = ({ text, startFrame, durationInFrames, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame >= durationInFrames) return null;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const words = text.split(" ");

  return (
    <div style={{
      position: "absolute",
      bottom: "15%",
      width: "100%",
      textAlign: "center",
      transform: `scale(${0.9 + 0.1 * scale})`,
    }}>
      <span style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 64,
        fontWeight: 900,
        color: "#fff",
        textTransform: "uppercase",
        WebkitTextStroke: "3px #000",
        paintOrder: "stroke fill",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      }}>
        {words.map((word, i) => (
          <span key={i} style={{
            color: word.toLowerCase() === highlight?.toLowerCase()
              ? "#facc15" : "#fff",
          }}>
            {word}{" "}
          </span>
        ))}
      </span>
    </div>
  );
};
```

### KaraokeCaption (Word-by-Word Highlight)

```tsx
const KaraokeCaption: React.FC<{
  words: { text: string; startFrame: number; endFrame: number }[];
  activeColor?: string;
}> = ({ words, activeColor = "#8b5cf6" }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{
      position: "absolute",
      bottom: "12%",
      width: "100%",
      textAlign: "center",
    }}>
      {words.map((word, i) => {
        const isActive = frame >= word.startFrame && frame < word.endFrame;
        const isPast = frame >= word.endFrame;
        return (
          <span key={i} style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 56,
            fontWeight: 800,
            color: isActive ? activeColor : isPast ? "#e4e4e7" : "#71717a",
            transition: "color 0.1s",
            marginRight: 12,
          }}>
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

### TypingCaption (Cursor Animation)

```tsx
const TypingCaption: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
}> = ({ text, startFrame, charsPerFrame = 0.8 }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const visibleChars = Math.min(
    Math.floor(localFrame * charsPerFrame),
    text.length
  );
  const showCursor = Math.floor(frame / 15) % 2 === 0; // Blink every 15 frames

  return (
    <div style={{
      position: "absolute",
      bottom: "10%",
      width: "100%",
      textAlign: "center",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 40,
      color: "#22c55e",
    }}>
      {text.slice(0, visibleChars)}
      <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
    </div>
  );
};
```

### Caption Styles by Platform

| Platform | Font Size | Position | Style |
|----------|-----------|----------|-------|
| TikTok/Reels | 56-72px | Bottom 15% | Bold, stroke, uppercase |
| YouTube | 42-56px | Bottom 10% | Clean, semi-bold, mixed case |
| LinkedIn | 36-48px | Bottom 10% | Professional, regular weight |
| Twitter/X | 48-64px | Center or bottom | High contrast, bold |

### SRT Subtitle Generation

```bash
# Generate SRT from narration timestamps
cat > subtitles.srt << 'SRT_EOF'
1
00:00:00,000 --> 00:00:03,500
What if Claude Code had the memory
of a senior developer?

2
00:00:03,800 --> 00:00:07,200
OrchestKit gives Claude 200 skills,
36 agents, and 93 hooks.
SRT_EOF

# Burn subtitles into video with ffmpeg
ffmpeg -i video.mp4 -vf "subtitles=subtitles.srt:force_style='\
  FontName=Inter,FontSize=24,PrimaryColour=&HFFFFFF,\
  OutlineColour=&H000000,Outline=2,Bold=1'" output.mp4
```

### Caption Timing Rules

- Max 2 lines on screen at once
- Max 42 characters per line
- Minimum display time: 1.5 seconds
- Maximum display time: 7 seconds
- 200ms gap between consecutive captions
- Sync caption entry to first syllable, not word start

**Key rules:** Always include captions — 80% of social video is watched muted. TikTok style: bold white, black stroke, bottom 15%. Max 2 lines, 42 chars per line.

**References:** `references/caption-components.md`, `references/subtitle-generation.md`
