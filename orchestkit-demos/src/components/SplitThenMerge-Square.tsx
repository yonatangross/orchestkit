/**
 * SplitThenMerge - Square 1:1 Variant
 *
 * Split/merge animation adapted for LinkedIn/Instagram square format
 * 2x2 grid layout that reconfigures during split/merge
 *
 * Format adjustments:
 * - LinkedIn: 5-10 cuts/min, 6-12s shots → Slower splits, bold typography
 * - Grid-based layout for balanced composition
 * - Larger summary metrics for feed impact
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

export const splitThenMergeSquareSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  splitMessage: z.string().default("Spawning 3 parallel scenarios..."),
  primaryColor: z.string().default("#8b5cf6"),

  simple: levelConfigSchema,
  medium: levelConfigSchema,
  advanced: levelConfigSchema,

  summaryTitle: z.string().default("📊 RESULTS"),
  summaryTagline: z.string(),

  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.1),
});

export type SplitThenMergeSquareProps = z.infer<
  typeof splitThenMergeSquareSchema
>;

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

const LEVEL_EMOJIS: Record<DifficultyLevel, string> = {
  simple: "🟢",
  medium: "🟡",
  advanced: "🟣",
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface SquareSplitPanelProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  progress: number;
  splitProgress: number;
  gridPosition: "tl" | "tr" | "bl" | "br" | "center";
  startFrame: number;
}

const SquareSplitPanel: React.FC<SquareSplitPanelProps> = ({
  level,
  config,
  skillCommand,
  progress,
  splitProgress,
  gridPosition,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // In merged state, only show center; in split state, show all
  if (splitProgress < 0.3 && gridPosition !== "center") {
    return null;
  }

  // Calculate position and size
  const panelSize = interpolate(splitProgress, [0, 1], [width - 96, (width - 96) / 2 - 24]);
  const gapSize = 12;

  let left = 48;
  let top = 48;

  if (splitProgress > 0.3) {
    switch (gridPosition) {
      case "tl":
        left = 48;
        top = 48;
        break;
      case "tr":
        left = 48 + panelSize + gapSize;
        top = 48;
        break;
      case "bl":
        left = 48;
        top = 48 + panelSize + gapSize;
        break;
      case "br":
        left = 48 + panelSize + gapSize;
        top = 48 + panelSize + gapSize;
        break;
      case "center":
        left = 48;
        top = 48;
        break;
    }
  }

  const opacity =
    gridPosition === "center"
      ? 1
      : interpolate(splitProgress, [0.3, 0.7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const scale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 60, stiffness: 150 },
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: panelSize,
        height: panelSize,
        backgroundColor: "#0a0a0f",
        borderRadius: 12,
        border: `2px solid ${levelColor}`,
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: `${levelColor}20`,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>{LEVEL_EMOJIS[level]}</span>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: levelColor,
          }}
        >
          {level.toUpperCase()}
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
          overflow: "hidden",
        }}
      >
        {/* Metrics highlight */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          <MetricMini
            icon="📁"
            value={config.files.length.toString()}
            label="Files"
            color={levelColor}
          />
          <MetricMini
            icon="⏱️"
            value={config.completionTime}
            label="Time"
            color={levelColor}
          />
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

        {/* Progress */}
        <div
          style={{
            height: 3,
            backgroundColor: "#1a1a2e",
            borderRadius: 2,
            overflow: "hidden",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: levelColor,
              transition: "width 0.2s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const MetricMini: React.FC<{
  icon: string;
  value: string;
  label: string;
  color: string;
}> = ({ icon, value, label, color }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 6,
      backgroundColor: `${color}15`,
      borderRadius: 6,
      border: `1px solid ${color}30`,
      gap: 2,
    }}
  >
    <span style={{ fontSize: 11 }}>{icon}</span>
    <span
      style={{
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 10,
        fontWeight: 600,
        color,
      }}
    >
      {value}
    </span>
    <span style={{ fontSize: 8, color: "#6b7280" }}>{label}</span>
  </div>
);

// Merged summary card
interface SquareMergedSummaryProps {
  simple: z.infer<typeof levelConfigSchema>;
  medium: z.infer<typeof levelConfigSchema>;
  advanced: z.infer<typeof levelConfigSchema>;
  title: string;
  tagline: string;
  skillCommand: string;
  startFrame: number;
}

