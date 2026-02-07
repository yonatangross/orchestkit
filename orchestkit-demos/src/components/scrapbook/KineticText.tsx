import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../../styles/scrapbook-style";

type TextMode = "headline" | "data" | "caption";

interface KineticTextProps {
  text: string;
  mode?: TextMode;
  color?: string;
  fontSize?: number;
  delay?: number;
  /** Slight rotation for collage feel (-3 to +3 degrees) */
  tilt?: number;
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  mode = "headline",
  color,
  fontSize,
  delay = 0,
  tilt = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Spring "stamp" pop-in with overshoot
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: SCRAPBOOK_ANIMATION.stampSpring,
    from: 1.4,
    to: 1,
  });

  const opacity = interpolate(adjustedFrame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  const resolvedColor = color ?? SCRAPBOOK_PALETTE.text.heading;
  const resolvedFont =
    mode === "headline" || mode === "caption"
      ? SCRAPBOOK_TYPOGRAPHY.serif
      : SCRAPBOOK_TYPOGRAPHY.sans;
  const resolvedSize =
    fontSize ??
    (mode === "headline"
      ? SCRAPBOOK_TYPOGRAPHY.sizes.hero
      : mode === "data"
        ? SCRAPBOOK_TYPOGRAPHY.sizes.heading
        : SCRAPBOOK_TYPOGRAPHY.sizes.caption);
  const fontWeight = mode === "headline" ? 700 : mode === "data" ? 600 : 400;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale}) rotate(${tilt}deg)`,
        fontFamily: resolvedFont,
        fontSize: resolvedSize,
        fontWeight,
        color: resolvedColor,
        lineHeight: 1.15,
        letterSpacing: mode === "headline" ? "-0.02em" : "0",
      }}
    >
      {text}
    </div>
  );
};
