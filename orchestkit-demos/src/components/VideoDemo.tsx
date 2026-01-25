import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { z } from "zod";
import { getVideoMetadata } from "@remotion/media-utils";

/**
 * VideoDemo - Terminal-first 10-second demo component
 *
 * Design Philosophy:
 * - Terminal is the HERO - never obscured, always center stage
 * - Overlays FRAME the terminal (top bar + bottom bar)
 * - Subtle glass morphism for professional look
 * - Video-driven duration via calculateMetadata
 *
 * Timeline (10s example):
 * ┌────────────────────────────────────────┐
 * │ TOP BAR: Skill name + hook (0-3s)      │
 * ├────────────────────────────────────────┤
 * │                                        │
 * │         TERMINAL VIDEO (0-10s)         │
 * │         Always visible, hero           │
 * │                                        │
 * ├────────────────────────────────────────┤
 * │ BOTTOM BAR: Results → CTA (7-10s)      │
 * └────────────────────────────────────────┘
 */

export const videoDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  terminalVideo: z.string(),
  problemPoints: z.array(z.string()).default([
    "Manual processes slow you down",
    "Context switching kills productivity",
  ]),
  results: z.object({
    before: z.string(),
    after: z.string(),
  }).default({
    before: "Hours of manual work",
    after: "Minutes with OrchestKit",
  }),
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    color: z.string().optional(),
  })).default([
    { value: "169", label: "skills", color: "#8b5cf6" },
    { value: "35", label: "agents", color: "#22c55e" },
    { value: "148", label: "hooks", color: "#f59e0b" },
  ]),
  cta: z.string().default("/plugin install ork"),
  primaryColor: z.string().default("#8b5cf6"),
  ccVersion: z.string().default("CC 2.1.16"),
});

type VideoDemoProps = z.infer<typeof videoDemoSchema>;

// Calculate duration from video file (video is source of truth)
export const calculateVideoDemoMetadata = async ({
  props,
}: {
  props: VideoDemoProps;
}) => {
  try {
    const metadata = await getVideoMetadata(staticFile(props.terminalVideo));
    // Video duration IS the composition duration (overlays happen DURING video)
    return {
      durationInFrames: Math.ceil(metadata.durationInSeconds * 30),
      fps: 30,
      width: 1920,
      height: 1080,
    };
  } catch {
    // Fallback to default duration if video metadata unavailable
    return {
      durationInFrames: 300, // 10s default
      fps: 30,
      width: 1920,
      height: 1080,
    };
  }
};

export const VideoDemo: React.FC<VideoDemoProps> = ({
  skillName,
  hook,
  terminalVideo,
  results,
  stats,
  cta,
  primaryColor,
  ccVersion,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Timeline for ~8-10s video:
  // FLOATING PANEL: 0-120 frames (0-4s) - slides in from right, holds, fades
  // STATS COUNTERS: Stagger in 30-90 frames on the left side
  // BOTTOM BAR: Last 3s - results then CTA
  const PANEL_IN = 0;
  const PANEL_VISIBLE = 20;
  const PANEL_OUT = 100;
  const PANEL_GONE = 120;

  const BOTTOM_BAR_IN = durationInFrames - 90;
  const BOTTOM_BAR_VISIBLE = BOTTOM_BAR_IN + 15;
  const CTA_SWAP = durationInFrames - 45;

  // Intro overlay opacity (fades in, holds, fades out)
  const panelOpacity = interpolate(
    frame,
    [PANEL_IN, PANEL_VISIBLE, PANEL_OUT, PANEL_GONE],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Bottom bar slide animation
  const bottomBarY = interpolate(
    frame,
    [BOTTOM_BAR_IN, BOTTOM_BAR_VISIBLE],
    [60, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const bottomBarOpacity = interpolate(
    frame,
    [BOTTOM_BAR_IN, BOTTOM_BAR_VISIBLE],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Results → CTA transition
  const showCTA = frame >= CTA_SWAP;
  const resultsOpacity = interpolate(
    frame,
    [CTA_SWAP - 10, CTA_SWAP],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ctaOpacity = interpolate(
    frame,
    [CTA_SWAP, CTA_SWAP + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Progress bar
  const progress = frame / durationInFrames;

  // Spring animation for skill badge
  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Layer 0: Terminal Video - FULL SCREEN HERO */}
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(terminalVideo)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </AbsoluteFill>

      {/* Layer 1: INTRO OVERLAY - Center, fades with video start */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: panelOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: "32px 48px",
            backgroundColor: "rgba(10, 10, 20, 0.92)",
            borderRadius: 20,
            border: `1px solid ${primaryColor}40`,
            boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${primaryColor}20`,
            backdropFilter: "blur(16px)",
            transform: `scale(${badgeScale})`,
          }}
        >
          {/* Version badge */}
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontFamily: "Menlo, monospace",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            {ccVersion}
          </span>

          {/* Skill name with glow */}
          <code
            style={{
              fontSize: 36,
              color: primaryColor,
              fontFamily: "Menlo, monospace",
              fontWeight: 700,
              textShadow: `0 0 40px ${primaryColor}60`,
            }}
          >
            /{skillName}
          </code>

          {/* Hook text */}
          <span
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "Inter, system-ui",
              fontWeight: 500,
            }}
          >
            {hook}
          </span>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 8,
            }}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  opacity: interpolate(
                    frame,
                    [15 + i * 8, 25 + i * 8],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  ),
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: stat.color || primaryColor,
                    fontFamily: "Menlo, monospace",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    fontFamily: "Inter, system-ui",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>

      {/* Layer 2: BOTTOM BAR - Results then CTA (end of video) */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: 0,
          right: 0,
          transform: `translateY(${bottomBarY}px)`,
          opacity: bottomBarOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 40px",
          background: "linear-gradient(0deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.85) 60%, transparent 100%)",
        }}
      >
        {/* Results (fades out) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: resultsOpacity,
            position: showCTA ? "absolute" : "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, color: "#ef4444" }}>✗</span>
            <span style={{ fontSize: 17, color: "#9ca3af", fontFamily: "Inter, system-ui" }}>
              {results.before}
            </span>
          </div>

          <span style={{ fontSize: 22, color: "#22c55e" }}>→</span>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, color: "#22c55e" }}>✓</span>
            <span style={{ fontSize: 17, color: "#22c55e", fontFamily: "Inter, system-ui", fontWeight: 600 }}>
              {results.after}
            </span>
          </div>
        </div>

        {/* CTA (fades in) */}
        <div
          style={{
            opacity: ctaOpacity,
            padding: "12px 32px",
            background: `linear-gradient(135deg, ${primaryColor} 0%, #6366f1 100%)`,
            borderRadius: 12,
            boxShadow: `0 12px 40px ${primaryColor}50`,
            position: showCTA ? "relative" : "absolute",
          }}
        >
          <code
            style={{
              fontSize: 20,
              color: "white",
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
            }}
          >
            {cta}
          </code>
        </div>
      </div>

      {/* Layer 3: Watermark - top right, visible when overlay gone */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 24,
          opacity: interpolate(frame, [PANEL_GONE, PANEL_GONE + 15], [0, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Menlo, monospace",
          }}
        >
          OrchestKit
        </span>
      </div>

      {/* Layer 4: Progress Bar */}
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
    </AbsoluteFill>
  );
};