const SquareMergedSummary: React.FC<SquareMergedSummaryProps> = ({
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

  const opacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const scale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 40, stiffness: 100 },
  });

  const levels = [
    { level: "simple" as const, config: simple },
    { level: "medium" as const, config: medium },
    { level: "advanced" as const, config: advanced },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 24,
        backgroundColor: "#0a0a0f",
        borderRadius: 16,
        padding: 28,
        border: "2px solid #2d2d4a",
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#f8fafc",
        }}
      >
        {title}
      </div>

      {/* 3x1 Comparison Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          width: "100%",
        }}
      >
        {levels.map(({ level, config }, index) => {
          const itemDelay = startFrame + 10 + index * 8;
          const itemOpacity = interpolate(
            frame,
            [itemDelay, itemDelay + 15],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={level}
              style={{
                padding: 16,
                backgroundColor: `${LEVEL_COLORS[level]}10`,
                borderRadius: 10,
                border: `2px solid ${LEVEL_COLORS[level]}`,
                opacity: itemOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 24 }}>{LEVEL_EMOJIS[level]}</span>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: LEVEL_COLORS[level],
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  {level.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span>📁 {config.files.length} files</span>
                  <span>⏱️ {config.completionTime}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 16,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        🎯 {tagline}
      </div>

      {/* CTA */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 12,
          color: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.15)",
          padding: "10px 16px",
          borderRadius: 8,
          border: "2px solid rgba(139, 92, 246, 0.4)",
          textAlign: "center",
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

export const SplitThenMergeSquare: React.FC<SplitThenMergeSquareProps> = ({
  skillName,
  skillCommand,
  hook,
  splitMessage,
  primaryColor,
  simple,
  medium,
  advanced,
  summaryTitle,
  summaryTagline,
  backgroundMusic,
  musicVolume,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adjusted timeline for square format - LinkedIn pacing (slower)
  const hookDuration = fps * 2;
  const singleDuration = fps * 2;
  const splitAnimDuration = fps * 1;
  const raceDuration = fps * 12;
  const mergeAnimDuration = fps * 1;

  const singleStart = hookDuration;
  const splitStart = singleStart + singleDuration;
  const raceStart = splitStart + splitAnimDuration;
  const mergeStart = raceStart + raceDuration;
  const summaryStart = mergeStart + mergeAnimDuration;

  // Split progress
  const splitProgress =
    frame < splitStart
      ? 0
      : frame < splitStart + splitAnimDuration
        ? interpolate(frame, [splitStart, splitStart + splitAnimDuration], [0, 1])
        : frame < mergeStart
          ? 1
          : frame < mergeStart + mergeAnimDuration
            ? interpolate(frame, [mergeStart, mergeStart + mergeAnimDuration], [1, 0])
            : 0;

  // Race progress
  const raceProgress = Math.min(
    100,
    Math.max(0, ((frame - raceStart) / raceDuration) * 100)
  );

  const simpleProgress = Math.min(100, raceProgress * 1.3);
  const mediumProgress = Math.min(100, raceProgress * 1.0);
  const advancedProgress = Math.min(100, raceProgress * 0.75);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Background */}
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
              fontSize: 44,
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
              fontSize: 22,
              color: primaryColor,
              opacity: interpolate(frame, [20, 40], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Split Panels */}
      <Sequence from={singleStart} durationInFrames={mergeStart + mergeAnimDuration - singleStart}>
        <AbsoluteFill>
          <SquareSplitPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            progress={simpleProgress}
            splitProgress={splitProgress}
            gridPosition="bl"
            startFrame={0}
          />
          <SquareSplitPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            progress={mediumProgress}
            splitProgress={splitProgress}
            gridPosition="center"
            startFrame={0}
          />
          <SquareSplitPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            progress={advancedProgress}
            splitProgress={splitProgress}
            gridPosition="tr"
            startFrame={0}
          />

          {/* Split message */}
          {frame >= splitStart && frame < splitStart + splitAnimDuration && (
            <div
              style={{
                position: "absolute",
                bottom: 120,
                left: 0,
                right: 0,
                textAlign: "center",
                fontFamily: "Menlo, Monaco, monospace",
                fontSize: 16,
                color: primaryColor,
                opacity: interpolate(
                  frame - splitStart,
                  [0, 8, splitAnimDuration - 8, splitAnimDuration],
                  [0, 1, 1, 0]
                ),
              }}
            >
              {splitMessage}
            </div>
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Summary Scene */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <SquareMergedSummary
          simple={simple}
          medium={medium}
          advanced={advanced}
          title={summaryTitle}
          tagline={summaryTagline}
          skillCommand={skillCommand}
          startFrame={0}
        />
      </Sequence>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 11,
          color: "#4b5563",
        }}
      >
        OrchestKit Demo
      </div>
    </AbsoluteFill>
  );
};

export default SplitThenMergeSquare;
