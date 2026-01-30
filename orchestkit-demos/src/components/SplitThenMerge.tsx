/**
 * SplitThenMerge - Dramatic Demo Template
 *
 * Shows a single terminal that splits into 3, runs in parallel,
 * then merges back for a unified summary. Great for complex skills.
 *
 * Flow:
 * 1. Single terminal with skill invocation
 * 2. Dramatic split animation into 3 panels
 * 3. Parallel execution (like TriTerminalRace)
 * 4. Merge animation back to single view
 * 5. Summary with combined results
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

// Reuse schema
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

export const splitThenMergeSchema = z.object({
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

export type SplitThenMergeProps = z.infer<typeof splitThenMergeSchema>;

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

interface SplitPanelProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  progress: number;
  splitProgress: number; // 0 = merged, 1 = fully split
  position: "left" | "center" | "right";
  startFrame: number;
}

const SplitPanel: React.FC<SplitPanelProps> = ({
  level,
  config,
  skillCommand,
  progress,
  splitProgress,
  position,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // Calculate position based on split progress
  const panelWidth = interpolate(splitProgress, [0, 1], [width - 96, (width - 96) / 3 - 16]);

  const xOffset =
    position === "left"
      ? interpolate(splitProgress, [0, 1], [0, 0])
      : position === "center"
        ? interpolate(splitProgress, [0, 1], [0, panelWidth + 16])
        : interpolate(splitProgress, [0, 1], [0, (panelWidth + 16) * 2]);

  // Opacity animation
  const opacity =
    position === "center"
      ? 1
      : interpolate(splitProgress, [0.3, 0.7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // Scale for entrance
  const scale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 60, stiffness: 150 },
  });

  // Only show center panel when not split
  if (splitProgress < 0.3 && position !== "center") {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 48 + xOffset,
        top: 48,
        width: panelWidth,
        height: "calc(100% - 96px)",
        backgroundColor: "#0a0a0f",
        borderRadius: 12,
        border: `1px solid ${levelColor}33`,
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
          backgroundColor: "#1a1a2e",
          padding: "8px 12px",
          borderBottom: `1px solid ${levelColor}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{LEVEL_EMOJIS[level]}</span>
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
        {splitProgress > 0.5 && (
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 10,
              color: "#6b7280",
            }}
          >
            {config.description}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {/* Command */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 11,
            color: "#e2e8f0",
          }}
        >
          <span style={{ color: "#22c55e" }}>❯</span> {skillCommand}
        </div>

        {/* Show different content based on split progress */}
        {splitProgress > 0.5 && (
          <>
            <LiveFolderTree
              files={config.files as FileNode[]}
              primaryColor={levelColor}
              startFrame={startFrame + 20}
              showStats={false}
            />
            <CompactClaudeResponse
              lines={config.claudeResponse.slice(0, 4)}
              startFrame={startFrame + 30}
              primaryColor={levelColor}
            />
          </>
        )}
      </div>

      {/* Progress bar */}
      {splitProgress > 0.5 && (
        <CompactProgressBar
          progress={progress}
          phaseName={progress === 100 ? "Complete" : "Processing"}
          phaseNumber={Math.min(4, Math.floor(progress / 25) + 1)}
          totalPhases={4}
          primaryColor={levelColor}
        />
      )}
    </div>
  );
};

// Merged summary card
interface MergedSummaryProps {
  simple: z.infer<typeof levelConfigSchema>;
  medium: z.infer<typeof levelConfigSchema>;
  advanced: z.infer<typeof levelConfigSchema>;
  title: string;
  tagline: string;
  skillCommand: string;
  startFrame: number;
}

const MergedSummary: React.FC<MergedSummaryProps> = ({
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
        inset: 48,
        backgroundColor: "#0a0a0f",
        borderRadius: 16,
        padding: 32,
        border: "1px solid #2d2d4a",
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#f8fafc",
          marginBottom: 32,
        }}
      >
        {title}
      </div>

      {/* Comparison Grid */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 32,
        }}
      >
        {levels.map(({ level, config }, index) => {
          const itemDelay = startFrame + 10 + index * 8;
          const itemOpacity = interpolate(frame, [itemDelay, itemDelay + 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });

          return (
            <div
              key={level}
              style={{
                flex: 1,
                padding: 24,
                backgroundColor: `${LEVEL_COLORS[level]}10`,
                borderRadius: 12,
                border: `2px solid ${LEVEL_COLORS[level]}`,
                opacity: itemOpacity,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{LEVEL_EMOJIS[level]}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: LEVEL_COLORS[level],
                  }}
                >
                  {level.toUpperCase()}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                <div style={{ marginBottom: 8 }}>📁 {config.files.length} files</div>
                <div style={{ marginBottom: 8 }}>⏱️ {config.completionTime}</div>
                {Object.entries(config.metrics).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    ✓ {key}: <span style={{ color: LEVEL_COLORS[level] }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 20,
          color: "#94a3b8",
          marginBottom: 16,
        }}
      >
        🎯 {tagline}
      </div>

      {/* CTA */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 18,
          color: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          padding: "12px 24px",
          borderRadius: 8,
          border: "1px solid rgba(139, 92, 246, 0.3)",
        }}
      >
        Try it: {skillCommand}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SplitThenMerge: React.FC<SplitThenMergeProps> = ({
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

  // Timeline (20 seconds total)
  const hookDuration = fps * 2;
  const singleDuration = fps * 2; // Single terminal before split
  const splitAnimDuration = fps * 1; // Split animation
  const raceDuration = fps * 10; // Parallel execution
  const mergeAnimDuration = fps * 1; // Merge animation
  // summaryDuration = fps * 4 (used in total duration calculation)

  const singleStart = hookDuration;
  const splitStart = singleStart + singleDuration;
  const raceStart = splitStart + splitAnimDuration;
  const mergeStart = raceStart + raceDuration;
  const summaryStart = mergeStart + mergeAnimDuration;

  // Calculate split progress (0 = merged, 1 = fully split)
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

  const simpleProgress = Math.min(100, raceProgress * 1.4);
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
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}15 0%, transparent 50%)`,
        }}
      />

      {/* Hook Scene */}
      <Sequence from={0} durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#f8fafc",
              textAlign: "center",
              opacity: interpolate(frame, [0, 15], [0, 1]),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 24,
              color: primaryColor,
              opacity: interpolate(frame, [15, 30], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Split Panels - visible during single, split, race, and merge phases */}
      <Sequence from={singleStart} durationInFrames={mergeStart + mergeAnimDuration - singleStart}>
        <AbsoluteFill>
          <SplitPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            progress={simpleProgress}
            splitProgress={splitProgress}
            position="left"
            startFrame={0}
          />
          <SplitPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            progress={mediumProgress}
            splitProgress={splitProgress}
            position="center"
            startFrame={0}
          />
          <SplitPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            progress={advancedProgress}
            splitProgress={splitProgress}
            position="right"
            startFrame={0}
          />

          {/* Split message overlay */}
          {frame >= splitStart && frame < splitStart + splitAnimDuration && (
            <div
              style={{
                position: "absolute",
                bottom: 100,
                left: 0,
                right: 0,
                textAlign: "center",
                fontFamily: "Menlo, Monaco, monospace",
                fontSize: 16,
                color: primaryColor,
                opacity: interpolate(
                  frame - splitStart,
                  [0, 10, splitAnimDuration - 10, splitAnimDuration],
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
        <MergedSummary
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
          bottom: 16,
          right: 16,
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

export default SplitThenMerge;
