# Captions and Subtitles

## @remotion/captions Integration

```tsx
import {
  Caption,
  createTikTokStyleCaptions,
  fitText,
} from "@remotion/captions";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
```

## Basic Caption Display

```tsx
interface CaptionData {
  text: string;
  startFrame: number;
  endFrame: number;
}

const SubtitleOverlay: React.FC<{ captions: CaptionData[] }> = ({ captions }) => {
  const frame = useCurrentFrame();

  const currentCaption = captions.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  if (!currentCaption) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 60 }}>
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: "12px 24px",
          borderRadius: 8,
          textAlign: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 32,
            fontFamily: "Inter, system-ui",
            fontWeight: 500,
          }}
        >
          {currentCaption.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

## TikTok-Style Animated Captions

```tsx
const TikTokCaption: React.FC<{
  words: string[];
  startFrame: number;
  wordsPerSecond?: number;
}> = ({ words, startFrame, wordsPerSecond = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerWord = fps / wordsPerSecond;
  const relativeFrame = frame - startFrame;
  const currentWordIndex = Math.floor(relativeFrame / framesPerWord);

  if (currentWordIndex < 0 || currentWordIndex >= words.length) {
    return null;
  }

  const wordProgress = (relativeFrame % framesPerWord) / framesPerWord;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {words.map((word, i) => {
          const isActive = i === currentWordIndex;
          const isPast = i < currentWordIndex;

          return (
            <span
              key={i}
              style={{
                fontSize: isActive ? 72 : 56,
                fontWeight: 700,
                fontFamily: "Inter, system-ui",
                color: isActive ? "#8b5cf6" : isPast ? "white" : "#6b7280",
                transform: isActive ? `scale(${1 + wordProgress * 0.1})` : "none",
                transition: "all 0.1s ease",
                textShadow: isActive
                  ? "0 0 30px rgba(139, 92, 246, 0.5)"
                  : "none",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Word-by-Word Highlight

```tsx
const HighlightCaption: React.FC<{
  text: string;
  startFrame: number;
  endFrame: number;
  highlightColor?: string;
}> = ({ text, startFrame, endFrame, highlightColor = "#8b5cf6" }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, words.length],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const currentHighlight = Math.floor(progress);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "8px 12px",
          maxWidth: "80%",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              fontSize: 42,
              fontWeight: 600,
              fontFamily: "Inter, system-ui",
              color: i <= currentHighlight ? "white" : "rgba(255,255,255,0.4)",
              backgroundColor:
                i === currentHighlight ? highlightColor : "transparent",
              padding: "4px 12px",
              borderRadius: 6,
              transition: "all 0.15s ease",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

## Karaoke-Style Captions

```tsx
const KaraokeCaption: React.FC<{
  text: string;
  startFrame: number;
  durationFrames: number;
}> = ({ text, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || relativeFrame > durationFrames) {
    return null;
  }

  const progress = relativeFrame / durationFrames;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        {/* Background text (gray) */}
        <span
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "Inter, system-ui",
          }}
        >
          {text}
        </span>

        {/* Foreground text (revealed) */}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            fontSize: 64,
            fontWeight: 700,
            color: "white",
            fontFamily: "Inter, system-ui",
            clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

## Caption with Typing Animation

```tsx
const TypingCaption: React.FC<{
  text: string;
  startFrame: number;
  charsPerSecond?: number;
}> = ({ text, startFrame, charsPerSecond = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - startFrame;
  const framesPerChar = fps / charsPerSecond;
  const visibleChars = Math.floor(relativeFrame / framesPerChar);

  if (relativeFrame < 0) return null;

  const displayText = text.slice(0, Math.min(visibleChars, text.length));
  const showCursor = visibleChars < text.length;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(10, 10, 20, 0.9)",
          padding: "16px 32px",
          borderRadius: 12,
          border: "1px solid rgba(139, 92, 246, 0.3)",
        }}
      >
        <span
          style={{
            fontSize: 28,
            color: "white",
            fontFamily: "Menlo, monospace",
          }}
        >
          {displayText}
          {showCursor && (
            <span
              style={{
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                color: "#8b5cf6",
              }}
            >
              |
            </span>
          )}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

## Multi-Line Captions with Animation

```tsx
const AnimatedMultiLineCaption: React.FC<{
  lines: string[];
  startFrame: number;
  staggerDelay?: number;
}> = ({ lines, startFrame, staggerDelay = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lines.map((line, i) => {
          const lineStart = startFrame + i * staggerDelay;
          const lineProgress = spring({
            frame: frame - lineStart,
            fps,
            config: { damping: 15, stiffness: 100 },
          });

          const opacity = interpolate(lineProgress, [0, 0.5], [0, 1]);
          const y = interpolate(lineProgress, [0, 1], [20, 0]);

          return (
            <span
              key={i}
              style={{
                fontSize: 36,
                fontWeight: 500,
                color: "white",
                fontFamily: "Inter, system-ui",
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {line}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Caption Style Presets

| Style | Use Case | Animation |
|-------|----------|-----------|
| Standard | Tutorial, docs | Fade in/out |
| TikTok | Social, shorts | Word bounce |
| Karaoke | Music, voiceover | Fill reveal |
| Typing | Code demos | Typewriter |
| Highlight | Emphasis | Word background |

## Caption from Transcript

```tsx
interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

const TranscriptCaption: React.FC<{
  transcript: TranscriptWord[];
}> = ({ transcript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentMs = (frame / fps) * 1000;

  const currentWords = transcript.filter(
    (w) => w.startMs <= currentMs && w.endMs >= currentMs
  );

  // Get surrounding words for context (5 words before/after)
  const currentIndex = transcript.findIndex(
    (w) => w.startMs <= currentMs && w.endMs >= currentMs
  );

  const windowStart = Math.max(0, currentIndex - 3);
  const windowEnd = Math.min(transcript.length, currentIndex + 4);
  const visibleWords = transcript.slice(windowStart, windowEnd);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: 60 }}>
      <div style={{ textAlign: "center" }}>
        {visibleWords.map((w, i) => {
          const isActive = currentWords.includes(w);
          return (
            <span
              key={i}
              style={{
                fontSize: 32,
                color: isActive ? "white" : "rgba(255,255,255,0.5)",
                fontWeight: isActive ? 700 : 400,
                marginRight: 8,
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

## Accessibility Notes

1. **Contrast**: Ensure 4.5:1 ratio for normal text, 3:1 for large text
2. **Timing**: Display captions for minimum 1.5 seconds
3. **Positioning**: Bottom-center default, avoid covering important content
4. **Font size**: Minimum 24px for readability at 1080p
5. **Background**: Always use semi-transparent background for legibility
