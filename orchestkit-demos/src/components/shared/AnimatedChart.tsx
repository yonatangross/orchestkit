import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { interpolateColors } from "remotion";

// ============================================================================
// PROGRESS RING (Donut/Radial Progress)
// ============================================================================

interface ProgressRingProps {
  progress: number; // 0-100
  color: string;
  size?: number;
  strokeWidth?: number;
  delay?: number;
  showLabel?: boolean;
  labelSuffix?: string;
  backgroundColor?: string;
  gradientColors?: [string, string];
  easing?: "spring" | "ease" | "bounce";
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  color,
  size = 120,
  strokeWidth = 12,
  delay = 0,
  showLabel = true,
  labelSuffix = "%",
  backgroundColor = "rgba(255,255,255,0.1)",
  gradientColors,
  easing = "spring",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Animated progress value
  let animatedProgress: number;
  if (easing === "spring") {
    animatedProgress = spring({
      frame: adjustedFrame,
      fps,
      config: { damping: 20, stiffness: 80 },
      from: 0,
      to: progress,
    });
  } else if (easing === "bounce") {
    animatedProgress = interpolate(adjustedFrame, [0, 45], [0, progress], {
      extrapolateRight: "clamp",
      easing: Easing.bounce,
    });
  } else {
    animatedProgress = interpolate(adjustedFrame, [0, 35], [0, progress], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    });
  }

  // Calculate SVG arc
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedProgress / 100);

  // Optional gradient color
  const strokeColor = gradientColors
    ? interpolateColors(animatedProgress / 100, [0, 1], gradientColors)
    : color;

  // Entry opacity
  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "relative", width: size, height: size, opacity }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            filter: `drop-shadow(0 0 8px ${strokeColor}50)`,
          }}
        />
      </svg>
      {/* Center label */}
      {showLabel && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: strokeColor,
              fontSize: size * 0.22,
              fontWeight: 700,
              fontFamily: "Menlo, monospace",
            }}
          >
            {Math.round(animatedProgress)}
            {labelSuffix}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// BAR CHART (Horizontal Bars with Racing Animation)
