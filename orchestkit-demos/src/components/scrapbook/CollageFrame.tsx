import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_ANIMATION,
} from "../../styles/scrapbook-style";

interface CollageFrameProps {
  children: React.ReactNode;
  delay?: number;
  /** Random slight rotation for organic feel (-3 to +3) */
  rotation?: number;
  width?: number | string;
  shadowIntensity?: number;
}

export const CollageFrame: React.FC<CollageFrameProps> = ({
  children,
  delay = 0,
  rotation = 0,
  width = "auto",
  shadowIntensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: SCRAPBOOK_ANIMATION.springConfig,
    from: 0.85,
    to: 1,
  });

  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        backgroundColor: SCRAPBOOK_PALETTE.background.secondary,
        borderRadius: 8,
        padding: 12,
        width,
        boxShadow: `0 ${6 * shadowIntensity}px ${32 * shadowIntensity}px rgba(0,0,0,${0.1 * shadowIntensity}), 0 2px 8px rgba(0,0,0,${0.06 * shadowIntensity})`,
        border: `1px solid ${SCRAPBOOK_PALETTE.ui.border}`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};
