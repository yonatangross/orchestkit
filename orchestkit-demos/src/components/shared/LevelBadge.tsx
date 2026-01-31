import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export type DifficultyLevel = "simple" | "medium" | "advanced";

export interface LevelBadgeProps {
  level: DifficultyLevel;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
  animateIn?: boolean;
  startFrame?: number;
  pulseOnActive?: boolean;
}

const LEVEL_CONFIG: Record<
  DifficultyLevel,
  { color: string; emoji: string; label: string; shortLabel: string }
> = {
  simple: {
    color: "#22c55e",
    emoji: "🟢",
    label: "SIMPLE",
    shortLabel: "LVL 1",
  },
  medium: {
    color: "#f59e0b",
    emoji: "🟡",
    label: "MEDIUM",
    shortLabel: "LVL 2",
  },
  advanced: {
    color: "#8b5cf6",
    emoji: "🟣",
    label: "ADVANCED",
    shortLabel: "LVL 3",
  },
};

const SIZE_CONFIG: Record<
  "small" | "medium" | "large",
  { width: number; fontSize: number; padding: number }
> = {
  small: { width: 60, fontSize: 10, padding: 6 },
  medium: { width: 80, fontSize: 12, padding: 10 },
  large: { width: 100, fontSize: 14, padding: 14 },
};

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  showLabel = true,
  size = "medium",
  animateIn = true,
  startFrame = 0,
  pulseOnActive = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const config = LEVEL_CONFIG[level];
  const sizeConfig = SIZE_CONFIG[size];

  // Entry animation
  const entryProgress = animateIn
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 60, stiffness: 200 },
      })
    : 1;

  // Pulse animation when active
  const pulse = pulseOnActive
    ? 1 + 0.05 * Math.sin(frame * 0.15)
    : 1;

  // Glow intensity
  const glowOpacity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.3, 0.6]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        opacity: entryProgress,
        transform: `scale(${entryProgress * pulse})`,
      }}
    >
      {/* Badge */}
      <div
        style={{
          width: sizeConfig.width,
          padding: sizeConfig.padding,
          backgroundColor: `${config.color}20`,
          border: `2px solid ${config.color}`,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          boxShadow: `0 0 20px ${config.color}${Math.round(glowOpacity * 255)
            .toString(16)
            .padStart(2, "0")}`,
        }}
      >
        {/* Emoji indicator */}
        <span style={{ fontSize: sizeConfig.fontSize + 4 }}>
          {config.emoji}
        </span>

        {/* Level label */}
        {showLabel && (
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: sizeConfig.fontSize,
              fontWeight: 700,
              color: config.color,
              letterSpacing: "0.05em",
            }}
          >
            {config.label}
          </span>
        )}
      </div>

      {/* Short label below */}
      <span
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: sizeConfig.fontSize - 2,
          color: config.color,
          opacity: 0.7,
        }}
      >
        {config.shortLabel}
      </span>
    </div>
  );
};

// Vertical badge strip for side of terminal
export const LevelBadgeStrip: React.FC<{
  level: DifficultyLevel;
  height?: number;
  animateIn?: boolean;
  startFrame?: number;
}> = ({ level, height = 300, animateIn = true, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const config = LEVEL_CONFIG[level];

  const fillHeight = animateIn
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 40, stiffness: 100 },
      }) * height
    : height;

  return (
    <div
      style={{
        width: 40,
        height,
        backgroundColor: "#0a0a0f",
        borderRadius: 4,
        border: `1px solid ${config.color}33`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        position: "relative",
      }}
    >
      {/* Fill bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: fillHeight,
          backgroundColor: `${config.color}30`,
          borderTop: `2px solid ${config.color}`,
        }}
      />

      {/* Level text (vertical) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-90deg)",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: config.color,
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
        }}
      >
        {config.label}
      </div>

      {/* Emoji at top */}
      <div
        style={{
          position: "absolute",
          top: 8,
          fontSize: 16,
        }}
      >
        {config.emoji}
      </div>
    </div>
  );
};