// ============================================================================

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  maxValue?: number;
  delay?: number;
  barHeight?: number;
  gap?: number;
  showValues?: boolean;
  defaultColor?: string;
  staggerDelay?: number;
  labelWidth?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  maxValue,
  delay = 0,
  barHeight = 28,
  gap = 12,
  showValues = true,
  defaultColor = "#8b5cf6",
  staggerDelay = 5,
  labelWidth = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const max = maxValue || Math.max(...data.map((d) => d.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {data.map((item, i) => {
        const itemDelay = i * staggerDelay;
        const itemFrame = Math.max(0, adjustedFrame - itemDelay);
        const color = item.color || defaultColor;

        // Bar width animation with spring
        const barProgress = spring({
          frame: itemFrame,
          fps,
          config: { damping: 15, stiffness: 100 },
        });
        const width = (item.value / max) * 100 * barProgress;

        // Value counter animation
        const displayValue = Math.round(item.value * barProgress);

        // Entry opacity
        const opacity = interpolate(itemFrame, [0, 8], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity,
            }}
          >
            {/* Label */}
            <span
              style={{
                width: labelWidth,
                color: "#9ca3af",
                fontSize: 14,
                fontFamily: "Inter, system-ui",
                textAlign: "right",
              }}
            >
              {item.label}
            </span>

            {/* Bar container */}
            <div
              style={{
                flex: 1,
                height: barHeight,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: barHeight / 4,
                overflow: "hidden",
              }}
            >
              {/* Animated bar */}
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  backgroundColor: color,
                  borderRadius: barHeight / 4,
                  boxShadow: `0 0 12px ${color}40`,
                }}
              />
            </div>

            {/* Value */}
            {showValues && (
              <span
                style={{
                  width: 50,
                  color,
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "Menlo, monospace",
                  textAlign: "right",
                }}
              >
                {displayValue}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// LINE CHART (with Path Drawing Animation)
// ============================================================================

interface LineChartProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  delay?: number;
  strokeWidth?: number;
  showDots?: boolean;
  showArea?: boolean;
  gradientColors?: [string, string];
}

export const LineChart: React.FC<LineChartProps> = ({
  points,
  color = "#8b5cf6",
  width = 300,
  height = 150,
  delay = 0,
  strokeWidth = 3,
  showDots = true,
  showArea = false,
  gradientColors,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = maxVal - minVal || 1;
  const padding = 10;

  // Generate path
  const pathPoints = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p - minVal) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathData = pathPoints
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
    .join(" ");

  // Calculate path length for drawing animation
  const pathLength = pathPoints.reduce((acc, pt, i) => {
    if (i === 0) return 0;
    const prev = pathPoints[i - 1];
    return acc + Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
  }, 0);

  // Drawing progress
  const drawProgress = interpolate(adjustedFrame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const strokeDashoffset = pathLength * (1 - drawProgress);

  // Gradient ID - use deterministic ID based on color
  const gradientId = `line-gradient-${color.replace("#", "")}`;

  // Entry opacity
  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} style={{ opacity }}>
      {/* Gradient definition */}
      {gradientColors && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradientColors[0]} />
            <stop offset="100%" stopColor={gradientColors[1]} />
          </linearGradient>
        </defs>
      )}

      {/* Area fill (optional) */}
      {showArea && (
        <path
          d={`${pathData} L ${pathPoints[pathPoints.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
          fill={`${color}20`}
          style={{
            clipPath: `inset(0 ${100 - drawProgress * 100}% 0 0)`,
          }}
        />
      )}

      {/* Line path */}
      <path
        d={pathData}
        fill="none"
        stroke={gradientColors ? `url(#${gradientId})` : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={strokeDashoffset}
        style={{
          filter: `drop-shadow(0 0 4px ${color}50)`,
        }}
      />

      {/* Dots at data points */}
      {showDots &&
        pathPoints.map((pt, i) => {
          const dotDelay = (i / (pathPoints.length - 1)) * 50;
          const dotFrame = Math.max(0, adjustedFrame - dotDelay);
          const dotScale = spring({
            frame: dotFrame,
            fps: 30,
            config: { damping: 12, stiffness: 150 },
          });

          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={5 * dotScale}
              fill={color}
              style={{
                filter: `drop-shadow(0 0 4px ${color})`,
              }}
            />
          );
        })}
    </svg>
  );
};

// ============================================================================
// COMPARISON STAT (Before/After with Animation)
// ============================================================================

interface ComparisonStatProps {
  before: number | string;
  after: number | string;
  label?: string;
  beforeColor?: string;
  afterColor?: string;
  delay?: number;
  suffix?: string;
  showArrow?: boolean;
}

export const ComparisonStat: React.FC<ComparisonStatProps> = ({
  before,
  after,
  label,
  beforeColor = "#ef4444",
  afterColor = "#22c55e",
  delay = 0,
  suffix = "",
  showArrow = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Before value animation
  const beforeProgress = interpolate(adjustedFrame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // After value animation (starts after before)
  const afterProgress = interpolate(adjustedFrame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // Arrow animation
  const arrowOpacity = interpolate(adjustedFrame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowScale = spring({
    frame: Math.max(0, adjustedFrame - 20),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const beforeNum = typeof before === "number" ? before : parseFloat(String(before));
  const afterNum = typeof after === "number" ? after : parseFloat(String(after));

  const displayBefore = !isNaN(beforeNum)
    ? Math.round(beforeNum * beforeProgress)
    : before;
  const displayAfter = !isNaN(afterNum)
    ? Math.round(afterNum * afterProgress)
    : after;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Before */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: beforeColor,
              fontFamily: "Menlo, monospace",
              opacity: beforeProgress,
            }}
          >
            {displayBefore}
            {suffix}
          </span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Before</span>
        </div>

        {/* Arrow */}
        {showArrow && (
          <span
            style={{
              fontSize: 24,
              color: afterColor,
              opacity: arrowOpacity,
              transform: `scale(${arrowScale})`,
            }}
          >
            →
          </span>
        )}

        {/* After */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: afterColor,
              fontFamily: "Menlo, monospace",
              opacity: afterProgress,
            }}
          >
            {displayAfter}
            {suffix}
          </span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>After</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// METRIC CARD (Stat with Icon and Trend)
// ============================================================================

interface MetricCardProps {
  value: number | string;
  label: string;
  icon?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string;
  delay?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  icon,
  trend,
  trendValue,
  color = "#8b5cf6",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Entry animation
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });
  const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Value animation
  const numValue = typeof value === "number" ? value : parseFloat(String(value));
  const displayValue = !isNaN(numValue)
    ? Math.round(
        interpolate(adjustedFrame, [0, 30], [0, numValue], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.ease),
        })
      )
    : value;

  const trendColors = {
    up: "#22c55e",
    down: "#ef4444",
    neutral: "#9ca3af",
  };
  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 20,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        border: `1px solid ${color}30`,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Icon */}
      {icon && (
        <span style={{ fontSize: 24, marginBottom: 4 }}>{icon}</span>
      )}

      {/* Value */}
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          color,
          fontFamily: "Menlo, monospace",
        }}
      >
        {displayValue}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: 13,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>

      {/* Trend */}
      {trend && trendValue && (
        <span
          style={{
            fontSize: 12,
            color: trendColors[trend],
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {trendIcons[trend]} {trendValue}
        </span>
      )}
    </div>
  );
};
