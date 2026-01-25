// src/components/HeyGenDemo.tsx
// Main demo composition combining HeyGen avatar with Remotion motion graphics

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AvatarVideo, AvatarPlaceholder, StatCounter } from "./shared";

// Timeline configuration (in frames at 30fps)
const TIMELINE = {
  INTRO_START: 0,
  INTRO_END: 150, // 5s - Logo reveal
  AVATAR_START: 150, // 5s
  AVATAR_END: 1500, // 50s - Avatar presents
  STATS_START: 1350, // 45s - Stats overlay
  STATS_END: 1650, // 55s
  CTA_START: 1500, // 50s
  CTA_END: 1800, // 60s
};

interface HeyGenDemoProps {
  avatarVideoUrl?: string;
  showPlaceholder?: boolean;
}

// Intro scene with logo reveal
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 120,
            fontWeight: 800,
            color: "white",
            margin: 0,
            letterSpacing: -4,
          }}
        >
          <span style={{ color: "#8b5cf6" }}>Orchest</span>Kit
        </h1>
      </div>

      {/* Subtitle */}
      <p
        style={{
          opacity: subtitleOpacity,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 28,
          color: "#888",
          marginTop: 24,
        }}
      >
        AI-Powered Development Toolkit
      </p>
    </AbsoluteFill>
  );
};

// Stats overlay that appears alongside avatar
const StatsOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const slideIn = interpolate(frame, [0, 30], [100, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: "50%",
        transform: `translateY(-50%) translateX(${slideIn}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <StatCounter
        value={169}
        label="Skills"
        color="#8b5cf6"
      />
      <StatCounter
        value={35}
        label="AI Agents"
        color="#06b6d4"
      />
      <StatCounter
        value={144}
        label="Automation Hooks"
        color="#10b981"
      />
    </div>
  );
};

// CTA scene with install command
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonScale = spring({
    frame: frame - 30,
    fps,
    config: { damping: 10, stiffness: 80 },
  });

  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Title */}
      <div style={{ opacity: fadeIn, textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            marginBottom: 40,
          }}
        >
          Get Started in Seconds
        </h2>

        {/* Install command */}
        <div
          style={{
            transform: `scale(${Math.max(0, buttonScale)})`,
            backgroundColor: "#1a1a2e",
            padding: "24px 48px",
            borderRadius: 16,
            border: "2px solid #8b5cf6",
            boxShadow: "0 0 40px rgba(139, 92, 246, 0.3)",
          }}
        >
          <code
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 28,
              color: "#8b5cf6",
            }}
          >
            /plugin install orchestkit
          </code>
        </div>

        {/* Confetti hint */}
        <p
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 20,
            color: "#666",
            marginTop: 32,
          }}
        >
          Works with Claude Code 2.1.16+
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const HeyGenDemo: React.FC<HeyGenDemoProps> = ({
  avatarVideoUrl,
  showPlaceholder = false,
}) => {
  const hasVideo = avatarVideoUrl && !showPlaceholder;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Scene 1: Intro (0-5s) */}
      <Sequence from={TIMELINE.INTRO_START} durationInFrames={TIMELINE.INTRO_END}>
        <IntroScene />
      </Sequence>

      {/* Scene 2: Avatar Presentation (5-50s) */}
      <Sequence
        from={TIMELINE.AVATAR_START}
        durationInFrames={TIMELINE.AVATAR_END - TIMELINE.AVATAR_START}
      >
        <AbsoluteFill>
          {hasVideo ? (
            <AvatarVideo
              src={avatarVideoUrl}
              position="center"
              shadow
            />
          ) : (
            <AvatarPlaceholder
              avatarName="Abigail"
              message="Generate avatar video first"
              size="large"
            />
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Stats Overlay (45-55s) - overlaps with avatar */}
      <Sequence
        from={TIMELINE.STATS_START}
        durationInFrames={TIMELINE.STATS_END - TIMELINE.STATS_START}
      >
        <StatsOverlay />
      </Sequence>

      {/* Scene 4: CTA (50-60s) */}
      <Sequence
        from={TIMELINE.CTA_START}
        durationInFrames={TIMELINE.CTA_END - TIMELINE.CTA_START}
      >
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default HeyGenDemo;
