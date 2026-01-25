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
} from "remotion";
import { z } from "zod";

export const hybridDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  terminalVideo: z.string(), // Path to VHS-generated video
  ccVersion: z.string().default("CC 2.1.16"),
  primaryColor: z.string().default("#8b5cf6"),
  showHook: z.boolean().default(true),
  showCTA: z.boolean().default(true),
  hookDuration: z.number().default(45), // frames
  ctaDuration: z.number().default(60), // frames
  // Audio options
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.15),
  enableSoundEffects: z.boolean().default(true),
});

type HybridDemoProps = z.infer<typeof hybridDemoSchema>;

export const HybridDemo: React.FC<HybridDemoProps> = ({
  skillName,
  hook,
  terminalVideo,
  ccVersion,
  primaryColor,
  showHook,
  showCTA,
  hookDuration,
  ctaDuration,
  backgroundMusic,
  musicVolume,
  enableSoundEffects,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const hookEnd = showHook ? hookDuration : 0;
  // CTA starts earlier to overlap with final content (not after blank space)
  const ctaStart = showCTA ? durationInFrames - ctaDuration - 30 : durationInFrames;

  // Hook overlay fade
  const hookOpacity = showHook
    ? frame < hookEnd - 15
      ? 1
      : Math.max(0, 1 - (frame - (hookEnd - 15)) / 15)
    : 0;

  // CTA fade in
  const ctaProgress = showCTA
    ? Math.max(0, (frame - ctaStart) / 15)
    : 0;

  // Subtle zoom pulse on terminal during key moments
  const terminalScale = interpolate(
    frame,
    [hookEnd, hookEnd + 10, ctaStart, ctaStart + 10],
    [1, 1.01, 1.01, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background Music */}
      {backgroundMusic && (
        <Audio
          src={staticFile(backgroundMusic)}
          volume={(f) => {
            // Fade in at start, fade out at end
            const fadeIn = Math.min(1, f / (fps * 0.5));
            const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
            return fadeIn * fadeOut * musicVolume;
          }}
        />
      )}

      {/* Success sound effect on CTA */}
      {enableSoundEffects && showCTA && frame >= ctaStart && frame < ctaStart + 2 && (
        <Audio src={staticFile("audio/success.mp3")} volume={0.3} />
      )}

      {/* VHS Terminal Recording - Centered vertically with zoom pulse */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${terminalScale})`,
        }}
      >
        <OffthreadVideo
          src={staticFile(terminalVideo)}
          style={{
            width: "100%",
            maxHeight: "90%",
            objectFit: "contain",
          }}
        />
      </AbsoluteFill>

      {/* Subtle vignette overlay */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Hook Overlay */}
      {showHook && hookOpacity > 0 && (
        <HookOverlay
          skillName={skillName}
          hook={hook}
          ccVersion={ccVersion}
          primaryColor={primaryColor}
          opacity={hookOpacity}
        />
      )}

      {/* Subtle gradient overlay at bottom for CTA */}
      {showCTA && ctaProgress > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(transparent 60%, rgba(0,0,0,0.8) 100%)`,
            opacity: ctaProgress,
          }}
        />
      )}

      {/* CTA Overlay */}
      {showCTA && ctaProgress > 0 && (
        <CTAOverlay
          ccVersion={ccVersion}
          primaryColor={primaryColor}
          progress={ctaProgress}
        />
      )}

      {/* OrchestKit watermark */}
      <Watermark />

      {/* Progress bar */}
      <ProgressBar progress={frame / durationInFrames} primaryColor={primaryColor} />
    </AbsoluteFill>
  );
};

const HookOverlay: React.FC<{
  skillName: string;
  hook: string;
  ccVersion: string;
  primaryColor: string;
  opacity: number;
}> = ({ skillName, hook, ccVersion, primaryColor, opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 80, stiffness: 300 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(10, 10, 15, 0.95)",
        opacity,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 8,
            fontFamily: "Menlo, monospace",
            letterSpacing: "0.1em",
          }}
        >
          {ccVersion} ALIGNED
        </div>
        <code
          style={{
            fontSize: 48,
            color: primaryColor,
            fontFamily: "Menlo, monospace",
            fontWeight: 700,
          }}
        >
          /{skillName}
        </code>
        <h1
          style={{
            fontSize: 56,
            color: "white",
            fontFamily: "Inter, system-ui",
            fontWeight: 700,
            marginTop: 16,
            maxWidth: 1000,
          }}
        >
          {hook}
        </h1>
      </div>
    </AbsoluteFill>
  );
};

const CTAOverlay: React.FC<{
  ccVersion: string;
  primaryColor: string;
  progress: number;
}> = ({ ccVersion, primaryColor, progress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Subtle pulse animation on the CTA button
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
      <div style={{ transform: `scale(${Math.min(1, scale) * pulse})`, textAlign: "center" }}>
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
            /plugin install ork
          </code>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
            fontFamily: "Menlo, monospace",
          }}
        >
          170 skills * 35 agents * {ccVersion}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Watermark: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: 0.6,
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: "#6b7280",
          fontFamily: "Menlo, monospace",
          fontWeight: 500,
        }}
      >
        OrchestKit
      </span>
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
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: "rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${primaryColor}, #6366f1)`,
        }}
      />
    </div>
  );
};
