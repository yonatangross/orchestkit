import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export interface ClaudeResponseProps {
  content: string[];
  thinking?: boolean;
  primaryColor?: string;
  animateIn?: boolean;
  startFrame?: number;
  typewriterSpeed?: number; // chars per frame
}

export const ClaudeResponse: React.FC<ClaudeResponseProps> = ({
  content,
  thinking = false,
  primaryColor = "#8b5cf6",
  animateIn = true,
  startFrame = 0,
  typewriterSpeed = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Container animation
  const containerOpacity = animateIn
    ? interpolate(frame - startFrame, [0, 10], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 1;

  const containerScale = animateIn
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 80, stiffness: 200 },
      })
    : 1;

  // Calculate total characters for typewriter effect
  const totalChars = content.join("").length;
  const currentCharIndex = Math.min(
    Math.floor((frame - startFrame) * typewriterSpeed),
    totalChars
  );

  // Thinking animation (dots)
  const thinkingDots = ".".repeat(1 + (Math.floor(frame / 10) % 3));

  // Render content with typewriter effect
  const renderContent = () => {
    let charCount = 0;

    return content.map((line, lineIndex) => {
      const lineStartIndex = charCount;
      charCount += line.length;

      // How much of this line to show
      const visibleChars = Math.max(
        0,
        Math.min(line.length, currentCharIndex - lineStartIndex)
      );

      if (visibleChars === 0 && lineStartIndex > currentCharIndex) {
        return null;
      }

      const visibleText = line.slice(0, visibleChars);
      const isCurrentLine = currentCharIndex >= lineStartIndex && currentCharIndex < charCount;

      return (
        <div
          key={lineIndex}
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 12,
            lineHeight: 1.6,
            color: "#e2e8f0",
          }}
        >
          {visibleText}
          {/* Cursor on current line */}
          {isCurrentLine && (
            <span
              style={{
                backgroundColor: primaryColor,
                color: "#0a0a0f",
                animation: "blink 0.8s infinite",
              }}
            >
              █
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <div
      style={{
        backgroundColor: "rgba(26, 26, 46, 0.95)",
        borderRadius: 8,
        padding: 12,
        border: `1px solid ${primaryColor}40`,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: "1px solid #2d2d4a",
        }}
      >
        {/* Claude icon */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: primaryColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
          🤖
        </div>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#f8fafc",
          }}
        >
          Claude
        </span>
        {thinking && (
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              color: "#f59e0b",
            }}
          >
            thinking{thinkingDots}
          </span>
        )}
      </div>

      {/* Content */}
      <div>{renderContent()}</div>
    </div>
  );
};

// Compact version for split terminal view
export const CompactClaudeResponse: React.FC<{
  lines: string[];
  startFrame?: number;
  primaryColor?: string;
}> = ({ lines, startFrame = 0, primaryColor = "#8b5cf6" }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        padding: 8,
        backgroundColor: "rgba(26, 26, 46, 0.8)",
        borderLeft: `3px solid ${primaryColor}`,
        borderRadius: "0 4px 4px 0",
        marginBottom: 8,
      }}
    >
      {lines.map((line, index) => {
        const lineDelay = startFrame + index * 6;
        const opacity = interpolate(frame, [lineDelay, lineDelay + 8], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });

        // Check if line is a bullet point
        const isBullet = line.startsWith("•") || line.startsWith("-");

        return (
          <div
            key={index}
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              lineHeight: 1.5,
              color: isBullet ? "#94a3b8" : "#e2e8f0",
              paddingLeft: isBullet ? 8 : 0,
              opacity,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
