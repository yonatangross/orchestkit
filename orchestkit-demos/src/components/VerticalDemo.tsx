import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  OffthreadVideo,
  staticFile,
  Audio,
  interpolate,
  Sequence,
} from "remotion";
import { z } from "zod";

export const verticalDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  terminalVideo: z.string(),
  ccVersion: z.string().default("CC 2.1.16"),
  primaryColor: z.string().default("#8b5cf6"),
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.15),
});

type VerticalDemoProps = z.infer<typeof verticalDemoSchema>;

export const VerticalDemo: React.FC<VerticalDemoProps> = ({
  skillName,
  hook,
  terminalVideo,
  ccVersion,
  primaryColor,
  backgroundMusic,
  musicVolume,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Phases: Hook (0-60), Terminal (60-end-90), CTA (end-90 to end)
  const hookDuration = 60;
  const ctaDuration = 90;
  const terminalStart = hookDuration;
  const ctaStart = durationInFrames - ctaDuration;

  // Hook phase
  const hookOpacity =
    frame < hookDuration - 15
      ? 1
      : Math.max(0, 1 - (frame - (hookDuration - 15)) / 15);

  // Terminal zoom in effect
  const terminalScale = interpolate(
    frame,
    [terminalStart, terminalStart + 20, ctaStart, ctaStart + 15],
    [0.95, 1, 1, 0.9],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const terminalOpacity = interpolate(
    frame,
    [terminalStart - 10, terminalStart + 5, ctaStart, ctaStart + 20],
    [0, 1, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // CTA animation
  const ctaProgress = Math.max(0, (frame - ctaStart) / 20);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg,
            rgba(139, 92, 246, 0.1) 0%,
            transparent 30%,
            transparent 70%,
            rgba(99, 102, 241, 0.1) 100%)`,
        }}
      />

      {/* Background Music */}
      {backgroundMusic && (
        <Audio
          src={staticFile(backgroundMusic)}
          volume={(f) => {
            const fadeIn = Math.min(1, f / (fps * 0.5));
            const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
            return fadeIn * fadeOut * musicVolume;
          }}
        />
      )}

      {/* Success sound on CTA */}
      {frame >= ctaStart && frame < ctaStart + 2 && (
        <Audio src={staticFile("audio/success.mp3")} volume={0.3} />
      )}

      {/* Hook Phase - Full screen intro */}
      {hookOpacity > 0 && (
        <HookPhase
          skillName={skillName}
          hook={hook}
          ccVersion={ccVersion}
          primaryColor={primaryColor}
          opacity={hookOpacity}
        />
      )}

      {/* Terminal Video - Starts after hook phase using Sequence */}
      <Sequence from={hookDuration - 15} layout="none">
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: terminalOpacity,
            transform: `scale(${terminalScale})`,
            paddingTop: 100,
            paddingBottom: 160,
          }}
        >
          <div
            style={{
              width: "95%",
              height: "80%",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: `0 20px 60px ${primaryColor}40`,
            }}
          >
            <OffthreadVideo
              src={staticFile(terminalVideo)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 16,
              }}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CTA Phase */}
      {ctaProgress > 0 && (
        <CTAPhase
          primaryColor={primaryColor}
          progress={ctaProgress}
        />
      )}

      {/* Top badge */}
      <TopBadge primaryColor={primaryColor} />

      {/* Progress bar */}
      <ProgressBar progress={frame / durationInFrames} primaryColor={primaryColor} />
    </AbsoluteFill>
  );
};

const HookPhase: React.FC<{
  skillName: string;
  hook: string;
  ccVersion: string;
  primaryColor: string;
  opacity: number;
}> = ({ skillName, hook, ccVersion, primaryColor, opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 80, stiffness: 300 } });
  const slideUp = spring({ frame: frame - 10, fps, config: { damping: 100, stiffness: 200 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(10, 10, 15, 0.98)",
        opacity,
        padding: 40,
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${(1 - slideUp) * 30}px)`,
          textAlign: "center",
        }}
      >
        {/* Version badge */}
        <div
          style={{
            display: "inline-block",
            background: "rgba(139, 92, 246, 0.2)",
            borderRadius: 20,
            padding: "8px 16px",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: primaryColor,
              fontFamily: "Menlo, monospace",
              letterSpacing: "0.05em",
            }}
          >
            {ccVersion} ALIGNED
          </span>
        </div>

        {/* Skill command */}
        <div
          style={{
            fontSize: 72,
            color: primaryColor,
            fontFamily: "Menlo, monospace",
            fontWeight: 700,
            marginBottom: 20,
            textShadow: `0 0 60px ${primaryColor}80`,
          }}
        >
          /{skillName}
        </div>

        {/* Hook text */}
        <div
          style={{
            fontSize: 42,
            color: "white",
            fontFamily: "Inter, system-ui",
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: 500,
          }}
        >
          {hook}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTAPhase: React.FC<{
  primaryColor: string;
  progress: number;
}> = ({ primaryColor, progress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const pulse = 1 + Math.sin(frame * 0.12) * 0.015;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 120,
        opacity: Math.min(1, progress),
      }}
    >
      <div
        style={{
          transform: `scale(${Math.min(1, scale) * pulse})`,
          textAlign: "center",
        }}
      >
        {/* CTA Button */}
        <div
          style={{
            background: `linear-gradient(135deg, #6366f1 0%, ${primaryColor} 100%)`,
            borderRadius: 16,
            padding: "20px 40px",
            marginBottom: 16,
            boxShadow: `0 15px 50px ${primaryColor}60`,
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
            /plugin install ork
          </code>
        </div>

        {/* Stats */}
        <div
          style={{
            fontSize: 16,
            color: "#9ca3af",
            fontFamily: "Menlo, monospace",
          }}
        >
          170 skills * 35 agents
        </div>

        {/* Swipe up hint */}
        <div
          style={{
            marginTop: 30,
            opacity: 0.5 + Math.sin(frame * 0.1) * 0.3,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderBottom: `15px solid ${primaryColor}`,
              margin: "0 auto 8px",
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "#6b7280",
              fontFamily: "Inter, system-ui",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Learn more
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TopBadge: React.FC<{ primaryColor: string }> = ({ primaryColor }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(10px)",
          borderRadius: 24,
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: primaryColor,
            boxShadow: `0 0 10px ${primaryColor}`,
          }}
        />
        <span
          style={{
            fontSize: 14,
            color: "white",
            fontFamily: "Menlo, monospace",
            fontWeight: 500,
          }}
        >
          OrchestKit
        </span>
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{ progress: number; primaryColor: string }> = ({
  progress,
  primaryColor,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 40,
        right: 40,
        height: 4,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 2,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${primaryColor}, #6366f1)`,
          borderRadius: 2,
        }}
      />
    </div>
  );
};
