/**
 * ProgressiveZoom - Tutorial-Style Demo Template
 *
 * Shows a single user-invocable skill by zooming into each difficulty level
 * sequentially. Better for tutorials and detailed explanations.
 *
 * Flow:
 * 1. Overview showing all 3 levels (small preview)
 * 2. Zoom into Simple level (detailed view)
 * 3. Zoom into Medium level (detailed view)
 * 4. Zoom into Advanced level (detailed view)
 * 5. Zoom out to Summary
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
  LevelBadge,
  SkillReferences,
  CompactClaudeResponse,
  CodePreview,
} from "./shared";
import type { FileNode, SkillReference, DifficultyLevel } from "./shared";

// Reuse the level config schema from TriTerminalRace
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

export const progressiveZoomSchema = z.object({
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

export type ProgressiveZoomProps = z.infer<typeof progressiveZoomSchema>;

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface LevelDetailProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  primaryColor: string;
  startFrame: number;
}

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

const LevelDetail: React.FC<LevelDetailProps> = ({
  level,
  config,
  skillCommand,
  primaryColor,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // Entry animation
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
        padding: 48,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
      }}
    >
      {/* Level Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <LevelBadge level={level} size="large" startFrame={startFrame} />
        <div>
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 700,
              color: levelColor,
            }}
          >
            {level.toUpperCase()} LEVEL
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 16,
              color: "#94a3b8",
            }}
          >
            {skillCommand} "{config.description}"
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div
        style={{
          display: "flex",
          gap: 24,
          flex: 1,
        }}
      >
        {/* Left: Folder tree + References */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <LiveFolderTree
            files={config.files as FileNode[]}
            primaryColor={levelColor}
            startFrame={startFrame + 10}
          />
          <SkillReferences
            references={config.references as SkillReference[]}
            primaryColor={levelColor}
            startFrame={startFrame + 20}
          />
        </div>

        {/* Right: Claude response + Code */}
        <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: 16 }}>
          <CompactClaudeResponse
            lines={config.claudeResponse}
            startFrame={startFrame + 15}
            primaryColor={levelColor}
          />
          {config.codeSnippet && (
            <CodePreview
              code={config.codeSnippet}
              primaryColor={levelColor}
              startFrame={startFrame + 30}
              typewriterSpeed={5}
            />
          )}
        </div>
      </div>

      {/* Bottom: Metrics */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "center",
          gap: 48,
        }}
      >
        <MetricBadge icon="⏱️" label="Time" value={config.completionTime} color={levelColor} />
        {Object.entries(config.metrics).slice(0, 3).map(([key, value]) => (
          <MetricBadge key={key} icon="✓" label={key} value={String(value)} color={levelColor} />
        ))}
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
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: "12px 24px",
      backgroundColor: `${color}15`,
      borderRadius: 12,
      border: `1px solid ${color}40`,
    }}
  >
    <span style={{ fontSize: 24 }}>{icon}</span>
    <span
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 24,
        fontWeight: 700,
        color,
      }}
    >
      {value}
    </span>
    <span
      style={{
        fontFamily: "Menlo, Monaco, monospace",
        fontSize: 12,
        color: "#6b7280",
      }}
    >
      {label}
    </span>
  </div>
);

// Preview card for overview
interface LevelPreviewProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  isActive: boolean;
  startFrame: number;
}

