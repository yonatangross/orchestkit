// src/components/InstallWithAvatarDemo.tsx
// Premium installation demo combining HeyGen avatar with terminal recording

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  OffthreadVideo,
  staticFile,
} from "remotion";
import { z } from "zod";
import { AvatarPlaceholder, StatCounter } from "./shared";

// Schema for props validation
export const installWithAvatarDemoSchema = z.object({
  avatarVideoUrl: z.string().optional(),
  terminalVideoUrl: z.string().default("install-demo.mp4"),
  showPlaceholder: z.boolean().default(true),
  primaryColor: z.string().default("#8b5cf6"),
});

type InstallWithAvatarDemoProps = z.infer<typeof installWithAvatarDemoSchema>;

// Timeline (30fps)
const FPS = 30;
const TIMELINE = {
  // Scene 1: Hook (0-3s)
  HOOK_START: 0,
  HOOK_END: FPS * 3,
  // Scene 2: Avatar intro (3-8s)
  AVATAR_INTRO_START: FPS * 3,
  AVATAR_INTRO_END: FPS * 8,
  // Scene 3: Terminal demo with avatar PIP (8-25s)
  TERMINAL_START: FPS * 8,
  TERMINAL_END: FPS * 25,
  // Scene 4: Stats overlay (22-28s)
  STATS_START: FPS * 22,
  STATS_END: FPS * 28,
  // Scene 5: CTA (25-30s)
  CTA_START: FPS * 25,
  CTA_END: FPS * 30,
};

// Aurora background component
const AuroraBackground: React.FC<{ primaryColor: string }> = ({ primaryColor }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% 120%, ${primaryColor}15 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 80% 0%, #06b6d420 0%, transparent 40%),
          radial-gradient(ellipse 50% 30% at 20% 20%, #22c55e15 0%, transparent 40%),
          linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)
        `,
      }}
    >
      {/* Animated aurora shimmer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 100% 60% at ${50 + Math.sin(frame * 0.02) * 10}% 100%,
              ${primaryColor}08 0%, transparent 50%)
          `,
        }}
      />
    </AbsoluteFill>
  );
};

// Hook scene with animated text
const HookScene: React.FC<{ primaryColor: string }> = ({ primaryColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {/* Main hook */}
        <h1
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            margin: 0,
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
            textShadow: `0 0 40px ${primaryColor}60`,
          }}
        >
          One Command.
          <br />
          <span style={{ color: primaryColor }}>Full-Stack AI Toolkit.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 28,
            color: "#888",
            marginTop: 24,
            opacity: subtitleOpacity,
          }}
        >
          170 skills. 35 agents. Zero configuration.
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Avatar intro scene
const AvatarIntroScene: React.FC<{
  avatarVideoUrl?: string;
  showPlaceholder: boolean;
}> = ({ avatarVideoUrl, showPlaceholder }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const hasVideo = avatarVideoUrl && !showPlaceholder;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          width: "60%",
          transform: `scale(${scale})`,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0, 0, 0, 0.5)",
        }}
      >
        {hasVideo ? (
          <OffthreadVideo
            src={staticFile(avatarVideoUrl)}
            style={{ width: "100%", height: "auto" }}
          />
        ) : (
          <AvatarPlaceholder
            avatarName="Abigail"
            message="Avatar introducing OrchestKit"
            size="large"
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

// Terminal with avatar PIP scene
const TerminalWithAvatarScene: React.FC<{
  terminalVideoUrl: string;
  avatarVideoUrl?: string;
  showPlaceholder: boolean;
  primaryColor: string;
}> = ({ terminalVideoUrl, avatarVideoUrl, showPlaceholder, primaryColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const terminalSlide = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const terminalX = interpolate(terminalSlide, [0, 1], [-100, 0]);

  const avatarSlide = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const hasVideo = avatarVideoUrl && !showPlaceholder;

  return (
    <AbsoluteFill>
      {/* Terminal video - main focus */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 60,
          width: "65%",
          transform: `translateX(${terminalX}px)`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px ${primaryColor}40`,
        }}
      >
        <OffthreadVideo
          src={staticFile(terminalVideoUrl)}
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      {/* Avatar PIP - bottom right */}
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 40,
          width: "30%",
          transform: `scale(${Math.max(0, avatarSlide)})`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          border: `2px solid ${primaryColor}60`,
        }}
      >
        {hasVideo ? (
          <OffthreadVideo
            src={staticFile(avatarVideoUrl!)}
            style={{ width: "100%", height: "auto" }}
          />
        ) : (
          <div
            style={{
              aspectRatio: "16/9",
              backgroundColor: "#1a1a2e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 48 }}>👤</span>
          </div>
        )}
      </div>

      {/* Feature callouts */}
      <FeatureCallouts frame={frame} primaryColor={primaryColor} />
    </AbsoluteFill>
  );
};

// Animated feature callouts
const FeatureCallouts: React.FC<{ frame: number; primaryColor: string }> = ({
  frame,
  primaryColor,
}) => {
  const features = [
    { text: "Auto-loaded skills", delay: 60, icon: "📚" },
    { text: "35 AI agents ready", delay: 120, icon: "🤖" },
    { text: "144 quality hooks", delay: 180, icon: "✨" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        top: 60,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {features.map((feature, i) => {
        const opacity = interpolate(
          frame,
          [feature.delay, feature.delay + 20],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const x = interpolate(
          frame,
          [feature.delay, feature.delay + 20],
          [30, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateX(${x}px)`,
              backgroundColor: "#1a1a2e",
              padding: "12px 20px",
              borderRadius: 12,
              border: `1px solid ${primaryColor}40`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>{feature.icon}</span>
            <span
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 18,
                color: "white",
                fontWeight: 500,
              }}
            >
              {feature.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Stats overlay scene
const StatsOverlay: React.FC<{ primaryColor: string }> = ({ primaryColor }) => {
  const frame = useCurrentFrame();

  const containerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 120,
        opacity: containerOpacity,
        display: "flex",
        gap: 40,
      }}
    >
      <StatCounter value={169} label="Skills" color={primaryColor} />
      <StatCounter value={35} label="Agents" color="#22c55e" />
      <StatCounter value={144} label="Hooks" color="#06b6d4" />
    </div>
  );
};

// CTA scene
const CTAScene: React.FC<{ primaryColor: string }> = ({ primaryColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const commandScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            color: "white",
            marginBottom: 40,
          }}
        >
          Get Started Now
        </h2>

        {/* Install command */}
        <div
          style={{
            transform: `scale(${Math.max(0, commandScale)})`,
            backgroundColor: "#1a1a2e",
            padding: "28px 56px",
            borderRadius: 20,
            border: `2px solid ${primaryColor}`,
            boxShadow: `0 0 60px ${primaryColor}40`,
          }}
        >
          <code
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 32,
              color: primaryColor,
            }}
          >
            /plugin install orchestkit
          </code>
        </div>

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

