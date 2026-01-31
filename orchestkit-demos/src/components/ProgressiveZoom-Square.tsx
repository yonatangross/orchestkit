/**
 * ProgressiveZoom - Square 1:1 Variant
 *
 * Tutorial-style for LinkedIn/Instagram square format
 * Slower pacing, detailed metrics display
 *
 * Format adjustments:
 * - LinkedIn: 5-10 cuts/min, 6-12s shots → Slower, more detailed
 * - Bold typography for feed thumbnails
 * - Side-by-side comparison in square grid
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

export const progressiveZoomSquareSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  primaryColor: z.string().default("#8b5cf6"),

  simple: levelConfigSchema,
  medium: levelConfigSchema,
  advanced: levelConfigSchema,

  summaryTitle: z.string().default("📊 RESULTS"),
  summaryTagline: z.string(),
});

export type ProgressiveZoomSquareProps = z.infer<
  typeof progressiveZoomSquareSchema
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

interface SquareLevelDetailProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  startFrame: number;
}

const SquareLevelDetail: React.FC<SquareLevelDetailProps> = ({
  level,
  config,
  skillCommand,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  const containerOpacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const containerScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 50, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 32,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        gap: 20,
        justifyContent: "center",
      }}
    >
      {/* Large level header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 36 }}>{LEVEL_EMOJIS[level]}</div>
        <div>
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 36,
              fontWeight: 700,
              color: levelColor,
            }}
          >
            {level.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 14,
              color: "#94a3b8",
            }}
          >
            {skillCommand}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          flex: 1,
        }}
      >
        {/* Left: Folder tree */}
        <div>
          <LiveFolderTree
            files={config.files.slice(0, 4) as FileNode[]}
            primaryColor={levelColor}
            startFrame={startFrame + 10}
          />
        </div>

        {/* Right: Metrics and response */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Metrics boxes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <MetricBox
              icon="⏱️"
              label="Time"
              value={config.completionTime}
              color={levelColor}
            />
            <MetricBox
              icon="📁"
              label="Files"
              value={config.files.length.toString()}
              color={levelColor}
            />
          </div>

          {/* Response snippet */}
          <CompactClaudeResponse
            lines={config.claudeResponse.slice(0, 2)}
            startFrame={startFrame + 15}
            primaryColor={levelColor}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MetricBox: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 12,
      backgroundColor: `${color}15`,
      borderRadius: 10,
      border: `2px solid ${color}40`,
      gap: 8,
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span
      style={{
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 16,
        fontWeight: 700,
        color,
      }}
    >
      {value}
    </span>
    <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressiveZoomSquare: React.FC<ProgressiveZoomSquareProps> = ({
  skillName,
  skillCommand,
  hook,
  primaryColor,
  simple,
  medium,
  advanced,
  summaryTitle,
  summaryTagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adjusted timeline for square format - LinkedIn pacing (slower)
  const hookDuration = fps * 2; // 2 second hook
  const levelDuration = fps * 6; // 6 seconds per level (more detail time)
  const summaryDuration = fps * 4;

  const simpleStart = hookDuration;
  const mediumStart = simpleStart + levelDuration;
  const advancedStart = mediumStart + levelDuration;
  const summaryStart = advancedStart + levelDuration;

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

      {/* Hook Scene */}
      <Sequence durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
          }}
        >
          <div
            style={{
              fontSize: 48,
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
              fontSize: 24,
              color: primaryColor,
              opacity: interpolate(frame, [20, 40], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Simple Level Detail */}
      <Sequence from={simpleStart} durationInFrames={levelDuration}>
        <SquareLevelDetail
          level="simple"
          config={simple}
          skillCommand={skillCommand}
                    startFrame={0}
        />
      </Sequence>

      {/* Medium Level Detail */}
      <Sequence from={mediumStart} durationInFrames={levelDuration}>
        <SquareLevelDetail
          level="medium"
          config={medium}
          skillCommand={skillCommand}
                    startFrame={0}
        />
      </Sequence>

      {/* Advanced Level Detail */}
      <Sequence from={advancedStart} durationInFrames={levelDuration}>
        <SquareLevelDetail
          level="advanced"
          config={advanced}
          skillCommand={skillCommand}
                    startFrame={0}
        />
      </Sequence>

      {/* Summary Scene */}
      <Sequence
        from={summaryStart}
        durationInFrames={Math.max(summaryDuration, durationInFrames - summaryStart)}
      >
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "#f8fafc",
            }}
          >
            {summaryTitle}
          </div>

          {/* 3x1 Grid Comparison */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              width: "100%",
              flex: 1,
            }}
          >
            {[
              { level: "simple" as const, config: simple },
              { level: "medium" as const, config: medium },
              { level: "advanced" as const, config: advanced },
            ].map(({ level, config }, index) => {
              const itemDelay = 8 + index * 6;
              const itemOpacity = interpolate(
                frame - summaryStart,
                [itemDelay, itemDelay + 15],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              );

              return (
                <div
                  key={level}
                  style={{
                    padding: 16,
                    backgroundColor: `${LEVEL_COLORS[level]}15`,
                    borderRadius: 12,
                    border: `2px solid ${LEVEL_COLORS[level]}`,
                    opacity: itemOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 32 }}>{LEVEL_EMOJIS[level]}</span>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: LEVEL_COLORS[level],
                        fontSize: 14,
                        marginBottom: 8,
                      }}
                    >
                      {level.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span>📁 {config.files.length} files</span>
                      <span>⏱️ {config.completionTime}</span>
                      {Object.entries(config.metrics)
                        .slice(0, 1)
                        .map(([key]) => (
                          <span key={key}>✓ {key}</span>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 18,
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            🎯 {summaryTagline}
          </div>

          {/* CTA */}
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 14,
              color: primaryColor,
              backgroundColor: `${primaryColor}15`,
              padding: "12px 20px",
              borderRadius: 8,
              border: `2px solid ${primaryColor}40`,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Try: {skillCommand}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
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

export default ProgressiveZoomSquare;
