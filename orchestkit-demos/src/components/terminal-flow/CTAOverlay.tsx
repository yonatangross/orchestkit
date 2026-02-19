/** CTA overlay with install command and branding */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { MONO, SANS, FG, GREEN } from "./constants";

interface CTAOverlayProps {
  ctaCommand: string;
  ctaSubtext: string;
  primaryColor: string;
  startFrame: number;
}

export const CTAOverlay: React.FC<CTAOverlayProps> = ({
  ctaCommand,
  ctaSubtext,
  primaryColor,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - startFrame);

  const bgOpacity = interpolate(elapsed, [0, 20], [0, 0.95], {
    extrapolateRight: "clamp",
  });

  const contentScale = spring({
    frame: Math.max(0, elapsed - 5),
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const contentOpacity = interpolate(elapsed, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(13, 17, 23, ${bgOpacity})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        opacity: contentOpacity,
        transform: `scale(${contentScale})`,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 36,
          color: FG,
          backgroundColor: "#161b22",
          padding: "24px 56px",
          borderRadius: 16,
          border: `2px solid ${primaryColor}66`,
          boxShadow: `0 0 40px ${primaryColor}22`,
          textAlign: "center",
        }}
      >
        <span style={{ color: GREEN }}>❯</span>{" "}
        <span style={{ color: primaryColor }}>{ctaCommand}</span>
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 18,
          color: "#8b949e",
          marginTop: -8,
        }}
      >
        {ctaSubtext}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: SANS,
          fontSize: 20,
          color: "#8b949e",
          marginTop: 8,
        }}
      >
        <span style={{ color: primaryColor, fontWeight: 700, fontSize: 24 }}>
          OrchestKit
        </span>
        <span>|</span>
        <span>AI-powered development toolkit</span>
      </div>
    </AbsoluteFill>
  );
};