// Main composition
export const InstallWithAvatarDemo: React.FC<InstallWithAvatarDemoProps> = ({
  avatarVideoUrl = "",
  terminalVideoUrl = "install-demo.mp4",
  showPlaceholder = true,
  primaryColor = "#8b5cf6",
}) => {
  return (
    <AbsoluteFill>
      {/* Background layer */}
      <AuroraBackground primaryColor={primaryColor} />

      {/* Scene 1: Hook (0-3s) */}
      <Sequence from={TIMELINE.HOOK_START} durationInFrames={TIMELINE.HOOK_END}>
        <HookScene primaryColor={primaryColor} />
      </Sequence>

      {/* Scene 2: Avatar intro (3-8s) */}
      <Sequence
        from={TIMELINE.AVATAR_INTRO_START}
        durationInFrames={TIMELINE.AVATAR_INTRO_END - TIMELINE.AVATAR_INTRO_START}
      >
        <AvatarIntroScene
          avatarVideoUrl={avatarVideoUrl}
          showPlaceholder={showPlaceholder}
        />
      </Sequence>

      {/* Scene 3: Terminal with avatar PIP (8-25s) */}
      <Sequence
        from={TIMELINE.TERMINAL_START}
        durationInFrames={TIMELINE.TERMINAL_END - TIMELINE.TERMINAL_START}
      >
        <TerminalWithAvatarScene
          terminalVideoUrl={terminalVideoUrl}
          avatarVideoUrl={avatarVideoUrl}
          showPlaceholder={showPlaceholder}
          primaryColor={primaryColor}
        />
      </Sequence>

      {/* Scene 4: Stats overlay (22-28s) - overlaps with terminal */}
      <Sequence
        from={TIMELINE.STATS_START}
        durationInFrames={TIMELINE.STATS_END - TIMELINE.STATS_START}
      >
        <StatsOverlay primaryColor={primaryColor} />
      </Sequence>

      {/* Scene 5: CTA (25-30s) */}
      <Sequence
        from={TIMELINE.CTA_START}
        durationInFrames={TIMELINE.CTA_END - TIMELINE.CTA_START}
      >
        <CTAScene primaryColor={primaryColor} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default InstallWithAvatarDemo;
