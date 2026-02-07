import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../../styles/scrapbook-style";

interface StatItem {
  value: number;
  label: string;
  accentColor?: string;
}

interface StatsCounterProps {
  stats: StatItem[];
  delay?: number;
  staggerMs?: number;
}

const SingleStat: React.FC<{
  stat: StatItem;
  delay: number;
  defaultAccent: string;
}> = ({ stat, delay, defaultAccent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const accent = stat.accentColor ?? defaultAccent;

  // Entry pop
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: SCRAPBOOK_ANIMATION.stampSpring,
  });

  const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Count-up animation
  const countProgress = interpolate(adjustedFrame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const displayValue = Math.round(stat.value * countProgress);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {/* Number */}
      <div
        style={{
          fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.hero,
          fontWeight: 700,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
          color: SCRAPBOOK_PALETTE.text.heading,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>

      {/* Warm accent underline */}
      <div
        style={{
          width: 48,
          height: 3,
          backgroundColor: accent,
          borderRadius: 2,
          transform: `scaleX(${countProgress})`,
          transformOrigin: "center",
        }}
      />

      {/* Label */}
      <div
        style={{
          fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.body,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
          color: SCRAPBOOK_PALETTE.text.muted,
          textTransform: "lowercase",
          letterSpacing: "0.04em",
        }}
      >
        {stat.label}
      </div>
    </div>
  );
};

export const StatsCounter: React.FC<StatsCounterProps> = ({
  stats,
  delay = 0,
  staggerMs = SCRAPBOOK_ANIMATION.staggerMs,
}) => {
  const { fps } = useVideoConfig();
  // Convert ms stagger to frame stagger
  const staggerFrames = Math.round((staggerMs / 1000) * fps);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 80,
      }}
    >
      {stats.map((stat, i) => (
        <SingleStat
          key={i}
          stat={stat}
          delay={delay + i * Math.max(staggerFrames, 4)}
          defaultAccent={SCRAPBOOK_PALETTE.accents[i % SCRAPBOOK_PALETTE.accents.length]}
        />
      ))}
    </div>
  );
};
