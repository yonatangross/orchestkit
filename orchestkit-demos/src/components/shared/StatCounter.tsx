import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface StatCounterProps {
  value: number | string;
  label: string;
  color?: string;
  delay?: number;
  suffix?: string;
  prefix?: string;
  animate?: boolean;
}

export const StatCounter: React.FC<StatCounterProps> = ({
  value,
  label,
  color = "#8b5cf6",
  delay = 0,
  suffix = "",
  prefix = "",
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Animate number counting
  const numericValue = typeof value === "number" ? value : parseInt(value, 10);
  const displayValue =
    animate && !isNaN(numericValue)
      ? Math.floor(
          interpolate(adjustedFrame, [0, 30], [0, numericValue], {
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
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color,
          fontFamily: "Menlo, monospace",
        }}
      >
        {prefix}
        {displayValue}
        {suffix}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#9ca3af",
          fontFamily: "Inter, system-ui",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
    </div>
  );
};

interface StatRowProps {
  stats: Array<{
    value: number | string;
    label: string;
    suffix?: string;
    prefix?: string;
  }>;
  color?: string;
  staggerDelay?: number;
}

export const StatRow: React.FC<StatRowProps> = ({
  stats,
  color = "#8b5cf6",
  staggerDelay = 8,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 60,
      }}
    >
      {stats.map((stat, index) => (
        <StatCounter
          key={index}
          value={stat.value}
          label={stat.label}
          color={color}
          delay={index * staggerDelay}
          suffix={stat.suffix}
          prefix={stat.prefix}
        />
      ))}
    </div>
  );
};
