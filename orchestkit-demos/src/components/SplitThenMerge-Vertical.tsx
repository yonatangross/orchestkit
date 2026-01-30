/**
 * SplitThenMerge - Vertical 9:16 Variant
 *
 * Dramatic split/merge effect adapted for portrait orientation
 * Panels expand/contract vertically instead of horizontally
 *
 * Format adjustments:
 * - TikTok: 20-40 cuts/min → Faster transitions
 * - Panels stack vertically for split effect
 * - Compact merge animation for mobile
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
} from "remotion";
import {
  LiveFolderTree,
  CompactProgressBar,
  CompactClaudeResponse,
} from "./shared";
import type { FileNode, DifficultyLevel } from "./shared";

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

export const splitThenMergeVerticalSchema = z.object({
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
});

export type SplitThenMergeVerticalProps = z.infer<
  typeof splitThenMergeVerticalSchema
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

interface VerticalSplitPanelProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  progress: number;
  splitProgress: number;
  position: "top" | "center" | "bottom";
  startFrame: number;
}

const VerticalSplitPanel: React.FC<VerticalSplitPanelProps> = ({
  level,
  config,
  skillCommand,
  progress,
  splitProgress,
  position,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // Calculate height based on split progress
  const panelHeight = interpolate(splitProgress, [0, 1], [height - 96, (height - 96) / 3 - 12]);

  const yOffset =
    position === "top"
      ? interpolate(splitProgress, [0, 1], [0, 0])
      : position === "center"
        ? interpolate(splitProgress, [0, 1], [0, panelHeight + 12])
        : interpolate(splitProgress, [0, 1], [0, (panelHeight + 12) * 2]);

  const opacity =
    position === "center"
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

  if (splitProgress < 0.3 && position !== "center") {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        top: 48 + yOffset,
        right: 12,
        height: panelHeight,
        backgroundColor: "#0a0a0f",
        borderRadius: 8,
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
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 10 }}>{LEVEL_EMOJIS[level]}</span>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            color: levelColor,
          }}
        >
          {level.toUpperCase()}
        </span>
        {splitProgress > 0.5 && (
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 8,
              color: "#6b7280",
              marginLeft: "auto",
            }}
          >
            {config.description.slice(0, 15)}...
          </span>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflow: "hidden",
          fontSize: 8,
        }}
      >
        {/* Command */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 8,
            color: "#e2e8f0",
          }}
        >
          ❯ {skillCommand}
        </div>

        {/* Show different content based on split progress */}
        {splitProgress > 0.5 && (
          <>
            <LiveFolderTree
              files={config.files.slice(0, 2) as FileNode[]}
              primaryColor={levelColor}
              startFrame={startFrame + 15}
              showStats={false}
            />
            <CompactClaudeResponse
              lines={config.claudeResponse.slice(0, 2)}
              startFrame={startFrame + 20}
              primaryColor={levelColor}
            />
          </>
        )}
      </div>

      {/* Progress bar */}
      {splitProgress > 0.5 && (
        <CompactProgressBar
          progress={progress}
          phaseName="..."
          phaseNumber={Math.min(3, Math.floor(progress / 25) + 1)}
          totalPhases={3}
          primaryColor={levelColor}
        />
      )}
    </div>
  );
};

// Merged summary card
interface VerticalMergedSummaryProps {
  simple: z.infer<typeof levelConfigSchema>;
  medium: z.infer<typeof levelConfigSchema>;
  advanced: z.infer<typeof levelConfigSchema>;
  title: string;
  tagline: string;
  skillCommand: string;
  startFrame: number;
}

const VerticalMergedSummary: React.FC<VerticalMergedSummaryProps> = ({
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

  const opacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
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
        inset: 20,
        backgroundColor: "#0a0a0f",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #2d2d4a",
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#f8fafc",
        }}
      >
        {title}
      </div>

      {/* Comparison - Stacked vertically for vertical format */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
        }}
      >
        {levels.map(({ level, config }, index) => {
          const itemDelay = startFrame + 8 + index * 6;
          const itemOpacity = interpolate(
            frame,
            [itemDelay, itemDelay + 12],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={level}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: `${LEVEL_COLORS[level]}10`,
                borderRadius: 8,
                border: `1px solid ${LEVEL_COLORS[level]}`,
                opacity: itemOpacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>{LEVEL_EMOJIS[level]}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: LEVEL_COLORS[level],
                    fontSize: 11,
                  }}
                >
                  {level.toUpperCase()}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 10,
                  color: "#94a3b8",
                  display: "flex",
                  gap: 10,
                }}
              >
                <span>📁 {config.files.length}</span>
                <span>⏱️ {config.completionTime}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 12,
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
          fontSize: 10,
          color: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid rgba(139, 92, 246, 0.3)",
          textAlign: "center",
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

export const SplitThenMergeVertical: React.FC<
  SplitThenMergeVerticalProps
> = ({
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
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adjusted timeline for vertical format
  const hookDuration = fps * 1;
  const singleDuration = fps * 1;
  const splitAnimDuration = fps * 0.8;
  const raceDuration = fps * 8;
  const mergeAnimDuration = fps * 0.8;

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
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}15 0%, transparent 70%)`,
        }}
      />

      {/* Hook Scene */}
      <Sequence durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#f8fafc",
              textAlign: "center",
              opacity: interpolate(frame, [0, 10], [0, 1]),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 16,
              color: primaryColor,
              opacity: interpolate(frame, [10, 15], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Split Panels */}
      <Sequence from={singleStart} durationInFrames={mergeStart + mergeAnimDuration - singleStart}>
        <AbsoluteFill>
          <VerticalSplitPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            progress={simpleProgress}
            splitProgress={splitProgress}
            position="top"
            startFrame={0}
          />
          <VerticalSplitPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            progress={mediumProgress}
            splitProgress={splitProgress}
            position="center"
            startFrame={0}
          />
          <VerticalSplitPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            progress={advancedProgress}
            splitProgress={splitProgress}
            position="bottom"
            startFrame={0}
          />

          {/* Split message */}
          {frame >= splitStart && frame < splitStart + splitAnimDuration && (
            <div
              style={{
                position: "absolute",
                bottom: 80,
                left: 0,
                right: 0,
                textAlign: "center",
                fontFamily: "Menlo, Monaco, monospace",
                fontSize: 12,
                color: primaryColor,
                opacity: interpolate(
                  frame - splitStart,
                  [0, 5, splitAnimDuration - 5, splitAnimDuration],
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
        <VerticalMergedSummary
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
          bottom: 8,
          right: 8,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 8,
          color: "#4b5563",
        }}
      >
        OrchestKit
      </div>
    </AbsoluteFill>
  );
};

export default SplitThenMergeVertical;
