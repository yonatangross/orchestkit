import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";
import { getVideoMetadata } from "@remotion/media-utils";

/**
 * ShowcaseDemo - 30-second plugin command showcase
 *
 * Timeline:
 * 0-3s:   Hook overlay (title + stats)
 * 3-27s:  Terminal with command labels
 * 27-30s: CTA overlay
 */

export const showcaseDemoSchema = z.object({
  terminalVideo: z.string(),
  primaryColor: z.string().default("#8b5cf6"),
});

type ShowcaseDemoProps = z.infer<typeof showcaseDemoSchema>;

// Segments with timing (in seconds)
const SEGMENTS = [
  { start: 3, end: 7, command: "/explore", description: "Understand any codebase" },
  { start: 7, end: 11, command: "/implement", description: "Build features with agents" },
  { start: 11, end: 15, command: "/commit + /create-pr", description: "Ship with confidence" },
  { start: 15, end: 19, command: "/review-pr", description: "6 agents review your code" },
  { start: 19, end: 23, command: "/fix-issue", description: "Debug intelligently" },
  { start: 23, end: 27, command: "23 commands", description: "Infinite possibilities" },
];

export const calculateShowcaseMetadata = async ({
  props,
}: {
  props: ShowcaseDemoProps;
}) => {
  try {
    const metadata = await getVideoMetadata(staticFile(props.terminalVideo));
    return {
      durationInFrames: Math.ceil(metadata.durationInSeconds * 30),
      fps: 30,
      width: 1920,
      height: 1080,
    };
  } catch {
    return {
      durationInFrames: 900, // 30s default
      fps: 30,
      width: 1920,
      height: 1080,
    };
  }
};

export const ShowcaseDemo: React.FC<ShowcaseDemoProps> = ({
  terminalVideo,
  primaryColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Hook overlay (0-3s)
  const HOOK_END = 3;
  const hookOpacity = interpolate(
    currentTime,
    [0, 0.5, HOOK_END - 0.5, HOOK_END],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // CTA overlay (last 3s)
  const CTA_START = (durationInFrames / fps) - 3;
  const ctaOpacity = interpolate(
    currentTime,
    [CTA_START, CTA_START + 0.5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Current segment
  const currentSegment = SEGMENTS.find(
    (s) => currentTime >= s.start && currentTime < s.end
  );

  // Segment label opacity
  const getSegmentOpacity = (segment: typeof SEGMENTS[0]) => {
    return interpolate(
      currentTime,
      [segment.start, segment.start + 0.3, segment.end - 0.3, segment.end],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  };

  // Spring for hook
  const hookScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Progress
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Layer 0: Terminal Video */}
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

      {/* Layer 1: Hook Overlay (0-3s) */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: hookOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            padding: "40px 60px",
            backgroundColor: "rgba(10, 10, 20, 0.95)",
            borderRadius: 24,
            border: `1px solid ${primaryColor}40`,
            boxShadow: `0 30px 100px rgba(0,0,0,0.7), 0 0 80px ${primaryColor}20`,
            transform: `scale(${hookScale})`,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "#6b7280",
              fontFamily: "Menlo, monospace",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Claude Code Plugin
          </span>

          <h1
            style={{
              fontSize: 56,
              color: "white",
              fontFamily: "Inter, system-ui",
              fontWeight: 700,
              margin: 0,
              background: `linear-gradient(135deg, ${primaryColor}, #6366f1)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            OrchestKit
          </h1>

          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 8,
            }}
          >
            {[
              { value: "23", label: "commands" },
              { value: "169", label: "skills" },
              { value: "35", label: "agents" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  opacity: interpolate(
                    frame,
                    [15 + i * 5, 25 + i * 5],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  ),
                }}
              >
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: primaryColor,
                    fontFamily: "Menlo, monospace",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: 14,
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

      {/* Layer 2: Command Labels (during segments) - BOTTOM LEFT */}
      {currentSegment && currentTime < CTA_START && (
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 40,
            opacity: getSegmentOpacity(currentSegment),
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 20px",
            backgroundColor: "rgba(10, 10, 20, 0.95)",
            borderRadius: 10,
            borderLeft: `3px solid ${primaryColor}`,
          }}
        >
          <code
            style={{
              fontSize: 20,
              color: primaryColor,
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
            }}
          >
            {currentSegment.command}
          </code>
          <span
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Inter, system-ui",
            }}
          >
            {currentSegment.description}
          </span>
        </div>
      )}

      {/* Layer 3: CTA Overlay (last 3s) */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: ctaOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            padding: "48px 72px",
            backgroundColor: "rgba(10, 10, 20, 0.98)",
            borderRadius: 24,
            border: `1px solid ${primaryColor}50`,
            boxShadow: `0 40px 120px rgba(0,0,0,0.8), 0 0 100px ${primaryColor}30`,
          }}
        >
          <code
            style={{
              fontSize: 36,
              color: "white",
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
              padding: "16px 32px",
              background: `linear-gradient(135deg, ${primaryColor} 0%, #6366f1 100%)`,
              borderRadius: 12,
              boxShadow: `0 12px 40px ${primaryColor}50`,
            }}
          >
            /plugin install ork
          </code>
          <span
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.8)",
              fontFamily: "Inter, system-ui",
            }}
          >
            Start building smarter.
          </span>
        </div>
      </AbsoluteFill>

      {/* Layer 4: Watermark */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 30,
          opacity: hookOpacity < 0.5 && ctaOpacity < 0.5 ? 0.4 : 0,
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

      {/* Layer 5: Progress Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
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
