import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { interpolateColors } from "remotion";

type EasingPreset = "linear" | "bounce" | "elastic" | "spring" | "back" | "snappy";

interface StatCounterProps {
  value: number | string;
  label: string;
  color?: string;
  delay?: number;
  suffix?: string;
  prefix?: string;
  animate?: boolean;
  easing?: EasingPreset;
  digitMorph?: boolean;
  gradientColors?: [string, string];
  celebrateOnComplete?: boolean;
  size?: "sm" | "md" | "lg";
}

// Easing function factory
const getEasingFn = (preset: EasingPreset) => {
  switch (preset) {
    case "bounce":
      return Easing.bounce;
    case "elastic":
      return Easing.elastic(1);
    case "back":
      return Easing.back(1.7);
    case "snappy":
      return Easing.bezier(0.68, -0.6, 0.32, 1.6);
    case "linear":
      return (t: number) => t;
    case "spring":
    default:
      return Easing.out(Easing.ease);
  }
};

// Size presets
const sizePresets = {
  sm: { value: 28, label: 11 },
  md: { value: 42, label: 14 },
  lg: { value: 64, label: 18 },
};

// Digit morphing component - animates each digit individually
const DigitMorph: React.FC<{
  value: string;
  frame: number;
  fps: number;
  delay: number;
  color: string;
  fontSize: number;
  gradientColors?: [string, string];
}> = ({ value, frame, fps, delay, color, fontSize, gradientColors }) => {
  const digits = value.split("");

  return (
    <div style={{ display: "flex", overflow: "hidden" }}>
      {digits.map((digit, i) => {
        const digitDelay = delay + i * 3;
        const adjustedFrame = Math.max(0, frame - digitDelay);

        const y = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 12, stiffness: 100 },
          from: 30,
          to: 0,
        });

        const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
          extrapolateRight: "clamp",
        });

        // Optional gradient color animation
        const digitColor = gradientColors
          ? interpolateColors(
              i / Math.max(digits.length - 1, 1),
              [0, 1],
              gradientColors
            )
          : color;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${y}px)`,
              opacity,
              color: digitColor,
              fontSize,
              fontWeight: 700,
              fontFamily: "Menlo, monospace",
            }}
          >
            {digit}
          </span>
        );
      })}
    </div>
  );
};

// Celebration particles
const CelebrationParticles: React.FC<{
  frame: number;
  color: string;
  active: boolean;
}> = ({ frame, color, active }) => {
  if (!active) return null;

  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const distance = interpolate(frame, [0, 30], [0, 40], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    });
    const opacity = interpolate(frame, [0, 15, 30], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: color,
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
          opacity,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        pointerEvents: "none",
      }}
    >
      {particles}
    </div>
  );
};

export const StatCounter: React.FC<StatCounterProps> = ({
  value,
  label,
  color = "#8b5cf6",
  delay = 0,
  suffix = "",
  prefix = "",
  animate = true,
  easing = "spring",
  digitMorph = false,
  gradientColors,
  celebrateOnComplete = false,
  size = "md",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const { value: valueFontSize, label: labelFontSize } = sizePresets[size];

  // Entry animation
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Animate number counting with easing
  const numericValue =
    typeof value === "number" ? value : parseFloat(value.toString());
  const isNumeric = !isNaN(numericValue);
  const animationDuration = easing === "bounce" || easing === "elastic" ? 45 : 35;

  const easingFn = getEasingFn(easing);
  const countProgress = interpolate(
    adjustedFrame,
    [0, animationDuration],
    [0, 1],
    {
      extrapolateRight: "clamp",
      easing: easingFn,
    }
  );

  const displayValue =
    animate && isNumeric
      ? Math.round(numericValue * countProgress)
      : value;

  // Check if animation is complete for celebration
  const isComplete = adjustedFrame >= animationDuration;
  const celebrationFrame = isComplete ? adjustedFrame - animationDuration : 0;

  // Gradient color for the value
  const valueColor = gradientColors
    ? interpolateColors(countProgress, [0, 1], gradientColors)
    : color;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Celebration effect */}
      {celebrateOnComplete && (
        <CelebrationParticles
          frame={celebrationFrame}
          color={color}
          active={isComplete}
        />
      )}

      {/* Value display */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
        }}
      >
        {/* Prefix */}
        {prefix && (
          <span
            style={{
              fontSize: valueFontSize * 0.7,
              color: valueColor,
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
              marginRight: 2,
            }}
          >
            {prefix}
          </span>
        )}

        {/* Main value - with optional digit morphing */}
        {digitMorph && isNumeric ? (
          <DigitMorph
            value={String(displayValue)}
            frame={frame}
            fps={fps}
            delay={delay}
            color={valueColor}
            fontSize={valueFontSize}
            gradientColors={gradientColors}
          />
        ) : (
          <span
            style={{
              fontSize: valueFontSize,
              fontWeight: 700,
              color: valueColor,
              fontFamily: "Menlo, monospace",
            }}
          >
            {displayValue}
          </span>
        )}

        {/* Suffix with slide-in animation */}
        {suffix && (
          <span
            style={{
              fontSize: valueFontSize * 0.7,
              color: valueColor,
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
              marginLeft: 2,
              opacity: interpolate(adjustedFrame, [animationDuration - 10, animationDuration], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateX(${interpolate(
                adjustedFrame,
                [animationDuration - 10, animationDuration],
                [10, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )}px)`,
            }}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: labelFontSize,
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
  easing?: EasingPreset;
  digitMorph?: boolean;
  size?: "sm" | "md" | "lg";
}

export const StatRow: React.FC<StatRowProps> = ({
  stats,
  color = "#8b5cf6",
  staggerDelay = 8,
  easing = "spring",
  digitMorph = false,
  size = "md",
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
          easing={easing}
          digitMorph={digitMorph}
          size={size}
        />
      ))}
    </div>
  );
};

// NEW: Compact stat for inline usage
export const InlineStat: React.FC<{
  value: number | string;
  suffix?: string;
  color?: string;
  delay?: number;
}> = ({ value, suffix = "", color = "#8b5cf6", delay = 0 }) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const numericValue = typeof value === "number" ? value : parseFloat(String(value));
  const displayValue = !isNaN(numericValue)
    ? Math.round(
        interpolate(adjustedFrame, [0, 25], [0, numericValue], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.ease),
        })
      )
    : value;

  return (
    <span style={{ color, fontWeight: 700, fontFamily: "Menlo, monospace" }}>
      {displayValue}
      {suffix}
    </span>
  );
};
