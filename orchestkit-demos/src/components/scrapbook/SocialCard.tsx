import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../../styles/scrapbook-style";

type SlideDirection = "left" | "right" | "top" | "bottom";

interface SocialCardProps {
  author: string;
  text: string;
  handle?: string;
  delay?: number;
  direction?: SlideDirection;
  tilt?: number;
  accentColor?: string;
}

const directionOffset: Record<SlideDirection, { x: number; y: number }> = {
  left: { x: -120, y: 0 },
  right: { x: 120, y: 0 },
  top: { x: 0, y: -120 },
  bottom: { x: 0, y: 120 },
};

export const SocialCard: React.FC<SocialCardProps> = ({
  author,
  text,
  handle,
  delay = 0,
  direction = "left",
  tilt = 0,
  accentColor = SCRAPBOOK_PALETTE.accents[1],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const offset = directionOffset[direction];

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: SCRAPBOOK_ANIMATION.springConfig,
  });

  const translateX = interpolate(progress, [0, 1], [offset.x, 0]);
  const translateY = interpolate(progress, [0, 1], [offset.y, 0]);
  const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Avatar initials
  const initials = author
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        opacity,
        transform: `translate(${translateX}px, ${translateY}px) rotate(${tilt}deg)`,
        backgroundColor: SCRAPBOOK_PALETTE.background.paper,
        borderRadius: 12,
        padding: 28,
        maxWidth: 520,
        boxShadow: `0 4px 24px ${SCRAPBOOK_PALETTE.ui.shadow}, 0 1px 4px rgba(0,0,0,0.04)`,
        border: `1px solid ${SCRAPBOOK_PALETTE.ui.border}`,
      }}
    >
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        {/* Avatar circle */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: SCRAPBOOK_PALETTE.text.heading,
              fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
            }}
          >
            {author}
          </div>
          {handle && (
            <div
              style={{
                fontSize: 14,
                color: SCRAPBOOK_PALETTE.text.muted,
                fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
              }}
            >
              {handle}
            </div>
          )}
        </div>
      </div>

      {/* Quote text */}
      <div
        style={{
          fontSize: 20,
          lineHeight: 1.5,
          color: SCRAPBOOK_PALETTE.text.body,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
          fontStyle: "italic",
        }}
      >
        &ldquo;{text}&rdquo;
      </div>
    </div>
  );
};
