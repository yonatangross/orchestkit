import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ORCHESTKIT_STATS } from "../../constants";

interface CTASceneProps {
  installCommand?: string;
  primaryColor?: string;
  secondaryColor?: string;
  stats?: {
    skills: number;
    agents: number;
  };
  ccVersion?: string;
}

export const CTAScene: React.FC<CTASceneProps> = ({
  installCommand = "/plugin install ork",
  primaryColor = "#8b5cf6",
  secondaryColor = "#6366f1",
  stats = { skills: 169, agents: 35 },
  ccVersion = "CC 2.1.16",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Pulse animation for button
  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;

  // Glow intensity
  const glowIntensity = 10 + Math.sin(frame * 0.1) * 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Radial gradient background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}20 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Main CTA Button */}
        <div
          style={{
            transform: `scale(${Math.min(1, buttonScale) * pulse})`,
            opacity: Math.min(1, frame / 10),
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
              borderRadius: 16,
              padding: "18px 36px",
              boxShadow: `0 ${glowIntensity}px ${glowIntensity * 4}px ${primaryColor}60`,
              cursor: "pointer",
            }}
          >
            <code
              style={{
                fontSize: 32,
                color: "white",
                fontFamily: "Menlo, monospace",
                fontWeight: 600,
              }}
            >
              {installCommand}
            </code>
          </div>
        </div>

        {/* Stats line */}
        <div
          style={{
            opacity: interpolate(frame, [15, 25], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: "#9ca3af",
              fontFamily: "Menlo, monospace",
            }}
          >
            {stats.skills} skills * {stats.agents} agents * {ccVersion}
          </span>
        </div>

        {/* Additional tagline */}
        <div
          style={{
            opacity: interpolate(frame, [25, 35], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: "#e5e7eb",
              fontFamily: "Inter, system-ui",
              fontWeight: 500,
            }}
          >
            Transform Claude Code into a full-stack powerhouse
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Compact CTA overlay for end of other scenes
interface CTAOverlayProps {
  installCommand?: string;
  primaryColor?: string;
  progress: number; // 0-1 for fade in
}

export const CTAOverlay: React.FC<CTAOverlayProps> = ({
  installCommand = "/plugin install ork",
  primaryColor = "#8b5cf6",
  progress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 50,
        opacity: progress,
      }}
    >
      <div
        style={{
          transform: `scale(${Math.min(1, scale) * pulse})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, #6366f1 0%, ${primaryColor} 100%)`,
            borderRadius: 12,
            padding: "14px 28px",
            marginBottom: 10,
            boxShadow: `0 10px 40px ${primaryColor}50`,
          }}
        >
          <code
            style={{
              fontSize: 26,
              color: "white",
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
            }}
          >
            {installCommand}
          </code>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
            fontFamily: "Menlo, monospace",
          }}
        >
          {ORCHESTKIT_STATS.skills} skills * {ORCHESTKIT_STATS.agents} agents * {ORCHESTKIT_STATS.ccVersion}
        </div>
      </div>
    </AbsoluteFill>
  );
};
