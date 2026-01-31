/**
 * TriTerminalRace - Square 1:1 Variant
 *
 * Square layout for LinkedIn/Instagram (1:1 aspect ratio)
 * Adapted grid layout for square viewport
 * Optimized for feed sharing with bold typography
 *
 * Format adjustments from video-pacing:
 * - LinkedIn: 5-10 cuts/min, 6-12s shots, 3s hook → Slower, detailed
 * - Instagram: Mixed between TikTok/Reels speeds → Balanced
 * - Focus on metrics and completion summary
 */

import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  staticFile,
} from "remotion";
import type { DifficultyLevel } from "./shared";

// Reuse same schema
const levelConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputCount: z.number(),
  files: z.array(z.any()),
  references: z.array(z.any()),
  claudeResponse: z.array(z.string()),
  codeSnippet: z.string().optional(),
  completionTime: z.string(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const triTerminalRaceSquareSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#22c55e"),
  accentColor: z.string().default("#f59e0b"),

  simple: levelConfigSchema,
  medium: levelConfigSchema,
  advanced: levelConfigSchema,

  phases: z.array(
    z.object({
      name: z.string(),
      shortName: z.string().optional(),
    })
  ),

  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.1),

  summaryTitle: z.string().default("📊 RESULTS"),
  summaryTagline: z.string().default("Same skill. Any scale."),
});

export type TriTerminalRaceSquareProps = z.infer<
  typeof triTerminalRaceSquareSchema
>;

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface SquareTerminalPanelProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  progress: number;
  startFrame: number;
}

const SquareTerminalPanel: React.FC<SquareTerminalPanelProps> = ({
  level,
  config,
  skillCommand,
  progress,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // Panel entry animation
  const panelOpacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const panelScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 60, stiffness: 150 },
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0f",
        borderRadius: 12,
        overflow: "hidden",
        border: `2px solid ${levelColor}`,
        opacity: panelOpacity,
        transform: `scale(${panelScale})`,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: `${levelColor}20`,
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: levelColor,
          }}
        >
          {level.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 10,
            color: "#94a3b8",
          }}
        >
          {config.description.slice(0, 20)}...
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontSize: 10,
        }}
      >
        {/* Metrics highlight */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              backgroundColor: `${levelColor}15`,
              padding: 8,
              borderRadius: 6,
              border: `1px solid ${levelColor}40`,
              textAlign: "center",
            }}
          >
            <div style={{ color: levelColor, fontWeight: 700, fontSize: 14 }}>
              {config.files.length}
            </div>
            <div style={{ color: "#6b7280", fontSize: 9 }}>Files</div>
          </div>
          <div
            style={{
              backgroundColor: `${levelColor}15`,
              padding: 8,
              borderRadius: 6,
              border: `1px solid ${levelColor}40`,
              textAlign: "center",
            }}
          >
            <div style={{ color: levelColor, fontWeight: 700, fontSize: 14 }}>
              {config.completionTime}
            </div>
            <div style={{ color: "#6b7280", fontSize: 9 }}>Time</div>
          </div>
        </div>

        {/* Command */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 9,
            color: "#94a3b8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          ❯ {skillCommand}
        </div>

        {/* Response snippet (minimal) */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 8,
            color: "#6b7280",
            maxHeight: 40,
            overflow: "hidden",
          }}
        >
          {config.claudeResponse.slice(0, 1).join("\n")}
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: "auto",
            height: 4,
            backgroundColor: "#1a1a2e",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: levelColor,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Summary Card Component (square optimized)
interface SquareSummaryCardProps {
  simple: z.infer<typeof levelConfigSchema>;
  medium: z.infer<typeof levelConfigSchema>;
  advanced: z.infer<typeof levelConfigSchema>;
  title: string;
  tagline: string;
  skillCommand: string;
  startFrame: number;
}

