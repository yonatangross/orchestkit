import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface ResultsSceneProps {
  before: string;
  after: string;
  stats?: Array<{
    label: string;
    value: string | number;
    suffix?: string;
  }>;
  primaryColor?: string;
}

export const ResultsScene: React.FC<ResultsSceneProps> = ({
  before,
  after,
  stats = [],
  primaryColor = "#22c55e",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Success glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}15 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          maxWidth: 1000,
        }}
      >
        {/* Title */}
        <div
          style={{
            transform: `scale(${titleScale})`,
            opacity: Math.min(1, frame / 10),
          }}
        >
          <h2
            style={{
              fontSize: 28,
              color: primaryColor,
              fontFamily: "Inter, system-ui",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              margin: 0,
            }}
          >
            Results
          </h2>
        </div>

        {/* Before / After Comparison */}
        <div
          style={{
            display: "flex",
            gap: 60,
            alignItems: "center",
          }}
        >
          {/* Before */}
          <div
            style={{
              opacity: interpolate(frame, [10, 20], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateX(${interpolate(frame, [10, 20], [-20, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <BeforeAfterCard
              type="before"
              text={before}
              frame={frame}
              startFrame={10}
            />
          </div>

          {/* Arrow */}
          <div
            style={{
              opacity: interpolate(frame, [25, 35], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                fontSize: 32,
                color: primaryColor,
              }}
            >
              →
            </div>
          </div>

          {/* After */}
          <div
            style={{
              opacity: interpolate(frame, [30, 40], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateX(${interpolate(frame, [30, 40], [20, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <BeforeAfterCard
              type="after"
              text={after}
              frame={frame}
              startFrame={30}
              primaryColor={primaryColor}
            />
          </div>
        </div>

        {/* Stats Row */}
        {stats.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 48,
              marginTop: 20,
              opacity: interpolate(frame, [45, 55], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {stats.map((stat, index) => (
              <StatBox
                key={index}
                label={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                delay={index * 8}
                frame={frame}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

interface BeforeAfterCardProps {
  type: "before" | "after";
  text: string;
  frame: number;
  startFrame: number;
  primaryColor?: string;
}

const BeforeAfterCard: React.FC<BeforeAfterCardProps> = ({
  type,
  text,
  primaryColor = "#22c55e",
}) => {
  const isBefore = type === "before";
  const color = isBefore ? "#ef4444" : primaryColor;
  const icon = isBefore ? "✗" : "✓";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "24px 32px",
        backgroundColor: `${color}10`,
        borderRadius: 16,
        border: `2px solid ${color}40`,
        minWidth: 280,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          color,
          fontWeight: 700,
        }}
      >
        {icon}
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 14,
          color: "#6b7280",
          fontFamily: "Inter, system-ui",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {type}
      </span>

      {/* Text */}
      <span
        style={{
          fontSize: 22,
          color: "white",
          fontFamily: "Inter, system-ui",
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        {text}
      </span>
    </div>
  );
};

interface StatBoxProps {
  label: string;
  value: string | number;
  suffix?: string;
  delay: number;
  frame: number;
  primaryColor: string;
}

const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  suffix = "",
  delay,
  frame,
  primaryColor,
}) => {
  const adjustedFrame = Math.max(0, frame - 45 - delay);
  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(adjustedFrame, [0, 10], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  // Animate numbers
  const numericValue = typeof value === "number" ? value : parseInt(value, 10);
  const displayValue = !isNaN(numericValue)
    ? Math.floor(
        interpolate(adjustedFrame, [0, 20], [0, numericValue], {
          extrapolateRight: "clamp",
        })
      )
    : value;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <span
        style={{
          fontSize: 36,
          color: primaryColor,
          fontFamily: "Menlo, monospace",
          fontWeight: 700,
        }}
      >
        {displayValue}
        {suffix}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "#9ca3af",
          fontFamily: "Inter, system-ui",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </div>
  );
};