const LevelPreview: React.FC<LevelPreviewProps> = ({
  level,
  config,
  isActive,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  const scale = isActive
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 30, stiffness: 100 },
      }) * 1.1
    : 1;

  const opacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: isActive ? `${levelColor}20` : "#1a1a2e",
        borderRadius: 16,
        padding: 24,
        border: `2px solid ${isActive ? levelColor : "#2d2d4a"}`,
        transform: `scale(${scale})`,
        opacity,
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{LEVEL_EMOJIS[level]}</span>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: levelColor,
          }}
        >
          {level.toUpperCase()}
        </span>
      </div>
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 14,
          color: "#94a3b8",
          marginBottom: 12,
        }}
      >
        {config.description}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
        <span>📁 {config.files.length} files</span>
        <span>⏱️ {config.completionTime}</span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressiveZoom: React.FC<ProgressiveZoomProps> = ({
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

  // Timeline (25 seconds total)
  const hookDuration = fps * 2;
  const overviewDuration = fps * 3;
  const levelDuration = fps * 5; // 5 seconds per level
  void fps; // summaryDuration would be fps * 5

  const overviewStart = hookDuration;
  const simpleStart = overviewStart + overviewDuration;
  const mediumStart = simpleStart + levelDuration;
  const advancedStart = mediumStart + levelDuration;
  const summaryStart = advancedStart + levelDuration;
  // summaryDuration used to calculate total duration: hookDuration + overviewDuration + (levelDuration * 3) + summaryDuration

  // Determine which level is active for overview
  const activeLevel: DifficultyLevel | null =
    frame >= advancedStart
      ? "advanced"
      : frame >= mediumStart
        ? "medium"
        : frame >= simpleStart
          ? "simple"
          : null;

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

      {/* Overview Scene */}
      <Sequence from={overviewStart} durationInFrames={overviewDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#f8fafc",
              marginBottom: 32,
            }}
          >
            Three Levels of Complexity
          </div>
          <div style={{ display: "flex", gap: 24, width: "100%" }}>
            <LevelPreview
              level="simple"
              config={simple}
              isActive={activeLevel === "simple"}
              startFrame={0}
            />
            <LevelPreview
              level="medium"
              config={medium}
              isActive={activeLevel === "medium"}
              startFrame={5}
            />
            <LevelPreview
              level="advanced"
              config={advanced}
              isActive={activeLevel === "advanced"}
              startFrame={10}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Simple Level Detail */}
      <Sequence from={simpleStart} durationInFrames={levelDuration}>
        <LevelDetail
          level="simple"
          config={simple}
          skillCommand={skillCommand}
          primaryColor={primaryColor}
          startFrame={0}
        />
      </Sequence>

      {/* Medium Level Detail */}
      <Sequence from={mediumStart} durationInFrames={levelDuration}>
        <LevelDetail
          level="medium"
          config={medium}
          skillCommand={skillCommand}
          primaryColor={primaryColor}
          startFrame={0}
        />
      </Sequence>

      {/* Advanced Level Detail */}
      <Sequence from={advancedStart} durationInFrames={levelDuration}>
        <LevelDetail
          level="advanced"
          config={advanced}
          skillCommand={skillCommand}
          primaryColor={primaryColor}
          startFrame={0}
        />
      </Sequence>

      {/* Summary Scene */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: 32,
            }}
          >
            {summaryTitle}
          </div>

          {/* Comparison row */}
          <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
            {[
              { level: "simple" as const, config: simple },
              { level: "medium" as const, config: medium },
              { level: "advanced" as const, config: advanced },
            ].map(({ level, config }) => (
              <div
                key={level}
                style={{
                  padding: 24,
                  backgroundColor: `${LEVEL_COLORS[level]}15`,
                  borderRadius: 16,
                  border: `2px solid ${LEVEL_COLORS[level]}`,
                  minWidth: 200,
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
                <div style={{ fontSize: 14, color: "#94a3b8" }}>
                  <div>📁 {config.files.length} files</div>
                  <div>⏱️ {config.completionTime}</div>
                  {Object.entries(config.metrics).slice(0, 2).map(([key, value]) => (
                    <div key={key}>✓ {key}: {value}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 20,
              color: "#94a3b8",
              marginBottom: 16,
            }}
          >
            🎯 {summaryTagline}
          </div>

          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 18,
              color: primaryColor,
              backgroundColor: `${primaryColor}15`,
              padding: "12px 24px",
              borderRadius: 8,
            }}
          >
            Try it: {skillCommand}
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
          fontSize: 10,
          color: "#4b5563",
        }}
      >
        OrchestKit Demo
      </div>
    </AbsoluteFill>
  );
};

export default ProgressiveZoom;