const SquareSummaryCard: React.FC<SquareSummaryCardProps> = ({
  simple,
  medium,
  advanced,
  title,
  tagline,
  skillCommand,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardOpacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const cardScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 50, stiffness: 120 },
  });

  const levels = [
    { config: simple, level: "simple" as const, color: "#22c55e", emoji: "🟢" },
    { config: medium, level: "medium" as const, color: "#f59e0b", emoji: "🟡" },
    {
      config: advanced,
      level: "advanced" as const,
      color: "#8b5cf6",
      emoji: "🟣",
    },
  ];

  return (
    <div
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.98)",
        borderRadius: 16,
        padding: 24,
        border: "2px solid #2d2d4a",
        opacity: cardOpacity,
        transform: `scale(${cardScale})`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Title - Large and bold for LinkedIn */}
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 700,
          color: "#f8fafc",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        {title}
      </div>

      {/* Level cards - 3x1 grid in square format */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 20,
          flex: 1,
        }}
      >
        {levels.map(({ config, level, color, emoji }, index) => {
          const cardDelay = startFrame + 10 + index * 8;
          const itemOpacity = interpolate(
            frame,
            [cardDelay, cardDelay + 15],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={level}
              style={{
                backgroundColor: `${color}10`,
                borderRadius: 12,
                padding: 16,
                border: `2px solid ${color}`,
                opacity: itemOpacity,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Level header with emoji */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>{emoji}</span>
                <span
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color,
                    textAlign: "center",
                  }}
                >
                  {level.toUpperCase()}
                </span>
              </div>

              {/* Metrics */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                <div>
                  <div style={{ color, fontWeight: 700, fontSize: 16 }}>
                    {config.files.length}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 9 }}>Files</div>
                </div>
                <div>
                  <div style={{ color, fontWeight: 700 }}>
                    {config.completionTime}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 9 }}>Time</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 16,
          color: "#94a3b8",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        🎯 {tagline}
      </div>

      {/* CTA - Bold for LinkedIn */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 12,
          color: "#8b5cf6",
          textAlign: "center",
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          padding: "12px 16px",
          borderRadius: 8,
          border: "2px solid rgba(139, 92, 246, 0.5)",
          fontWeight: 600,
        }}
      >
        Try: {skillCommand}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TriTerminalRaceSquare: React.FC<TriTerminalRaceSquareProps> = ({
  skillName,
  skillCommand,
  hook,
  primaryColor,
  simple,
  medium,
  advanced,
  phases,
  backgroundMusic,
  musicVolume,
  summaryTitle,
  summaryTagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adjusted timeline for square format - LinkedIn pace (slower, more detailed)
  const hookDuration = fps * 2; // 2 second hook (LinkedIn prefers longer intro)
  const raceDuration = fps * 14; // 14 seconds race
  const summaryStart = hookDuration + raceDuration;

  // Progress calculations
  const raceProgress = Math.min(
    100,
    ((frame - hookDuration) / raceDuration) * 100
  );
  const simpleProgress = Math.min(100, raceProgress * 1.3);
  const mediumProgress = Math.min(100, raceProgress * 1.0);
  const advancedProgress = Math.min(100, raceProgress * 0.7);

  void phases.length; // Used for raceProgress calculation

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${primaryColor}15 0%, transparent 70%)`,
        }}
      />

      {/* Audio */}
      {backgroundMusic && (
        <Audio src={staticFile(backgroundMusic)} volume={musicVolume} />
      )}

      {/* Hook Scene */}
      <Sequence durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 42,
              fontWeight: 700,
              color: "#f8fafc",
              textAlign: "center",
              opacity: interpolate(frame, [0, 20], [0, 1]),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 20,
              color: primaryColor,
              opacity: interpolate(frame, [20, 40], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Race Scene - 3 Panels in Grid */}
      <Sequence from={hookDuration} durationInFrames={raceDuration}>
        <AbsoluteFill
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "1fr",
            gridTemplateRows: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <SquareTerminalPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            progress={simpleProgress}
            startFrame={0}
          />
          <SquareTerminalPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            progress={mediumProgress}
            startFrame={5}
          />
          <SquareTerminalPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            progress={advancedProgress}
            startFrame={10}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Summary Scene */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <SquareSummaryCard
            simple={simple}
            medium={medium}
            advanced={advanced}
            title={summaryTitle}
            tagline={summaryTagline}
            skillCommand={skillCommand}
            startFrame={0}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 10,
          color: "#4b5563",
        }}
      >
        OrchestKit Demo
      </div>
    </AbsoluteFill>
  );
};

export default TriTerminalRaceSquare;
