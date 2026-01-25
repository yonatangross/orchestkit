import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

/**
 * Captions - Animated subtitle and caption components
 *
 * Supports multiple styles: standard, TikTok, karaoke, typing, highlight
 */

// ============================================================================
// TYPES
// ============================================================================

interface CaptionData {
  text: string;
  startFrame: number;
  endFrame: number;
}

type CaptionStyle = "standard" | "tiktok" | "karaoke" | "typing" | "highlight";

// ============================================================================
// STANDARD CAPTION (Simple fade in/out)
// ============================================================================

interface StandardCaptionProps {
  captions: CaptionData[];
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export const StandardCaption: React.FC<StandardCaptionProps> = ({
  captions,
  fontSize = 32,
  color = "white",
  backgroundColor = "rgba(0, 0, 0, 0.8)",
}) => {
  const frame = useCurrentFrame();

  const currentCaption = captions.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  if (!currentCaption) return null;

  const fadeIn = interpolate(
    frame,
    [currentCaption.startFrame, currentCaption.startFrame + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fadeOut = interpolate(
    frame,
    [currentCaption.endFrame - 10, currentCaption.endFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 60 }}>
      <div
        style={{
          backgroundColor,
          padding: "12px 24px",
          borderRadius: 8,
          textAlign: "center",
          opacity,
          alignSelf: "center",
        }}
      >
        <span
          style={{
            color,
            fontSize,
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

// ============================================================================
// TIKTOK CAPTION (Word-by-word with bounce)
// ============================================================================

interface TikTokCaptionProps {
  words: string[];
  startFrame: number;
  wordsPerSecond?: number;
  activeColor?: string;
  inactiveColor?: string;
}

export const TikTokCaption: React.FC<TikTokCaptionProps> = ({
  words,
  startFrame,
  wordsPerSecond = 3,
  activeColor = "#8b5cf6",
  inactiveColor = "white",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerWord = fps / wordsPerSecond;
  const relativeFrame = frame - startFrame;
  const currentWordIndex = Math.floor(relativeFrame / framesPerWord);

  if (currentWordIndex < 0 || currentWordIndex >= words.length) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
          maxWidth: "80%",
        }}
      >
        {words.map((word, i) => {
          const isActive = i === currentWordIndex;
          const isPast = i < currentWordIndex;

          const wordFrame = relativeFrame - i * framesPerWord;
          const bounce = isActive
            ? spring({
                frame: wordFrame,
                fps,
                config: { damping: 8, stiffness: 200 },
              })
            : 1;

          return (
            <span
              key={i}
              style={{
                fontSize: isActive ? 72 : 56,
                fontWeight: 700,
                fontFamily: "Inter, system-ui",
                color: isActive ? activeColor : isPast ? inactiveColor : "#6b7280",
                transform: `scale(${bounce})`,
                textShadow: isActive
                  ? `0 0 30px ${activeColor}50`
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

// ============================================================================
// KARAOKE CAPTION (Fill reveal animation)
// ============================================================================

interface KaraokeCaptionProps {
  text: string;
  startFrame: number;
  durationFrames: number;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
}

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  text,
  startFrame,
  durationFrames,
  fontSize = 64,
  activeColor = "white",
  inactiveColor = "rgba(255,255,255,0.3)",
}) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || relativeFrame > durationFrames) {
    return null;
  }

  const progress = (relativeFrame / durationFrames) * 100;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        {/* Background text (inactive) */}
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: inactiveColor,
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
            fontSize,
            fontWeight: 700,
            color: activeColor,
            fontFamily: "Inter, system-ui",
            clipPath: `inset(0 ${100 - progress}% 0 0)`,
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// TYPING CAPTION (Typewriter effect)
// ============================================================================

interface TypingCaptionProps {
  text: string;
  startFrame: number;
  charsPerSecond?: number;
  fontSize?: number;
  color?: string;
  cursorColor?: string;
  showCursor?: boolean;
}

export const TypingCaption: React.FC<TypingCaptionProps> = ({
  text,
  startFrame,
  charsPerSecond = 30,
  fontSize = 28,
  color = "white",
  cursorColor = "#8b5cf6",
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - startFrame;
  const framesPerChar = fps / charsPerSecond;
  const visibleChars = Math.floor(relativeFrame / framesPerChar);

  if (relativeFrame < 0) return null;

  const displayText = text.slice(0, Math.min(visibleChars, text.length));
  const isTyping = visibleChars < text.length;

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
            fontSize,
            color,
            fontFamily: "Menlo, monospace",
          }}
        >
          {displayText}
          {showCursor && isTyping && (
            <span
              style={{
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                color: cursorColor,
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

// ============================================================================
// HIGHLIGHT CAPTION (Word background highlight)
// ============================================================================

interface HighlightCaptionProps {
  text: string;
  startFrame: number;
  endFrame: number;
  highlightColor?: string;
  fontSize?: number;
}

export const HighlightCaption: React.FC<HighlightCaptionProps> = ({
  text,
  startFrame,
  endFrame,
  highlightColor = "#8b5cf6",
  fontSize = 42,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, words.length],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const currentHighlight = Math.floor(progress);

  if (frame < startFrame || frame > endFrame) {
    return null;
  }

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
              fontSize,
              fontWeight: 600,
              fontFamily: "Inter, system-ui",
              color: i <= currentHighlight ? "white" : "rgba(255,255,255,0.4)",
              backgroundColor:
                i === currentHighlight ? highlightColor : "transparent",
              padding: "4px 12px",
              borderRadius: 6,
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MULTI-LINE CAPTION (Staggered animation)
// ============================================================================

interface MultiLineCaptionProps {
  lines: string[];
  startFrame: number;
  staggerDelay?: number;
  fontSize?: number;
  color?: string;
}

export const MultiLineCaption: React.FC<MultiLineCaptionProps> = ({
  lines,
  startFrame,
  staggerDelay = 10,
  fontSize = 36,
  color = "white",
}) => {
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

          const opacity = interpolate(lineProgress, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          });
          const y = interpolate(lineProgress, [0, 1], [20, 0]);

          return (
            <span
              key={i}
              style={{
                fontSize,
                fontWeight: 500,
                color,
                fontFamily: "Inter, system-ui",
                opacity,
                transform: `translateY(${y}px)`,
                textAlign: "center",
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

// ============================================================================
// SUBTITLE OVERLAY (Combined positioning)
// ============================================================================

interface SubtitleOverlayProps {
  captions: CaptionData[];
  style?: CaptionStyle;
  primaryColor?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  captions,
  style = "standard",
  primaryColor = "#8b5cf6",
}) => {
  const frame = useCurrentFrame();

  const currentCaption = captions.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  if (!currentCaption) return null;

  switch (style) {
    case "tiktok":
      return (
        <TikTokCaption
          words={currentCaption.text.split(" ")}
          startFrame={currentCaption.startFrame}
          activeColor={primaryColor}
        />
      );

    case "karaoke":
      return (
        <KaraokeCaption
          text={currentCaption.text}
          startFrame={currentCaption.startFrame}
          durationFrames={currentCaption.endFrame - currentCaption.startFrame}
        />
      );

    case "typing":
      return (
        <TypingCaption
          text={currentCaption.text}
          startFrame={currentCaption.startFrame}
          cursorColor={primaryColor}
        />
      );

    case "highlight":
      return (
        <HighlightCaption
          text={currentCaption.text}
          startFrame={currentCaption.startFrame}
          endFrame={currentCaption.endFrame}
          highlightColor={primaryColor}
        />
      );

    case "standard":
    default:
      return <StandardCaption captions={captions} />;
  }
};
