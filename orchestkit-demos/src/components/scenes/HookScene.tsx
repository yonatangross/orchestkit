import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface HookSceneProps {
  skillName: string;
  hook: string;
  ccVersion: string;
  primaryColor: string;
  stats?: {
    skills?: number;
    agents?: number;
  };
}

export const HookScene: React.FC<HookSceneProps> = ({
  skillName,
  hook,
  ccVersion,
  primaryColor,
  stats = { skills: 169, agents: 35 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 300 },
  });

  const skillNameScale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 80, stiffness: 250 },
  });

  const hookScale = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const statsOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle background pulse
  const bgPulse = 1 + Math.sin(frame * 0.05) * 0.02;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0f",
        overflow: "hidden",
      }}
    >
      {/* Radial gradient background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}15 0%, transparent 70%)`,
          transform: `scale(${bgPulse})`,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        {/* CC Version Badge */}
        <div
          style={{
            transform: `scale(${badgeScale})`,
            opacity: Math.min(1, frame / 10),
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontFamily: "Menlo, monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "6px 16px",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {ccVersion} ALIGNED
          </div>
        </div>

        {/* Skill Name */}
        <div
          style={{
            transform: `scale(${skillNameScale})`,
            opacity: Math.min(1, (frame - 5) / 10),
          }}
        >
          <code
            style={{
              fontSize: 56,
              color: primaryColor,
              fontFamily: "Menlo, monospace",
              fontWeight: 700,
              textShadow: `0 0 40px ${primaryColor}50`,
            }}
          >
            /{skillName}
          </code>
        </div>

        {/* Hook Text */}
        <div
          style={{
            transform: `scale(${hookScale})`,
            opacity: Math.min(1, (frame - 12) / 10),
          }}
        >
          <h1
            style={{
              fontSize: 52,
              color: "white",
              fontFamily: "Inter, system-ui",
              fontWeight: 700,
              maxWidth: 900,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {hook}
          </h1>
        </div>

        {/* Stats Badge */}
        <div
          style={{
            opacity: statsOpacity,
            marginTop: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 14,
              color: "#9ca3af",
              fontFamily: "Menlo, monospace",
            }}
          >
            <span>
              <span style={{ color: primaryColor }}>{stats.skills}</span> skills
            </span>
            <span style={{ color: "#4b5563" }}>*</span>
            <span>
              <span style={{ color: primaryColor }}>{stats.agents}</span> agents
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
