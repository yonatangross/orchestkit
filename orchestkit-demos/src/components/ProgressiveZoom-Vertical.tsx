/**
 * ProgressiveZoom - Vertical 9:16 Variant
 *
 * Tutorial-style zooming for vertical format (TikTok/Reels)
 * Simplified content flow optimized for portrait orientation
 *
 * Format adjustments:
 * - TikTok: 20-40 cuts/min → Faster transitions between levels
 * - Hide side-by-side comparisons → Stack vertically or hide
 * - Focus on single-level detail view
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

export const progressiveZoomVerticalSchema = z.object({
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

export type ProgressiveZoomVerticalProps = z.infer<
  typeof progressiveZoomVerticalSchema
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

interface VerticalLevelDetailProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  startFrame: number;
}

const VerticalLevelDetail: React.FC<VerticalLevelDetailProps> = ({
  level,
  config,
  skillCommand,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  const containerOpacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
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
        padding: 20,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        gap: 12,
      }}
    >
      {/* Compact header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 20 }}>{LEVEL_EMOJIS[level]}</div>
        <div>
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: levelColor,
            }}
          >
            {level.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              color: "#94a3b8",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {skillCommand}
          </div>
        </div>
      </div>

      {/* Content area - vertical stack */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Folder tree */}
        <LiveFolderTree
          files={config.files.slice(0, 4) as FileNode[]}
          primaryColor={levelColor}
          startFrame={startFrame + 10}
        />

        {/* Claude response */}
        <CompactClaudeResponse
          lines={config.claudeResponse.slice(0, 3)}
          startFrame={startFrame + 15}
          primaryColor={levelColor}
        />

        {/* Metrics row */}
        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 10,
          }}
        >
          <MetricBadge
            icon="⏱️"
            label="Time"
            value={config.completionTime}
            color={levelColor}
          />
          <MetricBadge
            icon="📁"
            label="Files"
            value={config.files.length.toString()}
            color={levelColor}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MetricBadge: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 8,
      backgroundColor: `${color}15`,
      borderRadius: 8,
      border: `1px solid ${color}40`,
      gap: 4,
    }}
  >
    <span style={{ fontSize: 12 }}>{icon}</span>
    <span
      style={{
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 11,
        fontWeight: 700,
        color,
      }}
    >
      {value}
    </span>
    <span style={{ fontSize: 8, color: "#6b7280" }}>{label}</span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressiveZoomVertical: React.FC<
  ProgressiveZoomVerticalProps
> = ({
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

  // Adjusted timeline for vertical/TikTok pacing
  const hookDuration = fps * 1; // 1 second hook
  const levelDuration = fps * 4; // 4 seconds per level (faster than horizontal)
  const summaryDuration = fps * 3; // 3 seconds summary

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
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}15 0%, transparent 60%)`,
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
            padding: 24,
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

      {/* Simple Level Detail */}
      <Sequence from={simpleStart} durationInFrames={levelDuration}>
        <VerticalLevelDetail
          level="simple"
          config={simple}
          skillCommand={skillCommand}
          startFrame={0}
        />
      </Sequence>

      {/* Medium Level Detail */}
      <Sequence from={mediumStart} durationInFrames={levelDuration}>
        <VerticalLevelDetail
          level="medium"
          config={medium}
          skillCommand={skillCommand}
          startFrame={0}
        />
      </Sequence>

      {/* Advanced Level Detail */}
      <Sequence from={advancedStart} durationInFrames={levelDuration}>
        <VerticalLevelDetail
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
            padding: 20,
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#f8fafc",
            }}
          >
            {summaryTitle}
          </div>

          {/* Comparison - Stacked vertically */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
          >
            {[
              { level: "simple" as const, config: simple },
              { level: "medium" as const, config: medium },
              { level: "advanced" as const, config: advanced },
            ].map(({ level, config }, index) => {
              const itemDelay = 5 + index * 3;
              const itemOpacity = interpolate(
                frame - summaryStart,
                [itemDelay, itemDelay + 10],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              );

              return (
                <div
                  key={level}
                  style={{
                    padding: 12,
                    backgroundColor: `${LEVEL_COLORS[level]}15`,
                    borderRadius: 8,
                    border: `2px solid ${LEVEL_COLORS[level]}`,
                    opacity: itemOpacity,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{LEVEL_EMOJIS[level]}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: LEVEL_COLORS[level],
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      {level.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span>📁 {config.files.length}</span>
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
              fontSize: 14,
              color: "#94a3b8",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            🎯 {summaryTagline}
          </div>

          {/* CTA */}
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              color: primaryColor,
              backgroundColor: `${primaryColor}15`,
              padding: "8px 12px",
              borderRadius: 6,
              border: `1px solid ${primaryColor}40`,
              textAlign: "center",
              width: "100%",
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

export default ProgressiveZoomVertical;
